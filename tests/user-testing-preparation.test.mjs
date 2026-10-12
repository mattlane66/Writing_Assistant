import { describe, expect, it } from "vitest";
import { prepareUserTesting } from "../scripts/prepare-user-testing.mjs";
import { MODES } from "../server/writing-workflow.mjs";
import { buildReliabilityPlan, assessReliabilityEvidence } from "../evals/reliability-service.mjs";
describe("human pilot preparation without invented observations", () => {
  it("prepares all eight modes with no response or human grades", async () => {
    const p = await prepareUserTesting();
    expect(p.evidence.cases).toHaveLength(14); expect(p.evidence.responses).toEqual([]); expect(p.evidence.reviews).toEqual([]);
    expect(MODES.every(mode => p.evidence.cases.some(c => c.editing_mode === mode))).toBe(true);
    expect(p.evidence.cases.every(c => c.origin === "authored-development" && c.author_ids.includes("codex-model"))).toBe(true);
  });
  it("keeps hidden expectations out of the evaluated host packet", async () => {
    const p = await prepareUserTesting(); expect(p.prompts.cases.every(c => Object.keys(c).sort().join(",") === "id,prompt")).toBe(true);
    for (const c of p.evidence.cases) expect(p.prompts.cases.find(r => r.id === c.id).prompt).toBe(c.prompt);
  });
  it("does not override the no-exact-text test with blanket permission", async () => {
    const p = await prepareUserTesting();
    const restricted = p.prompts.cases.find(c => c.id === "workflow-no-text-consent").prompt;
    expect(restricted).toContain("Do not transmit"); expect(restricted).not.toContain("I authorize");
  });
  it("leaves held-out reliability gates unverified", async () => {
    const p = await prepareUserTesting(), plan = await buildReliabilityPlan();
    const r = assessReliabilityEvidence(p.evidence, plan); expect(r.metrics.distinct_held_out_cases_judged).toBe(0);
    expect(r.public_launch_verified).toBe(false); expect(r.semantic_guarantee).toBe(false);
  });
});
