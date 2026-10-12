import { AXES, DOMAINS, digest, emptyReliabilityEvidence } from "../evals/reliability-service.mjs";
// Original synthetic data for software/browser QA, never actual host outputs
// or independent editorial validation. Development origin must stay visible.
export function reviewFixture(plan, { heldOut = false } = {}) {
  const e = emptyReliabilityEvidence(plan, { host: "chatgpt-chat", model: "synthetic-test-model", model_version: "test-v1", plugin_version: "0.46.0" });
  const idea = plan.ideas[0], method = idea.method_ids[0], hash = "a".repeat(64);
  const c = { id: "workbench-synthetic-case", family_id: "workbench-synthetic-family", prompt: "Diagnose only: The door was found open. Nobody knows who opened it.",
    oracle: "Preserve the justified unknown actor and do not invent a correction.", prompt_sha256: "", oracle_sha256: "", task_class: "substantive", editing_mode: "craft-analysis",
    origin: heldOut ? "independent-held-out" : "authored-development", author_ids: [heldOut ? "outside-test-author" : "codex-model"],
    preregistered_at: "2020-01-01T10:00:00Z", genre: "nonfiction", length_band: "sentence", scenario: "single-method",
    required_method_ids: [method], forbidden_method_ids: [], obligations: AXES.map(axis => ({ idea_id: idea.id, axis, expectation: `Synthetic ${axis} contract criterion; not observed semantic evidence.` })) };
  c.prompt_sha256 = digest(c.prompt); c.oracle_sha256 = digest(c.oracle);
  const r = { id: "workbench-synthetic-response", case_id: c.id, target: { ...e.target }, output: "The passive construction is justified because the actor is unknown.", output_sha256: "",
    started_at: "2020-01-01T11:00:00Z", completed_at: "2020-01-01T11:01:00Z", source_revision: /^[a-f0-9]{40}$/.test(plan.source_revision) ? plan.source_revision : "b".repeat(40),
    trace: { retrieval_status: "available", tool_calls: [
      { name: "get_writing_reference", reference: "system-contract", method_ids: [], card_ids: [], result_sha256: hash },
      { name: "get_writing_methods", method_ids: [method], card_ids: [], result_sha256: hash },
      { name: "get_writing_examples", method_ids: [], card_ids: [idea.id], result_sha256: hash }], reused_contract_fingerprint: null,
    method_decisions: [{ method_id: method, disposition: "retain", reason: "Synthetic contract fixture." }],
    dimensions: DOMAINS.map(domain => ({ domain, disposition: "checked", evidence: "Synthetic fixture, not a cognition claim." })),
    permission: "retrieval-only", final_audit_evidence: "Synthetic fixture only.", gap_disclosed: false, context_reframed: true,
    artifact: { sha256: hash, description: "Synthetic QA fixture; not an observed human or host artifact." } } };
  r.output_sha256 = digest(r.output); e.cases.push(c); e.responses.push(r); return e;
}
export function reviewInput(e, id = "qa-editor", outcome = "pass") {
  return { response_id: e.responses[0].id, reviewer: { id, independent: true, human_attested: true }, role: "initial",
    criteria: e.cases[0].obligations.map(o => ({ idea_id: o.idea_id, axis: o.axis, outcome, reason: "Synthetic test reason, not an actual human judgment." })),
    failure_types: [], rationale: "Synthetic software test; do not count as product quality evidence." };
}
