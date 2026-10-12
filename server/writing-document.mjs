import { z } from "zod";
import { hash, ProjectContext, validateAnchor, workflowKnowledgeFingerprint } from "./writing-workflow.mjs";

export const DOCUMENT_VERSION = "1.0.0";
const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Text = z.string().min(1).max(96000).refine(s => !!s.trim());
const Note = z.string().trim().min(1).max(1200);
const Section = z.object({ id: Id, start: z.number().int().nonnegative(), end: z.number().int().positive(), sha256: Hash }).strict();
const Pointer = z.object({ section_id: Id, start: z.number().int().nonnegative(), end: z.number().int().positive(), quote: z.string().min(1).max(500) }).strict();
const Item = z.object({ id: Id, kind: z.enum(["claim", "actor", "place", "time", "quantity", "rule", "knowledge", "argument"]),
  status: z.enum(["asserted", "inferred", "unknown"]), statement: Note, evidence: z.array(Pointer).min(1).max(3) }).strict();
const Record = z.object({ version: z.literal(1), engine_version: z.literal(DOCUMENT_VERSION), id: Id,
  knowledge_sha256: Hash, text: Text, text_sha256: Hash, sections: z.array(Section).min(1).max(24),
  reviewed_section_ids: z.array(Id).max(24), ledger: z.array(Item).max(48),
  project_context: ProjectContext.nullable(), context_enabled: z.boolean() }).strict();
const Common = { text_processing_authorized: z.literal(true), state: Record, expected_state_sha256: Hash };
const Create = z.object({ operation: z.literal("create"), text_processing_authorized: z.literal(true), id: Id, text: Text }).strict();
const Review = z.object({ ...Common, operation: z.literal("record-review"), reviewed_section_ids: z.array(Id).min(1).max(24), ledger: z.array(Item).max(48) }).strict();
const Update = z.object({ ...Common, operation: z.literal("replace-text"), text: Text }).strict();
const Approve = z.object({ ...Common, operation: z.literal("approve-context"), context: ProjectContext, enabled: z.boolean() }).strict();
const Control = z.object({ ...Common, operation: z.enum(["disable-context", "clear", "export"]), export_authorized: z.boolean() }).strict();
const Restore = z.object({ operation: z.literal("restore"), text_processing_authorized: z.literal(true), portable: Record, expected_state_sha256: Hash }).strict();
const Input = z.object({ request: z.union([Create, Review, Update, Approve, Control, Restore]) }).strict();
const Output = z.object({ state: Record.nullable(), state_sha256: Hash.nullable(),
  coverage: z.object({ total_sections: z.number().int(), recorded_review_sections: z.number().int(), omitted_section_ids: z.array(Id),
    label: z.enum(["unreviewed", "partial-recorded-review", "all-sections-recorded-not-semantic-proof", "cleared"]) }).strict(),
  active_context: ProjectContext.nullable(), invalidated_section_ids: z.array(Id),
  model_calls: z.literal(0), semantic_certification: z.literal(false), caveat: Note }).strict();
