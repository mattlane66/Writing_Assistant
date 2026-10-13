import { z } from "zod";
import { digest, validateReliabilityEvidence } from "./reliability-service.mjs";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Prose = z.string().min(1).max(24000).refine(value => value.trim().length > 0);
const OptionalText = Prose.nullable();
const Metadata = z.object({ model_label: OptionalText, model_version: OptionalText,
  plugin_id: OptionalText, plugin_version: OptionalText, server_revision: OptionalText }).strict();
const Input = z.object({ id: Id, case_id: Id.nullable(), host: z.enum(["chatgpt-chat", "chatgpt-work"]),
  capture_origin: z.enum(["actual-host-observation", "synthetic-ui-fixture"]),
  result_kind: z.enum(["answer", "fallback", "platform-error", "no-answer", "partial"]),
  observed_at: z.string().datetime({ offset: true }).nullable(), actual_prompt: Prose,
  output: OptionalText, visible_error: OptionalText, raw_tool_evidence: OptionalText,
  metadata: Metadata, notes: OptionalText, faithful_capture_attested: z.literal(true) }).strict();
const Record = Input.extend({ captured_at: z.string().datetime({ offset: true }), observation_sha256: Hash }).strict();
const Packet = z.object({ schema_version: z.literal(1), kind: z.literal("writing-host-observations"),
  authority: z.literal("ungraded-observations-not-reliability-evidence"),
  capture_plan_fingerprint: Hash, observations: z.array(Record).max(100) }).strict();

function invalid() { throw new TypeError("Observation format, source attestation, fingerprint or content hash is invalid. Private input is not echoed."); }
function parse(schema, value) { const result = schema.safeParse(value); if (!result.success) invalid(); return result.data; }
function checkResult(value) {
  if (["answer", "fallback"].includes(value.result_kind) && value.output === null) invalid();
  if (value.result_kind === "platform-error" && value.visible_error === null) invalid();
  if (value.result_kind === "no-answer" && (value.output !== null || (!value.visible_error && !value.notes))) invalid();
  if (value.result_kind === "partial" && !value.visible_error && !value.notes) invalid();
}

export function emptyHostObservations(plan) {
  return { schema_version: 1, kind: "writing-host-observations", authority: "ungraded-observations-not-reliability-evidence",
    capture_plan_fingerprint: plan.validation_fingerprint, observations: [] };
}

export function validateHostObservations(value, plan) {
  const packet = parse(Packet, value);
  if (packet.capture_plan_fingerprint !== plan.validation_fingerprint) invalid();
  const ids = new Set();
  for (const record of packet.observations) {
    const { observation_sha256, ...body } = record;
    checkResult(record);
    if (ids.has(record.id) || digest(body) !== observation_sha256) invalid();
    ids.add(record.id);
  }
  // A matching capture-plan hash scopes this local collection only. It is not
  // an observed server receipt, authenticated transcript or semantic judgment.
  return packet;
}

export function appendHostObservation(value, input, plan, evidenceValue, now = new Date().toISOString()) {
  const packet = validateHostObservations(value, plan);
  const entry = parse(Input, input); checkResult(entry);
  if (packet.observations.some(record => record.id === entry.id) || packet.observations.length >= 100) invalid();
  const evidence = validateReliabilityEvidence(evidenceValue, plan);
  if (entry.case_id !== null) {
    const task = evidence.cases.find(item => item.id === entry.case_id);
    // Linking does not register a case or supply an oracle. Keep the actual
    // submitted prompt, including any extra authorization, independently.
    if (!task || !entry.actual_prompt.includes(task.prompt)) invalid();
  }
  const body = { ...entry, captured_at: now };
  return validateHostObservations({ ...packet, observations: [...packet.observations,
    { ...body, observation_sha256: digest(body) }] }, plan);
}
