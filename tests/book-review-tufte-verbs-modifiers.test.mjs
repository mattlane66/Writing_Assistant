import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-tufte-verbs-modifiers.cases.json", import.meta.url), "utf8"));
describe("Tufte verb, modifier and preposition first pass", () => {
  it("adds only the fifty actually read pages and keeps blank accounting separate", async () => {
    const source = (await getWritingCoverage({})).sources.find(s => s.id === "tufte-artful-sentences");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 202, unreviewed_pages: 112,
      visually_dispositioned_pages: 3, undispositioned_pages: 109, first_pass_disposition_complete: false });
    expect(source.reviewed_ranges).toEqual([{ start: 1, end: 3 }, { start: 7, end: 205 }]);
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const reviews = ledger.reviews.filter(r => r.id.startsWith("tufte-verbs-modifiers-"));
    expect(reviews.flatMap(r => r.pages).reduce((n, r) => n + r.end - r.start + 1, 0)).toBe(50);
    expect(reviews.every(r => r.method === "local-extracted-text-with-rendered-spot-checks")).toBe(true);
    expect(suite.execution_status).toBe("host-judgment-not-run");
    expect(suite.human_review_status).toBe("pending");
  });
  it.each([
    ["clause-hierarchy-purpose-not-outcome", "A purpose infinitive gives a character's goal, but success is unreported. Do not convert the intention into an accomplished outcome."],
    ["timeline-space-quantity-nonfinite-context-time", "A past participial modifier describes waves acting on a boat during an ongoing drift. Its form alone does not establish an earlier event or a tense contradiction."],
    ["modifier-attachment-split-infinitive-scope", "An adverb inside an infinitive modifies the degree of funding. Relocating it onto the settled choice changes the scope; no automatic unsplitting rule should do that."],
  ])("retrieves a differently worded authored probe without oracle tags: %s", async (id, query) => {
    const result = await searchWritingExamples({ query, limit: 8 });
    expect(result.cards.map(c => c.id)).toContain(id);
  });
  it.each(suite.cases)("transports application and restraint intact: $card_id", async item => {
    const corpus = await loadSourceCards();
    const card = corpus.cards.find(c => c.id === item.card_id);
    expect(card.concept_ids).toEqual(item.concept_ids);
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice.alternatives.map(a => a.text));
    expect(item.execution.criteria).toEqual(expect.arrayContaining(card.example.practice.invariants));
    expect(item.non_application.draft).toBe(card.counterexample.text);
    const result = await searchWritingExamples({ query: item.recognition.query, limit: 8 });
    const retrieved = result.cards.find(c => c.id === item.card_id);
    expect(retrieved).toEqual(card);
    expect(retrieved.exceptions).toContain(item.exception_anchor);
  });
  it.each([
    ["functional-diction-modifier-contribution", ["PDF pp. 93-95", "PDF pp. 104-108"]],
    ["meaning-voice-fidelity-audit-editorial-exemplars", ["PDF p. 110"]],
  ])("corroborates a stable existing method rather than duplicating it: %s", async (id, locators) => {
    const corpus = await loadSourceCards();
    expect(corpus.cards.filter(c => c.id === id)).toHaveLength(1);
    const card = corpus.cards.find(c => c.id === id);
    expect(card.sources.filter(s => s.ref === "tufte-artful-sentences").map(s => s.locator)).toEqual(locators);
    expect(card.sources.some(s => s.ref !== "tufte-artful-sentences")).toBe(true);
    expect(card.counterexample.why_not_apply).toBeTruthy();
  });
});
