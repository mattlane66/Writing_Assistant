import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { loadConceptRegistry } from "./concept-registry.mjs";
import { loadSourceCards, retrieveSourceCardPacket, scoreSourceCardSemantics, SourceCardsSchema } from "./source-cards.mjs";
import { buildMeaningContract, compareMeaningContract } from "./meaning-contract.mjs";
import { buildTextWorld, compareTextWorld } from "./text-world.mjs";

export const BOOK_ENGINE_VERSION = "1.0.1";
const revision = () => process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "repository-deployment";
const badRequest = message => Object.assign(new Error(message), { status: 400 });
const Text = z.string().trim().min(1);
const Mode = z.enum(["proofread", "edit", "heavy-rewrite", "compression", "draft", "craft-analysis", "pattern-imitation", "argument-analysis"]);
const Search = z.object({ query: Text.max(1200), concept_ids: z.array(Text).max(8).default([]), limit: z.number().int().min(1).max(8).default(6) }).strict();
const Get = z.object({ ids: z.array(Text).min(1).max(8).refine(ids => new Set(ids).size === ids.length) }).strict();
const Check = z.object({
  original: z.string().min(1).max(12000), candidate: z.string().min(1).max(12000),
  editing_mode: Mode, text_processing_authorized: z.literal(true),
}).strict();
const Empty = z.object({}).strict();
const SourceIdentity = z.object({ id: Text, identity: z.record(z.string(), z.union([z.string(), z.number(), z.null()])), pdf_pages: z.number().int(), authority_caveat: Text }).strict();
const Provenance = { engine_version: Text, source_revision: Text, corpus_version: Text, corpus_sha256: Text };
const Packet = z.object({ ...Provenance,
  example_policy: Text, cards: SourceCardsSchema.shape.cards,
  coverage: z.record(z.string(), z.unknown()), source_identities: z.array(SourceIdentity),
  retrieval: z.object({ method: Text, caveat: Text }).strict(),
}).strict();
const Coverage = z.object({ ...Provenance, completeness: z.literal("partial-model-review-not-comprehensive-mastery"),
  total_pdf_pages: z.number().int(), tracked_model_reviewed_pages: z.number().int(), unreviewed_pages: z.number().int(),
  visually_dispositioned_pages: z.number().int().nonnegative(), undispositioned_pages: z.number().int().nonnegative(),
  card_count: z.number().int(), method_count: z.number().int(),
  methods: z.array(z.object({ id: Text, card_count: z.number().int() }).strict()),
  sources: z.array(SourceIdentity.extend({ tracked_model_reviewed_pages: z.number().int(), unreviewed_pages: z.number().int(),
    visually_dispositioned_pages: z.number().int().nonnegative(), undispositioned_pages: z.number().int().nonnegative(),
    first_pass_disposition_complete: z.boolean(),
    visually_dispositioned_ranges: z.array(z.object({ start: z.number().int(), end: z.number().int() }).strict()),
    reviewed_ranges: z.array(z.object({ start: z.number().int(), end: z.number().int() }).strict()), card_count: z.number().int(),
  }).strict()), caveat: Text,
}).strict();
const Checked = z.object({ engine_version: Text, source_revision: Text, editing_mode: Mode,
  semantic_certification: z.literal(false), meaning_review: z.record(z.string(), z.unknown()),
  world_review: z.record(z.string(), z.unknown()), world_fidelity: z.record(z.string(), z.unknown()).nullable(),
  model_calls: z.literal(0), caveat: Text,
}).strict();

