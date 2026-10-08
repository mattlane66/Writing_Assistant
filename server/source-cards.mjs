import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { loadConceptRegistry } from "./concept-registry.mjs";
import { buildLocalLatentIndex, scoreLocalLatentIndex } from "./source-semantic.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_CARDS_PATH = path.join(ROOT, "knowledge/SOURCE_CARDS.json");
const MANIFEST_PATH = path.join(ROOT, "knowledge/SOURCE_MANIFEST.json");
const NonEmpty = z.string().trim().min(1);
const List = z.array(NonEmpty).min(1).refine((items) => new Set(items).size === items.length);
const Practice = z.object({
  task: NonEmpty,
  invariants: List,
  alternatives: z.array(z.object({
    text: NonEmpty,
    when_to_prefer: NonEmpty,
    tradeoff: NonEmpty,
  }).strict()).min(1).max(3),
}).strict();
const Example = z.object({
  before: NonEmpty,
  after: NonEmpty,
  why: NonEmpty,
  practice: Practice.optional(),
}).strict().refine((example) => {
  const texts = example.practice?.alternatives.map((alternative) => alternative.text) ?? [];
  // Alternatives are distinct revisions, not permission to apply this method
  // everywhere. The separate counterexample records when to preserve a draft.
  return new Set(texts).size === texts.length && texts.every((text) => text !== example.before && text !== example.after);
}, "Practice alternatives must differ from one another and from the before/after example.");
const Source = z.object({
  kind: z.enum(["repository", "private-pdf"]),
  ref: NonEmpty,
  locator: NonEmpty,
  provenance: z.enum(["controlling-synthesis", "operational-synthesis", "vendored-method", "primary-reference", "secondary-corroboration"]),
  note: NonEmpty.optional(),
  caveat: NonEmpty,
}).strict();

export const SourceCardsSchema = z.object({
  schema_version: z.literal(1),
  corpus_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  method: z.literal("bm25+concept-tag-relations"),
  example_policy: z.literal("Original illustrative examples; not quotations or factual evidence."),
  cards: z.array(z.object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    concept_ids: List,
    title: NonEmpty,
    mechanism: NonEmpty,
    steps: List,
    triggers: List,
    exceptions: List,
    tags: List,
    example: Example,
    counterexample: z.object({ text: NonEmpty, why_not_apply: NonEmpty }).strict().optional(),
    sources: z.array(Source).min(1),
  }).strict()).min(1),
}).strict();

export class SourceCardsError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "SourceCardsError";
    this.status = 503;
    this.publicMessage = "The editorial source cards are unavailable or invalid. Restore them and try again.";
  }
}

