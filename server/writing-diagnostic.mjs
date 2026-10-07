import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadConceptRegistry } from "./concept-registry.mjs";

const require = createRequire(import.meta.url);
const { buildDiagnostic } = require("../products/writing-diagnostic/server/core.js");
const { DIAGNOSTIC_INPUT, DIAGNOSTIC_OUTPUT } = require("../products/writing-diagnostic/server/schemas.js");
const { validate } = require("../products/writing-diagnostic/server/validation.js");

const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SERVER_DIRECTORY, "..");
const WIDGET_PATH = path.join(
  PROJECT_DIRECTORY,
  "products",
  "writing-diagnostic",
  "public",
  "diagnostic-widget.html",
);

export const WRITING_DIAGNOSTIC_UI_URI =
  "ui://writing-assistant/diagnostic-v1.2.1.html";

const EDITING_MODES = Object.freeze([
  "proofread",
  "edit",
  "heavy-rewrite",
  "compression",
  "draft",
  "craft-analysis",
  "pattern-imitation",
  "argument-analysis",
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

function methodIdsSchema() {
  return {
    type: "array",
    minItems: 1,
    maxItems: 8,
    uniqueItems: true,
    items: {
      type: "string",
      minLength: 1,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    },
  };
}

function integratedInputSchema() {
  const schema = clone(DIAGNOSTIC_INPUT);
  schema.properties.editing_mode = {
    type: "string",
    enum: EDITING_MODES,
    description:
      "The narrowest Writing Assistant mode authorized by the user. The later revision must remain within this boundary.",
  };
  schema.required.push("editing_mode");

  for (const key of ["findings", "whole_passage_checks"]) {
    const item = schema.properties[key].items;
    item.properties.method_ids = methodIdsSchema();
    item.required.push("method_ids");
  }

  return schema;
}

function integratedOutputSchema() {
  const schema = clone(DIAGNOSTIC_OUTPUT);
  for (const key of ["findings", "whole_passage_checks"]) {
    const item = schema.properties[key].items;
    item.properties.method_ids = methodIdsSchema();
    item.required.push("method_ids");
  }
  schema.properties.integration = {
    type: "object",
    additionalProperties: false,
    required: [
      "registry_version",
      "source_revision",
      "editing_mode",
      "passage_digest",
      "diagnostic_id",
    ],
    properties: {
      registry_version: { type: "string", minLength: 1 },
      source_revision: { type: "string", minLength: 1 },
      editing_mode: { type: "string", enum: EDITING_MODES },
      passage_digest: {
        type: "string",
        pattern: "^[a-f0-9]{16}$",
      },
      diagnostic_id: {
        type: "string",
        pattern: "^wad-[a-f0-9]{16}$",
      },
    },
  };
  schema.required.push("integration");
  return schema;
}

export const WRITING_DIAGNOSTIC_INPUT_SCHEMA = Object.freeze(
  integratedInputSchema(),
);
export const WRITING_DIAGNOSTIC_OUTPUT_SCHEMA = Object.freeze(
  integratedOutputSchema(),
);

function sourceRevision() {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "repository-deployment"
  );
}

function passageDigest(passage) {
  return createHash("sha256").update(passage, "utf8").digest("hex").slice(0, 16);
}

function stripIntegrationFields(finding) {
  const rest = { ...finding };
  delete rest.method_ids;
  return rest;
}

function validateMethodLinks(registry, findings) {
  const known = new Set(registry.concepts.map(({ id }) => id));
  for (const finding of findings) {
    const unknown = finding.method_ids.filter((id) => !known.has(id));
    if (unknown.length) {
      throw Object.assign(
        new Error(
          `Finding ${finding.id} links unknown canonical method id(s): ${unknown.join(", ")}.`,
        ),
        { status: 400 },
      );
    }
  }
}

export async function buildWritingAssistantDiagnostic(args = {}) {
  try {
    validate(WRITING_DIAGNOSTIC_INPUT_SCHEMA, args);
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }

  const registry = await loadConceptRegistry();
  const suppliedFindings = [
    ...args.findings,
    ...(args.whole_passage_checks || []),
  ];
  validateMethodLinks(registry, suppliedFindings);

  let base;
  try {
    base = buildDiagnostic({
      passage: args.passage,
      findings: args.findings.map(stripIntegrationFields),
      whole_passage_checks: (args.whole_passage_checks || []).map(
        stripIntegrationFields,
      ),
    });
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }

  const methodsById = new Map(
    suppliedFindings.map((finding) => [finding.id, [...finding.method_ids]]),
  );
  const digest = passageDigest(args.passage);
  const payload = {
    ...base,
    findings: base.findings.map((finding) => ({
      ...finding,
      method_ids: methodsById.get(finding.id),
    })),
    whole_passage_checks: base.whole_passage_checks.map((finding) => ({
      ...finding,
      method_ids: methodsById.get(finding.id),
    })),
    integration: {
      registry_version: registry.registry_version,
      source_revision: sourceRevision(),
      editing_mode: args.editing_mode,
      passage_digest: digest,
      diagnostic_id: `wad-${digest}`,
    },
  };

  try {
    validate(WRITING_DIAGNOSTIC_OUTPUT_SCHEMA, payload, "result");
  } catch (error) {
    throw Object.assign(error, { status: 500 });
  }
  return payload;
}

export function getWritingDiagnosticResourceList() {
  return [
    {
      uri: WRITING_DIAGNOSTIC_UI_URI,
      name: "Writing Assistant diagnostic",
      description:
        "Interactive marked prose, calibrated findings, canonical method provenance, and user-selected repair directions.",
      mimeType: "text/html;profile=mcp-app",
    },
  ];
}

export async function readWritingDiagnosticResource(uri) {
  if (uri !== WRITING_DIAGNOSTIC_UI_URI) {
    throw Object.assign(new Error("Unknown UI resource."), { status: 400 });
  }

  return {
    contents: [
      {
        uri: WRITING_DIAGNOSTIC_UI_URI,
        mimeType: "text/html;profile=mcp-app",
        text: await readFile(WIDGET_PATH, "utf8"),
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains: [] },
          },
          "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
          "openai/widgetDescription":
            "Inspect marked writing, see the canonical Writing Assistant methods behind each judgment, choose Keep it or a repair direction, then send those decisions back to the conversation for bounded revision.",
        },
      },
    ],
  };
}
