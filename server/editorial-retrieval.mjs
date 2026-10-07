import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadConceptRegistry } from "./concept-registry.mjs";

const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SERVER_DIRECTORY, "..");

const REFERENCE_SOURCES = Object.freeze({
  "system-contract": {
    title: "Canonical writing contract",
    path: "knowledge/SYSTEM_PROMPT.md",
  },
  "semantic-composition": {
    title: "Semantic composition",
    path: "knowledge/SEMANTIC_COMPOSITION.md",
  },
  "editorial-playbook": {
    title: "Editorial playbook",
    path: "knowledge/EDITORIAL_PLAYBOOK.md",
  },
  coherence: {
    title: "Text-world coherence",
    path: "knowledge/COHERENCE_PLAYBOOK.md",
  },
  "argument-reconstruction": {
    title: "Argument reconstruction",
    path: "knowledge/argument-reconstruction/SKILL.md",
  },
  "argument-evaluation": {
    title: "Argument evaluation standards",
    path: "knowledge/argument-reconstruction/references/evaluation-standards.md",
  },
  "argument-mapping": {
    title: "Argument mapping and tests",
    path: "knowledge/argument-reconstruction/references/mapping-and-tests.md",
  },
});

const STOP_WORDS = new Set([
  "about","after","again","against","also","because","been","before","being","between",
  "could","does","doing","from","have","into","more","most","only","other","over",
  "should","some","such","than","that","their","them","then","there","these","they",
  "this","through","under","very","what","when","where","which","while","with","would",
  "write","writing","writer","text","prose","user","make","need","want"
]);

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function tokens(value) {
  return [...new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  )];
}

function sourceRevision() {
  return (
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    "repository-deployment"
  );
}

function publicMethod(concept) {
  return {
    id: concept.id,
    name: concept.name,
    category: concept.category,
    description: concept.description,
    procedure: [...concept.procedure],
    triggers: [...concept.triggers],
    anti_triggers: [...concept.anti_triggers],
    exceptions: [...concept.exceptions],
    eval_criteria: {
      recognition: [...concept.eval_criteria.recognition],
      execution: [...concept.eval_criteria.execution],
    },
  };
}

function scoreConcept(concept, queryTokens, queryText) {
  const fields = {
    name: normalizeText(concept.name),
    description: normalizeText(concept.description),
    triggers: normalizeText(concept.triggers.join(" ")),
    procedure: normalizeText(concept.procedure.join(" ")),
    antiTriggers: normalizeText(concept.anti_triggers.join(" ")),
    exceptions: normalizeText(concept.exceptions.join(" ")),
    category: normalizeText(concept.category),
  };

  let score = 0;
  const matched = new Set();

  for (const token of queryTokens) {
    let tokenScore = 0;
    if (fields.name.includes(token)) tokenScore += 7;
    if (fields.description.includes(token)) tokenScore += 5;
    if (fields.triggers.includes(token)) tokenScore += 4;
    if (fields.procedure.includes(token)) tokenScore += 3;
    if (fields.category.includes(token)) tokenScore += 3;
    if (fields.antiTriggers.includes(token) || fields.exceptions.includes(token)) tokenScore += 1;
    if (tokenScore > 0) {
      score += tokenScore;
      matched.add(token);
    }
  }

  if (queryText && fields.name.includes(queryText)) score += 12;
  if (concept.id === "task-contract") score += 2;
  if (/voice|meaning|preserv/.test(queryText) && concept.id === "meaning-voice-fidelity") score += 8;
  if (/coher|timeline|chronolog|contradict|world/.test(queryText) && concept.category === "coherence") score += 7;
  if (/argument|premise|conclusion|logic|infer/.test(queryText) && concept.category === "argument-reasoning") score += 7;
  if (/source|fact|evidence|quotation|invent/.test(queryText) && concept.category === "source-discipline") score += 6;
  if (/proofread|edit|rewrite|compress|draft|mode/.test(queryText) && concept.id === "mode-boundary") score += 6;

  return { score, matchedTerms: [...matched] };
}

export function listReferenceIds() {
  return Object.keys(REFERENCE_SOURCES);
}

export async function searchWritingMethods({ query, category = "", limit = 5 } = {}) {
  if (typeof query !== "string" || !query.trim()) {
    throw Object.assign(new Error("query must be a non-empty string."), { status: 400 });
  }
  if (query.length > 1200) {
    throw Object.assign(new Error("query must be at most 1,200 characters."), { status: 400 });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) {
    throw Object.assign(new Error("limit must be an integer from 1 to 8."), { status: 400 });
  }

  const registry = await loadConceptRegistry();
  const normalizedQuery = normalizeText(query).trim();
  const queryTokens = tokens(query);
  let candidates = registry.concepts;

  if (category) {
    candidates = candidates.filter((concept) => concept.category === category);
    if (candidates.length === 0) {
      throw Object.assign(new Error(`Unknown or empty category: ${category}`), { status: 400 });
    }
  }

  const ranked = candidates
    .map((concept) => ({ concept, ...scoreConcept(concept, queryTokens, normalizedQuery) }))
    .sort((a, b) => b.score - a.score || a.concept.name.localeCompare(b.concept.name));

  const positive = ranked.filter(({ score }) => score > 0);
  const selected = (positive.length ? positive : ranked).slice(0, limit);

  return {
    registry_version: registry.registry_version,
    source_revision: sourceRevision(),
    query: query.trim(),
    methods: selected.map(({ concept, score, matchedTerms }) => ({
      ...publicMethod(concept),
      match_score: score,
      matched_terms: matchedTerms,
    })),
  };
}

export async function getWritingMethods({ ids } = {}) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 8) {
    throw Object.assign(new Error("ids must contain between 1 and 8 method ids."), { status: 400 });
  }
  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw Object.assign(new Error("Every method id must be a non-empty string."), { status: 400 });
  }

  const registry = await loadConceptRegistry();
  const byId = new Map(registry.concepts.map((concept) => [concept.id, concept]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw Object.assign(new Error(`Unknown method id(s): ${missing.join(", ")}`), { status: 400 });
  }

  return {
    registry_version: registry.registry_version,
    source_revision: sourceRevision(),
    methods: ids.map((id) => publicMethod(byId.get(id))),
  };
}

export async function getWritingReference({ reference } = {}) {
  if (typeof reference !== "string" || !REFERENCE_SOURCES[reference]) {
    throw Object.assign(
      new Error(`reference must be one of: ${listReferenceIds().join(", ")}`),
      { status: 400 },
    );
  }

  const source = REFERENCE_SOURCES[reference];
  const content = await readFile(path.join(PROJECT_DIRECTORY, source.path), "utf8");

  return {
    reference_id: reference,
    title: source.title,
    source_path: source.path,
    source_revision: sourceRevision(),
    content: content.trim(),
  };
}
