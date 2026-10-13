export type Outcome = "pass" | "fail" | "unresolved";
export interface Obligation { idea_id: string; axis: string; expectation: string }
export interface Criterion { idea_id: string; axis: string; outcome: Outcome; reason: string }
export interface Reviewer { id: string; independent: boolean; human_attested: boolean }
export interface Case { id: string; prompt: string; oracle: string; author_ids: string[]; editing_mode: string; origin: string; obligations: Obligation[] }
export interface Response { id: string; case_id: string; output: string; target: { host: string; model: string; model_version: string; plugin_version: string }; trace: Record<string, unknown> }
export interface Review { response_id: string; reviewer: { id: string; kind: string; independent: boolean }; role: string; outcome: Outcome; rationale: string; criteria: Criterion[] }
export interface Audit { section_id: string; outcome: string; reviewer: { id: string; independent: boolean }; omissions_or_disagreements: string[] }
export interface Evidence { schema_version: number; validation_fingerprint: string; target: Response["target"]; cases: Case[]; responses: Response[]; reviews: Review[]; section_audits: Audit[]; host_sessions: unknown[] }
export interface Section { id: string; source_id: string; title: string; pages: { start: number; end: number }[]; original_card_ids: string[]; kind: string }
export interface Idea { id: string; title: string; method_ids: string[]; sources: { ref: string; locator: string }[] }
export interface Plan { validation_fingerprint: string; source_revision: string; corpus_version: string; ideas: Idea[]; sections: Section[]; source_limitations: { source_id: string; description: string }[]; totals: { ideas: number; methods: number; sections: number; idea_axis_obligations: number } }
export interface Card { id: string; title: string; mechanism: string; steps: string[]; exceptions: string[]; concept_ids: string[];
  sources: { ref: string; locator: string; caveat: string }[]; example: { before: string; after: string; why: string; practice?: { invariants: string[]; alternatives: { text: string; when_to_prefer: string; tradeoff: string }[] } };
  counterexample?: { text: string; why_not_apply: string } }
export interface Report { gates: { id: string; status: string }[]; missing_obligations: { obligation: string; passing_distinct_cases: number; required: number }[]; missing_sections: string[];
  metrics: { distinct_held_out_cases_judged: number; passed: number; unresolved_or_disputed: number; development_responses_excluded: number; trace_failures: number; pass_rate: number | null }; caveat: string }
export interface HostObservation { id: string; case_id: string | null; host: "chatgpt-chat" | "chatgpt-work";
  capture_origin: "actual-host-observation" | "synthetic-ui-fixture"; result_kind: "answer" | "fallback" | "platform-error" | "no-answer" | "partial";
  observed_at: string | null; captured_at: string; actual_prompt: string; output: string | null; visible_error: string | null;
  raw_tool_evidence: string | null; metadata: { model_label: string | null; model_version: string | null; plugin_id: string | null; plugin_version: string | null; server_revision: string | null };
  notes: string | null; faithful_capture_attested: true; observation_sha256: string }
export interface HostObservationPacket { schema_version: 1; kind: "writing-host-observations";
  authority: "ungraded-observations-not-reliability-evidence"; capture_plan_fingerprint: string; observations: HostObservation[] }
export interface Bootstrap { token: string; plan: Plan; catalog: { cards: Card[]; methods: { id: string; name: string; procedure: string[]; exceptions: string[] }[] }; workspace: Evidence; observations: HostObservationPacket; report: Report;
  batch: { id: string; sections: Section[]; review_questions: string[]; caveat: string } }
export interface WorkspaceResult { evidence: Evidence; report: Report }
export interface BlindPacket { schema_version: number; assignment_sha256: string; rubric: string; cases: { case_id: string; prompt: string; responses: { id: string; text: string; output_sha256: string }[] }[] }
export interface BlindGrade { case_id: string; response_id: string; output_sha256: string; score: number; fidelity_failure: boolean; reason: string; evidence_sha256: string }
