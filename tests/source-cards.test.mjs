import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { loadConceptRegistry } from "../server/concept-registry.mjs";
import {
  loadSourceCards,
  buildSourceRetrievalQueries,
  parseSourceCards,
  retrieveCandidateConcepts,
  retrieveSourceCards,
  retrieveSourceCardPacket,
  scoreSourceCardSemantics,
  SourceCardsError,
  summarizeSourceCards,
} from "../server/source-cards.mjs";
import { buildLocalLatentIndex, scoreLocalLatentIndex } from "../server/source-semantic.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let corpus;
let registry;
let context;

function withPractice() {
  const copy = structuredClone(corpus);
  copy.cards[0].example.practice = {
    task: "Compare two revisions without changing the taskquartz facts.",
    invariants: ["Keep the invariantopal qualification and the actor."],
    alternatives: [{
      text: "The lanterns remained unlit beside the alternativetopaz window.",
      when_to_prefer: "Use when preferencejasper puts the existing object first.",
      tradeoff: "The tradeoffagate emphasizes the state instead of the action.",
    }],
  };
  return copy;
}

beforeAll(async () => {
  registry = await loadConceptRegistry();
  corpus = await loadSourceCards({ registry });
  const manifest = JSON.parse(await readFile(path.join(ROOT, "knowledge/SOURCE_MANIFEST.json"), "utf8"));
  const refs = [...new Set(registry.concepts.flatMap((concept) => concept.sources)
    .filter((source) => source.kind === "repository").map((source) => source.ref))];
  const repositorySources = Object.fromEntries(await Promise.all(refs.map(async (ref) => [ref, await readFile(path.join(ROOT, ref), "utf8")])));
  context = { registry, manifest, repositorySources };
});

