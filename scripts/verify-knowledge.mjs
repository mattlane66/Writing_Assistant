import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateConceptEvalSuite } from "../evals/concept-eval-contract.mjs";
import { parseConceptRegistry } from "../server/concept-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "knowledge/SYSTEM_PROMPT.md",
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

console.log(
  `Knowledge verified: ${manifest.sources.length} private sources, ${conceptEvalSummary.conceptCount} addressable concepts, paired recognition/execution evals, and Argument Reconstruction v2.`,
);
