import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, getWritingExamples, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-grammar-closing.cases.json", import.meta.url), "utf8"));
describe("Grammar as Style closing source review, not semantic mastery", () => {
  it("accounts for the remaining 80 text pages and one blank without repairing absent content", async () => {
    const coverage = await getWritingCoverage({});
    expect(coverage).toMatchObject({ card_count: 201, tracked_model_reviewed_pages: 1210, visually_dispositioned_pages: 33, undispositioned_pages: 117, unreviewed_pages: 150 });
    expect(coverage.sources.find(s => s.id === "tufte-stewart-grammar-as-style")).toMatchObject({ tracked_model_reviewed_pages: 287, visually_dispositioned_pages: 3, undispositioned_pages: 0, first_pass_disposition_complete: true });
    expect(coverage.sources.filter(s => !s.first_pass_disposition_complete).map(s => s.id)).toEqual(["bookey-100-ways-summary"]);
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const records = ledger.reviews.filter(r => r.id.startsWith("grammar-closing-"));
    expect(records.flatMap(r => r.pages).reduce((n,r) => n + r.end - r.start + 1, 0)).toBe(80);
    expect(records.flatMap(r => r.visual_pages)).toEqual([190,195,217,220,224,227,232,233,243,248,251,258,260,263,264,286,287]);
    expect(records.filter(r => r.status === "context-reviewed").map(r => r.card_ids)).toEqual([[],[]]);
    expect(records.find(r => r.id.includes("term-index")).notes).toMatch(/conflicting with the chapter/);
    expect(ledger.visual_dispositions.find(r => r.id === "grammar-closing-blank-final-2026-10-09")).toMatchObject({ pages: [{ start: 290, end: 290 }], disposition: "blank" });
    expect(coverage.caveat).toMatch(/printed page 2 is absent/);
    expect(coverage.caveat).toMatch(/conflicting with the chapter/);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
  });
  it.each([...suite.cases,...suite.corroborated_cards])("transports full reference application and restraint: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect((await getWritingExamples({ ids: [item.card_id] })).cards[0]).toEqual(card);
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice?.alternatives.map(a => a.text) ?? []);
    expect(item.execution.criteria).toEqual(card.example.practice?.invariants ?? ["Preserve the supplied task and commitments."]);
    expect(item.non_application.draft).toBe(card.counterexample.text);
    expect(card.exceptions).toContain(item.exception_anchor);
    if (item.locator) expect(card.sources.some(s => s.ref === "tufte-stewart-grammar-as-style" && s.locator === item.locator)).toBe(true);
  });
  it.each(suite.cases)("retrieves authored recognition without oracle tags: $card_id", async item => {
    expect((await searchWritingExamples({ query: item.recognition.query, limit: 8 })).cards.map(c => c.id)).toContain(item.card_id);
  });
  it.each(suite.supplemental_cases)("retains a qualification control, not observed judgment: $id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(card.exceptions).toContain(item.exception_anchor);
    expect(item.criteria.length).toBeGreaterThanOrEqual(3);
    expect(item.reference_response.length).toBeGreaterThan(60);
    expect((await searchWritingExamples({ query: item.recognition_query, limit: 8 })).cards.map(c => c.id)).toContain(item.card_id);
  });
  it.each([
    ["parallelism-truth-chiasmic-relation-map", "A mirrored pair puts an object before its actor in the second clause. Recover the actor and object beneath the reversal; do not give the two distinct actions one repeated verb or assume paired items are opposites."],
    ["text-world-consistency-perceived-motion-not-world-change", "A moving observer sees stationary scenery recede, look smaller and disappear behind an obstruction. Separate apparent motion and lost visibility from physical shrinkage or destruction; do not invent a missing viewpoint."],
  ])("retrieves paraphrased development recognition: %s", async (id,query) => {
    expect((await searchWritingExamples({ query, limit: 8 })).cards.map(c => c.id)).toContain(id);
  });
  it("carries the conditional safeguards in the operating contract", async () => {
    const prompt = await readFile(new URL("../knowledge/SYSTEM_PROMPT.md", import.meta.url), "utf8");
    expect(prompt).toContain("Mirrored phrase positions do not reverse the actors");
    expect(prompt).toContain("A moving viewpoint can make stationary objects seem to pass");
    expect(prompt).toContain("An index cross-reference must not silently override");
  });
});