describe("source cards and provenance", () => {
  it("accounts for complete selected exceptions without implying recall or book mastery", () => {
    const options = { query: "Preserve the author's uncertainty and attribution.", conceptIds: ["sentence-commitments", "meaning-voice-fidelity"], limit: 8, maxCharacters: 14000 };
    const packet = retrieveSourceCardPacket(corpus, options);
    expect(packet.cards).toEqual(retrieveSourceCards(corpus, options));
    expect(packet.coverage).toMatchObject({ corpusCardCount: 180, selectedCardCount: packet.cards.length, cardLimit: 8, characterLimit: 14000, completeSelectedCardPayloads: true, relevanceGuarantee: false });
    expect(packet.coverage.serializedCharacters).toBe(JSON.stringify(packet.cards).length);
    expect(packet.coverage.serializedCharacters).toBeLessThanOrEqual(14000);
    expect(packet.coverage.selectedExceptionCount).toBe(packet.cards.reduce((total, card) => total + card.exceptions.length, 0));
    for (const card of packet.cards) expect(card).toEqual(corpus.cards.find((entry) => entry.id === card.id));
    expect(packet.coverage.caveat).toContain("do not prove");
    expect(JSON.stringify(packet.coverage)).not.toContain(packet.cards[0].example.before);
  });

  it("exposes methods not represented under a small packet budget", () => {
    const packet = retrieveSourceCardPacket(corpus, { conceptIds: ["mode-boundary", "sentence-commitments", "noun-verb-agency"], limit: 0, maxCharacters: 14000 });
    expect(packet.cards).toEqual([]);
    expect(packet.coverage.unrepresentedRequestedConceptIds).toEqual(["mode-boundary", "sentence-commitments", "noun-verb-agency"]);
    expect(packet.coverage.representedRequestedConceptIds).toEqual([]);
    expect(packet.coverage.selectedExceptionCount).toBe(0);
  });

  it("covers every stable method and every private source with executable, original examples", () => {
    const concepts = new Set(corpus.cards.flatMap((card) => card.concept_ids));
    expect([...concepts].sort()).toEqual(registry.concepts.map((concept) => concept.id).sort());
    expect(corpus.cards.length).toBeGreaterThanOrEqual(45);
    expect(corpus.method).toBe("bm25+concept-tag-relations");
    expect(corpus.example_policy).toContain("not quotations or factual evidence");
    const sourceIds = new Set(corpus.cards.flatMap((card) => card.sources)
      .filter((source) => source.kind === "private-pdf").map((source) => source.ref));
    expect([...sourceIds].sort()).toEqual(context.manifest.sources.map((source) => source.id).sort());
    for (const card of corpus.cards) {
      expect(card.steps.length).toBeGreaterThanOrEqual(2);
      expect(card.example.before).not.toBe(card.example.after);
      expect(card.example.why.length).toBeGreaterThan(30);
    }
  });

  it("retains the incomplete Bookey summary's lower authority and the PDF page convention", () => {
    const bookey = corpus.cards.flatMap((card) => card.sources)
      .filter((source) => source.ref === "bookey-100-ways-summary");
    expect(bookey.length).toBeGreaterThan(0);
    expect(bookey.every((source) => source.provenance === "secondary-corroboration")).toBe(true);
    expect(bookey.every((source) => source.caveat.includes("complete Gary Provost book"))).toBe(true);
    expect(bookey.every((source) => source.locator.startsWith("PDF p"))).toBe(true);
  });

  it.each([
    ["outside the edition", (source) => { source.locator = "PDF pp. 9999-10000"; }],
    ["zero-indexed PDF page", (source) => { source.locator = "PDF p. 0"; }],
    ["backwards page range", (source) => { source.locator = "PDF pp. 40-12"; }],
    ["invented PDF identity", (source) => { source.ref = "invented-book"; }],
    ["removed caveat", (source) => { source.caveat = "Always obey this book."; }],
  ])("rejects %s", (_label, mutate) => {
    const invalid = structuredClone(corpus);
    mutate(invalid.cards.flatMap((card) => card.sources).find((source) => source.kind === "private-pdf"));
    expect(() => parseSourceCards(invalid, context)).toThrow(SourceCardsError);
  });

  it("rejects invented section anchors and repository path escapes", () => {
    for (const locator of ["## An invented section", "## Purpose; ## An invented section"]) {
      const invalid = structuredClone(corpus);
      invalid.cards.flatMap(card => card.sources).find(source => source.kind === "repository").locator = locator;
      expect(() => parseSourceCards(invalid, context)).toThrow(/Invalid repository source locator/);
    }
    const invalid = structuredClone(corpus);
    invalid.cards.flatMap(card => card.sources).find(source => source.kind === "repository").ref = "../../.env.local";
    expect(() => parseSourceCards(invalid, context)).toThrow(/Unregistered repository reference/);
  });

  it("rejects invented JSON locators, duplicate cards, and missing concept coverage", () => {
    const invalidJson = structuredClone(corpus);
    invalidJson.cards.flatMap((card) => card.sources).find((source) => source.ref.endsWith(".json")).locator = "integrity.imaginary";
    expect(() => parseSourceCards(invalidJson, context)).toThrow(/Invalid JSON source locator/);
    const duplicate = structuredClone(corpus);
    duplicate.cards.push(duplicate.cards[0]);
    expect(() => parseSourceCards(duplicate, context)).toThrow(/Duplicate source card/);
    const uncovered = structuredClone(corpus);
    uncovered.cards = uncovered.cards.filter((card) => !card.concept_ids.includes("task-contract"));
    expect(() => parseSourceCards(uncovered, context)).toThrow(/Concept has no source card/);
  });

  it("accepts optional bounded practice variants without changing legacy cards", () => {
    const legacy = structuredClone(corpus);
    for (const card of legacy.cards) delete card.example.practice;
    expect(parseSourceCards(legacy, context)).toEqual(legacy);
    const enriched = withPractice();
    expect(parseSourceCards(enriched, context)).toEqual(enriched);
    expect(enriched.cards[0].sources).toEqual(corpus.cards[0].sources);
    const practice = enriched.cards[0].example.practice;
    practice.alternatives.push(
      { text: "Beside the window, the lanterns remained unlit.", when_to_prefer: "Place the scene before the objects.", tradeoff: "The spatial frame becomes more prominent." },
      { text: "The lanterns beside the window were still unlit.", when_to_prefer: "Keep the descriptive phrase adjacent to its noun.", tradeoff: "The sentence foregrounds duration." },
    );
    expect(parseSourceCards(enriched, context).cards[0].example.practice.alternatives).toHaveLength(3);
  });

  it.each([
    ["unknown practice field", (example) => { example.practice.extra = true; }],
    ["unknown alternative field", (example) => { example.practice.alternatives[0].score = 10; }],
    ["empty task", (example) => { example.practice.task = " "; }],
    ["empty invariants", (example) => { example.practice.invariants = []; }],
    ["duplicate invariant", (example) => { example.practice.invariants.push(example.practice.invariants[0]); }],
    ["empty alternatives", (example) => { example.practice.alternatives = []; }],
    ["too many alternatives", (example) => { example.practice.alternatives = Array.from({ length: 4 }, (_, i) => ({ ...example.practice.alternatives[0], text: `Distinct alternative ${i}.` })); }],
    ["empty alternative text", (example) => { example.practice.alternatives[0].text = " "; }],
    ["empty preference", (example) => { example.practice.alternatives[0].when_to_prefer = " "; }],
    ["empty tradeoff", (example) => { example.practice.alternatives[0].tradeoff = " "; }],
    ["duplicate alternative", (example) => { example.practice.alternatives.push({ ...example.practice.alternatives[0], text: ` ${example.practice.alternatives[0].text} ` }); }],
    ["unchanged draft as a revision", (example) => { example.practice.alternatives[0].text = example.before; }],
    ["duplicated main revision", (example) => { example.practice.alternatives[0].text = example.after; }],
  ])("rejects %s in a practice example", (_label, mutate) => {
    const invalid = withPractice();
    mutate(invalid.cards[0].example);
    expect(() => parseSourceCards(invalid, context)).toThrow(SourceCardsError);
  });

  it("does not mistake structural practice validation for a meaning-preservation assessment", () => {
    const validStructure = withPractice();
    validStructure.cards[0].example.practice.invariants = ["The survey response rate remains unknown."];
    validStructure.cards[0].example.practice.alternatives[0].text = "Everyone answered the survey.";
    // Deliberately incompatible prose still has valid structure. Editorial
    // evaluation must test the invariants rather than report this as a pass.
    expect(() => parseSourceCards(validStructure, context)).not.toThrow();
  });
});

