import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { buildReliabilityPlan, emptyReliabilityEvidence, digest } from "../evals/reliability-service.mjs";
import { prepareBlindComparison } from "../evals/blinded-comparison.mjs";
import { importWorkspace, appendHumanReview, appendSourceAudit, validateBlindPacket, lockBlindRatings, sourceAuditBatch } from "../evals/review-workbench.mjs";
import { reviewFixture, reviewInput } from "./review-workbench-fixture.mjs";
let plan; const now = "2020-01-02T10:00:00Z";
beforeAll(async () => { plan = await buildReliabilityPlan(); });
function packet() {
  const conditions = ["plugin", "plain-model", "prompted-knowledge"].map(id => ({ id, target: { host: "test", model: "test-model", model_version: "v1", sampling_conditions: "synthetic" } }));
  return prepareBlindComparison({ schema_version: 1, validation_fingerprint: plan.validation_fingerprint, preregistered_at: "2020-01-01T10:00:00Z", conditions,
    cases: [{ id: "blind-workbench-development", family_id: "blind-workbench-family", prompt: "Original synthetic request.", genre: "nonfiction", origin: "authored-development", author_ids: ["codex-model"],
      outputs: conditions.map(c => ({ condition: c.id, text: `Synthetic result ${c.id}.`, recorded_at: "2020-01-01T11:00:00Z", artifact_sha256: "a".repeat(64) })) }] }, plan);
}
function ratingInput(p) { return { reviewer: { id: "qa-editor", independent: false, human_attested: true }, ratings: p.cases.flatMap(c => c.responses.map(r => ({ case_id: c.case_id, response_id: r.id, output_sha256: r.output_sha256,
  score: 3, fidelity_failure: false, reason: "Synthetic browser/software rating, not a human observation.", evidence_sha256: "c".repeat(64) }))) }; }