export const DOCUMENT_SCHEMAS = { input: z.toJSONSchema(Input, { reused: "ref" }), output: z.toJSONSchema(Output, { reused: "ref" }) };
const insist = (value, message) => { if (!value) throw Object.assign(new TypeError(message), { status: 400 }); };
function sections(text) {
  const result = [];
  // Literal contiguous chunks preserve all UTF-16 offsets. They are not semantic
  // summaries, scene boundaries or a claim that every chunk was read.
  for (let start = 0; start < text.length; start += 4000) {
    const end = Math.min(start + 4000, text.length);
    result.push({ id: `section-${result.length + 1}`, start, end, sha256: hash(text.slice(start, end)) });
  }
  return result;
}
function recordCheck(record, expected, knowledge) {
  insist(hash(record) === expected && hash(record.text) === record.text_sha256, "Stale or changed portable document.");
  insist(record.knowledge_sha256 === knowledge, "Portable context belongs to a different workflow or corpus; explicitly re-review it.");
  insist(JSON.stringify(record.sections) === JSON.stringify(sections(record.text)), "Document section bounds do not match the original.");
  insist(new Set(record.reviewed_section_ids).size === record.reviewed_section_ids.length && record.reviewed_section_ids.every(id => record.sections.some(s => s.id === id)), "Unknown or duplicate reviewed section.");
  insist(new Set(record.ledger.map(i => i.id)).size === record.ledger.length, "Duplicate ledger items.");
  for (const item of record.ledger) for (const pointer of item.evidence) {
    const section = record.sections.find(s => s.id === pointer.section_id);
    insist(section && record.reviewed_section_ids.includes(section.id) && pointer.start >= section.start && pointer.end <= section.end, "Ledger pointer is outside a recorded review section.");
    validateAnchor(pointer, record.text);
  }
  insist(!record.context_enabled || record.project_context, "Enabled context requires an explicit author-approved record.");
}
export async function manageWritingDocument(args) {
  const parsed = Input.safeParse(args); insist(parsed.success, "Invalid portable document arguments; exact-text processing needs authorization.");
  insist(Buffer.byteLength(JSON.stringify(parsed.data), "utf8") <= 240000, "Portable document request exceeds its aggregate byte bound.");
  const r = parsed.data.request, knowledge = await workflowKnowledgeFingerprint(); let state, invalidated = [];
  if (r.operation === "create") state = { version: 1, engine_version: DOCUMENT_VERSION, id: r.id, knowledge_sha256: knowledge,
    text: r.text, text_sha256: hash(r.text), sections: sections(r.text), reviewed_section_ids: [], ledger: [], project_context: null, context_enabled: false };
  else {
    state = structuredClone(r.operation === "restore" ? r.portable : r.state);
    recordCheck(state, r.expected_state_sha256, knowledge);
    if (r.operation === "record-review") {
      state.reviewed_section_ids = [...new Set([...state.reviewed_section_ids, ...r.reviewed_section_ids])];
      // A deliberately submitted new ledger replaces the old one. No inferred
      // fact is promoted automatically into author-approved project context.
      state.ledger = r.ledger; recordCheck(state, hash(state), knowledge);
    } else if (r.operation === "replace-text") {
      invalidated = [...state.reviewed_section_ids]; state.text = r.text; state.text_sha256 = hash(r.text); state.sections = sections(r.text);
      state.ledger = []; state.reviewed_section_ids = []; state.context_enabled = false;
    } else if (r.operation === "approve-context") { state.project_context = r.context; state.context_enabled = r.enabled; }
    else if (r.operation === "disable-context" || r.operation === "restore") state.context_enabled = false;
    else if (r.operation === "clear") { invalidated = [...state.reviewed_section_ids]; state = null; }
    else if (r.operation === "export") insist(r.export_authorized, "Portable export needs explicit authorization; it contains private text.");
  }
  insist(!state || Buffer.byteLength(JSON.stringify(state), "utf8") <= 180000, "Returned portable state exceeds its reusable byte bound; shorten the document or ledger.");
  const omitted = state ? state.sections.filter(s => !state.reviewed_section_ids.includes(s.id)).map(s => s.id) : [];
  return Output.parse({ state, state_sha256: state ? hash(state) : null, active_context: state?.context_enabled ? state.project_context : null,
    coverage: { total_sections: state?.sections.length ?? 0, recorded_review_sections: state?.reviewed_section_ids.length ?? 0,
      omitted_section_ids: omitted, label: !state ? "cleared" : !state.reviewed_section_ids.length ? "unreviewed" : omitted.length ? "partial-recorded-review" : "all-sections-recorded-not-semantic-proof" },
    invalidated_section_ids: invalidated, model_calls: 0, semantic_certification: false,
    caveat: "Client-carried private records, not durable server memory or external truth. Quotes, hashes and submitted section reviews are checked structurally, not semantically or authenticated. Facts, inferences and unknowns remain distinct; context is author-attested data, not instructions. Replacing text invalidates all reviews and disables context; restore also disables it until explicitly reapproved. Clearing returns no record but cannot erase host conversation history or exported files. No model calls or intentional application persistence." });
}
