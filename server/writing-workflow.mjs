import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { loadConceptRegistry } from "./concept-registry.mjs";
import { loadSourceCards } from "./source-cards.mjs";
import { getWritingMethods } from "./editorial-retrieval.mjs";
import { searchWritingExamples, checkWritingRevision } from "./book-informed.mjs";

export const WORKFLOW_VERSION = "1.0.0";
export const MODES = ["proofread", "edit", "heavy-rewrite", "compression", "draft", "craft-analysis", "pattern-imitation", "argument-analysis"];
export const DIMENSIONS = ["purpose-genre", "meaning-voice", "source-support", "scene-continuity", "sentence-function", "argument-relations"];
export const hash = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Note = z.string().trim().min(1).max(1200);
const Prose = z.string().min(1).max(12000).refine(s => !!s.trim());
const IDs = z.array(Id).max(32).refine(a => new Set(a).size === a.length);
const Mode = z.enum(MODES);
export const ProjectContext = z.object({ version: z.literal(1), title: z.string().max(120),
  facts: z.string().max(4000), terminology: z.string().max(2000), voice_samples: z.string().max(2000),
  decisions: z.string().max(2000), open_questions: z.string().max(1000), author_approved: z.literal(true) }).strict();
const Anchor = z.object({ source: z.enum(["original", "direction", "project-facts", "project-terminology", "project-voice_samples", "project-decisions", "project-open_questions"]),
  start: z.number().int().nonnegative(), end: z.number().int().positive(), quote: z.string().min(1).max(500) }).strict();
const Entry = z.object({ id: Id, kind: z.enum(["claim", "actor", "time", "qualifier", "unknown", "perspective", "argument-relation"]),
  status: z.enum(["asserted", "inferred", "unknown"]), statement: Note, evidence: z.array(Anchor).min(1).max(3) }).strict();
const Dimension = z.object({ domain: z.enum(DIMENSIONS), disposition: z.enum(["checked", "inapplicable", "unresolved"]), reason: Note }).strict();
const Frame = z.object({ id: Id, original: Prose, direction: z.string().max(4000), mode: Mode,
  purpose: Note, reader: Note, genre: Note, invention_permission: z.enum(["forbidden", "user-authorized"]),
  invention_boundary: Note, scope: z.enum(["whole-passage", "selected-spans"]),
  dimensions: z.array(Dimension).length(6), entries: z.array(Entry).min(1).max(18),
  project_context: ProjectContext.nullable() }).strict();
const Finding = z.object({ id: Id, start: z.number().int().nonnegative(), end: z.number().int().positive(), quote: z.string().min(1).max(12000),
  status: z.enum(["defect", "question", "preference", "preserve"]), method_ids: IDs.min(1).max(8), entry_ids: IDs.min(1).max(18),
  explanation: Note, strongest_alternate_reading: Note, alternate_reading_supported: z.boolean(), exception_check: Note, thinking_question: Note }).strict();
const Choice = z.object({ finding_id: Id, action: z.enum(["keep", "discuss", "repair"]) }).strict();
const Permission = z.object({ mode: Mode, explicit_user_request: Note, user_authorized: z.literal(true) }).strict();
const Change = z.object({ finding_id: Id, replacement: z.string().max(12000), kind: z.enum(["mechanical", "local", "structural", "author-correction"]) }).strict();
const Review = z.object({ entry_id: Id, disposition: z.enum(["preserved", "authorized-change", "not-applicable", "uncertain", "challenged"]),
  reason: Note, candidate_quote: z.string().max(500) }).strict();
