import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-tufte-coordination-branching.cases.json", import.meta.url), "utf8"));
describe("Tufte coordination, openers and branching first pass", () => {
  it("accounts for only the forty-eight newly read pages and retains validation gaps", async () => {
    const source = (await getWritingCoverage({})).sources.find(s => s.id === "tufte-artful-sentences");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 202, unreviewed_pages: 112,
      visually_dispositioned_pages: 3, undispositioned_pages: 109, first_pass_disposition_complete: false });
    expect(source.reviewed_ranges).toEqual([{ start: 1, end: 3 }, { start: 7, end: 205 }]);
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const reviews = ledger.reviews.filter(r => r.id.startsWith("tufte-coordination-branching-"));
    expect(reviews.flatMap(r => r.pages).reduce((n, r) => n + r.end - r.start + 1, 0)).toBe(48);
    expect(reviews.flatMap(r => r.visual_pages)).toEqual([134, 136, 160, 171, 173, 174, 175, 179, 180, 188, 189]);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
  });
  it.each([
    ["sentence-commitments-inclusive-choice-coordination", "Replace an and/or submission rule with a clear inclusive choice. Either item alone and both together remain eligible; do not demand exactly one."],
    ["noun-verb-agency-fronted-object-role-map", "In an object-first inversion, the unusual opening is not the agent. Preserve who keeps the key and who returns the map; fronting supports contrast."],
    ["modifier-attachment-branch-relocation-audit", "Moving a free modifier from a left branch to after another possible actor creates competing attachment. Preserve the supplied lantern holder, not a smooth but changed scene."],
  ])("retrieves a paraphrased authored probe without oracle tags: %s", async (id, query) => {
    const result = await searchWritingExamples({ query, limit: 8 });
    expect(result.cards.map(c => c.id)).toContain(id);
  });
  it.each(suite.cases)("transports application and restraint intact: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
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
  it.each(suite.supplemental_cases)("retains an authored qualification control, not a semantic pass: $id", async item => {
    expect(item.draft).toBeTruthy();
    expect(item.criteria.length).toBeGreaterThanOrEqual(2);
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(card.exceptions).toContain(item.exception_anchor);
    const result = await searchWritingExamples({ query: item.recognition_query, limit: 8 });
    expect(result.cards.find(c => c.id === item.card_id)).toEqual(card);
  });
  it.each([
    ["modifier-attachment-participial-opener-anchor", "PDF pp. 159-162"],
    ["sentence-commitments-reversible-deletion", "PDF pp. 173-175"],
    ["clause-hierarchy-frame-order-scope", "PDF pp. 157-159"],
    ["cohesion-transition-adverb-position-and-focus", "PDF p. 135"],
  ])("corroborates the existing stable card without duplicating it: %s", async (id, locator) => {
    const corpus = await loadSourceCards();
    expect(corpus.cards.filter(c => c.id === id)).toHaveLength(1);
    expect(corpus.cards.find(c => c.id === id).sources.some(s => s.ref === "tufte-artful-sentences" && s.locator === locator)).toBe(true);
  });
});
