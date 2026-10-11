import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { digest, wilsonInterval } from "./reliability-service.mjs";

const Text = z.string().trim().min(1).max(24000);
const Prose = z.string().min(1).max(24000).refine(s => s.trim().length > 0);
const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Time = z.iso.datetime({ offset: true });
const Target = z.object({ host: Text.max(100), model: Text.max(120), model_version: Text.max(120), sampling_conditions: Text.max(400) }).strict();
const Condition = z.enum(["plugin", "plain-model", "prompted-knowledge", "stronger-model"]);
export const BlindInputSchema = z.object({ schema_version: z.literal(1), validation_fingerprint: Digest,
  preregistered_at: Time, conditions: z.array(z.object({ id: Condition, target: Target }).strict()).min(3).max(4),
  cases: z.array(z.object({ id: Id, family_id: Id, prompt: Prose, genre: Text.max(100),
    origin: z.enum(["authored-development", "independent-held-out"]), author_ids: z.array(Id).min(1),
    outputs: z.array(z.object({ condition: Condition, text: Prose, recorded_at: Time, artifact_sha256: Digest }).strict()).min(3).max(4) }).strict()).min(1).max(2000),
}).strict();
export const BlindRatingsSchema = z.object({ schema_version: z.literal(1), assignment_sha256: Digest,
  rater: z.object({ id: Id, kind: z.enum(["human", "model"]), independent: z.boolean() }).strict(),
  ratings_locked_at: Time, ratings: z.array(z.object({ case_id: Id, response_id: Id, output_sha256: Digest,
    score: z.number().int().min(1).max(5), fidelity_failure: z.boolean(), reason: Text, evidence_sha256: Digest }).strict()).min(3).max(8000),
}).strict();
const assert = (ok, message) => { if (!ok) throw new TypeError(message); };
const unique = (rows, key) => assert(new Set(rows.map(key)).size === rows.length, "Duplicate comparison record.");
const shuffled = rows => {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};

// No model calls; outputs come from separately observed sessions with a common task.
// Never give the sealed key to the rater until ratings have been locked.
export function prepareBlindComparison(input, plan) {
  const parsed = BlindInputSchema.safeParse(input);
  assert(parsed.success, "Invalid blind input; no evaluated text is echoed.");
  const value = parsed.data;
  assert(value.validation_fingerprint === plan.validation_fingerprint, "Stale comparison fingerprint.");
  unique(value.conditions, c => c.id); unique(value.cases, c => c.id);
  assert(["plugin", "plain-model", "prompted-knowledge"].every(id => value.conditions.some(c => c.id === id)), "Plugin, plain-model and prompted-knowledge baselines are required.");
  const assignments = [], packets = [];
  for (const c of value.cases) {
    unique(c.outputs, o => o.condition);
    assert(c.outputs.length === value.conditions.length && value.conditions.every(condition => c.outputs.some(o => o.condition === condition.id)), "Each case needs all declared conditions.");
    assert(c.outputs.every(o => Date.parse(o.recorded_at) > Date.parse(value.preregistered_at)), "Outputs predate comparison preregistration.");
    if (c.origin === "independent-held-out") assert(!plan.public_fixture_ids.includes(c.id) && !c.author_ids.includes("codex-model"), "Public practice is not held-out comparison evidence.");
    const responses = shuffled(c.outputs).map(o => {
      const id = `response-${randomBytes(12).toString("hex")}`, hash = digest(o.text);
      assignments.push({ response_id: id, case_id: c.id, condition: o.condition, output_sha256: hash,
        artifact_sha256: o.artifact_sha256, recorded_at: o.recorded_at });
      return { id, output_sha256: hash, text: o.text };
    });
    packets.push({ case_id: c.id, prompt: c.prompt, responses });
  }
  const body = { schema_version: 1, validation_fingerprint: value.validation_fingerprint,
    preregistered_at: value.preregistered_at, conditions: value.conditions,
    cases: value.cases.map(({ id, family_id, genre, origin, author_ids }) => ({ id, family_id, genre, origin, author_ids })), assignments };
  const key = { ...body, assignment_sha256: digest(body) };
  return { packets: { schema_version: 1, assignment_sha256: key.assignment_sha256,
    rubric: "Rate overall task success from 1 (materially wrong) to 5 (strong, faithful and appropriately restrained). Flag material fidelity failure separately. Judge all outputs under the same prompt; preserve ties and no-change successes. Score before learning conditions.", cases: packets }, key };
}

