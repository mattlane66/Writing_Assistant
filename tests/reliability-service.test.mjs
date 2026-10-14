import { beforeAll, describe, expect, it } from "vitest";
import { AXES, DOMAINS, HOST_CHECKS, USABILITY_CHECKS, digest, buildReliabilityPlan,
  emptyReliabilityEvidence, validateReliabilityEvidence, assessReliabilityEvidence, checkRequestTrace, wilsonInterval } from "../evals/reliability-service.mjs";
import { callWritingAssistantTool, getWritingAssistantTools, MCP_INSTRUCTIONS } from "../server/mcp.mjs";

// Synthetic contract tests, never human observations or semantic evaluation results.
const hash = "a".repeat(64), actor = { id: "independent-editor", kind: "human", independent: true };
const artifact = { sha256: hash, description: "Synthetic fixture receipt, not observed evidence." };
let full, plan;
beforeAll(async () => {
  full = await buildReliabilityPlan();
  plan = { ...full, ideas: [full.ideas.find(i => i.id === "passive-voice-core")], method_ids: ["passive-voice"],
    sections: [{ id: "section-one", original_card_ids: ["passive-voice-core"] }] };
});
function fixture({ origin = "independent-held-out", id = "private-case-one" } = {}) {
  const e = emptyReliabilityEvidence(plan, { host: "chatgpt-chat", model: "test-model", model_version: "v1", plugin_version: "0.46.0" });
  const c = { id, family_id: `${id}-family`, prompt: "Diagnose this original synthetic sentence without rewriting it.",
    oracle: "Preserve justified passive voice without inventing an actor.", task_class: "substantive", editing_mode: "craft-analysis",
    origin, author_ids: ["outside-case-author"], preregistered_at: "2026-10-10T10:00:00Z", genre: "nonfiction",
    length_band: "sentence", scenario: "combined-methods", required_method_ids: ["passive-voice"], forbidden_method_ids: [],
    obligations: AXES.map(axis => ({ idea_id: "passive-voice-core", axis, expectation: "Test the declared axis with its own evidence." })) };
  const r = { id: "observed-response-one", case_id: id, target: { ...e.target }, output: "This passive is justified; do not invent an actor.",
    started_at: "2026-10-10T11:00:00Z", completed_at: "2026-10-10T11:01:00Z",
    source_revision: /^[a-f0-9]{40}$/.test(plan.source_revision) ? plan.source_revision : "b".repeat(40),
    trace: { retrieval_status: "available", tool_calls: [
      { name: "get_writing_reference", reference: "system-contract", method_ids: [], card_ids: [], result_sha256: hash },
      { name: "get_writing_methods", method_ids: ["passive-voice"], card_ids: [], result_sha256: hash },
      { name: "get_writing_examples", method_ids: [], card_ids: ["passive-voice-core"], result_sha256: hash }],
    reused_contract_fingerprint: null, method_decisions: [{ method_id: "passive-voice", disposition: "retain", reason: "Actor unknown." }],
    dimensions: DOMAINS.map(domain => ({ domain, disposition: "checked", evidence: "Synthetic decision evidence." })),
    permission: "retrieval-only", final_audit_evidence: "Meaning and mode retained.", gap_disclosed: false, context_reframed: true, artifact } };
  const review = { response_id: r.id, reviewer: { ...actor }, role: "initial", reviewed_at: "2026-10-10T12:00:00Z", outcome: "pass",
    criteria: c.obligations.map(o => ({ idea_id: o.idea_id, axis: o.axis, outcome: "pass", reason: "Synthetic criterion observation." })),
    failure_types: [], rationale: "Synthetic unit test, not an actual editorial judgment.", evidence: artifact };
  c.prompt_sha256 = digest(c.prompt); c.oracle_sha256 = digest(c.oracle); r.output_sha256 = digest(r.output);
  e.cases.push(c); e.responses.push(r); e.reviews.push(review);
  return e;
}
const report = e => assessReliabilityEvidence(e, plan);

