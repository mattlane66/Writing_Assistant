import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-tufte-closing.cases.json", import.meta.url), "utf8"));
describe("Artful Sentences closing review and honest completion boundary", () => {
  it("adds one hundred text pages and nine inspected dispositions without certifying mastery", async () => {
    const source = (await getWritingCoverage({})).sources.find(s => s.id === "tufte-artful-sentences");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 302, unreviewed_pages: 12,
      visually_dispositioned_pages: 12, undispositioned_pages: 0, first_pass_disposition_complete: true });
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const reviews = ledger.reviews.filter(r => r.id.startsWith("tufte-closing-"));
    const dispositions = ledger.visual_dispositions.filter(r => r.id.startsWith("tufte-closing-"));
    expect(reviews.flatMap(r => r.pages).reduce((n, r) => n + r.end - r.start + 1, 0)).toBe(100);
    expect(dispositions.flatMap(r => r.pages).reduce((n, r) => n + r.end - r.start + 1, 0)).toBe(9);
    expect(dispositions.every(r => r.method === "local-rendered-page-inspection")).toBe(true);
    expect(ledger.completeness).toBe("partial-model-review-not-comprehensive-mastery");
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
  });
  it.each([
    ["reader-state-question-function-and-presupposition", "A why question assumes a successful outcome even though the result has not been measured. Distinguish a leading presupposition from evidence of failure or manipulative intent."],
    ["clause-hierarchy-ellipsis-shared-predicate", "Parallel clauses omit a repeated predicate. Recover the understood action before accepting concise ellipsis; do not transfer approved where only reviewed was supplied."],
    ["rhythm-and-sound-grounded-mimetic-sequence", "Compare stop-start mimetic syntax with a continuous account of the same actions. Sentence motion must follow the supplied scene, not invent dramatic beats or emotions."],
  ])("retrieves a differently worded authored probe without oracle tags: %s", async (id, query) => {
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
  it.each(suite.supplemental_cases)("keeps an authored qualification control, not a semantic pass: $id", async item => {
    expect(item.draft).toBeTruthy();
    expect(item.criteria.length).toBeGreaterThanOrEqual(2);
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(card.exceptions).toContain(item.exception_anchor);
    const result = await searchWritingExamples({ query: item.recognition_query, limit: 8 });
    expect(result.cards.find(c => c.id === item.card_id)).toEqual(card);
  });
  it.each([
    ["cohesion-transition-structural-linkage", "PDF pp. 239-241"],
    ["rhythm-and-sound-informative-parallelism", "PDF pp. 219-221"],
    ["rhythm-and-sound-comparative-sentence-audit", "PDF pp. 252-253"],
    ["clause-hierarchy-frame-order-scope", "PDF p. 272"],
  ])("corroborates a stable existing method without duplicating it: %s", async (id, locator) => {
    const corpus = await loadSourceCards();
    expect(corpus.cards.filter(c => c.id === id)).toHaveLength(1);
    expect(corpus.cards.find(c => c.id === id).sources.some(s => s.ref === "tufte-artful-sentences" && s.locator === locator)).toBe(true);
  });
});
