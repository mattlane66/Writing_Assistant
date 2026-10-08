import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-zinsser-principles.cases.json", import.meta.url), "utf8"));
describe("Zinsser Principles review", () => {
  it("records only the extracted pages actually reviewed, without certifying ideas", async () => {
    const coverage = await getWritingCoverage({});
    const source = coverage.sources.find(s=>s.id==="zinsser-on-writing-well-6e");
    expect(source).toMatchObject({tracked_model_reviewed_pages:312,unreviewed_pages:10});
    expect(source.reviewed_ranges).not.toContainEqual({start:1,end:322});
    expect(suite.execution_status).toBe("host-judgment-not-run");
    expect(suite.human_review_status).toBe("pending");
  });
  it.each(suite.cases)("preserves recognition, execution and restraint: $card_id",async item=>{
    const corpus=await loadSourceCards();
    const card=corpus.cards.find(c=>c.id===item.card_id);
    expect(card.concept_ids).toEqual(item.concept_ids);
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice.alternatives.map(a=>a.text));
    expect(item.execution.criteria).toEqual(expect.arrayContaining(card.example.practice.invariants));
    expect(item.non_application.draft).toBe(card.counterexample.text);
    const result=await searchWritingExamples({query:item.recognition.query,limit:8});
    const retrieved=result.cards.find(c=>c.id===item.card_id);
    expect(retrieved).toEqual(card);
    expect(retrieved.exceptions.some(e=>e.includes(item.exception_anchor))).toBe(true);
  });
});