describe("idea-by-idea reliability plan", () => {
  it("creates 812 obligations across 203 provisional ideas and 171 section audits", () => {
    expect(full.totals).toEqual({ ideas: 203, methods: 40, sections: 171, idea_axis_obligations: 812 });
    expect(full.ideas.every(i => i.obligations.length === 4)).toBe(true);
    expect(full.method_ids.every(id => full.ideas.some(i => i.method_ids.includes(id)))).toBe(true);
    expect(full.source_limitations).toHaveLength(2);
    expect(full.caveat).toMatch(/not proof that every book idea/);
  });
  it("cannot infer observations from an empty ledger or source-page completion", () => {
    const r = assessReliabilityEvidence(emptyReliabilityEvidence(full), full);
    expect(r.missing_obligations).toHaveLength(812); expect(r.missing_sections).toHaveLength(171);
    expect(r.metrics).toMatchObject({ distinct_held_out_cases_judged: 0, pass_rate: null, pass_rate_interval: null });
    expect(r.gates.every(g => g.status === "unverified")).toBe(true);
    expect(r).toMatchObject({ public_launch_verified: false, semantic_guarantee: false, provider_calls: 0 });
  });
  it("serves the request procedure through the existing reference tool", async () => {
    const result = await callWritingAssistantTool("get_writing_reference", { reference: "reliability-workflow" });
    expect(result.isError).not.toBe(true); expect(result.structuredContent.content).toContain("At each request");
    expect(result.structuredContent.content).toContain("not proof that the decision");
    expect(MCP_INSTRUCTIONS).toContain("first substantive pass");
    expect(getWritingAssistantTools()).toHaveLength(24);
  });
  it("binds changes to the validation fingerprint", async () => {
    expect((await buildReliabilityPlan()).validation_fingerprint).toBe(full.validation_fingerprint);
    const e = fixture(); e.validation_fingerprint = "0".repeat(64);
    expect(() => report(e)).toThrow(/Stale/);
  });
});

