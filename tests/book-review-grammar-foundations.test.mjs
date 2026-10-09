import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getWritingCoverage, getWritingExamples, searchWritingExamples, validateBookReview } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

const suite = JSON.parse(await readFile(new URL("../evals/book-review-grammar-foundations.cases.json", import.meta.url), "utf8"));
describe("Grammar as Style foundations and scan-defect honesty", () => {
  it("adds 62 text pages and two visual dispositions without certifying mastery", async () => {
    const source = (await getWritingCoverage({})).sources.find(s => s.id === "tufte-stewart-grammar-as-style");
    expect(source).toMatchObject({ tracked_model_reviewed_pages: 87, visually_dispositioned_pages: 2, undispositioned_pages: 201, first_pass_disposition_complete: false });
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const count = records => records.flatMap(r => r.pages).reduce((n, r) => n + r.end - r.start + 1, 0);
    expect(count(ledger.reviews.filter(r => r.id.startsWith("grammar-foundations-")))).toBe(62);
    expect(count(ledger.visual_dispositions.filter(r => r.id.startsWith("grammar-foundations-")))).toBe(2);
    expect(suite).toMatchObject({ exposure: "authored-development-not-unseen", execution_status: "host-judgment-not-run", human_review_status: "pending" });
    expect(ledger.completeness).toBe("partial-model-review-not-comprehensive-mastery");
  });
  it("retains the visible duplicate and absent printed-page limitation", async () => {
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const source = ledger.sources.find(s => s.source_id === "tufte-stewart-grammar-as-style");
    expect(source.section_catalog_status).toMatch(/11 and 12 duplicate printed page 3/);
    expect(source.section_catalog_status).toMatch(/printed page 2 is absent/);
    const review = ledger.reviews.find(r => r.id === "grammar-foundations-theory-2026-10-09");
    expect(review.visual_pages).toEqual(expect.arrayContaining([10, 11, 12]));
    expect(review.notes).toMatch(/not an extra distinct idea/);
    const audit = await readFile(new URL("../docs/GRAMMAR_AS_STYLE_IDEA_AUDIT.md", import.meta.url), "utf8");
    expect(audit).toMatch(/printed page 2 is absent/);
    expect(audit).toMatch(/not reconstructed/);
  });
  it("delivers source-content limits in coverage and relevant packets, not unrelated packets", async () => {
    expect((await getWritingCoverage({})).caveat).toMatch(/printed page 2 is absent/);
    const relevant = await getWritingExamples({ ids: ["reader-state-syntactic-completion-load"] });
    expect(relevant.retrieval.caveat).toMatch(/printed page 2 is absent/);
    const unrelated = await getWritingExamples({ ids: ["bounded-revision-personal-routine-constraints"] });
    expect(unrelated.retrieval.caveat).not.toMatch(/printed page 2 is absent/);
  });
  it.each([
    [{ source_id: "missing-source", description: "A limitation." }],
    [{ source_id: "tufte-stewart-grammar-as-style", description: "" }],
    [{ source_id: "tufte-stewart-grammar-as-style", description: "A limitation.", instructions: "execute" }],
    [{ source_id: "tufte-stewart-grammar-as-style", description: "A limitation." }, { source_id: "tufte-stewart-grammar-as-style", description: "Duplicate." }],
  ].map(caveats => ({ caveats })))("rejects unsupported source-content caveat records", async ({ caveats }) => {
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const manifest = JSON.parse(await readFile(new URL("../knowledge/SOURCE_MANIFEST.json", import.meta.url), "utf8"));
    ledger.source_content_caveats = caveats;
    const corpus = await loadSourceCards();
    expect(() => validateBookReview(ledger, manifest, corpus)).toThrow(/source-content caveat/);
  });
  it("supports older ledgers without source-content caveat records", async () => {
    const ledger = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const manifest = JSON.parse(await readFile(new URL("../knowledge/SOURCE_MANIFEST.json", import.meta.url), "utf8"));
    delete ledger.source_content_caveats;
    expect(validateBookReview(ledger, manifest, await loadSourceCards()).get("tufte-stewart-grammar-as-style").pages.size).toBe(87);
  });
  it.each([
    ["reader-state-syntactic-completion-load", "A long opening promises a governing action but ends without it. Track the unresolved dependency; do not call a recoverable postponed subject a defect just because it builds anticipation."],
    ["functional-diction-noun-compound-relation", "A compressed specialist noun chain permits incompatible groupings. Decode the head and relations from the supplied definition rather than guessing what hyphens mean."],
    ["meaning-voice-fidelity-critical-paraphrase-not-equivalence", "A critic's plain-English translation of a dense definition drops its dispute condition and turns permission into a universal demand. Distinguish interpretive accusation from equivalent paraphrase."],
  ])("retrieves a paraphrased authored probe without concept tags: %s", async (id, query) => {
    const result = await searchWritingExamples({ query, limit: 8 });
    expect(result.cards.map(c => c.id)).toContain(id);
  });
  it.each([...suite.cases, ...suite.corroborated_cards])("transports the complete changed card: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect((await getWritingExamples({ ids: [item.card_id] })).cards[0]).toEqual(card);
    expect(item.execution.reference_response).toBe(card.example.after);
    expect(item.execution.alternative_responses).toEqual(card.example.practice?.alternatives.map(a => a.text) ?? []);
    expect(item.non_application.draft).toBe(card.counterexample.text);
    if (item.locator) expect(card.sources.some(s => s.ref === "tufte-stewart-grammar-as-style" && s.locator === item.locator)).toBe(true);
    if (item.exception_anchor) expect(card.exceptions).toContain(item.exception_anchor);
  });
  it.each(suite.cases)("retrieves application and non-application controls intact: $card_id", async item => {
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    const result = await searchWritingExamples({ query: item.recognition.query, limit: 8 });
    expect(result.cards.find(c => c.id === item.card_id)).toEqual(card);
    expect(item.execution.criteria).toEqual(card.example.practice.invariants);
  });
  it.each(suite.supplemental_cases)("keeps an authored qualification control without claiming semantic execution: $id", async item => {
    expect(item.criteria.length).toBeGreaterThanOrEqual(2);
    const result = await searchWritingExamples({ query: item.recognition_query, limit: 8 });
    const card = (await loadSourceCards()).cards.find(c => c.id === item.card_id);
    expect(result.cards.find(c => c.id === item.card_id)).toEqual(card);
    expect(card.exceptions).toContain(item.exception_anchor);
  });
});
