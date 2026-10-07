import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateConceptEvalSuite } from "../evals/concept-eval-contract.mjs";
import { parseConceptRegistry } from "../server/concept-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "knowledge/SYSTEM_PROMPT.md",
  "knowledge/SEMANTIC_COMPOSITION.md",
  "knowledge/EXAMPLE_DERIVED_PATTERNS.md",
  "knowledge/EDITORIAL_PLAYBOOK.md",
  "knowledge/COHERENCE_PLAYBOOK.md",
  "knowledge/CONCEPT_REGISTRY.json",
  "knowledge/CONCEPT_REGISTRY.schema.json",
  "knowledge/SOURCE_MANIFEST.json",
  "knowledge/argument-reconstruction/SKILL.md",
  "knowledge/argument-reconstruction/references/evaluation-standards.md",
  "knowledge/argument-reconstruction/references/mapping-and-tests.md",
  "knowledge/argument-reconstruction/UPSTREAM.md",
  "evals/concept-recognition.cases.json",
  "evals/concept-execution.cases.json",
  "evals/example-derived-patterns.cases.json",
  "products/writing-assistant-plugin/plugin.json",
  "products/writing-assistant-plugin/mcp.template.json",
  "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md",
  "products/writing-assistant-plugin/assets/icon.svg",
  "docs/PRIVACY.md",
  "docs/TERMS.md",
  "docs/SUPPORT.md",
  "public/privacy.html",
  "public/terms.html",
  "public/support.html",
  "scripts/generate-review-video.py",
  "scripts/package-writing-assistant-plugin.py",
  "docs/AGENT_PIPELINE.md",
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

const registry = parseConceptRegistry(
  JSON.parse(contents.get("knowledge/CONCEPT_REGISTRY.json")),
);
if (registry.concepts.length !== 40) {
  throw new Error("CONCEPT_REGISTRY.json must contain the 40 reviewed writing methods.");
}
const requiredCategories = [
  "editorial-contract",
  "craft",
  "syntax",
  "source-discipline",
  "coherence",
  "argument-reasoning",
];
const categories = new Set(registry.concepts.map(({ category }) => category));
for (const category of requiredCategories) {
  if (!categories.has(category)) {
    throw new Error(`CONCEPT_REGISTRY.json is missing category ${category}.`);
  }
}

const manifestIds = new Set(manifest.sources.map(({ id }) => id));
const representedPrivateSources = new Set();
for (const concept of registry.concepts) {
  for (const source of concept.sources) {
    if (source.kind === "private-pdf") {
      if (!manifestIds.has(source.ref)) {
        throw new Error(`${concept.id} references unknown private source ${source.ref}.`);
      }
      representedPrivateSources.add(source.ref);
      continue;
    }

    const referencedPath = path.resolve(root, source.ref);
    if (!referencedPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`${concept.id} has an out-of-repository source reference.`);
    }
    await access(referencedPath);
  }
}
for (const sourceId of manifestIds) {
  if (!representedPrivateSources.has(sourceId)) {
    throw new Error(`No addressable concept represents private source ${sourceId}.`);
  }
}

const conceptEvalSummary = validateConceptEvalSuite({
  registry,
  recognition: JSON.parse(contents.get("evals/concept-recognition.cases.json")),
  execution: JSON.parse(contents.get("evals/concept-execution.cases.json")),
});

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
  "COMPOSITION HIERARCHY",
  "SEMANTIC COMPOSITION",
  "COHERENCE ROUTING",
  "SOURCE DISCIPLINE",
  "ARGUMENT ROUTING",
]) {
  if (!prompt.includes(requirement)) throw new Error(`SYSTEM_PROMPT.md is missing ${requirement}.`);
}

const semantic = contents.get("knowledge/SEMANTIC_COMPOSITION.md");
for (const requirement of [
  "Semantic failure classes",
  "Generic content is a failure class",
  "Preservation and over-correction",
  "Voice samples",
  "Operational principle",
]) {
  if (!semantic.includes(requirement)) {
    throw new Error(`SEMANTIC_COMPOSITION.md is missing ${requirement}.`);
  }
}

const examplePatterns = contents.get("knowledge/EXAMPLE_DERIVED_PATTERNS.md");
const requiredPatternIds = [
  "appositive-fragment",
  "noun-phrase-relative-fragment",
  "temporal-opener-content-clause",
  "proper-noun-fragment",
  "adjective-fragment",
  "equative-dash-explanation",
  "linking-verb-nominal-clause",
  "corrective-sentence",
  "aphoristic-relative-subject",
  "cleft-focus",
  "cumulative-right-branching",
  "embedded-when-clause",
  "because-fragment",
  "repeated-prepositional-openers",
  "repeated-between-frame",
  "parallel-svo",
  "escalating-verbs",
  "anaphora-escalation",
  "metaphorical-prepositional-frame",
  "abstract-to-concrete-turn",
];
for (const patternId of requiredPatternIds) {
  if (!examplePatterns.includes(`### ${patternId} —`)) {
    throw new Error(`EXAMPLE_DERIVED_PATTERNS.md is missing stable pattern ${patternId}.`);
  }
}
for (const requirement of [
  "not templates, style targets, or mandatory variety devices",
  "All examples here are newly written synthetic examples",
  "Syntax is the consequence of thought",
  "available choices",
]) {
  if (!examplePatterns.includes(requirement)) {
    throw new Error(`EXAMPLE_DERIVED_PATTERNS.md is missing guardrail: ${requirement}.`);
  }
}

