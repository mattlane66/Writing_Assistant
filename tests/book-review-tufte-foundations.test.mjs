import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-tufte-foundations.cases.json", import.meta.url), "utf8"));
describe("Tufte short-sentence and noun-phrase first pass", () => {
  it("records text and inspected blanks separately without claiming completion", async () => {
    const coverage = await getWritingCoverage({});
    const source = coverage.sources.find(s => s.id === "tufte-artful-sentences");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 302, unreviewed_pages: 12,
      visually_dispositioned_pages: 12, undispositioned_pages: 0, first_pass_disposition_complete: true });
    expect(source.reviewed_ranges).toEqual([{ start: 1, end: 3 }, { start: 7, end: 236 }, { start: 238, end: 274 }, { start: 277, end: 301 }, { start: 305, end: 310 }, { start: 313, end: 313 }]);
    expect(source.visually_dispositioned_ranges).toEqual([{ start: 4, end: 6 }, { start: 237, end: 237 }, { start: 275, end: 276 }, { start: 302, end: 304 }, { start: 311, end: 312 }, { start: 314, end: 314 }]);
    expect(suite.execution_status).toBe("host-judgment-not-run");
    expect(suite.human_review_status).toBe("pending");
  });
  it.each([
    ["modifier-attachment-absolute-own-subject", "An introductory circumstance has its own noun and participle, distinct from the actor of the main clause. Do not automatically diagnose a dangling modifier or invent a causal reason."],
    ["functional-diction-nominal-subject-function", "A gerund fills the subject slot because the activity is the topic. The person affected is named; judge the function before alleging concealed responsibility."],
    ["functional-diction-neutral-reference-without-scope-drift", "Neutralize a generic masculine pronoun in a per-person instruction. Preserve exactly one card for each reviewer rather than a shared plural allocation."],
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