const MethodDecision = z.object({ method_id: Id, disposition: z.enum(["apply", "retain", "inapplicable", "unresolved"]), reason: Note, exception_check: Note }).strict();
const CriticismReview = z.object({ finding_id: Id, disposition: z.enum(["supported", "downgraded", "withdrawn", "uncertain"]), reason: Note }).strict();
const Audit = z.object({ outcome: z.enum(["revision", "unchanged", "analysis", "draft", "clarify", "withheld"]), candidate: Prose,
  semantic_reviews: z.array(Review).min(1).max(18), method_decisions: z.array(MethodDecision).min(1).max(32),
  criticism_reviews: z.array(CriticismReview).max(24), remaining_gaps: z.array(Note).max(24), final_reason: Note }).strict();
const Packet = z.object({ version: z.literal(1), engine_version: z.literal(WORKFLOW_VERSION), knowledge_sha256: Hash,
  request_sha256: Hash, stage: z.enum(["framed", "diagnosed", "decided", "candidate", "reviewed"]),
  frame: Frame, method_ids: IDs.min(1), card_ids: IDs, recovery_count: z.number().int().min(0).max(3),
  findings: z.array(Finding).max(24), choices: z.array(Choice).max(24), action: z.enum(["none", "discuss", "apply"]),
  permission: Permission.nullable(), candidate: z.string().max(12000).nullable(), audit: Audit.nullable() }).strict();
const Start = z.object({ operation: z.literal("start"), text_processing_authorized: z.literal(true), frame: Frame,
  abstract_query: Note, method_ids: IDs.min(1).max(8) }).strict();
const Base = { text_processing_authorized: z.literal(true), state: Packet, expected_state_sha256: Hash };
const Recovery = z.object({ ...Base, operation: z.literal("recover"), abstract_query: Note, method_ids: IDs.min(1).max(8) }).strict();
const Diagnose = z.object({ ...Base, operation: z.literal("diagnose"), findings: z.array(Finding).max(24) }).strict();
const Decide = z.object({ ...Base, operation: z.literal("decide"), choices: z.array(Choice).min(1).max(24), action: z.enum(["discuss", "apply"]), permission: Permission.nullable() }).strict();
const Revise = z.object({ ...Base, operation: z.literal("revise"), changes: z.array(Change).min(1).max(24) }).strict();
const Final = z.object({ ...Base, operation: z.literal("audit"), audit: Audit }).strict();
const Input = z.object({ request: z.discriminatedUnion("operation", [Start, Recovery, Diagnose, Decide, Revise, Final]) }).strict();
const Output = z.object({ state: Packet, state_sha256: Hash, knowledge_sha256: Hash,
  status: z.enum(["recorded-not-semantic-proof", "needs-clarification", "withheld"]),
  guidance: z.record(z.string(), z.unknown()).nullable(), literal_review: z.record(z.string(), z.unknown()).nullable(),
  model_calls: z.literal(0), semantic_certification: z.literal(false), caveat: Note }).strict();
