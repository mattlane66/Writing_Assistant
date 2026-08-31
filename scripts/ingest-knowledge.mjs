import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import OpenAI from "openai";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SCRIPT_DIRECTORY, "..");
const KNOWLEDGE_DIRECTORY = path.join(PROJECT_DIRECTORY, "knowledge");
const ENV_FILE = path.join(PROJECT_DIRECTORY, ".env.local");
const RECEIPT_FILE = path.join(KNOWLEDGE_DIRECTORY, "vector-store.local.json");
const VECTOR_STORE_VARIABLE = "OPENAI_VECTOR_STORE_ID";
const LOGIC_SKILL_VERSION = "2.0.0";
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 30 * 60 * 1_000;

const LOGIC_KNOWLEDGE_FILES = Object.freeze([
  path.join(KNOWLEDGE_DIRECTORY, "COHERENCE_PLAYBOOK.md"),
  path.join(KNOWLEDGE_DIRECTORY, "argument-reconstruction", "SKILL.md"),
  path.join(
    KNOWLEDGE_DIRECTORY,
    "argument-reconstruction",
    "references",
    "evaluation-standards.md",
  ),
  path.join(
    KNOWLEDGE_DIRECTORY,
    "argument-reconstruction",
    "references",
    "mapping-and-tests.md",
  ),
]);

dotenv.config({ path: ENV_FILE, override: false, quiet: true });

function usage() {
  return `Usage:
  npm run knowledge:ingest -- "/absolute/path/to/guide-one.pdf" "/absolute/path/to/guide-two.pdf"

The command creates one OpenAI vector store, uploads every supplied PDF plus the
vendored argument-reconstruction skill, waits for indexing, and saves the vector
store ID to .env.local.`;
}

function sanitizeErrorMessage(error) {
  const fallback = "Knowledge ingestion failed.";
  if (!error) return fallback;

  const raw = typeof error.message === "string" ? error.message : String(error);
  return raw
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/OPENAI_API_KEY\s*=\s*\S+/gi, "OPENAI_API_KEY=[redacted]")
    .slice(0, 800);
}

async function validateInputFiles(arguments_) {
  if (arguments_.length === 0) {
    throw new Error(`No PDF paths were provided.\n\n${usage()}`);
  }

  const resolved = Array.from(
    new Set(arguments_.map((argument) => path.resolve(process.cwd(), argument))),
  );

  for (const filePath of resolved) {
    if (path.extname(filePath).toLowerCase() !== ".pdf") {
      throw new Error(`Expected a PDF path, but received: ${path.basename(filePath)}`);
    }

    let metadata;
    try {
      metadata = await stat(filePath);
    } catch {
      throw new Error(`Cannot read PDF: ${path.basename(filePath)}`);
    }

    if (!metadata.isFile()) {
      throw new Error(`PDF path is not a file: ${path.basename(filePath)}`);
    }
  }

  for (const filePath of LOGIC_KNOWLEDGE_FILES) {
    let metadata;
    try {
      metadata = await stat(filePath);
    } catch {
      throw new Error(`Missing vendored logic knowledge: ${path.basename(filePath)}`);
    }

    if (!metadata.isFile()) {
      throw new Error(`Logic knowledge path is not a file: ${path.basename(filePath)}`);
    }
  }

  return [...resolved, ...LOGIC_KNOWLEDGE_FILES];
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollFileBatch(client, vectorStoreId, initialBatch) {
  const startedAt = Date.now();
  let batch = initialBatch;

  while (batch.status === "in_progress") {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("Vector-store indexing did not finish within 30 minutes.");
    }

    await sleep(POLL_INTERVAL_MS);
    batch = await client.vectorStores.fileBatches.retrieve(batch.id, {
      vector_store_id: vectorStoreId,
    });
  }

  return batch;
}

function upsertEnvironmentValue(contents, name, value) {
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();

  const assignment = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
  const updated = [];
  let replaced = false;

  for (const line of lines) {
    if (!assignment.test(line)) {
      updated.push(line);
      continue;
    }

    if (!replaced) {
      updated.push(`${name}=${value}`);
      replaced = true;
    }
  }

  if (!replaced) updated.push(`${name}=${value}`);
  return `${updated.join(newline)}${newline}`;
}