export const BOOK_TOOL_SCHEMAS = Object.freeze({
  search_writing_examples: { input: z.toJSONSchema(Search), output: z.toJSONSchema(Packet) },
  get_writing_examples: { input: z.toJSONSchema(Get), output: z.toJSONSchema(Packet) },
  get_writing_coverage: { input: z.toJSONSchema(Empty), output: z.toJSONSchema(Coverage) },
  check_writing_revision: { input: z.toJSONSchema(Check), output: z.toJSONSchema(Checked) },
});
function input(schema, value) {
  const result = schema.safeParse(value ?? {});
  // Never echo supplied passages or unexpected argument values in errors.
  if (!result.success) throw badRequest("Invalid or out-of-bounds tool arguments. Use only the declared fields; revision checks require explicit text-processing authorization.");
  return result.data;
}
function identity(source) {
  return { id: source.id, identity: source.identity, pdf_pages: source.pdf_pages, authority_caveat: source.authority_notes };
}
function pageSet(ranges, maximum) {
  if (!Array.isArray(ranges)) throw new Error("Review page ranges are missing.");
  const pages = new Set();
  let previous = 0;
  for (const { start, end } of ranges) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start <= previous || end < start || end > maximum) throw new Error("Review range is invalid.");
    for (let p = start; p <= end; p++) pages.add(p);
    previous = end;
  }
  return pages;
}

let cached;
async function knowledge() {
  if (!cached) cached = (async () => {
    const registry = await loadConceptRegistry();
    const corpus = await loadSourceCards({ registry });
    const manifest = JSON.parse(await readFile(new URL("../knowledge/SOURCE_MANIFEST.json", import.meta.url), "utf8"));
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const reviewed = validateBookReview(ledger, manifest, corpus);
    // Includes actual cards, source identities/caveats, and ledger; not private PDF bytes.
    const digest = createHash("sha256").update(JSON.stringify({ corpus, manifest, ledger })).digest("hex");
    return { registry, corpus, manifest, ledger, reviewed, digest };
  })().catch(error => { cached = undefined; throw error; });
  return cached;
}

export function validateBookReview(ledger, manifest, corpus) {
  if (ledger.schema_version !== 1 || ledger.completeness !== "partial-model-review-not-comprehensive-mastery"
    || !Array.isArray(ledger.sources) || !Array.isArray(ledger.reviews) || ledger.sources.length !== manifest.sources.length) throw new Error("Invalid review ledger.");
  const cards = new Map(corpus.cards.map(card => [card.id, card]));
  const sources = new Map(manifest.sources.map(source => [source.id, source]));
  const contentCaveats = ledger.source_content_caveats === undefined ? [] : ledger.source_content_caveats;
  if (!Array.isArray(contentCaveats) || contentCaveats.some((item, i) => !item
    || !sources.has(item.source_id) || typeof item.description !== "string"
    || !item.description.trim() || item.description.length > 1000
    || Object.keys(item).some(key => !["source_id", "description"].includes(key))
    || contentCaveats.slice(0, i).some(previous => previous.source_id === item.source_id))) {
    throw new Error("Unsupported source-content caveat.");
  }
  const result = new Map();
  for (const entry of ledger.sources) {
    const source = sources.get(entry.source_id);
    if (!source || result.has(source.id) || entry.sha256 !== source.sha256 || entry.pdf_pages !== source.pdf_pages || entry.authority_caveat !== source.authority_notes) throw new Error("Source identity or caveat drift.");
    const extracted = pageSet(entry.extracted_ranges, source.pdf_pages);
    const missing = pageSet(entry.no_extracted_text_ranges, source.pdf_pages);
    if (extracted.size + missing.size !== source.pdf_pages || [...missing].some(p => extracted.has(p))) throw new Error("Incomplete extraction accounting.");
    result.set(source.id, { pages: new Set(), visual: new Set(), extracted, missing });
  }
  const ids = new Set();
  for (const review of ledger.reviews) {
    const source = sources.get(review.source_id);
    const state = result.get(review.source_id);
    if (!state || typeof review.id !== "string" || !review.id.trim() || ids.has(review.id) || !["principles-reviewed", "context-reviewed"].includes(review.status)
      || review.reviewer !== "codex-model" || review.method !== "local-extracted-text-with-rendered-spot-checks"
      || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed_on) || typeof review.notes !== "string" || !review.notes.trim()) throw new Error("Unsupported review evidence.");
    ids.add(review.id);
    const pages = pageSet(review.pages, source.pdf_pages);
    if ([...pages].some(p => state.pages.has(p) || !state.extracted.has(p))) throw new Error("Overlapping or unextracted review pages.");
    if (!Array.isArray(review.visual_pages) || new Set(review.visual_pages).size !== review.visual_pages.length
      || review.visual_pages.some(p => !pages.has(p))) throw new Error("Unsupported visual review locator.");
    if (!Array.isArray(review.card_ids) || new Set(review.card_ids).size !== review.card_ids.length
      || (review.status === "principles-reviewed" && !review.card_ids.length)) throw new Error("Review cards missing or duplicated.");
    for (const id of review.card_ids) {
      const card = cards.get(id);
      if (!card?.sources.some(ref => {
        if (ref.kind !== "private-pdf" || ref.ref !== source.id) return false;
        const match = /^PDF pp?\. (\d+)(?:-(\d+))?$/.exec(ref.locator);
        if (!match) return false;
        const start = Number(match[1]), end = Number(match[2] ?? match[1]);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i).every(p => pages.has(p));
      })) throw new Error("Review card locator is not supported by reviewed pages.");
    }
    for (const p of pages) state.pages.add(p);
  }
  // A rendered cover or confirmed blank is a disposition, not text review.
  // In particular, this path cannot promote unextracted content into a method.
  if (ledger.visual_dispositions !== undefined && !Array.isArray(ledger.visual_dispositions)) throw new Error("Invalid visual dispositions.");
  for (const review of ledger.visual_dispositions ?? []) {
    const source = sources.get(review.source_id);
    const state = result.get(review.source_id);
    if (!state || typeof review.id !== "string" || !review.id.trim() || ids.has(review.id)
      || !["context", "blank"].includes(review.disposition) || review.reviewer !== "codex-model"
      || review.method !== "local-rendered-page-inspection" || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed_on)
      || typeof review.notes !== "string" || !review.notes.trim()
      || Object.keys(review).some(key => !["id", "source_id", "pages", "disposition", "reviewer", "reviewed_on", "method", "notes"].includes(key))) throw new Error("Unsupported visual disposition evidence.");
    ids.add(review.id);
    const pages = pageSet(review.pages, source.pdf_pages);
    if (!pages.size || [...pages].some(p => !state.missing.has(p) || state.pages.has(p) || state.visual.has(p))) throw new Error("Overlapping or extracted visual disposition pages.");
    for (const p of pages) state.visual.add(p);
  }
  return result;
}

