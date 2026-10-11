import { beforeAll, describe, expect, it } from "vitest";
import { buildReliabilityPlan } from "../evals/reliability-service.mjs";
import { prepareBlindComparison, assessBlindComparison } from "../evals/blinded-comparison.mjs";

let plan;
beforeAll(async () => { plan = await buildReliabilityPlan(); });
const hash = "a".repeat(64);
function fixture({ n = 1, origin = "independent-held-out" } = {}) {
  const target = { host: "chatgpt-chat", model: "test-model", model_version: "v1", sampling_conditions: "identical recorded conditions" };
  return { schema_version: 1, validation_fingerprint: plan.validation_fingerprint, preregistered_at: "2026-10-10T10:00:00Z",
    conditions: ["plugin", "plain-model", "prompted-knowledge"].map(id => ({ id, target: { ...target } })),
    cases: Array.from({ length: n }, (_, i) => ({ id: `private-comparison-${i}`, family_id: `independent-family-${i}`, prompt: "The same original task for all conditions.",
      genre: "nonfiction", origin, author_ids: ["outside-author"], outputs: ["plugin", "plain-model", "prompted-knowledge"].map(condition => ({ condition,
        text: `Synthetic ${condition} output ${i}; not an observed response.`, recorded_at: "2026-10-10T11:00:00Z", artifact_sha256: hash })) })) };
}
function grades(key) {
  return { schema_version: 1, assignment_sha256: key.assignment_sha256, ratings_locked_at: "2026-10-10T12:00:00Z",
    rater: { id: "outside-reviewer", kind: "human", independent: true }, ratings: key.assignments.map(a => ({
      response_id: a.response_id, case_id: a.case_id, output_sha256: a.output_sha256, score: a.condition === "plugin" ? 4 : 3,
      fidelity_failure: false, reason: "Synthetic contract grade, never actual comparative evidence.", evidence_sha256: hash })) };
}
describe("independent blinded comparison contracts", () => {
  it("separates randomized anonymous review packets from the condition key", () => {
    const { packets, key } = prepareBlindComparison(fixture(), plan);
    expect(key.assignments).toHaveLength(3);
    expect(packets.cases[0].responses.every(r => !Object.hasOwn(r, "condition"))).toBe(true);
    expect(new Set(packets.cases[0].responses.map(r => r.id)).size).toBe(3);
    const next = prepareBlindComparison(fixture(), plan);
    expect(next.key.assignments[0].response_id).not.toBe(key.assignments[0].response_id);
    expect(packets.assignment_sha256).toBe(key.assignment_sha256);
  });
  it("does not alter captured prose before a reviewer sees it", () => {
    const input = fixture(); input.cases[0].outputs[0].text = "\n  A line with intentional spacing.\n";
    const { packets } = prepareBlindComparison(input, plan);
    expect(packets.cases[0].responses.some(r => r.text === input.cases[0].outputs[0].text)).toBe(true);
  });
  it("reports wins and fidelity failures without certifying superiority", () => {
    const { key } = prepareBlindComparison(fixture({ n: 30 }), plan);
    const r = assessBlindComparison(key, grades(key), plan);
    expect(r.status).toBe("blinded-paired-evidence-recorded"); expect(r.held_out_cases).toBe(30);
    expect(r.comparisons[0]).toMatchObject({ wins: 30, ties: 0, losses: 0, bounded_advantage_verified: false });
    expect(r).toMatchObject({ provider_calls: 0, semantic_guarantee: false });
  });
  it("preserves ties, losses and separate material-fidelity failures", () => {
    const { key } = prepareBlindComparison(fixture(), plan), ratings = grades(key);
    ratings.ratings.find(r => r.response_id === key.assignments.find(a => a.condition === "plain-model").response_id).score = 4;
    const plugin = ratings.ratings.find(r => r.response_id === key.assignments.find(a => a.condition === "plugin").response_id);
    plugin.fidelity_failure = true;
    ratings.ratings.find(r => r.response_id === key.assignments.find(a => a.condition === "prompted-knowledge").response_id).score = 5;
    const r = assessBlindComparison(key, ratings, plan);
    expect(r.comparisons[0]).toMatchObject({ ties: 1, decisive_win_rate: null, plugin_fidelity_failures: 1 });
    expect(r.comparisons[1].losses).toBe(1);
  });
  it("keeps development comparisons separate from unseen efficacy evidence", () => {
    const { key } = prepareBlindComparison(fixture({ n: 30, origin: "authored-development" }), plan);
    const r = assessBlindComparison(key, grades(key), plan);
    expect(r.held_out_cases).toBe(0); expect(r.development_cases_excluded).toBe(30);
    expect(r.status).toBe("insufficient-independent-comparable-evidence");
  });
  it("does not mistake thirty related paraphrases for thirty independent cases", () => {
    const input = fixture({ n: 30 }); input.cases.forEach(c => { c.family_id = "shared-family"; });
    const { key } = prepareBlindComparison(input, plan), r = assessBlindComparison(key, grades(key), plan);
    expect(r.independent_case_families).toBe(1); expect(r.comparisons[0].exploratory_interval).toBeNull();
    expect(r.status).toBe("insufficient-independent-comparable-evidence");
  });
  it("does not let a self-grading model or case author qualify as independent", () => {
    const { key } = prepareBlindComparison(fixture({ n: 30 }), plan);
    for (const actor of [{ kind: "model" }, { independent: false }, { id: "outside-author" }]) {
      const ratings = grades(key); Object.assign(ratings.rater, actor);
      expect(assessBlindComparison(key, ratings, plan).independently_rated).toBe(false);
    }
  });
  it("rejects incomplete ratings, duplicate grades and swapped output hashes", () => {
    const { key } = prepareBlindComparison(fixture({ n: 2 }), plan);
    const ratings = grades(key); ratings.ratings.pop(); expect(() => assessBlindComparison(key, ratings, plan)).toThrow(/Incomplete/);
    const altered = grades(key); altered.ratings[0].output_sha256 = "0".repeat(64);
    expect(() => assessBlindComparison(key, altered, plan)).toThrow(/digest/);
    const duplicate = grades(key); duplicate.ratings[1] = duplicate.ratings[0];
    expect(() => assessBlindComparison(key, duplicate, plan)).toThrow(/Duplicate/);
  });
  it("requires locked ratings after observation and preregistration before outputs", () => {
    const { key } = prepareBlindComparison(fixture(), plan), ratings = grades(key);
    ratings.ratings_locked_at = "2026-10-10T09:00:00Z";
    expect(() => assessBlindComparison(key, ratings, plan)).toThrow(/order/);
    const input = fixture(); input.preregistered_at = "2026-10-10T12:00:00Z";
    expect(() => prepareBlindComparison(input, plan)).toThrow(/predate/);
  });
  it("detects a changed key or stale workflow", () => {
    const { key } = prepareBlindComparison(fixture(), plan), ratings = grades(key);
    key.assignments[0].condition = "stronger-model";
    expect(() => assessBlindComparison(key, ratings, plan)).toThrow(/mismatch/);
    const other = prepareBlindComparison(fixture(), plan);
    expect(() => assessBlindComparison(other.key, grades(other.key), { ...plan, validation_fingerprint: "0".repeat(64) })).toThrow(/mismatch/);
  });
  it("requires all baselines under the common task", () => {
    const input = fixture(); input.conditions[2].id = "stronger-model";
    expect(() => prepareBlindComparison(input, plan)).toThrow(/required/);
  });
  it("does not attribute a model/configuration change to the writing harness", () => {
    const input = fixture({ n: 30 }); input.conditions[1].target.model_version = "different";
    const { key } = prepareBlindComparison(input, plan), r = assessBlindComparison(key, grades(key), plan);
    expect(r.comparisons[0].comparability).toBe("confounded-model-or-sampling");
    expect(r.status).toBe("insufficient-independent-comparable-evidence");
  });
  it("reports a stronger model separately", () => {
    const input = fixture(); input.conditions.push({ id: "stronger-model", target: { ...input.conditions[0].target, model: "another-model" } });
    input.cases[0].outputs.push({ condition: "stronger-model", text: "Another original synthetic result.", recorded_at: "2026-10-10T11:00:00Z", artifact_sha256: hash });
    const { key } = prepareBlindComparison(input, plan);
    expect(assessBlindComparison(key, grades(key), plan).comparisons[2].comparability).toBe("separate-model-comparator");
  });
});
