import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, getWritingExamples, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-grammar-verbs-coordination.cases.json", import.meta.url), "utf8"));
describe("Grammar as Style verbal, modifier, preposition and coordination review", () => {
  it("accounts for 60 new text pages without claiming judgment validation", async () => {
    const coverage = await getWritingCoverage({});
    expect(coverage).toMatchObject({ card_count: 199, tracked_model_reviewed_pages: 1130, undispositioned_pages: 198 });
    expect(coverage.sources.find(s => s.id === "tufte-stewart-grammar-as-style")).toMatchObject({ tracked_model_reviewed_pages: 207, visually_dispositioned_pages: 2, undispositioned_pages: 81 });
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const records = ledger.reviews.filter(r => r.id.startsWith("grammar-verbs-coordination-"));
    expect(records.flatMap(r => r.pages).reduce((n,r) => n + r.end - r.start + 1, 0)).toBe(60);
    expect(records.flatMap(r => r.visual_pages)).toEqual([69,73,84,88,98,101,105,116,122]);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
    expect(coverage.caveat).toMatch(/printed page 2 is absent/);
  });
  it.each([...suite.cases, ...suite.corroborated_cards])("retains the full method and authored execution/restraint contract: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect((await getWritingExamples({ ids: [item.card_id] })).cards[0]).toEqual(card);
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice?.alternatives.map(a => a.text) ?? []);
    expect(item.execution.criteria).toEqual(card.example.practice?.invariants ?? ["Preserve the supplied task and commitments."]);
    expect(item.non_application.draft).toBe(card.counterexample.text);
    expect(card.exceptions).toContain(item.exception_anchor);
    if (item.locator) expect(card.sources.some(s => s.ref === "tufte-stewart-grammar-as-style" && s.locator === item.locator)).toBe(true);
  });
  it.each(suite.cases)("retrieves authored recognition guidance without oracle concept tags: $card_id", async item => {
    const result = await searchWritingExamples({ query: item.recognition.query, limit: 8 });
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(result.cards.find(c => c.id === item.card_id)).toEqual(card);
  });
  it.each([
    ["sentence-commitments-infinitive-governing-frame", "A hoped-for repair and an outstanding test are polished into two accomplishments. Recover the governing stance and not-yet status rather than promote embedded activities into events."],
    ["text-world-ledger-fragment-motion-or-location", "A caption gives a fixed spatial arrangement without a verb. An expansion invents ascent; returning to an earlier question is mistaken for physical travel. Distinguish static scene, implied movement and discourse redirection."],
    ["reader-state-correlative-predicate-recovery", "A paired not-only construction lends its first predicate to the second object. The notes specify different actions. Recover the ellipsis and complete the pair without changing what was inspected versus repaired."],
  ])("retrieves a paraphrased development probe: %s", async (id, query) => {
    expect((await searchWritingExamples({ query, limit: 8 })).cards.map(c => c.id)).toContain(id);
  });
});