function provenance(data) {
  return { engine_version: BOOK_ENGINE_VERSION, source_revision: revision(), corpus_version: data.corpus.corpus_version, corpus_sha256: data.digest };
}
function sourceContentCaveats(data, sourceIds) {
  return (data.ledger.source_content_caveats ?? [])
    .filter(item => !sourceIds || sourceIds.has(item.source_id))
    .map(item => ` Source-content limitation: ${item.description}`).join("");
}
function packet(data, cards, coverage, method) {
  const ids = new Set(cards.flatMap(card => card.sources.filter(s => s.kind === "private-pdf").map(s => s.ref)));
  return Packet.parse({ ...provenance(data), cards, coverage, example_policy: data.corpus.example_policy,
    source_identities: data.manifest.sources.filter(s => ids.has(s.id)).map(identity),
    retrieval: { method, caveat: "These are original practice examples and candidate methods, not book quotations, factual evidence, or a judgment that every selected method applies. Retain exceptions and counterexamples; search can miss relevant ideas." + sourceContentCaveats(data, ids) },
  });
}
export async function searchWritingExamples(args) {
  const { query, concept_ids, limit } = input(Search, args);
  const data = await knowledge();
  if (concept_ids.some(id => !data.registry.concepts.some(c => c.id === id))) throw badRequest("Unknown canonical concept id.");
  const semantic = scoreSourceCardSemantics(data.corpus, [{ text: query }]);
  const found = retrieveSourceCardPacket(data.corpus, { query, conceptIds: concept_ids, limit, maxCharacters: 14000, localSemanticScores: semantic.scores });
  return packet(data, found.cards, found.coverage, "bm25+concept-tag-relations+local-tfidf-lsa");
}
export async function getWritingExamples(args) {
  const { ids } = input(Get, args);
  const data = await knowledge();
  const byId = new Map(data.corpus.cards.map(c => [c.id, c]));
  if (ids.some(id => !byId.has(id))) throw badRequest("Unknown writing example id.");
  const cards = ids.map(id => byId.get(id));
  if (JSON.stringify(cards).length > 50000) throw badRequest("Requested example packet exceeds 50,000 characters; request fewer cards.");
  return packet(data, cards, { selectedCardCount: cards.length, corpusCardCount: data.corpus.cards.length, completeSelectedCardPayloads: true, relevanceGuarantee: false }, "exact-card-id");
}
function ranges(pages) {
  const result = [];
  for (const p of [...pages].sort((a, b) => a - b)) {
    const last = result.at(-1);
    if (last && last.end === p - 1) last.end = p;
    else result.push({ start: p, end: p });
  }
  return result;
}
export async function getWritingCoverage(args) {
  input(Empty, args);
  const data = await knowledge();
  const sources = data.manifest.sources.map(source => {
    const { pages, visual } = data.reviewed.get(source.id);
    return { ...identity(source), tracked_model_reviewed_pages: pages.size, unreviewed_pages: source.pdf_pages - pages.size,
      visually_dispositioned_pages: visual.size, undispositioned_pages: source.pdf_pages - pages.size - visual.size,
      first_pass_disposition_complete: pages.size + visual.size === source.pdf_pages,
      visually_dispositioned_ranges: ranges(visual),
      reviewed_ranges: ranges(pages), card_count: data.corpus.cards.filter(c => c.sources.some(s => s.ref === source.id)).length };
  });
  return Coverage.parse({ ...provenance(data), completeness: data.ledger.completeness,
    total_pdf_pages: sources.reduce((n, s) => n + s.pdf_pages, 0), tracked_model_reviewed_pages: sources.reduce((n, s) => n + s.tracked_model_reviewed_pages, 0),
    unreviewed_pages: sources.reduce((n, s) => n + s.unreviewed_pages, 0), card_count: data.corpus.cards.length, method_count: data.registry.concepts.length,
    visually_dispositioned_pages: sources.reduce((n, s) => n + s.visually_dispositioned_pages, 0),
    undispositioned_pages: sources.reduce((n, s) => n + s.undispositioned_pages, 0),
    methods: data.registry.concepts.map(c => ({ id: c.id, card_count: data.corpus.cards.filter(card => card.concept_ids.includes(c.id)).length })), sources,
    caveat: "Tracked model-reviewed pages count extracted-text review, not complete idea coverage, human validation, model training, or successful application. Visually dispositioned covers/context and confirmed blanks are separate and do not add methods. The legacy unreviewed count includes those pages; undispositioned pages are unresolved first-pass gaps. First-pass disposition completion does not certify idea recall or judgment. PDFs and extracted text are not accessible through these tools. The Bookey file is an incomplete secondary summary, not the complete Provost book." + sourceContentCaveats(data),
  });
}
export function checkWritingRevision(args) {
  const { original, candidate, editing_mode } = input(Check, args);
  const analysis = ["craft-analysis", "argument-analysis"].includes(editing_mode);
  const mode = analysis ? "analyze" : editing_mode === "compression" ? "compress" : editing_mode === "heavy-rewrite" ? "rewrite" : editing_mode;
  return Checked.parse({ engine_version: BOOK_ENGINE_VERSION, source_revision: revision(), editing_mode,
    semantic_certification: false, model_calls: 0,
    meaning_review: compareMeaningContract(buildMeaningContract(original), candidate, { mode }),
    world_review: buildTextWorld(candidate, { instruction: editing_mode === "argument-analysis" ? "analyze the argument" : "" }),
    world_fidelity: analysis || mode === "draft" ? null : compareTextWorld(original, candidate, { mode }),
    caveat: "Stateless literal checks, not an independent semantic editor, external fact-checker, or full world model. Exact supported arithmetic/unit/date/percentage templates can be checked; quotation, quantity, qualification and state signals require contextual review. Absence of findings never certifies a passage. Both exact passages were sent with an authorization flag; the host must obtain actual user authorization, which the flag cannot prove. No provider request or intentional application persistence occurs.",
  });
}