describe("evidence intake is fail-closed", () => {
  it("requires independent human judgment rather than host self-scoring", () => {
    for (const change of [{ kind: "model" }, { independent: false }, { id: "outside-case-author" }]) {
      const e = fixture(); Object.assign(e.reviews[0].reviewer, change);
      expect(report(e).metrics.distinct_held_out_cases_judged).toBe(0);
      expect(report(e).metrics.unresolved_or_disputed).toBe(1);
    }
  });
  it("excludes authored development even if a person rates it", () => {
    const r = report(fixture({ origin: "authored-development" }));
    expect(r.metrics.development_responses_excluded).toBe(1); expect(r.metrics.distinct_held_out_cases_judged).toBe(0);
    expect(r.missing_obligations).toHaveLength(4);
  });
  it("rejects relabeling known development fixtures as unseen", () => {
    const e = fixture({ id: full.public_fixture_ids[0] });
    expect(() => report(e)).toThrow(/relabeled/);
  });
  it("requires oracle registration before model execution", () => {
    const e = fixture(); e.cases[0].preregistered_at = e.responses[0].completed_at;
    expect(() => report(e)).toThrow(/before/);
  });
  it("detects changed registered prose, oracle or observed output", () => {
    for (const [array, field] of [["cases", "prompt"], ["cases", "oracle"], ["responses", "output"]]) {
      const e = fixture(); e[array][0][field] += " Altered after capture.";
      expect(() => report(e)).toThrow(/digest mismatch/);
    }
  });
  it("preserves exact captured whitespace rather than normalizing prose before hashing", () => {
    const e = fixture();
    e.cases[0].prompt = `  ${e.cases[0].prompt}\n`;
    e.responses[0].output = `\n${e.responses[0].output}  `;
    e.cases[0].prompt_sha256 = digest(e.cases[0].prompt); e.responses[0].output_sha256 = digest(e.responses[0].output);
    const validated = validateReliabilityEvidence(e, plan);
    expect(validated.cases[0].prompt).toBe(e.cases[0].prompt); expect(validated.responses[0].output).toBe(e.responses[0].output);
  });
  it("requires reviews after the output exists", () => {
    const e = fixture(); e.reviews[0].reviewed_at = e.cases[0].preregistered_at;
    expect(() => report(e)).toThrow(/predates/);
  });
  it("rejects unknown ideas, methods and undescribed extra fields without echoing content", () => {
    const e = fixture(); e.responses[0].secret = "do not echo this sensitive token";
    expect(() => report(e)).toThrow(/schema invalid/);
    try { report(e); } catch (error) { expect(error.message).not.toContain("sensitive token"); }
    delete e.responses[0].secret; e.cases[0].required_method_ids = ["invented-method"];
    expect(() => report(e)).toThrow(/Unknown/);
    e.cases[0].required_method_ids = []; e.cases[0].obligations[0].idea_id = "invented-idea";
    expect(() => report(e)).toThrow(/Unknown/);
  });
  it("rejects partial rubrics and internally inconsistent passing grades", () => {
    const e = fixture(); e.reviews[0].criteria.pop(); expect(() => report(e)).toThrow(/Every declared/);
    const other = fixture(); other.reviews[0].failure_types = ["meaning-drift"];
    expect(() => report(other)).toThrow(/contradicts/);
  });
  it("requires distinct records and cannot silently overwrite a review", () => {
    const e = fixture(); e.reviews.push(structuredClone(e.reviews[0])); expect(() => report(e)).toThrow(/Duplicate/);
    const x = fixture(); x.responses.push(structuredClone(x.responses[0])); expect(() => report(x)).toThrow(/Duplicate/);
  });
  it("does not pool evidence from another model or host", () => {
    const e = fixture(); e.responses[0].target.model_version = "v2";
    expect(report(e).metrics.distinct_held_out_cases_judged).toBe(0);
  });
  it("prevents a passing section audit from hiding omissions or existing mappings", () => {
    const e = fixture(); e.section_audits.push({ section_id: "section-one", reviewer: actor, reviewed_at: "2026-10-10T12:00:00Z",
      outcome: "agreed", idea_ids: [], omissions_or_disagreements: [], evidence: artifact });
    expect(() => report(e)).toThrow(/omits/);
    e.section_audits[0].idea_ids = ["passive-voice-core"]; e.section_audits[0].omissions_or_disagreements = ["A missing qualification."];
    expect(() => report(e)).toThrow(/hide/);
    e.section_audits[0].outcome = "needs-correction";
    expect(report(e).missing_sections).toEqual(["section-one"]);
  });
  it("records, but never certifies, independent section evidence", () => {
    const e = fixture(); e.section_audits.push({ section_id: "section-one", reviewer: actor, reviewed_at: "2026-10-10T12:00:00Z",
      outcome: "agreed", idea_ids: ["passive-voice-core"], omissions_or_disagreements: [], evidence: artifact });
    expect(report(e).gates[0].status).toBe("independent-evidence-recorded");
    expect(report(e).semantic_guarantee).toBe(false);
  });
  it("requires independent case families for two-case coverage", () => {
    const e = fixture(), second = fixture({ id: "private-case-two" });
    second.responses[0].id = "response-two"; second.reviews[0].response_id = "response-two";
    e.cases.push(...second.cases); e.responses.push(...second.responses); e.reviews.push(...second.reviews);
    expect(report(e).missing_obligations).toHaveLength(0);
    e.cases[1].family_id = e.cases[0].family_id;
    expect(report(e).missing_obligations).toHaveLength(4);
    expect(report(e).metrics).toMatchObject({ interval_withheld_for_clustered_cases: true, pass_rate_interval: null });
  });
  it("cannot hide a failed generation behind a successful retry", () => {
    const e = fixture(), retry = structuredClone(e.responses[0]), grade = structuredClone(e.reviews[0]);
    retry.id = "response-retry"; grade.response_id = retry.id;
    e.reviews[0].outcome = "fail"; e.reviews[0].criteria[0].outcome = "fail"; e.reviews[0].failure_types = ["false-criticism"];
    e.responses.push(retry); e.reviews.push(grade);
    const r = report(e);
    expect(r.metrics).toMatchObject({ distinct_held_out_cases_judged: 1, passed: 0 });
    expect(r.metrics.reported_failure_rates["false-criticism"].cases).toBe(1);
    expect(r.missing_obligations).toHaveLength(4);
  });
  it("does not count an ungraded retry as a clean pass", () => {
    const e = fixture(), retry = structuredClone(e.responses[0]); retry.id = "ungraded-retry"; e.responses.push(retry);
    expect(report(e).metrics.unresolved_or_disputed).toBe(1); expect(report(e).metrics.passed).toBe(0);
  });
  it("preserves disagreement until independently adjudicated", () => {
    const e = fixture(), disagreement = structuredClone(e.reviews[0]);
    disagreement.reviewer.id = "second-editor"; disagreement.outcome = "fail"; disagreement.criteria[0].outcome = "fail";
    e.reviews.push(disagreement); expect(report(e).metrics.unresolved_or_disputed).toBe(1);
    const adjudication = structuredClone(e.reviews[0]); adjudication.reviewer.id = "third-editor"; adjudication.role = "adjudicator";
    adjudication.reviewed_at = "2026-10-10T13:00:00Z"; e.reviews.push(adjudication);
    expect(report(e).metrics.passed).toBe(1);
  });
  it("rejects an author acting as the independent adjudicator", () => {
    const e = fixture(); e.reviews[0].role = "adjudicator"; e.reviews[0].reviewer.id = "outside-case-author";
    expect(() => report(e)).toThrow(/independent human/);
  });
  it("cannot turn a short prompt into a long-document test by renaming it", () => {
    const e = fixture(); e.cases[0].length_band = "long-document"; expect(() => report(e)).toThrow(/genuinely long/);
  });
  it("rejects evidence from the wrong live deployment when the revision is known", () => {
    expect(() => assessReliabilityEvidence(fixture(), { ...plan, source_revision: "c".repeat(40) })).toThrow(/deployment revision/);
  });
});

