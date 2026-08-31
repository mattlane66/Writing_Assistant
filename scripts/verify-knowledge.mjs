import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "knowledge/SYSTEM_PROMPT.md",
  "knowledge/EDITORIAL_PLAYBOOK.md",
  "knowledge/COHERENCE_PLAYBOOK.md",
  "knowledge/SOURCE_MANIFEST.json",
  "knowledge/argument-reconstruction/SKILL.md",
  "knowledge/argument-reconstruction/references/evaluation-standards.md",
  "knowledge/argument-reconstruction/references/mapping-and-tests.md",
  "knowledge/argument-reconstruction/UPSTREAM.md",
];

const contents = new Map();
for (const relativePath of requiredFiles) {
  const value = await readFile(path.join(root, relativePath), "utf8");
  if (!value.trim()) throw new Error(`${relativePath} is empty.`);
  contents.set(relativePath, value);
}

const manifest = JSON.parse(contents.get("knowledge/SOURCE_MANIFEST.json"));
if (!Array.isArray(manifest.sources) || manifest.sources.length !== 7) {
  throw new Error("SOURCE_MANIFEST.json must describe exactly seven supplied PDFs.");
}

const ids = new Set();
for (const source of manifest.sources) {
  if (!source.id || ids.has(source.id)) throw new Error("Source ids must be present and unique.");
  ids.add(source.id);
  if (!Number.isInteger(source.pdf_pages) || source.pdf_pages < 1) {
    throw new Error(`${source.id} has an invalid PDF page count.`);
  }
  if (!/^[a-f0-9]{64}$/.test(source.sha256 ?? "")) {
    throw new Error(`${source.id} has an invalid SHA-256 digest.`);
  }
}

const prompt = contents.get("knowledge/SYSTEM_PROMPT.md");
for (const requirement of [
  "MODE BOUNDARY",
  "COHERENCE ROUTING",
  "SOURCE DISCIPLINE",
  "ARGUMENT ROUTING",
]) {
  if (!prompt.includes(requirement)) throw new Error(`SYSTEM_PROMPT.md is missing ${requirement}.`);
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
for (const protectedPattern of [".env.*", "*.pdf", "knowledge/vector-store.local.json"]) {
  if (!gitignore.includes(protectedPattern)) {
    throw new Error(`.gitignore must protect ${protectedPattern}.`);
  }
}

console.log(`Knowledge verified: ${manifest.sources.length} private sources, prompt, playbook, and Argument Reconstruction v2.`);