export function assessBlindComparison(key, ratingsInput, plan) {
  // Validate the key by reconstruction; also bound/validate all nested records.
  const KeySchema = z.object({ schema_version: z.literal(1), validation_fingerprint: Digest, preregistered_at: Time,
    conditions: BlindInputSchema.shape.conditions,
    cases: z.array(z.object({ id: Id, family_id: Id, genre: Text.max(100), origin: z.enum(["authored-development", "independent-held-out"]), author_ids: z.array(Id).min(1) }).strict()).min(1).max(2000),
    assignments: z.array(z.object({ response_id: Id, case_id: Id, condition: Condition, output_sha256: Digest, artifact_sha256: Digest, recorded_at: Time }).strict()).min(3).max(8000), assignment_sha256: Digest }).strict();
  const kp = KeySchema.safeParse(key), rp = BlindRatingsSchema.safeParse(ratingsInput);
  assert(kp.success && rp.success, "Invalid comparison key or ratings; no evaluated text is echoed.");
  key = kp.data; const ratings = rp.data;
  const { assignment_sha256: hash, ...body } = key;
  assert(digest(body) === hash && ratings.assignment_sha256 === hash && key.validation_fingerprint === plan.validation_fingerprint, "Comparison key, ratings, or workflow digest mismatch.");
  unique(key.conditions, c => c.id); unique(key.cases, c => c.id); unique(key.assignments, a => a.response_id);
  unique(key.assignments, a => `${a.case_id}:${a.condition}`); unique(ratings.ratings, r => r.response_id);
  assert(["plugin", "plain-model", "prompted-knowledge"].every(id => key.conditions.some(c => c.id === id)), "Required baselines absent.");
  assert(ratings.ratings.length === key.assignments.length, "Incomplete blinded ratings.");
  for (const a of key.assignments) {
    assert(key.cases.some(c => c.id === a.case_id) && key.conditions.some(c => c.id === a.condition), "Unknown comparison assignment.");
    const grade = ratings.ratings.find(r => r.response_id === a.response_id);
    assert(grade && grade.case_id === a.case_id && grade.output_sha256 === a.output_sha256, "Ratings do not match the observed output digest.");
    assert(Date.parse(a.recorded_at) > Date.parse(key.preregistered_at) && Date.parse(ratings.ratings_locked_at) >= Date.parse(a.recorded_at), "Invalid comparison observation/rating order.");
  }
  for (const c of key.cases) assert(key.assignments.filter(a => a.case_id === c.id).length === key.conditions.length, "Case lacks a condition.");
  const independent = ratings.rater.kind === "human" && ratings.rater.independent && key.cases.every(c => !c.author_ids.includes(ratings.rater.id));
  const eligible = key.cases.filter(c => c.origin === "independent-held-out" && !plan.public_fixture_ids.includes(c.id) && !c.author_ids.includes("codex-model"));
  const familyCount = new Set(eligible.map(c => c.family_id)).size;
  const unclustered = familyCount === eligible.length;
  const plugin = key.conditions.find(c => c.id === "plugin");
  const comparisons = key.conditions.filter(c => c.id !== "plugin").map(condition => {
    let wins = 0, ties = 0, losses = 0, pluginFidelity = 0, baselineFidelity = 0;
    for (const c of eligible) {
      const get = id => ratings.ratings.find(r => r.response_id === key.assignments.find(a => a.case_id === c.id && a.condition === id).response_id);
      const a = get("plugin"), b = get(condition.id);
      if (a.score > b.score) wins++; else if (a.score === b.score) ties++; else losses++;
      pluginFidelity += Number(a.fidelity_failure); baselineFidelity += Number(b.fidelity_failure);
    }
    const sameModel = JSON.stringify(plugin.target) === JSON.stringify(condition.target);
    return { baseline: condition.id, cases: eligible.length, wins, ties, losses,
      decisive_win_rate: wins + losses ? wins / (wins + losses) : null, exploratory_interval: unclustered ? wilsonInterval(wins, wins + losses) : null,
      plugin_fidelity_failures: pluginFidelity, baseline_fidelity_failures: baselineFidelity,
      comparability: condition.id === "stronger-model" ? "separate-model-comparator" : sameModel ? "same-recorded-model-and-sampling" : "confounded-model-or-sampling",
      bounded_advantage_verified: false };
  });
  return { validation_fingerprint: plan.validation_fingerprint, provider_calls: 0, semantic_guarantee: false,
    status: independent && familyCount >= 30 && comparisons.filter(c => c.baseline !== "stronger-model").every(c => c.comparability === "same-recorded-model-and-sampling") ? "blinded-paired-evidence-recorded" : "insufficient-independent-comparable-evidence",
    independently_rated: independent, held_out_cases: eligible.length, independent_case_families: familyCount,
    interval_withheld_for_clustered_cases: !unclustered, development_cases_excluded: key.cases.length - eligible.length, comparisons,
    caveat: "Thirty cases is an initial protocol floor, not proof of superiority. Intervals are exploratory, assume independent cases and exclude ties from their denominator. Independent rater identity, actual blinding, provenance and sampling claims require external verification. No universal mastery, launch approval or confirmatory superiority claim is issued." };
}
