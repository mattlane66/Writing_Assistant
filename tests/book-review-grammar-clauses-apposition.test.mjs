import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, getWritingExamples, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-grammar-clauses-apposition.cases.json", import.meta.url), "utf8"));
describe("Grammar as Style clause, branch and apposition review", () => {
  it("accounts for 60 reviewed pages including one preview, without claiming mastery", async () => {
    const coverage = await getWritingCoverage({});
    expect(coverage).toMatchObject({ card_count: 199, tracked_model_reviewed_pages: 1130, visually_dispositioned_pages: 32, undispositioned_pages: 198 });
    expect(coverage.sources.find(s => s.id === "tufte-stewart-grammar-as-style")).toMatchObject({ tracked_model_reviewed_pages: 207, visually_dispositioned_pages: 2, undispositioned_pages: 81 });
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const records = ledger.reviews.filter(r => r.id.startsWith("grammar-clauses-apposition-"));
    expect(records.flatMap(r => r.pages).reduce((n,r) => n + r.end - r.start + 1, 0)).toBe(60);
    expect(records.flatMap(r => r.visual_pages)).toEqual([130,131,140,151,152,154,155,159,165,171,179,180]);
    expect(records.find(r => r.pages[0].start === 184)).toMatchObject({ status: "context-reviewed", card_ids: [] });
    expect(records.find(r => r.visual_pages.includes(154)).notes).toMatch(/No assertion of repaired full OCR/);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
    expect(coverage.caveat).toMatch(/printed page 2 is absent/);
  });
  it.each([...suite.cases, ...suite.corroborated_cards])("transports complete guidance and authored execution/restraint: $card_id", async item => {
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
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect((await searchWritingExamples({ query: item.recognition.query, limit: 8 })).cards.find(c => c.id === item.card_id)).toEqual(card);
  });
  it.each(suite.supplemental_cases)("retains an authored qualification control, not semantic execution evidence: $id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(item.criteria.length).toBeGreaterThanOrEqual(3);
    expect(item.reference_response.length).toBeGreaterThan(60);
    expect(card.exceptions).toContain(item.exception_anchor);
    expect((await searchWritingExamples({ query: item.recognition_query, limit: 8 })).cards.find(c => c.id === item.card_id)).toEqual(card);
  });
  it.each([
    ["reader-state-cumulative-detail-thread", "A loose accumulation describes a container, elaborates its label, then returns to the other containers. Follow each branch's principal and changing level rather than flatten every added phrase into an equal list."],
    ["sentence-commitments-appositive-range-equivalence", "Items after a dash illustrate a broader category. A shorter substitute turns those examples into the complete inventory. Test semantic range rather than assume a grammatically replaceable appositive has identical meaning."],
  ])("retrieves a paraphrased development probe: %s", async (id, query) => {
    expect((await searchWritingExamples({ query, limit: 8 })).cards.map(c => c.id)).toContain(id);
  });
});
