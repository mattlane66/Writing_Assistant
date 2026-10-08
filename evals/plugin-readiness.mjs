import { getWritingCoverage } from "../server/book-informed.mjs";

export function sourceReviewGate(coverage) {
  const complete = coverage.undispositioned_pages === 0
    && coverage.tracked_model_reviewed_pages + coverage.visually_dispositioned_pages === coverage.total_pdf_pages;
  return { id: "source-review", status: complete ? "first-pass-recorded-not-idea-mastery" : "incomplete",
    evidence: `${coverage.tracked_model_reviewed_pages}/${coverage.total_pdf_pages} tracked text-reviewed pages; ${coverage.visually_dispositioned_pages} separate visual dispositions; ${coverage.undispositioned_pages} unresolved first-pass pages. First-pass accounting is not independent idea or judgment validation.` };
}

// Host sessions and blinded human comparisons cannot be inferred from build output.
// Update these records only after observing and documenting the named evidence.
export async function assessPluginReadiness() {
  const coverage = await getWritingCoverage({});
  const gates = [
    sourceReviewGate(coverage),
    { id: "idea-and-exception-audit", status: "unverified", evidence: "A chapter/page-to-idea ledger, independent review, disagreements and exception tests are still required. Page counts and card mappings do not establish complete ideas." },
    { id: "chatgpt-chat-fresh-install", status: "unverified", evidence: "Requires the updated installed bundle and recorded retrieval, rendering, selection handoff, privacy, mode-boundary and stale-choice behavior in ChatGPT Chat." },
    { id: "chatgpt-work-fresh-install", status: "unverified", evidence: "Requires the same observed end-to-end flow in the intended Work host. Codex or a simulated bridge cannot substitute." },
    { id: "unseen-semantic-judgments", status: "unverified", evidence: "Requires held-out human-adjudicated cases across all registered methods, including exceptions, ambiguous readings, false criticism and preservation controls." },
    { id: "blinded-comparison", status: "unverified", evidence: "Requires blinded paired ratings against plain-model and well-prompted knowledge-backed baselines; assess a stronger model separately. Authored retrieval fixtures are not efficacy evidence." },
    { id: "target-host-usability", status: "unverified", evidence: "Requires real-user desktop/mobile scrolling, readability, keyboard interaction and decision-handoff evidence in the intended hosts." }
  ];
  return { public_launch_verified: false, semantic_guarantee: false, provider_calls: 0,
    scope: "Readiness evidence report, not an automated semantic evaluation or a publication interlock in the external Builder.",
    coverage: { method_count: coverage.method_count, card_count: coverage.card_count, reviewed_pages: coverage.tracked_model_reviewed_pages, total_pages: coverage.total_pdf_pages, unreviewed_pages: coverage.unreviewed_pages,
      visually_dispositioned_pages: coverage.visually_dispositioned_pages, undispositioned_pages: coverage.undispositioned_pages, corpus_sha256: coverage.corpus_sha256 },
    gates, caveat: "Even complete observed acceptance evidence would support bounded performance claims, never correct judgment on every future passage." };
}