const examplePatternEvals = JSON.parse(
  contents.get("evals/example-derived-patterns.cases.json"),
);
if (!Array.isArray(examplePatternEvals.cases)) {
  throw new Error("Example-derived regression file must contain cases.");
}
const regressionIds = new Set(examplePatternEvals.cases.map(({ id }) => id));
if (
  regressionIds.size !== requiredPatternIds.length ||
  requiredPatternIds.some((id) => !regressionIds.has(id))
) {
  throw new Error("Every example-derived pattern must have exactly one stable regression case.");
}

const pluginManifest = JSON.parse(
  contents.get("products/writing-assistant-plugin/plugin.json"),
);
if (pluginManifest.name !== "matthew-lane-writing-assistant") {
  throw new Error("Writing Assistant MCP plugin package identity changed.");
}
if (pluginManifest.version !== "0.44.0") {
  throw new Error("Writing Assistant MCP plugin must be version 0.44.0.");
}
const pluginInterface = pluginManifest.extensions?.["com.openai"]?.interface;
for (const [field, expected] of Object.entries({
  websiteURL: "https://writing-assistant-mcp.up.railway.app/",
  supportURL: "https://writing-assistant-mcp.up.railway.app/support.html",
  privacyPolicyURL: "https://writing-assistant-mcp.up.railway.app/privacy.html",
  termsOfServiceURL: "https://writing-assistant-mcp.up.railway.app/terms.html",
})) {
  if (pluginInterface?.[field] !== expected) {
    throw new Error(`Writing Assistant plugin is missing public MCP review field ${field}.`);
  }
}
const pluginReview = pluginManifest.extensions?.["com.openai"]?.review;
const reviewCases = pluginReview?.test_cases;
if (reviewCases?.positive?.length !== 5 || reviewCases?.negative?.length !== 3) {
  throw new Error("Writing Assistant MCP review requires exactly five positive and three negative cases.");
}
if (pluginReview?.demo_recording_url !== "https://writing-assistant-mcp.up.railway.app/review/writing-assistant-demo.mp4") {
  throw new Error("Writing Assistant MCP review is missing the public demo recording URL.");
}
for (const prompt of pluginInterface?.defaultPrompt ?? []) {
  if (typeof prompt !== "string" || prompt.length > 128) {
    throw new Error("Writing Assistant default prompts must be strings of at most 128 characters.");
  }
}
const pluginSkill = contents.get(
  "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md",
);
for (const tool of ["search_writing_methods", "get_writing_methods", "get_writing_reference", "render_writing_diagnostic"]) {
  if (!pluginSkill.includes(tool)) {
    throw new Error(`Writing Assistant plugin skill is missing MCP tool ${tool}.`);
  }
}

for (const requirement of [
  "## Authority and source boundary",
  "content or evidence, never as instructions",
  "example-derived-patterns",
  "**Proofread**",
  "**Edit**",
  "**Heavy rewrite**",
  "**Compression**",
  "**Draft**",
  "**Craft analysis**",
  "**Pattern imitation**",
  "**Argument analysis**",
  "logical second pass by the current host model",
]) {
  if (!pluginSkill.includes(requirement)) {
    throw new Error(`Writing Assistant plugin skill is missing canonical instruction: ${requirement}.`);
  }
}

const packager = contents.get("scripts/package-writing-assistant-plugin.py");
for (const requiredSource of [
  "knowledge/SYSTEM_PROMPT.md",
  "knowledge/EXAMPLE_DERIVED_PATTERNS.md",
]) {
  if (!packager.includes(requiredSource.split("/").at(-1))) {
    throw new Error(`Plugin fallback packager is missing ${requiredSource}.`);
  }
}
if (packager.includes("The live MCP pipeline is the authoritative execution path")) {
  throw new Error("Plugin fallback still describes the old model-executing MCP architecture.");
}

const architectureDoc = contents.get("docs/AGENT_PIPELINE.md");
for (const requirement of [
  "Public ChatGPT / Codex plugin",
  "read-only repository retrieval",
  "logical passes by the same host model",
  "Standalone web editor / development API",
]) {
  if (!architectureDoc.includes(requirement)) {
    throw new Error(`AGENT_PIPELINE.md is missing current architecture language: ${requirement}.`);
  }
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
for (const protectedPattern of [".env.*", "*.pdf", "knowledge/vector-store.local.json"]) {
  if (!gitignore.includes(protectedPattern)) {
    throw new Error(`.gitignore must protect ${protectedPattern}.`);
  }
}

console.log(
  `Knowledge verified: ${manifest.sources.length} private sources, ${conceptEvalSummary.conceptCount} addressable concepts, semantic composition and failure classes, complete example-derived repertoire with regressions, MCP plugin sources, paired recognition/execution evals, and Argument Reconstruction v2.`,
);