describe("private review workbench contracts", () => {
  it("imports empty evidence without manufacturing quality results", () => {
    const r = importWorkspace(emptyReliabilityEvidence(plan), plan);
    expect(r.report.metrics.distinct_held_out_cases_judged).toBe(0); expect(r.report.missing_obligations).toHaveLength(812);
  });
  it("keeps captured prose and prior evidence immutable", () => {
    const e = reviewFixture(plan); const before = JSON.stringify(e);
    const r = appendHumanReview(e, reviewInput(e), plan, now);
    expect(JSON.stringify(e)).toBe(before); expect(r.evidence.responses[0].output).toBe(e.responses[0].output);
    expect(r.evidence.reviews).toHaveLength(1);
  });
  it("never promotes rated authored practice to held-out quality evidence", () => {
    const e = reviewFixture(plan); const r = appendHumanReview(e, reviewInput(e), plan, now);
    expect(r.report.metrics.distinct_held_out_cases_judged).toBe(0); expect(r.report.metrics.development_responses_excluded).toBe(1);
    expect(r.report.semantic_guarantee).toBe(false);
  });
  it("requires human attestation and rejects model identity or extra actor fields", () => {
    for (const change of [{ human_attested: false }, { id: "codex-model" }, { kind: "model" }]) {
      const e = reviewFixture(plan), input = reviewInput(e); Object.assign(input.reviewer, change);
      expect(() => appendHumanReview(e, input, plan, now)).toThrow();
    }
  });
  it("does not infer independent review from a case author's checkbox", () => {
    const e = reviewFixture(plan, { heldOut: true }); expect(() => appendHumanReview(e, reviewInput(e, "outside-test-author"), plan, now)).toThrow(/author/);
    const input = reviewInput(e, "outside-test-author"); input.reviewer.independent = false;
    expect(appendHumanReview(e, input, plan, now).report.metrics.distinct_held_out_cases_judged).toBe(0);
  });
  it("requires every declared criterion and its actual reason", () => {
    const e = reviewFixture(plan), input = reviewInput(e); input.criteria.pop(); expect(() => appendHumanReview(e, input, plan, now)).toThrow();
    const missing = reviewInput(e); missing.criteria[0].reason = ""; expect(() => appendHumanReview(e, missing, plan, now)).toThrow();
  });
  it("derives failure and unresolved outcomes without a default pass override", () => {
    const e = reviewFixture(plan), unresolved = reviewInput(e); unresolved.criteria[0].outcome = "unresolved";
    expect(appendHumanReview(e, unresolved, plan, now).evidence.reviews[0].outcome).toBe("unresolved");
    const fail = reviewInput(e); fail.failure_types = ["false-criticism"];
    expect(appendHumanReview(e, fail, plan, now).evidence.reviews[0].outcome).toBe("fail");
  });
  it("does not overwrite or duplicate a locked review", () => {
    const e = reviewFixture(plan), input = reviewInput(e); const first = appendHumanReview(e, input, plan, now).evidence;
    expect(() => appendHumanReview(first, input, plan, now)).toThrow(/locked/);
  });
  it("requires two independent initial reviewers before third-person adjudication", () => {
    let e = reviewFixture(plan, { heldOut: true }); const adjudicator = { ...reviewInput(e, "third-editor"), role: "adjudicator" };
    expect(() => appendHumanReview(e, adjudicator, plan, now)).toThrow(/two earlier/);
    e = appendHumanReview(e, reviewInput(e, "first-editor"), plan, "2020-01-01T12:00:00Z").evidence;
    e = appendHumanReview(e, reviewInput(e, "second-editor", "fail"), plan, "2020-01-01T13:00:00Z").evidence;
    expect(appendHumanReview(e, adjudicator, plan, now).evidence.reviews[2].role).toBe("adjudicator");
  });
  it("requires direct source checking and preserves disagreements", () => {
    const e = emptyReliabilityEvidence(plan), section = plan.sections[0];
    const a = { section_id: section.id, reviewer: { id: "qa-editor", independent: false, human_attested: true }, outcome: "needs-correction", idea_ids: section.original_card_ids, notes: "An unresolved qualification.", source_checked: false };
    expect(() => appendSourceAudit(e, a, plan, now)).toThrow(); a.source_checked = true;
    const result = appendSourceAudit(e, a, plan, now);
    expect(result.evidence.section_audits[0].omissions_or_disagreements).toEqual([a.notes]);
    expect(result.report.missing_sections).toContain(section.id);
  });
  it("cannot silently agree with unresolved source notes or overwrite an audit", () => {
    const e = emptyReliabilityEvidence(plan), section = plan.sections[0];
    const a = { section_id: section.id, reviewer: { id: "qa-editor", independent: false, human_attested: true }, outcome: "agreed", idea_ids: section.original_card_ids, notes: "Unresolved omission", source_checked: true };
    expect(() => appendSourceAudit(e, a, plan, now)).toThrow(/Unresolved/); a.notes = "";
    const first = appendSourceAudit(e, a, plan, now).evidence;
    expect(() => appendSourceAudit(first, a, plan, now)).toThrow(/already contains/);
  });
  it("prepares seven source sections without claiming they were reviewed", () => {
    const batch = sourceAuditBatch(plan);
    expect(batch.sections).toHaveLength(7); expect(new Set(batch.sections.map(s => s.source_id)).size).toBe(7);
    expect(batch.status).toBe("prepared-not-reviewed"); expect(batch.sections.every(s => s.original_card_ids.length)).toBe(true);
  });
  it("accepts anonymous packets but refuses their condition key or leaked fields", () => {
    const p = packet(); expect(validateBlindPacket(p.packets).cases).toHaveLength(1);
    expect(() => validateBlindPacket(p.key)).toThrow(); expect(() => validateBlindPacket({ ...p.packets, conditions: p.key.conditions })).toThrow();
  });
  it("rejects changed anonymous prose or duplicate response IDs", () => {
    const p = packet().packets; p.cases[0].responses[0].text += " Changed"; expect(() => validateBlindPacket(p)).toThrow(/hashes/);
    const other = packet().packets; other.cases[0].responses[1].id = other.cases[0].responses[0].id; expect(() => validateBlindPacket(other)).toThrow(/identifiers/);
  });
  it("cannot lock partial, duplicate or mismatched ratings", () => {
    const p = packet().packets, partial = ratingInput(p); partial.ratings.pop(); expect(() => lockBlindRatings(p, partial, now)).toThrow(/incomplete|Every/);
    const duplicate = ratingInput(p); duplicate.ratings[1] = { ...duplicate.ratings[0] }; expect(() => lockBlindRatings(p, duplicate, now)).toThrow(/Every/);
    const wrong = ratingInput(p); wrong.ratings[0].output_sha256 = "f".repeat(64); expect(() => lockBlindRatings(p, wrong, now)).toThrow(/Every/);
  });
  it("locks deliberate ratings while keeping the condition key absent", () => {
    const p = packet().packets; const locked = lockBlindRatings(p, ratingInput(p), now);
    expect(locked.rater).toEqual({ id: "qa-editor", kind: "human", independent: false });
    expect(locked.ratings_locked_at).toBe(now); expect(JSON.stringify(locked)).not.toMatch(/plain-model|prompted-knowledge|conditions|assignments/);
    expect(digest(locked)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("keeps private operator sources out of the production Docker context", async () => {
    const excluded = (await readFile(new URL("../.dockerignore", import.meta.url), "utf8")).split(/\r?\n/);
    for (const path of [".review-dist", "src/review", "server/review-workbench.mjs", "evals/review-workbench.mjs", "review.html"]) expect(excluded).toContain(path);
  });
});