function validateLocator(source, manifest, repositorySources, registry) {
  if (source.kind === "private-pdf") {
    const identity = manifest.sources.find((entry) => entry.id === source.ref);
    const match = /^PDF pp?\. (\d+)(?:-(\d+))?$/.exec(source.locator);
    if (!identity || !match) throw new SourceCardsError(`Invalid PDF source locator for ${source.ref}.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > identity.pdf_pages) {
      throw new SourceCardsError(`PDF source locator outside the supplied edition: ${source.ref}.`);
    }
    if (source.caveat !== identity.authority_notes) {
      throw new SourceCardsError(`Source authority caveat changed for ${source.ref}.`);
    }
    if (source.ref === "bookey-100-ways-summary" && source.provenance !== "secondary-corroboration") {
      throw new SourceCardsError("The Bookey summary is corroborative, not a primary Provost source.");
    }
    return;
  }

  const registeredRefs = new Set(registry.concepts.flatMap((concept) => concept.sources)
    .filter((entry) => entry.kind === "repository").map((entry) => entry.ref));
  if (!registeredRefs.has(source.ref) || source.ref.includes("..") || path.isAbsolute(source.ref)) {
    throw new SourceCardsError(`Unregistered repository reference: ${source.ref}.`);
  }
  const content = repositorySources[source.ref];
  if (typeof content !== "string") throw new SourceCardsError(`Repository reference unavailable: ${source.ref}.`);
  if (source.ref.endsWith(".json")) {
    let cursor = JSON.parse(content);
    for (const segment of source.locator.split(".")) cursor = cursor?.[segment];
    if (cursor === undefined) throw new SourceCardsError(`Invalid JSON source locator: ${source.locator}.`);
    return;
  }
  const lines = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  for (const heading of source.locator.split(/;\s*/)) {
    if (!/^#{1,6} /.test(heading) || !lines.has(heading)) {
      throw new SourceCardsError(`Invalid repository source locator: ${source.locator}.`);
    }
  }
}

export function parseSourceCards(value, { registry, manifest, repositorySources } = {}) {
  const parsed = SourceCardsSchema.safeParse(value);
  if (!parsed.success) throw new SourceCardsError("Source card schema validation failed.", { cause: parsed.error });
  if (!registry?.concepts || !manifest?.sources || !repositorySources) {
    throw new SourceCardsError("Source card validation requires the concept registry, source manifest, and repository references.");
  }
  const conceptIds = new Set(registry.concepts.map((concept) => concept.id));
  const coveredConcepts = new Set();
  const coveredPdfs = new Set();
  const cardIds = new Set();
  for (const card of parsed.data.cards) {
    if (cardIds.has(card.id)) throw new SourceCardsError(`Duplicate source card id: ${card.id}.`);
    cardIds.add(card.id);
    for (const id of card.concept_ids) {
      if (!conceptIds.has(id)) throw new SourceCardsError(`Unknown source card concept: ${id}.`);
      coveredConcepts.add(id);
    }
    for (const source of card.sources) {
      validateLocator(source, manifest, repositorySources, registry);
      if (source.kind === "private-pdf") coveredPdfs.add(source.ref);
    }
  }
  for (const id of conceptIds) {
    if (!coveredConcepts.has(id)) throw new SourceCardsError(`Concept has no source card: ${id}.`);
  }
  for (const source of manifest.sources) {
    if (!coveredPdfs.has(source.id)) throw new SourceCardsError(`Private source has no card: ${source.id}.`);
  }
  return parsed.data;
}

export async function loadSourceCards({ registry } = {}) {
  try {
    const [resolvedRegistry, raw, rawManifest] = await Promise.all([
      registry ?? loadConceptRegistry(),
      readFile(SOURCE_CARDS_PATH, "utf8"),
      readFile(MANIFEST_PATH, "utf8"),
    ]);
    const refs = [...new Set(resolvedRegistry.concepts.flatMap((concept) => concept.sources)
      .filter((source) => source.kind === "repository").map((source) => source.ref))];
    for (const ref of refs) {
      if (!ref.startsWith("knowledge/") || ref.includes("..") || path.isAbsolute(ref)) {
        throw new SourceCardsError("Repository source escaped the knowledge directory.");
      }
    }
    const repositorySources = Object.fromEntries(await Promise.all(refs.map(async (ref) => [ref, await readFile(path.join(ROOT, ref), "utf8")])));
    return parseSourceCards(JSON.parse(raw), { registry: resolvedRegistry, manifest: JSON.parse(rawManifest), repositorySources });
  } catch (error) {
    if (error instanceof SourceCardsError) throw error;
    throw new SourceCardsError("Source cards could not be loaded.", { cause: error });
  }
}

const STOP_WORDS = new Set("a an and are as at be been being but by can could did do does for from had has have how i if in into is it its may my of on or our should so than that the their them then there these they this to was we were what when where which who will with would you your".split(" "));
function tokens(text) {
  return (String(text ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

// Named links make the retrieval behavior inspectable; they are not learned embeddings.
const TAG_RELATIONS = [
  ["arithmetic", "quantity", "quantities", "percentage", "percent", "denominator", "totals", "count", "units"],
  ["chronology", "timeline", "dates", "duration", "ages", "temporal", "elapsed"],
  ["agency", "agent", "actor", "agentless", "omission", "euphemism", "passive", "responsibility", "nominalization"],
  ["cause", "causal", "causation", "confounder", "confounding", "correlation"],
  ["voice", "tone", "cadence", "rhythm", "style"],
  ["evidence", "citation", "citations", "quotation", "attribution", "verification"],
  ["knowledge", "knows", "knew", "learned", "viewpoint", "pov"],
  ["logic", "argument", "premise", "conclusion", "inference", "cogency"],
  ["fiction", "fantasy", "magic", "world", "rules"],
  ["brevity", "compress", "compression", "shorten", "clutter", "concise"],
];

// These are explicit editorial relationships, not semantic embeddings or a verdict
// that either method applies. The complete exception text travels with each card.
export const CONCEPT_RELATIONS = [
  ["passive-voice", "noun-verb-agency", "meaning-voice-fidelity"],
  ["parallelism-truth", "conclusion-scope", "inference-mode"],
  ["knowledge-state", "contradiction-vs-transition", "local-world-rules", "genre-routing"],
  ["timeline-space-quantity", "sequential-state-audit", "text-world-ledger"],
  ["claim-support-status", "logic-evidence-separation", "conclusion-scope"],
  ["cohesion-transition", "reader-state", "paragraph-attention"],
  ["bounded-revision", "meaning-voice-fidelity", "functional-diction", "rhythm-and-sound"],
];

export function buildSourceRetrievalQueries({ draft = "", instruction = "", maxSectionCharacters = 2400 } = {}) {
  if (typeof draft !== "string" || typeof instruction !== "string"
    || draft.length > 120000 || instruction.length > 120000
    || !Number.isInteger(maxSectionCharacters) || maxSectionCharacters < 1000 || maxSectionCharacters > 12000) {
    throw new SourceCardsError("Section retrieval requires bounded text and sections of 1000-12000 characters.");
  }
  const queries = [];
  for (const [document, text] of [["instruction", instruction], ["draft", draft]]) {
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + maxSectionCharacters, text.length);
      if (end < text.length) {
        // Prefer an observed paragraph boundary, but never omit a middle span.
        const paragraphEnd = text.lastIndexOf("\n\n", end - 1);
        if (paragraphEnd > start + maxSectionCharacters / 2) end = paragraphEnd + 2;
        if (/[\uDC00-\uDFFF]/.test(text[end])) end -= 1;
      }
      queries.push({ id: `${document}-${start}`, document, start, end, text: text.slice(start, end) });
      start = end;
    }
  }
  return {
    queries,
    method: "section-aware-local-lexical",
    coverage: { coveredCharacters: draft.length + instruction.length, totalCharacters: draft.length + instruction.length, complete: true },
    semanticRetrieval: "not-configured",
  };
}

const INDEXES = new WeakMap();
const LATENT_INDEXES = new WeakMap();
function buildIndex(corpus) {
  if (INDEXES.has(corpus)) return INDEXES.get(corpus);
  const frequencies = new Map();
  const documents = corpus.cards.map((card) => {
    const practice = card.example.practice;
    const words = tokens([
      card.title, card.mechanism, ...card.steps, ...card.triggers, ...card.exceptions, ...card.tags,
      card.example.before, card.example.after, card.example.why,
      practice?.task, ...(practice?.invariants ?? []),
      ...(practice?.alternatives.flatMap(({ text, when_to_prefer, tradeoff }) => [text, when_to_prefer, tradeoff]) ?? []),
      card.counterexample?.text, card.counterexample?.why_not_apply,
    ].filter(Boolean).join(" "));
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const word of counts.keys()) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    return { card, counts, length: words.length, tags: new Set(tokens(card.tags.join(" "))) };
  });
  const index = { documents, frequencies, averageLength: documents.reduce((sum, doc) => sum + doc.length, 0) / Math.max(documents.length, 1) };
  INDEXES.set(corpus, index);
  return index;
}

export function scoreSourceCardSemantics(corpus, queries = []) {
  if (!Array.isArray(queries) || queries.length > 256 || queries.some((item) => typeof item?.text !== "string")
    || queries.reduce((sum, item) => sum + item.text.length, 0) > 240000) {
    throw new SourceCardsError("Local latent retrieval requires bounded text sections.");
  }
  const index = buildIndex(corpus);
  if (!LATENT_INDEXES.has(corpus)) LATENT_INDEXES.set(corpus, buildLocalLatentIndex(index.documents, index.frequencies));
  const latent = LATENT_INDEXES.get(corpus);
  const scores = new Map();
  for (const query of queries) {
    for (const item of scoreLocalLatentIndex(latent, new Set(tokens(query.text)))) {
      scores.set(item.cardId, Math.max(scores.get(item.cardId) ?? 0, item.score));
    }
  }
  return {
    method: "local-tfidf-lsa-v1",
    dimensions: latent.dimensions,
    vocabularySize: latent.vocabularySize,
    limitation: "Corpus-derived co-occurrence only; no pretrained embeddings, out-of-vocabulary understanding, applicability judgment, or external calls.",
    scores: [...scores].map(([cardId, score]) => ({ cardId, score, localOnly: true, encoderId: "local-tfidf-lsa-v1" })),
  };
}

export function retrieveCandidateConcepts(corpus, { draft = "", instruction = "", maxConcepts = 16 } = {}) {
  if (!Number.isInteger(maxConcepts) || maxConcepts < 1 || maxConcepts > 40) {
    throw new SourceCardsError("Candidate method retrieval is limited to 1-40 concepts.");
  }
  const sections = buildSourceRetrievalQueries({ draft, instruction });
  const semantic = scoreSourceCardSemantics(corpus, sections.queries);
  const cards = retrieveSourceCards(corpus, { queries: sections.queries, localSemanticScores: semantic.scores, limit: 24, maxCharacters: 50000 });
  const candidateConceptIds = [...new Set(cards.flatMap((card) => card.concept_ids))].slice(0, maxConcepts);
  return {
    candidateConceptIds,
    signals: cards.filter((card) => card.concept_ids.some((id) => candidateConceptIds.includes(id))).map((card) => ({
      cardId: card.id,
      conceptIds: card.concept_ids.filter((id) => candidateConceptIds.includes(id)),
      methods: ["section-bm25", "local-tfidf-lsa-v1", "explicit-tag-relations"],
      hasExceptions: card.exceptions.length > 0,
    })),
    coverage: { ...sections.coverage, sectionCount: sections.queries.length, candidateLimit: maxConcepts },
    method: "section-bm25+local-tfidf-lsa+explicit-relations",
    semanticRetrieval: { method: semantic.method, dimensions: semantic.dimensions, limitation: semantic.limitation },
    instruction: "Candidates are retrieval hints, not automatic selections or findings. Apply triggers, anti-triggers, exceptions, genre, and the user's mode before selecting a method.",
  };
}

export function retrieveSourceCards(corpus, { query = "", queries = [], conceptIds = [], localSemanticScores = [], limit = 8, maxCharacters = 14000 } = {}) {
  if (!Number.isInteger(limit) || limit < 0 || limit > 24 || !Number.isInteger(maxCharacters) || maxCharacters < 0 || maxCharacters > 50000) {
    throw new SourceCardsError("Source card retrieval bounds are invalid (limit 0-24, characters 0-50000).");
  }
  if (!Array.isArray(conceptIds) || conceptIds.some((id) => typeof id !== "string")) {
    throw new SourceCardsError("Source card concept IDs must be an array of strings.");
  }
  if (!Array.isArray(queries) || queries.length > 256 || queries.some((item) => typeof item?.text !== "string")
    || typeof query !== "string" || query.length + queries.reduce((sum, item) => sum + item.text.length, 0) > 240000) {
    throw new SourceCardsError("Source card queries must contain bounded text sections.");
  }
  const knownCardIds = new Set(corpus.cards.map((card) => card.id));
  // Optional interface for a future, locally installed embedding encoder. No
  // model, download, network request, or inferred semantic score is hidden here.
  const semanticIds = new Set();
  if (!Array.isArray(localSemanticScores) || localSemanticScores.length > corpus.cards.length) {
    throw new SourceCardsError("Local semantic scores must be a bounded array.");
  }
  for (const item of localSemanticScores) {
    if (!item || !knownCardIds.has(item.cardId) || semanticIds.has(item.cardId)
      || !Number.isFinite(item.score) || item.score < 0 || item.score > 1
      || item.localOnly !== true || typeof item.encoderId !== "string" || !item.encoderId.trim()) {
      throw new SourceCardsError("Local semantic scores require known unique cards, a local encoder identity, and scores in [0, 1].");
    }
    semanticIds.add(item.cardId);
  }
  if (limit === 0 || maxCharacters < 2) return [];
  const index = buildIndex(corpus);
  const selectedIds = new Set(conceptIds);
  const knownIds = new Set(corpus.cards.flatMap((card) => card.concept_ids));
  for (const id of selectedIds) if (!knownIds.has(id)) throw new SourceCardsError(`Unknown retrieval concept: ${id}.`);
  const sectionInputs = [{ text: query }, ...queries].filter((item) => item.text);
  const sectionWords = sectionInputs.map((item) => new Set(tokens(item.text)));
  const queryWords = new Set(sectionWords.flatMap((words) => [...words]));
  const relatedWords = new Set();
  for (const group of TAG_RELATIONS) {
    if (group.some((word) => queryWords.has(word))) for (const word of group) relatedWords.add(word);
  }
  const relatedIds = new Set(CONCEPT_RELATIONS.filter((group) => group.some((id) => selectedIds.has(id))).flat());
  const semanticScores = new Map(localSemanticScores.map((item) => [item.cardId, item.score]));
  const ranked = index.documents.map((doc) => {
    const sectionScores = sectionWords.map((words, sectionIndex) => {
      let value = 0;
      for (const word of words) {
        const tf = doc.counts.get(word) ?? 0;
        if (tf === 0) continue;
        const df = index.frequencies.get(word) ?? 0;
        const idf = Math.log(1 + (index.documents.length - df + 0.5) / (df + 0.5));
        value += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.length / index.averageLength));
      }
      return value * (sectionInputs[sectionIndex].document === "instruction" ? 1.4 : 1);
    });
    // A local need in one section must not be diluted by many unrelated sections.
    let score = Math.max(0, ...sectionScores);
    const explicit = doc.card.concept_ids.filter((id) => selectedIds.has(id)).length;
    score += explicit * 12;
    if (!explicit && doc.card.concept_ids.some((id) => relatedIds.has(id))) score += 1.5;
    // Latent similarity is a weak candidate signal, never an applicability verdict.
    score += (semanticScores.get(doc.card.id) ?? 0) * 3;
    for (const word of doc.tags) {
      if (queryWords.has(word)) score += 2.5;
      else if (relatedWords.has(word)) score += 0.6;
    }
    return { ...doc, score, explicit, sectionScores };
  }).filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));

  const selected = [];
  const represented = new Set();
  // When the planner names several methods, first give each a chance at one card.
  const coveragePass = [];
  for (const id of selectedIds) {
    const candidate = ranked.find((entry) => entry.card.concept_ids.includes(id));
    if (candidate && !coveragePass.includes(candidate)) coveragePass.push(candidate);
  }
  for (const entry of [...coveragePass, ...ranked]) {
    if (selected.length >= limit) break;
    if (represented.has(entry.card.id)) continue;
    if (JSON.stringify([...selected, entry.card]).length > maxCharacters) continue;
    selected.push(entry.card);
    represented.add(entry.card.id);
  }
  return selected;
}

export function summarizeSourceCards(cards) {
  return cards.map((card) => ({
    id: card.id,
    conceptIds: [...card.concept_ids],
    sources: card.sources.map(({ kind, ref, locator, provenance }) => ({ kind, ref, locator, provenance })),
  }));
}

/** Packet accounting is not a relevance or exception-recall score. */
export function retrieveSourceCardPacket(corpus, options = {}) {
  const cards = retrieveSourceCards(corpus, options);
  const requested = [...new Set(options.conceptIds ?? [])];
  const represented = new Set(cards.flatMap((card) => card.concept_ids));
  return {
    cards,
    coverage: {
      corpusCardCount: corpus.cards.length,
      selectedCardCount: cards.length,
      cardLimit: options.limit ?? 8,
      serializedCharacters: JSON.stringify(cards).length,
      characterLimit: options.maxCharacters ?? 14000,
      requestedConceptIds: requested,
      representedRequestedConceptIds: requested.filter((id) => represented.has(id)),
      unrepresentedRequestedConceptIds: requested.filter((id) => !represented.has(id)),
      completeSelectedCardPayloads: true,
      selectedExceptionCount: cards.reduce((sum, card) => sum + card.exceptions.length, 0),
      selectedCounterexampleCount: cards.filter((card) => card.counterexample).length,
      relevanceGuarantee: false,
      caveat: "Accounting for selected complete cards only. Unrepresented requested methods are visible; represented methods do not prove the relevant mechanism or exception was retrieved or applied. No full-book coverage is implied.",
    },
  };
}
