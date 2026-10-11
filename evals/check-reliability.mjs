import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReliabilityPlan, AXES, assessReliabilityEvidence, emptyReliabilityEvidence } from "./reliability-service.mjs";

if (process.argv.length > 2) throw new Error("Offline only; no provider/live options.");
const plan = await buildReliabilityPlan();
const suite = JSON.parse(await readFile(new URL("./reliability-composition-cases.json", import.meta.url), "utf8"));
assert.equal(suite.exposure, "authored-development-not-unseen");
assert.equal(new Set(suite.cases.map(c => c.id)).size, suite.cases.length);
assert.equal(suite.cases.length, 12);
const ids = new Set(plan.ideas.map(i => i.id)), methods = new Set(plan.method_ids);
for (const c of suite.cases) {
  assert(c.idea_ids.length && c.idea_ids.every(id => ids.has(id)), "Unknown practice idea.");
  assert(c.method_ids.length && c.method_ids.every(id => methods.has(id)), "Unknown method.");
  assert(c.axes.every(axis => AXES.includes(axis)));
  assert(c.prompt.length > 80 && c.acceptance.length > 80);
}
for (const pair of new Set(suite.cases.map(c => c.pair))) {
  const cases = suite.cases.filter(c => c.pair === pair);
  assert.equal(cases.length, 2); assert(cases.some(c => c.expected_status === "pass"));
  assert(cases.some(c => c.expected_status !== "pass"));
}
assert.equal(plan.totals.idea_axis_obligations, plan.totals.ideas * AXES.length);
assert(plan.method_ids.every(id => plan.ideas.some(i => i.method_ids.includes(id))));
const report = assessReliabilityEvidence(emptyReliabilityEvidence(plan), plan);
assert.equal(report.metrics.distinct_held_out_cases_judged, 0);
assert.equal(report.public_launch_verified, false);
assert.equal(report.missing_obligations.length, plan.totals.idea_axis_obligations);
console.log(JSON.stringify({ scope: "Offline service integrity and authored fixture contracts only; no host outputs or independent editorial judgments.",
  ...plan.totals, development_contrast_cases: suite.cases.length, independent_judgments_observed: 0,
  validation_fingerprint: plan.validation_fingerprint, provider_calls: 0, semantic_guarantee: false }, null, 2));
