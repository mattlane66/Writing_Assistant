import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import dotenv from "dotenv";
import express from "express";

import {
  AgentPipelineError,
  MODE_INSTRUCTIONS,
  PIPELINE_VERSION,
  runBoundedAgentPipeline,
} from "./agent-pipeline.mjs";
import {
  CONCEPT_REGISTRY_PATH,
  ConceptRegistryError,
  loadConceptRegistry,
} from "./concept-registry.mjs";

const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SERVER_DIRECTORY, "..");
const ENV_FILE = path.join(PROJECT_DIRECTORY, ".env.local");
const DIST_DIRECTORY = path.join(PROJECT_DIRECTORY, "dist");
const DIST_INDEX = path.join(DIST_DIRECTORY, "index.html");

export const KNOWLEDGE_SOURCE_COUNT = 7;
export const LOGIC_SKILL_VERSION = "2.0.0";
export const DEFAULT_MODEL = "gpt-5.6";
export const MAX_DRAFT_CHARACTERS = 30_000;
export const REQUEST_TIMEOUT_MS = 120_000;

const KNOWLEDGE_FILES = Object.freeze([
  {
    label: "Canonical system prompt",
    path: path.join(PROJECT_DIRECTORY, "knowledge", "SYSTEM_PROMPT.md"),
    authority: "operating guidance",
  },
  {
    label: "Editorial playbook",
    path: path.join(PROJECT_DIRECTORY, "knowledge", "EDITORIAL_PLAYBOOK.md"),
    authority: "operating guidance",
  },
  {
    label: "Text-world coherence playbook",
    path: path.join(PROJECT_DIRECTORY, "knowledge", "COHERENCE_PLAYBOOK.md"),
    authority: "reasoning methodology",
  },
  {
    label: "Argument reconstruction skill",
    path: path.join(
      PROJECT_DIRECTORY,
      "knowledge",
      "argument-reconstruction",
      "SKILL.md",
    ),
    authority: "reasoning methodology",
  },
  {
    label: "Argument evaluation standards",
    path: path.join(
      PROJECT_DIRECTORY,
      "knowledge",
      "argument-reconstruction",
      "references",
      "evaluation-standards.md",
    ),
    authority: "reasoning methodology",
  },
  {
    label: "Argument mapping and tests",
    path: path.join(
      PROJECT_DIRECTORY,
      "knowledge",
      "argument-reconstruction",
      "references",
      "mapping-and-tests.md",
    ),
    authority: "reasoning methodology",
  },
  {
    label: "Concept registry",
    path: CONCEPT_REGISTRY_PATH,
    authority: "addressable method registry",
  },
]);

const ALLOWED_MODES = new Set(Object.keys(MODE_INSTRUCTIONS));

dotenv.config({ path: ENV_FILE, override: false, quiet: true });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function environmentValue(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function configuredModel() {
  return environmentValue("OPENAI_MODEL") || DEFAULT_MODEL;
}

function configuredVectorStore() {
  return environmentValue("OPENAI_VECTOR_STORE_ID");
}

function countCharacters(value) {
  return Array.from(value).length;
}

function validateRevisionBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const { draft } = body;
  const direction = body.direction ?? "";
  const mode = body.mode ?? "edit";
  const ceiling = body.ceiling ?? false;

  if (typeof draft !== "string" || draft.trim().length === 0) {
    throw new HttpError(400, "Draft must be a non-empty string.");
  }

  if (countCharacters(draft) > MAX_DRAFT_CHARACTERS) {
    throw new HttpError(
      400,
      `Draft cannot exceed ${MAX_DRAFT_CHARACTERS.toLocaleString("en-US")} characters.`,
    );
  }

  if (typeof direction !== "string") {
    throw new HttpError(400, "Direction must be a string.");
  }

  if (countCharacters(direction) > MAX_DRAFT_CHARACTERS) {
    throw new HttpError(
      400,
      `Direction cannot exceed ${MAX_DRAFT_CHARACTERS.toLocaleString("en-US")} characters.`,
    );
  }

  if (typeof mode !== "string" || !ALLOWED_MODES.has(mode)) {
    throw new HttpError(
      400,
      `Mode must be one of: ${Array.from(ALLOWED_MODES).join(", ")}.`,
    );
  }

  if (typeof ceiling !== "boolean") {
    throw new HttpError(400, "Ceiling must be a boolean.");
  }

  return { draft, direction, mode, ceiling };
}

async function loadPipelineKnowledge() {
  try {
    const [systemPrompt, registry] = await Promise.all([
      readFile(path.join(PROJECT_DIRECTORY, "knowledge", "SYSTEM_PROMPT.md"), "utf8"),
      loadConceptRegistry(),
    ]);
    return { systemPrompt, registry };
  } catch (error) {
    if (error instanceof ConceptRegistryError) throw error;
    throw new HttpError(
      503,
      "The local writing knowledge is unavailable. Restore the knowledge files and try again.",
    );
  }
}

async function localKnowledgeStatus() {
  try {
    await Promise.all(KNOWLEDGE_FILES.map((file) => access(file.path)));
    const registry = await loadConceptRegistry();
    return { available: true, registryVersion: registry.registry_version };
  } catch {
    return { available: false, registryVersion: null };
  }
}