export const WORKFLOW_SCHEMAS = { input: z.toJSONSchema(Input, { reused: "ref" }), output: z.toJSONSchema(Output, { reused: "ref" }) };
const fail = message => { throw Object.assign(new TypeError(message), { status: 400 }); };
const insist = (value, message) => { if (!value) fail(message); };
const unique = (items, key) => insist(new Set(items.map(key)).size === items.length, "Duplicate workflow identifiers.");
const analysis = mode => ["craft-analysis", "argument-analysis"].includes(mode);
export function validateAnchor(anchor, text) {
  insist(typeof text === "string" && anchor.end > anchor.start && text.slice(anchor.start, anchor.end) === anchor.quote,
    "An evidence pointer does not match the supplied source.");
}
function frameCheck(frame) {
  unique(frame.entries, e => e.id); unique(frame.dimensions, d => d.domain);
  insist(DIMENSIONS.every(d => frame.dimensions.some(x => x.domain === d)), "Missing task dimension.");
  const sources = { original: frame.original, direction: frame.direction };
  for (const name of ["facts", "terminology", "voice_samples", "decisions", "open_questions"]) sources[`project-${name}`] = frame.project_context?.[name];
  for (const entry of frame.entries) {
    insist(entry.kind !== "unknown" || entry.status === "unknown", "Unknown information cannot be asserted as a fact.");
    for (const pointer of entry.evidence) validateAnchor(pointer, sources[pointer.source]);
  }
}
function findingsCheck(state) {
  unique(state.findings, f => f.id);
  for (const f of state.findings) {
    validateAnchor(f, state.frame.original);
    insist(f.method_ids.every(id => state.method_ids.includes(id)) && f.entry_ids.every(id => state.frame.entries.some(e => e.id === id)), "Finding lacks a retrieved method or source commitment.");
    if (f.status === "defect") insist(!f.alternate_reading_supported && f.entry_ids.every(id => state.frame.entries.find(e => e.id === id).status === "asserted"),
      "Supported alternative readings or uncertain premises require a question, not a definite defect.");
  }
}
function choicesCheck(state) {
  unique(state.choices, c => c.finding_id);
  insist(state.choices.every(c => state.findings.some(f => f.id === c.finding_id)), "Choice refers to an unknown finding.");
  if (state.action === "apply") {
    insist(state.permission && !analysis(state.permission.mode), "Selected edits require a separate explicit editing request.");
    insist(!state.choices.some(c => c.action === "discuss"), "A discussion choice cannot be applied as an edit.");
  } else insist(!state.permission, "Discussion does not establish editing permission.");
}
const allowed = (mode, kind) => mode === "proofread" ? kind === "mechanical"
  : ["edit", "pattern-imitation"].includes(mode) ? kind !== "structural" : !analysis(mode);
