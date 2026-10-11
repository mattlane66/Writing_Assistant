import { getWritingCoverage } from "../server/book-informed.mjs";
import { buildReliabilityPlan, emptyReliabilityEvidence, assessReliabilityEvidence } from "./reliability-service.mjs";
import { assessBlindComparison } from "./blinded-comparison.mjs";

export function sourceReviewGate(coverage) {
  const complete = coverage.undispositioned_pages === 0
    && coverage.tracked_model_reviewed_pages + coverage.visually_dispositioned_pages === coverage.total_pdf_pages;
  return { id: "source-review", status: complete ? "first-pass-recorded-not-idea-mastery" : "incomplete",
    evidence: `${coverage.tracked_model_reviewed_pages}/${coverage.total_pdf_pages} tracked text-reviewed pages; ${coverage.visually_dispositioned_pages} separate visual dispositions; ${coverage.undispositioned_pages} unresolved first-pass pages. First-pass accounting is not independent idea or judgment validation.` };
}

// Host sessions and blinded human comparisons cannot be inferred from build output.
// Update these records only after observing and documenting the named evidence.
export async function assessPluginReadiness({ evidence, comparison } = {}) {
  const coverage = await getWritingCoverage({});
  const plan = await buildReliabilityPlan();
  const validation = assessReliabilityEvidence(evidence ?? emptyReliabilityEvidence(plan), plan);
  const blind = comparison ? assessBlindComparison(comparison.key, comparison.ratings, plan) : null;
  const gates = [
    sourceReviewGate(coverage),
    { id: "idea-and-exception-audit", status: "unverified", evidence: "A chapter/page-to-idea ledger, independent review, disagreements and exception tests are still required. Page counts and card mappings do not establish complete ideas." },
    { id: "chatgpt-chat-fresh-install", status: "unverified", evidence: "Requires the updated installed bundle and recorded retrieval, rendering, selection handoff, privacy, mode-boundary and stale-choice behavior in ChatGPT Chat." },
    { id: "chatgpt-work-fresh-install", status: "unverified", evidence: "Requires the same observed end-to-end flow in the intended Work host. Codex or a simulated bridge cannot substitute." },
    { id: "unseen-semantic-judgments", status: "unverified", evidence: "Requires held-out human-adjudicated cases across all registered methods, including exceptions, ambiguous readings, false criticism and preservation controls." },
    { id: "blinded-comparison", status: "unverified", evidence: "Requires blinded paired ratings against plain-model and well-prompted knowledge-backed baselines; assess a stronger model separately. Authored retrieval fixtures are not efficacy evidence." },
    { id: "target-host-usability", status: "unverified", evidence: "Requires real-user desktop/mobile scrolling, readability, keyboard interaction and decision-handoff evidence in the intended hosts." }
  ];
  // These statuses mean evidence was recorded and structurally checked, not that
  // the program authenticated reviewers, witnessed sessions or proved semantics.
  for (const id of ["idea-and-exception-audit", "unseen-semantic-judgments", "chatgpt-chat-fresh-install", "chatgpt-work-fresh-install"]) {
    const candidate = validation.gates.find(g => g.id === id);
    const variety = validation.gates.find(g => g.id === "combined-and-cross-genre-judgments");
    if (candidate.status !== "unverified" && (id !== "unseen-semantic-judgments" || variety.status !== "unverified")) {
      const gate = gates.find(g => g.id === id); gate.status = "independent-evidence-recorded-not-certified";
      gate.evidence = "Scoped records passed the offline evidence contract; independent provenance and actual observations require external verification.";
    }
  }
  if (validation.gates.filter(g => /-usability$/.test(g.id)).every(g => g.status !== "unverified")) gates.find(g => g.id === "target-host-usability").status = "independent-evidence-recorded-not-certified";
  if (blind?.status === "blinded-paired-evidence-recorded") gates.find(g => g.id === "blinded-comparison").status = "independent-evidence-recorded-not-certified";
  return { public_launch_verified: false, semantic_guarantee: false, provider_calls: 0,
    scope: "Readiness evidence report, not an automated semantic evaluation or a publication interlock in the external Builder.",
    coverage: { method_count: coverage.method_count, card_count: coverage.card_count, reviewed_pages: coverage.tracked_model_reviewed_pages, total_pages: coverage.total_pdf_pages, unreviewed_pages: coverage.unreviewed_pages,
      visually_dispositioned_pages: coverage.visually_dispositioned_pages, undispositioned_pages: coverage.undispositioned_pages, corpus_sha256: coverage.corpus_sha256 },
    validation: { fingerprint: plan.validation_fingerprint, provisional_idea_units: plan.totals.ideas,
      idea_axis_obligations: plan.totals.idea_axis_obligations, source_sections: plan.totals.sections,
      missing_obligations: validation.missing_obligations.length, missing_sections: validation.missing_sections.length,
      metrics: validation.metrics, comparison: blind },
    gates, caveat: "Even complete observed acceptance evidence would support bounded performance claims, never correct judgment on every future passage. Structured attestations are not authenticated human review, and this service does not issue launch approval." };
}
