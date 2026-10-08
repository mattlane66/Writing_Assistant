import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-king-memoir.cases.json", import.meta.url), "utf8"));
describe("King complete memoir first pass", () => {
  it("records all first-pass pages without claiming semantic mastery", async () => {
    const coverage = await getWritingCoverage({});
    const source = coverage.sources.find(s => s.id === "king-on-writing");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 195, unreviewed_pages: 6,
      visually_dispositioned_pages: 6, undispositioned_pages: 0, first_pass_disposition_complete: true });
    expect(source.reviewed_ranges).toEqual([{ start: 5, end: 191 }, { start: 194, end: 201 }]);
    expect(source.visually_dispositioned_ranges).toEqual([{ start: 1, end: 4 }, { start: 192, end: 193 }]);
    expect(suite.execution_status).toBe("host-judgment-not-run");
    expect(suite.human_review_status).toBe("pending");
  });
  it.each([
    ["countermodels-stress-tests-available-character-choice", "A protagonist uses a slow entrance despite knowing a quicker accessible route. Question the unmotivated choice without assuming every person acts optimally."],
    ["local-world-rules-poetic-image-function", "A lyric poem personifies an anticipated day as a visitor. Assess the image in context instead of treating it as a literal physical event."],
    ["logic-evidence-separation-creative-cost-not-cause", "The author completed a manuscript while sleeping badly and infers that deprivation is essential to creativity. Separate coexistence from necessity."],
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
});