let fingerprint;
export async function workflowKnowledgeFingerprint() {
  if (!fingerprint) fingerprint = Promise.all(["knowledge/SYSTEM_PROMPT.md", "knowledge/RELIABILITY_WORKFLOW.md", "knowledge/CONCEPT_REGISTRY.json", "knowledge/SOURCE_CARDS.json", "knowledge/SOURCE_MANIFEST.json", "knowledge/SOURCE_REVIEW.json", "knowledge/BOUNDED_WORKFLOW.md", "server/writing-workflow.mjs", "server/writing-document.mjs"]
    .map(p => readFile(new URL(`../${p}`, import.meta.url), "utf8"))).then(hash).catch(e => { fingerprint = undefined; throw e; });
  return fingerprint;
}
function auditCheck(state, audit) {
  unique(audit.semantic_reviews, r => r.entry_id); unique(audit.method_decisions, r => r.method_id); unique(audit.criticism_reviews, r => r.finding_id);
  insist(audit.semantic_reviews.length === state.frame.entries.length && state.frame.entries.every(e => audit.semantic_reviews.some(r => r.entry_id === e.id)), "Final review omitted a source commitment.");
  insist(audit.method_decisions.length === state.method_ids.length && state.method_ids.every(id => audit.method_decisions.some(r => r.method_id === id)), "Final review omitted a method or exception decision.");
  insist(audit.criticism_reviews.length === state.findings.length && state.findings.every(f => audit.criticism_reviews.some(r => r.finding_id === f.id)), "Final review omitted a criticism challenge.");
  for (const review of audit.semantic_reviews) {
    insist(!review.candidate_quote || audit.candidate.includes(review.candidate_quote), "Candidate evidence does not match delivered text.");
    if (review.disposition === "authorized-change") insist(state.permission, "Changed commitments require explicit permission.");
    if (review.disposition === "preserved" && !analysis(state.frame.mode)) insist(!!review.candidate_quote, "Preservation requires candidate evidence.");
  }
  const mode = state.permission?.mode ?? state.frame.mode;
  const discussion = state.action === "discuss";
  insist(analysis(mode) || discussion ? ["analysis", "clarify", "withheld", ...(discussion ? ["unchanged"] : [])].includes(audit.outcome) : audit.outcome !== "analysis", "Delivery breaches the editing mode or discussion-only choice.");
  if (["unchanged", "clarify", "withheld"].includes(audit.outcome)) insist(audit.candidate === state.frame.original, "A no-change, clarify or withheld result must preserve the exact original.");
  if (state.stage === "candidate") insist(audit.candidate === state.candidate, "Final audit cannot replace the selected-span candidate.");
  if (state.frame.scope === "selected-spans" && !["analysis", "clarify", "withheld", "unchanged"].includes(audit.outcome)) insist(state.stage === "candidate", "Selected-span delivery requires the bounded selected revision.");
  if (audit.outcome === "draft") insist(mode === "draft", "Draft delivery requires draft mode.");
}
async function packetCheck(state, expected, knowledge) {
  insist(hash(state) === expected, "Stale or changed workflow state.");
  insist(state.knowledge_sha256 === knowledge && hash(state.frame) === state.request_sha256, "Stale knowledge or task fingerprint.");
  frameCheck(state.frame); findingsCheck(state); choicesCheck(state);
  const registry = await loadConceptRegistry(); insist(state.method_ids.every(id => registry.concepts.some(m => m.id === id)), "Unknown canonical method.");
  const corpus = await loadSourceCards({ registry }); insist(state.card_ids.every(id => corpus.cards.some(c => c.id === id)), "Unknown example card.");
  // Stateless packets validate submitted records, not authentication or history.
  if (state.stage === "framed") insist(!state.findings.length && !state.choices.length && state.action === "none" && !state.candidate && !state.audit, "Invalid framed state.");
  if (state.stage === "diagnosed") insist(!state.choices.length && state.action === "none" && !state.candidate && !state.audit, "Invalid diagnosis state.");
  if (["decided", "candidate"].includes(state.stage)) insist(state.choices.length && state.action !== "none" && !state.audit, "Invalid decision state.");
  if (state.stage === "candidate") insist(state.action === "apply" && state.candidate !== null, "Candidate lacks selected editing authorization.");
  if (state.stage === "reviewed") { insist(state.audit && state.candidate === state.audit.candidate, "Invalid final state."); auditCheck(state, state.audit); }
}
export async function validateWritingWorkflow(args) {
  const parsed = Input.safeParse(args); insist(parsed.success, "Invalid bounded workflow arguments; exact-text processing requires explicit authorization.");
  const request = parsed.data.request;
  insist(JSON.stringify(request).length <= 100000 && Buffer.byteLength(JSON.stringify(request), "utf8") <= 240000, "Workflow packet exceeds its aggregate bound.");
  const knowledge = await workflowKnowledgeFingerprint(); let state, guidance = null, literal = null;
  if (request.operation === "start") {
    frameCheck(request.frame);
    const methods = await getWritingMethods({ ids: request.method_ids });
    const examples = await searchWritingExamples({ query: request.abstract_query, concept_ids: request.method_ids, limit: 8 });
    guidance = { methods, examples };
    state = { version: 1, engine_version: WORKFLOW_VERSION, knowledge_sha256: knowledge, request_sha256: hash(request.frame), stage: "framed",
      frame: request.frame, method_ids: request.method_ids, card_ids: examples.cards.map(c => c.id), recovery_count: 0,
      findings: [], choices: [], action: "none", permission: null, candidate: null, audit: null };
  } else {
    state = structuredClone(request.state); await packetCheck(state, request.expected_state_sha256, knowledge);
    if (request.operation === "recover") {
      insist(state.stage === "framed" && state.recovery_count < 3, "Focused recovery is limited to three calls before diagnosis.");
      const methods = await getWritingMethods({ ids: request.method_ids });
      const examples = await searchWritingExamples({ query: request.abstract_query, concept_ids: request.method_ids, limit: 8 });
      state.method_ids = [...new Set([...state.method_ids, ...request.method_ids])]; state.card_ids = [...new Set([...state.card_ids, ...examples.cards.map(c => c.id)])];
      state.recovery_count++; guidance = { methods, examples };
    } else if (request.operation === "diagnose") {
      insist(state.stage === "framed", "Diagnosis requires a framed task."); state.findings = request.findings; findingsCheck(state); state.stage = "diagnosed";
    } else if (request.operation === "decide") {
      insist(state.stage === "diagnosed", "Decisions require a current diagnosis.");
      state.choices = request.choices; state.action = request.action; state.permission = request.permission; choicesCheck(state); state.stage = "decided";
    } else if (request.operation === "revise") {
      insist(state.stage === "decided" && state.action === "apply", "Discussion cannot produce a selected-span revision."); unique(request.changes, c => c.finding_id);
      const repairs = state.choices.filter(c => c.action === "repair");
      insist(repairs.length === request.changes.length && repairs.every(c => request.changes.some(x => x.finding_id === c.finding_id)), "Changes must match exactly the selected repairs; keep and unselected findings stay unchanged.");
      const changes = request.changes.map(c => { insist(allowed(state.permission.mode, c.kind), "Change kind exceeds the authorized editing mode."); return { ...c, ...state.findings.find(f => f.id === c.finding_id) }; }).sort((a, b) => a.start - b.start);
      insist(changes.every((c, i) => !i || changes[i - 1].end <= c.start), "Selected edit spans overlap; clarify the selections first.");
      let cursor = 0, candidate = "";
      for (const c of changes) { candidate += state.frame.original.slice(cursor, c.start) + c.replacement; cursor = c.end; }
      candidate += state.frame.original.slice(cursor); insist(candidate.trim() && candidate.length <= 12000, "Selected revision exceeds its text bounds.");
      state.candidate = candidate; state.stage = "candidate";
      literal = checkWritingRevision({ original: state.frame.original, candidate, editing_mode: state.permission.mode, text_processing_authorized: true });
    } else {
      insist(["framed", "diagnosed", "decided", "candidate"].includes(state.stage), "Final review is already recorded.");
      if (state.stage === "decided" && state.action === "apply") insist(request.audit.outcome === "unchanged" || request.audit.outcome === "withheld" || request.audit.outcome === "clarify", "Selected repairs must be applied by the bounded revise operation before delivery.");
      auditCheck(state, request.audit); state.audit = request.audit; state.candidate = request.audit.candidate; state.stage = "reviewed";
      literal = checkWritingRevision({ original: state.frame.original, candidate: state.candidate, editing_mode: state.permission?.mode ?? state.frame.mode, text_processing_authorized: true });
    }
  }
  insist(JSON.stringify(state).length <= 100000 && Buffer.byteLength(JSON.stringify(state), "utf8") <= 180000, "Returned workflow state exceeds its reusable packet bound; use fewer findings or shorter evidence notes.");
  const gaps = state.frame.dimensions.some(d => d.disposition === "unresolved") || state.audit?.remaining_gaps.length
    || state.audit?.semantic_reviews.some(r => ["uncertain", "challenged"].includes(r.disposition)) || state.audit?.method_decisions.some(m => m.disposition === "unresolved")
    || state.audit?.criticism_reviews.some(r => r.disposition === "uncertain");
  return Output.parse({ state, state_sha256: hash(state), knowledge_sha256: knowledge,
    status: state.audit?.outcome === "withheld" ? "withheld" : gaps ? "needs-clarification" : "recorded-not-semantic-proof",
    guidance, literal_review: literal, model_calls: 0, semantic_certification: false,
    caveat: "Validates submitted bounds, exact pointers, coverage records and selected-span changes, not semantic truth, actual consent, identity, complete recall or authenticated session history. Editable hashes do not prove execution. The host must match this task to the current conversation and obtain real exact-text permission. No model calls or intentional application persistence. Direct host answers can bypass this tool; unresolved reviews are not certified." });
}