async function updateLocalEnvironment(vectorStoreId) {
  if (!/^vs_[A-Za-z0-9_-]+$/.test(vectorStoreId)) {
    throw new Error("OpenAI returned an invalid vector-store ID.");
  }

  let existing = "";
  try {
    existing = await readFile(ENV_FILE, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const updated = upsertEnvironmentValue(
    existing,
    VECTOR_STORE_VARIABLE,
    vectorStoreId,
  );
  const temporaryFile = `${ENV_FILE}.${process.pid}.tmp`;

  try {
    await writeFile(temporaryFile, updated, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, ENV_FILE);
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
}

async function writeReceipt(receipt) {
  await mkdir(KNOWLEDGE_DIRECTORY, { recursive: true });
  const temporaryFile = `${RECEIPT_FILE}.${process.pid}.tmp`;
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;

  try {
    await writeFile(temporaryFile, serialized, { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, RECEIPT_FILE);
  } catch (error) {
    await unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
}

async function retrieveFileStatuses(client, vectorStoreId, uploadedFiles) {
  return Promise.all(
    uploadedFiles.map(async (file) => {
      try {
        const vectorFile = await client.vectorStores.files.retrieve(file.fileId, {
          vector_store_id: vectorStoreId,
        });
        return {
          filename: file.filename,
          fileId: file.fileId,
          status: vectorFile.status,
          ...(vectorFile.last_error
            ? { error: sanitizeErrorMessage(vectorFile.last_error.message) }
            : {}),
        };
      } catch (error) {
        return {
          filename: file.filename,
          fileId: file.fileId,
          status: "unknown",
          error: sanitizeErrorMessage(error),
        };
      }
    }),
  );
}

export async function ingestKnowledge(pdfArguments) {
  const apiKey = typeof process.env.OPENAI_API_KEY === "string"
    ? process.env.OPENAI_API_KEY.trim()
    : "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing from .env.local.");
  }

  const inputFiles = await validateInputFiles(pdfArguments);
  const client = new OpenAI({ apiKey });
  const receipt = {
    createdAt: new Date().toISOString(),
    status: "in_progress",
    logicSkillVersion: LOGIC_SKILL_VERSION,
    vectorStore: null,
    batch: null,
    files: [],
  };

  try {
    console.log("Creating the Writing Assistant knowledge store...");
    const vectorStore = await client.vectorStores.create({
      name: `Writing Assistant Knowledge ${new Date().toISOString().slice(0, 10)}`,
    });
    receipt.vectorStore = {
      id: vectorStore.id,
      name: vectorStore.name || "Writing Assistant Knowledge",
      status: vectorStore.status || "in_progress",
    };

    const uploadedFiles = [];
    for (const filePath of inputFiles) {
      const filename = path.basename(filePath);
      console.log(`Uploading ${filename}...`);
      const uploaded = await client.files.create({
        file: createReadStream(filePath),
        purpose: "assistants",
      });
      const entry = {
        filename,
        fileId: uploaded.id,
        status: "uploaded",
      };
      uploadedFiles.push(entry);
      receipt.files.push(entry);
    }

    console.log("Indexing uploaded knowledge...");
    const initialBatch = await client.vectorStores.fileBatches.create(
      vectorStore.id,
      { file_ids: uploadedFiles.map((file) => file.fileId) },
    );
    const batch = await pollFileBatch(client, vectorStore.id, initialBatch);
    receipt.batch = {
      id: batch.id,
      status: batch.status,
      fileCounts: batch.file_counts,
    };
    receipt.files = await retrieveFileStatuses(
      client,
      vectorStore.id,
      uploadedFiles,
    );
    receipt.vectorStore.status = batch.status;

    const failedFiles = receipt.files.filter((file) => file.status !== "completed");
    const failedCount = batch.file_counts?.failed || 0;
    const cancelledCount = batch.file_counts?.cancelled || 0;
    if (
      batch.status !== "completed" ||
      failedCount > 0 ||
      cancelledCount > 0 ||
      failedFiles.length > 0
    ) {
      receipt.status = "failed";
      await writeReceipt(receipt);
      throw new Error(
        `Vector-store indexing finished with ${failedFiles.length || failedCount + cancelledCount} unsuccessful file(s).`,
      );
    }

    await updateLocalEnvironment(vectorStore.id);
    receipt.status = "completed";
    receipt.completedAt = new Date().toISOString();
    receipt.environmentUpdated = true;
    await writeReceipt(receipt);

    console.log(
      `Knowledge ready: ${receipt.files.length} files indexed in vector store ${vectorStore.id}.`,
    );
    console.log("OPENAI_VECTOR_STORE_ID was saved to .env.local; restart the API if it is running.");
    return receipt;
  } catch (error) {
    receipt.status = "failed";
    receipt.failedAt = new Date().toISOString();
    receipt.error = sanitizeErrorMessage(error);
    await writeReceipt(receipt).catch(() => undefined);
    throw error;
  }
}

async function main() {
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
  if (arguments_.includes("--help") || arguments_.includes("-h")) {
    console.log(usage());
    return;
  }

  await ingestKnowledge(arguments_);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(sanitizeErrorMessage(error));
    process.exitCode = 1;
  });
}