function requestAbortController(request, response, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;

  const abortIfRequestEndedEarly = () => {
    if (request.aborted) controller.abort();
  };
  const abortIfResponseClosedEarly = () => {
    if (!response.writableEnded) controller.abort();
  };

  request.once("aborted", abortIfRequestEndedEarly);
  request.once("close", abortIfRequestEndedEarly);
  response.once("close", abortIfResponseClosedEarly);
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    dispose() {
      clearTimeout(timer);
      request.off("aborted", abortIfRequestEndedEarly);
      request.off("close", abortIfRequestEndedEarly);
      response.off("close", abortIfResponseClosedEarly);
    },
  };
}

function safeErrorSummary(error) {
  const status = Number.isInteger(error?.status) ? error.status : undefined;
  const code =
    typeof error?.code === "string" && /^[a-z0-9_.-]{1,80}$/i.test(error.code)
      ? error.code
      : undefined;

  return [error?.name || "Error", status ? `status=${status}` : "", code ? `code=${code}` : ""]
    .filter(Boolean)
    .join(" ");
}

function publicError(error) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }

  if (
    error instanceof AgentPipelineError ||
    error instanceof ConceptRegistryError ||
    (Number.isInteger(error?.status) && typeof error?.publicMessage === "string")
  ) {
    return { status: error.status, message: error.publicMessage };
  }

  if (error?.type === "entity.too.large") {
    return { status: 413, message: "Request body is too large." };
  }

  if (error?.type === "entity.parse.failed") {
    return { status: 400, message: "Request body must contain valid JSON." };
  }

  if (error?.name === "TimeoutError") {
    return { status: 504, message: "The bounded writing pipeline timed out." };
  }

  if (error?.name === "AbortError") {
    return { status: 499, message: "The request was cancelled." };
  }

  if (
    error?.code === "credit_balance_exhausted" ||
    error?.code === "insufficient_quota"
  ) {
    return {
      status: 503,
      message:
        "This OpenAI project has no available API credits or has reached its spend limit. Add credits or raise the limit, then try again.",
    };
  }

  switch (error?.status) {
    case 400:
    case 404:
      return {
        status: 502,
        message:
          "OpenAI rejected the configured model, vector store, or request. Check the server configuration.",
      };
    case 401:
    case 403:
      return {
        status: 503,
        message: "OpenAI credentials were rejected. Check OPENAI_API_KEY and project access.",
      };
    case 408:
      return { status: 504, message: "OpenAI timed out before completing the revision." };
    case 429:
      return {
        status: 429,
        message: "OpenAI is rate-limited. Wait briefly, then try again.",
      };
    default:
      if (Number.isInteger(error?.status) && error.status >= 500) {
        return { status: 502, message: "OpenAI is temporarily unavailable. Try again shortly." };
      }
      return { status: 500, message: "The server could not complete the revision." };
  }
}

export function createApp({
  pipelineRunner = runBoundedAgentPipeline,
  pipelineKnowledgeLoader = loadPipelineKnowledge,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.use("/api", (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "256kb", strict: true }));

  app.get("/api/status", async (_request, response, next) => {
    try {
      const knowledge = await localKnowledgeStatus();
      const apiConfigured = Boolean(environmentValue("OPENAI_API_KEY"));
      const grounded = Boolean(configuredVectorStore());

      response.json({
        ready: apiConfigured && knowledge.available,
        model: configuredModel(),
        knowledgeSourceCount: KNOWLEDGE_SOURCE_COUNT,
        logicSkillVersion: LOGIC_SKILL_VERSION,
        grounded,
        agentic: true,
        pipelineVersion: PIPELINE_VERSION,
        registryVersion: knowledge.registryVersion,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/revise", async (request, response, next) => {
    const abort = requestAbortController(request, response, requestTimeoutMs);

    try {
      const revision = validateRevisionBody(request.body);
      if (!environmentValue("OPENAI_API_KEY")) {
        throw new HttpError(
          503,
          "OpenAI is not configured. Add OPENAI_API_KEY to .env.local and restart the server.",
        );
      }

      const { systemPrompt, registry } = await pipelineKnowledgeLoader();
      const model = configuredModel();
      const vectorStoreId = configuredVectorStore();
      const completion = await pipelineRunner({
        revision,
        model,
        vectorStoreId,
        registry,
        systemPrompt,
        signal: abort.signal,
      });

      response.json({
        result: completion.result,
        meta: {
          model,
          mode: revision.mode,
          ceiling: revision.ceiling,
          grounded: completion.grounded,
          pipeline: completion.pipeline,
        },
      });
    } catch (error) {
      if (abort.timedOut && !response.destroyed) {
        next(new HttpError(504, "The bounded writing pipeline timed out."));
      } else if (!abort.signal.aborted || !response.destroyed) {
        next(error);
      }
    } finally {
      abort.dispose();
    }
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API route not found." });
  });

  if (process.env.NODE_ENV === "production") {
    app.use(express.static(DIST_DIRECTORY, { index: false }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || !request.accepts("html")) {
        next();
        return;
      }

      response.sendFile(DIST_INDEX, (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const visible = publicError(error);
    if (process.env.NODE_ENV !== "test") {
      console.error(`[writing-assistant] ${safeErrorSummary(error)}`);
    }
    response.status(visible.status).json({ error: visible.message });
  });

  return app;
}

const app = createApp();

export default app;