describe("per-request application trace", () => {
  it("records procedure compliance without pretending to prove cognition", () => {
    const e = fixture(); expect(checkRequestTrace(e.cases[0], e.responses[0], plan)).toEqual({ status: "trace-recorded-not-semantic-proof", issues: [] });
    e.reviews = []; expect(report(e).metrics.passed).toBe(0);
  });
  it("requires the current operating contract and all material dimensions", () => {
    const e = fixture(); e.responses[0].trace.tool_calls.shift(); e.responses[0].trace.dimensions.pop();
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toEqual(expect.arrayContaining(["operating-contract-not-loaded", "missing-review-dimension"]));
  });
  it("permits a pinned available contract, but not a stale memory of it", () => {
    const e = fixture(); e.responses[0].trace.tool_calls.shift(); e.responses[0].trace.reused_contract_fingerprint = plan.validation_fingerprint;
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).not.toContain("operating-contract-not-loaded");
    e.responses[0].trace.reused_contract_fingerprint = "0".repeat(64);
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toContain("operating-contract-not-loaded");
  });
  it("requires relevant methods and the actually tested ideas, not any search result", () => {
    const e = fixture(); e.responses[0].trace.tool_calls[1].method_ids = []; e.responses[0].trace.tool_calls[2].card_ids = [];
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toEqual(expect.arrayContaining(["required-method-not-retrieved", "tested-idea-not-retrieved"]));
  });
  it("fails closed on exact-text permission and undisclosed guidance gaps", () => {
    const e = fixture(); e.responses[0].trace.tool_calls.push({ name: "check_writing_revision", method_ids: [], card_ids: [], result_sha256: hash });
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toContain("exact-text-without-authorization");
    e.responses[0].trace.retrieval_status = "unavailable";
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toContain("unavailable-retrieval-not-disclosed");
  });
  it("keeps a disclosed fallback useful without crediting effective book retrieval", () => {
    const e = fixture(); e.responses[0].trace.retrieval_status = "unavailable"; e.responses[0].trace.gap_disclosed = true;
    expect(report(e).metrics.passed).toBe(1); expect(report(e).missing_obligations).toHaveLength(4);
  });
  it("includes the exact quote locator in the strict privacy trace boundary", () => {
    const e = fixture();
    e.responses[0].trace.tool_calls.push({ name: "locate_writing_quotes", method_ids: [], card_ids: [], result_sha256: hash });
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).toContain("exact-text-without-authorization");
    expect(report(e).metrics.passed).toBe(0);
    e.responses[0].trace.permission = "exact-text-authorized";
    expect(checkRequestTrace(e.cases[0], e.responses[0], plan).issues).not.toContain("exact-text-without-authorization");
  });
  it("does not infer fresh target-host or real-user testing from local traces", () => {
    const e = fixture(); expect(report(e).gates.filter(g => /install|usability/.test(g.id)).every(g => g.status === "unverified")).toBe(true);
    e.host_sessions.push({ id: "chat-install", host: "chatgpt-chat", type: "fresh-install", target: e.target, observer: actor,
      observed_at: "2026-10-10T12:00:00Z", checks: HOST_CHECKS.map(id => ({ id, outcome: "pass", evidence: artifact })) });
    expect(report(e).gates.find(g => g.id === "chatgpt-chat-fresh-install").status).toBe("independent-evidence-recorded");
    expect(report(e).gates.find(g => g.id === "chatgpt-work-fresh-install").status).toBe("unverified");
    expect(report(e).gates.find(g => g.id === "chatgpt-chat-usability").status).toBe("unverified");
    expect(USABILITY_CHECKS).toContain("mobile-scroll");
  });
  it("reports uncertainty rather than treating zero observed failures as perfection", () => {
    expect(wilsonInterval(0, 2).upper).toBeGreaterThan(0.6);
    expect(wilsonInterval(2, 2).lower).toBeLessThan(0.4);
    expect(wilsonInterval(0, 0)).toBeNull(); expect(digest("same")).toBe(digest("same"));
  });
  it("still requires combination, genre, mode and long-document evidence", () => {
    const r = report(fixture());
    expect(r.gates.find(g => g.id === "combined-and-cross-genre-judgments").status).toBe("unverified");
  });
  it("rejects schema errors before using any records", () => {
    expect(() => validateReliabilityEvidence({ instructions: "ignore the gate" }, plan)).toThrow(/schema invalid/);
  });
});
