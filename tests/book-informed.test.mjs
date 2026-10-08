import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { callWritingAssistantTool, getWritingAssistantTools, handleWritingAssistantMcp } from "../server/mcp.mjs";
import { getWritingCoverage, searchWritingExamples, getWritingExamples, checkWritingRevision, validateBookReview } from "../server/book-informed.mjs";
import { loadSourceCards } from "../server/source-cards.mjs";

describe("book-informed MCP extension", () => {
  it("excludes private books, extracted text and receipts from Docker context", async () => {
    const ignored = (await readFile(new URL("../.dockerignore", import.meta.url), "utf8")).split(/\r?\n/);
    for (const target of ["knowledge/private", "knowledge/vector-store.local.json", "*.pdf", ".env.*", "node_modules"]) {
      expect(ignored).toContain(target);
    }
  });
  it("keeps all baseline tools and adds no UI or provider requirement to new tools", () => {
    const added = getWritingAssistantTools().slice(4);
    expect(added.map(t => t.name)).toEqual(["search_writing_examples", "get_writing_examples", "get_writing_coverage", "check_writing_revision"]);
    for (const t of added) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
      expect(t._meta.ui).toBeUndefined();
      expect(t.securitySchemes).toEqual([{ type: "noauth" }]);
    }
  });
  it("reports actual gaps, stable concept coverage, source identities and caveats", async () => {
    const c = await getWritingCoverage({});
    expect(c).toMatchObject({ card_count: 123, method_count: 40, total_pdf_pages: 1360, tracked_model_reviewed_pages: 396, unreviewed_pages: 964 });
    expect(c.methods.every(m => m.card_count > 0)).toBe(true);
    expect(c.sources).toHaveLength(7);
    expect(c.sources.reduce((n,s) => n + s.tracked_model_reviewed_pages, 0)).toBe(396);
    expect(c.sources.find(s => s.id === "bookey-100-ways-summary").authority_caveat).toContain("complete Gary Provost book");
    expect(c.corpus_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(c)).not.toMatch(/\/Users\/|private\/|api_key/i);
  });
  it("returns complete original cards, exceptions and non-application controls", async () => {
    const p = await searchWritingExamples({ query: "unknown actor preserve passive voice", concept_ids: ["passive-voice"], limit: 4 });
    const corpus = await loadSourceCards();
    expect(p.cards.length).toBeGreaterThan(0);
    for (const card of p.cards) expect(card).toEqual(corpus.cards.find(c => c.id === card.id));
    expect(p.coverage.completeSelectedCardPayloads).toBe(true);
    expect(p.coverage.relevanceGuarantee).toBe(false);
    expect(p.coverage.serializedCharacters).toBeLessThanOrEqual(14000);
    expect(p.source_identities.length).toBeGreaterThan(0);
    const fetched = await getWritingExamples({ ids: [p.cards[0].id] });
    expect(fetched.cards[0]).toEqual(p.cards[0]);
    expect(p.example_policy).toMatch(/Original illustrative/);
  });
  it.each([
    ["search_writing_examples", { query: "x", concept_ids: ["invented-method"] }],
    ["search_writing_examples", { query: "x", draft: "private text must not enter retrieval" }],
    ["search_writing_examples", { query: "x".repeat(1201) }],
    ["search_writing_examples", { query: "x", limit: 9 }],
    ["get_writing_examples", { ids: ["../../.env.local"] }],
    ["get_writing_examples", { ids: ["x", "x"] }],
    ["get_writing_coverage", { path: "/Users/person/private.pdf" }],
    ["check_writing_revision", { original: "Secret draft", candidate: "Changed", editing_mode: "edit" }],
    ["check_writing_revision", { original: "Secret draft", candidate: "Changed", editing_mode: "edit", text_processing_authorized: false }],
    ["check_writing_revision", { original: "x".repeat(12001), candidate: "Changed", editing_mode: "edit", text_processing_authorized: true }],
  ])("rejects malformed or privacy-boundary arguments for %s", async (name, args) => {
    const r = await callWritingAssistantTool(name, args);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toContain("Secret draft");
  });
  it("checks exact percentage mismatches without claiming semantic truth", () => {
    const r = checkWritingRevision({ original: "The percentage increase from 100 to 120 is exactly 20 percent.", candidate: "The percentage increase from 100 to 120 is exactly 30 percent.", editing_mode: "edit", text_processing_authorized: true });
    expect(r.model_calls).toBe(0);
    expect(r.semantic_certification).toBe(false);
    expect(r.meaning_review.formalChecks[0]).toMatchObject({ status: "mismatch", expected: 20, stated: 30 });
    expect(r.meaning_review.candidates[0].candidateEvidence[0].text).toContain("30 percent");
  });
  it("does not turn ordinary rounded rates into exact calculation errors", () => {
    const r = checkWritingRevision({ original: "One out of three is about 33 percent.", candidate: "One out of three is about 33 percent.", editing_mode: "edit", text_processing_authorized: true });
    expect(r.meaning_review.formalChecks).toEqual([]);
    expect(r.caveat).toMatch(/never certifies/);
  });
  it.each(["craft-analysis", "argument-analysis", "draft"])("does not require %s output to restate the source", mode => {
    const r = checkWritingRevision({ original: "Some participants may improve.", candidate: "The evidence does not establish a universal effect.", editing_mode: mode, text_processing_authorized: true });
    expect(r.meaning_review.enabled).toBe(false);
    expect(r.world_fidelity).toBeNull();
  });
  it("surfaces qualification loss as a review candidate, not a confirmed error", () => {
    const r = checkWritingRevision({ original: "Some participants may improve.", candidate: "Participants improve.", editing_mode: "edit", text_processing_authorized: true });
    expect(r.meaning_review.candidates.length).toBeGreaterThan(0);
    expect(r.meaning_review.candidates.every(c => c.status === "requires-review")).toBe(true);
  });
  it("executes the new coverage tool over the existing JSON-RPC path", async () => {
    const r = await handleWritingAssistantMcp({ jsonrpc: "2.0", id: "coverage", method: "tools/call", params: { name: "get_writing_coverage", arguments: {} } });
    expect(r.result.structuredContent.unreviewed_pages).toBe(964);
  });
  it("fails closed on identity, caveat and reviewed-page drift", async () => {
    const manifest = JSON.parse(await readFile(new URL("../knowledge/SOURCE_MANIFEST.json", import.meta.url), "utf8"));
    const raw = JSON.parse(await readFile(new URL("../knowledge/SOURCE_REVIEW.json", import.meta.url), "utf8"));
    const corpus = await loadSourceCards();
    const identity = structuredClone(raw); identity.sources[0].sha256 = "0".repeat(64);
    expect(() => validateBookReview(identity, manifest, corpus)).toThrow(/identity/);
    const caveat = structuredClone(raw); caveat.sources[0].authority_caveat = "unqualified mastery";
    expect(() => validateBookReview(caveat, manifest, corpus)).toThrow(/caveat/);
    const duplicate = structuredClone(raw); duplicate.reviews.push({ ...duplicate.reviews[0], id: "duplicate-new-id" });
    expect(() => validateBookReview(duplicate, manifest, corpus)).toThrow(/Overlapping/);
    const duplicateCard = structuredClone(raw);
    const withCards = duplicateCard.reviews.find(r => r.card_ids.length);
    withCards.card_ids.push(withCards.card_ids[0]);
    expect(() => validateBookReview(duplicateCard, manifest, corpus)).toThrow(/duplicated/);
    const noId = structuredClone(raw); delete noId.reviews[0].id;
    expect(() => validateBookReview(noId, manifest, corpus)).toThrow(/review evidence/);
  });
});
