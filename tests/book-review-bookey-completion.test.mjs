import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, getWritingExamples, searchWritingExamples } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-bookey-completion.cases.json", import.meta.url), "utf8"));
describe("Bookey supplied-page completion, not primary-book or idea mastery", () => {
  it("accounts for every supplied page while preserving source-content limits", async () => {
    const coverage = await getWritingCoverage({});
    expect(coverage).toMatchObject({ card_count: 203, tracked_model_reviewed_pages: 1310, visually_dispositioned_pages: 50, undispositioned_pages: 0, unreviewed_pages: 50 });
    expect(coverage.sources.every(s => s.first_pass_disposition_complete)).toBe(true);
    const bookey = coverage.sources.find(s => s.id === "bookey-100-ways-summary");
    expect(bookey).toMatchObject({ tracked_model_reviewed_pages: 106, visually_dispositioned_pages: 17, undispositioned_pages: 0, first_pass_disposition_complete: true });
    expect(bookey.authority_caveat).toContain("complete Gary Provost book");
    expect(coverage.completeness).toBe("partial-model-review-not-comprehensive-mastery");
    expect(coverage.caveat).toContain("printed page 2 is absent");
    expect(coverage.caveat).toContain("visibly gates");
    expect(coverage.caveat).toContain("Quiz answer keys");
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const records = ledger.reviews.filter(r => r.id.startsWith("bookey-completion-"));
    expect(records.flatMap(r => r.pages).reduce((n,r) => n + r.end - r.start + 1, 0)).toBe(100);
    expect(records.flatMap(r => r.visual_pages)).toEqual([2,11,17,28,29,36,40,81,98,101,113]);
    expect(ledger.visual_dispositions.find(r => r.id === "bookey-completion-image-advertisements-2026-10-11")).toMatchObject({
      disposition: "context", pages: [5,18,30,42,50,54,59,63,66,78,91,103,112,115,118,121,123].map(p => ({ start:p, end:p })),
    });
    const datasets = (await readdir(new URL("../evals/", import.meta.url))).filter(f => /^book-review-.*\.cases\.json$/.test(f));
    expect(datasets).toHaveLength(16);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
  });
  it.each([...suite.cases,...suite.corroborated_cards])("transports application and restraint: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    const packet = await getWritingExamples({ ids: [item.card_id] });
    expect(packet.cards[0]).toEqual(card);
    expect(packet.retrieval.caveat).toContain("visibly gates");
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice?.alternatives.map(a => a.text) ?? []);
    expect(item.execution.criteria).toEqual(card.example.practice?.invariants ?? ["Preserve the supplied task and commitments."]);
    if (card.counterexample) expect(item.non_application.draft).toBe(card.counterexample.text);
    expect(card.exceptions).toContain(item.exception_anchor);
    if (item.locator) expect(card.sources.some(s => s.ref === "bookey-100-ways-summary" && s.locator === item.locator)).toBe(true);
  });
  it.each(suite.cases)("retrieves original authored recognition: $card_id", async item => {
    expect((await searchWritingExamples({ query: item.recognition.query, limit: 8 })).cards.map(c => c.id)).toContain(item.card_id);
  });
  it.each(suite.supplemental_cases)("retains an authored qualification control, not observed judgment: $id", async item => {
    expect(item.criteria.length).toBeGreaterThanOrEqual(3);
    expect(item.reference_response.trim().length).toBeGreaterThan(20);
    expect((await searchWritingExamples({ query: item.recognition_query, limit: 8 })).cards.map(c => c.id)).toContain(item.card_id);
  });
  it.each([
    ["functional-diction-lexical-substitution-commitments", "A proposed lively synonym turns a brief glance into sustained attention and a generic dog into a named breed. Audit added duration, intensity and identity rather than reward shorter or stronger wording."],
    ["clause-hierarchy-punctuation-restriction-and-pause", "Comma placement turns a subset-identifying relative clause into a supplementary aside. Keep the actual restriction and required facts; punctuation is not determined by where a reader takes a breath."],
  ])("retrieves paraphrased development recognition: %s", async (id,query) => {
    expect((await searchWritingExamples({ query, limit: 8 })).cards.map(c => c.id)).toContain(id);
  });
  it("does not let completed source accounting erase conditional safeguards", async () => {
    const prompt = await readFile(new URL("../knowledge/SYSTEM_PROMPT.md", import.meta.url), "utf8");
    expect(prompt).toContain("Quiz prompts can contain deliberately false statements");
    expect(prompt).toContain("breath alone does not decide comma placement");
    expect(prompt).toContain("not restoration of absent source content or guaranteed idea mastery");
  });
  it("keeps new public examples original and secondary provenance explicit", () => {
    for (const item of suite.cases) {
      expect(item.execution.criteria.length).toBeGreaterThanOrEqual(4);
      expect(item.non_application.reference_response.length).toBeGreaterThan(60);
    }
  });
});