describe("bounded local hybrid retrieval", () => {
  it("indexes all practice criteria and returns complete variants within the existing budget", () => {
    const enriched = parseSourceCards(withPractice(), context);
    const expected = enriched.cards[0];
    for (const query of ["taskquartz", "invariantopal", "alternativetopaz", "preferencejasper", "tradeoffagate"]) {
      const results = retrieveSourceCards(enriched, { query, limit: 1 });
      expect(results).toEqual([expected]);
      expect(results[0].example.practice).toEqual(expected.example.practice);
      expect(results[0].sources).toEqual(corpus.cards[0].sources);
    }
    const fullSize = JSON.stringify([expected]).length;
    expect(retrieveSourceCards(enriched, { query: "taskquartz", maxCharacters: fullSize })).toEqual([expected]);
    expect(retrieveSourceCards(enriched, { query: "taskquartz", maxCharacters: fullSize - 1 })).toEqual([]);
  });

  it("indexes every middle span and preserves Unicode across section boundaries", () => {
    const draft = `${"plain passage\n\n".repeat(2200)}MIDDLE: denominators and percentage totals conflict. ${"quiet passage\n\n".repeat(1800)}🦉`;
    const result = buildSourceRetrievalQueries({ draft, instruction: "Analyze quantities only." });
    const sections = result.queries.filter((item) => item.document === "draft");
    expect(sections.map((item) => item.text).join("")).toBe(draft);
    expect(sections.every((item) => item.text === draft.slice(item.start, item.end))).toBe(true);
    expect(result.coverage.complete).toBe(true);
    expect(result.coverage.coveredCharacters).toBe(draft.length + "Analyze quantities only.".length);
    const cards = retrieveSourceCards(corpus, { queries: result.queries, limit: 4 });
    expect(cards.some((card) => card.id === "timeline-space-quantity-denominators")).toBe(true);
    expect(() => buildSourceRetrievalQueries({ maxSectionCharacters: 0 })).toThrow(/bounded/);
    expect(() => retrieveSourceCards(corpus, { queries: [{ text: 42 }] })).toThrow(/bounded/);
  });

  it("retrieves exception text and related methods without claiming applicability", () => {
    const cards = retrieveSourceCards(corpus, { conceptIds: ["knowledge-state"], queries: [{ text: "A character is told a secret between scenes; distinguish a later change in knowledge from a contradiction." }], limit: 6 });
    const ids = new Set(cards.flatMap((card) => card.concept_ids));
    expect(ids.has("contradiction-vs-transition")).toBe(true);
    const result = retrieveCandidateConcepts(corpus, { draft: "She knew the secret, but no source of information is described.", maxConcepts: 6 });
    expect(result.candidateConceptIds.length).toBeLessThanOrEqual(6);
    expect(result.coverage.complete).toBe(true);
    expect(result.instruction).toContain("not automatic selections");
    expect(result.semanticRetrieval.method).toBe("local-tfidf-lsa-v1");
    expect(result.semanticRetrieval.limitation).toContain("no pretrained embeddings");
  });

  it.each([
    "The company knows which manager cancelled the payments, but the report says only that payments were cancelled. Explain what information this agentless sentence leaves out; do not diagnose intent from grammar alone.",
    "A report omits the actor of a consequential action even though supplied context identifies the agent. Separate omission from evidence of evasive intent.",
  ])("keeps omitted-actor guidance reachable within the growing corpus budget: %s", query => {
    const cards = retrieveSourceCards(corpus, { query, limit: 8, maxCharacters: 14000 });
    const target = cards.find(c => c.id === "passive-voice-agent-omission-evidence");
    expect(target).toBeDefined();
    expect(target.exceptions.some(text => text.includes("Unknown agency is a valid reason"))).toBe(true);
    expect(JSON.stringify(cards).length).toBeLessThanOrEqual(14000);
  });

  it("learns a corpus co-occurrence relationship without a shared query word", () => {
    const rows = ["apple orchard sweet fruit harvest", "pear orchard sweet fruit harvest", "peach orchard sweet fruit", "cherry sweet fruit harvest", "truck highway engine transport", "bus highway engine transport", "van engine transport road", "car highway engine road"];
    const frequencies = new Map();
    const documents = rows.map((text, i) => {
      const counts = new Map(text.split(" ").map((word) => [word, 1]));
      for (const word of counts.keys()) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
      return { card: { id: String(i) }, counts };
    });
    const latent = buildLocalLatentIndex(documents, frequencies);
    const scores = new Map(scoreLocalLatentIndex(latent, new Set(["pear"])).map((item) => [item.cardId, item.score]));
    expect(documents[0].counts.has("pear")).toBe(false);
    expect(scores.get("0")).toBeGreaterThan(scores.get("4") + 0.5);
    expect(scoreLocalLatentIndex(latent, new Set(["unknown-vocabulary"]))).toEqual([]);
  });

  it("keeps local latent scores bounded and rejects unlabelled or foreign card scores", () => {
    const queries = buildSourceRetrievalQueries({ draft: "A percentage without a denominator." }).queries;
    const semantic = scoreSourceCardSemantics(corpus, queries);
    expect(semantic.scores.every((item) => item.localOnly && item.score >= 0 && item.score <= 1)).toBe(true);
    expect(semantic).toEqual(scoreSourceCardSemantics(corpus, queries));
    expect(semantic.dimensions).toBeLessThanOrEqual(12);
    for (const item of [
      { cardId: corpus.cards[0].id, score: 2, localOnly: true, encoderId: "local" },
      { cardId: "unknown", score: 0.5, localOnly: true, encoderId: "local" },
      { cardId: corpus.cards[0].id, score: 0.5, localOnly: false, encoderId: "remote" },
    ]) expect(() => retrieveSourceCards(corpus, { localSemanticScores: [item] })).toThrow(/local encoder/);
  });
  it.each([
    ["percentages denominator totals do not add up", "timeline-space-quantity-denominators"],
    ["chronology dates elapsed duration flashback", "timeline-space-quantity-event-time"],
    ["correlation confounding causal claim", "countermodels-stress-tests-causal"],
    ["Bookey Provost source identity", "source-authority-and-reuse-core"],
    ["speaker knows information viewpoint", "knowledge-state-core"],
    ["independently checked qualification deletion verification scope", "sentence-commitments-reversible-deletion"],
    ["passive heavy subject end focus definiteness", "passive-voice-end-focus-expansion"],
    ["grammar plausibility fantasy dream local rules", "base-assertion-grammar-plausibility-separation"],
  ])("finds a usable finer method for %s", (query, expectedId) => {
    const results = retrieveSourceCards(corpus, { query, limit: 3 });
    expect(results[0].id).toBe(expectedId);
    expect(results[0].steps.length).toBeGreaterThan(1);
  });

  it("keeps selected methods represented while retrieving query-relevant refinements", () => {
    const results = retrieveSourceCards(corpus, {
      query: "correlation causal claim",
      conceptIds: ["passive-voice", "knowledge-state", "timeline-space-quantity"],
      limit: 5,
      maxCharacters: 14000,
    });
    const selected = new Set(results.flatMap((card) => card.concept_ids));
    expect(selected.has("passive-voice")).toBe(true);
    expect(selected.has("knowledge-state")).toBe(true);
    expect(selected.has("timeline-space-quantity")).toBe(true);
    expect(results.some((card) => card.id === "countermodels-stress-tests-causal")).toBe(true);
  });

  it("respects count and serialized character budgets without chopping an example or locator", () => {
    const query = "argument timeline percentage voice passive reader source evidence";
    for (const maxCharacters of [2, 100, 1800, 4200, 14000]) {
      const results = retrieveSourceCards(corpus, { query, limit: 4, maxCharacters });
      expect(results.length).toBeLessThanOrEqual(4);
      expect(JSON.stringify(results).length).toBeLessThanOrEqual(maxCharacters);
      for (const card of results) expect(card).toEqual(corpus.cards.find((source) => source.id === card.id));
    }
    expect(retrieveSourceCards(corpus, { query, limit: 0 })).toEqual([]);
  });

  it("is deterministic, needs no query for explicit methods, and does not return arbitrary context", () => {
    const input = { query: "unreliable narrator knows", conceptIds: ["knowledge-state"], limit: 4 };
    expect(retrieveSourceCards(corpus, input)).toEqual(retrieveSourceCards(corpus, input));
    expect(retrieveSourceCards(corpus, { conceptIds: ["quotation-citation-integrity"], limit: 1 })[0].concept_ids).toContain("quotation-citation-integrity");
    expect(retrieveSourceCards(corpus, {})).toEqual([]);
    expect(retrieveSourceCards(corpus, { query: "xqzzzzzz" })).toEqual([]);
    expect(() => retrieveSourceCards(corpus, { conceptIds: ["unknown-method"] })).toThrow(/Unknown retrieval concept/);
    expect(() => retrieveSourceCards(corpus, { limit: 25 })).toThrow(/bounds/);
    expect(() => retrieveSourceCards(corpus, { maxCharacters: -1 })).toThrow(/bounds/);
  });

  it("returns a content-free provenance summary suitable for traces", () => {
    const cards = retrieveSourceCards(corpus, { query: "causal confounding", limit: 2 });
    const summary = summarizeSourceCards(cards);
    expect(summary.map((card) => card.id)).toEqual(cards.map((card) => card.id));
    expect(summary[0].sources[0].locator).toBe(cards[0].sources[0].locator);
    const serialized = JSON.stringify(summary);
    for (const card of cards) {
      expect(serialized).not.toContain(card.mechanism);
      expect(serialized).not.toContain(card.example.before);
      expect(serialized).not.toContain(card.example.after);
      expect(serialized).not.toContain(card.sources[0].caveat);
    }
  });
});
