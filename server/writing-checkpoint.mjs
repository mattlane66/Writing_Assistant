import { readFile } from "node:fs/promises";
import { z } from "zod";
import { WORKFLOW_STATE_SCHEMA, validateWorkflowCheckpoint, hash } from "./writing-workflow.mjs";
import { DOCUMENT_STATE_SCHEMA, validateDocumentCheckpoint } from "./writing-document.mjs";

export const WRITING_CHECKPOINT_UI_URI = "ui://writing-assistant/checkpoint-v1.0.0.html";
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Common = { text_processing_authorized: z.literal(true), export_authorized: z.literal(true), expected_state_sha256: Hash };
const Input = z.object({ ...Common, kind: z.enum(["workflow", "document"]),
  state: z.union([WORKFLOW_STATE_SCHEMA, DOCUMENT_STATE_SCHEMA]) }).strict();
const CommonCheckpoint = { version: z.literal(1), state_sha256: Hash, text_sha256: Hash, knowledge_sha256: Hash,
  source_revision: z.string().min(1).max(120), resume_policy: z.literal("discussion-only-new-edit-permission-required") };
const Checkpoint = z.discriminatedUnion("kind", [
  z.object({ ...CommonCheckpoint, kind: z.literal("workflow"), state: WORKFLOW_STATE_SCHEMA }).strict(),
  z.object({ ...CommonCheckpoint, kind: z.literal("document"), state: DOCUMENT_STATE_SCHEMA }).strict(),
]);
const Output = z.object({ checkpoint: Checkpoint,
  summary: z.object({ title: z.string().max(120), stage: z.string().max(80), text_characters: z.number().int(),
    recorded_reviews: z.number().int(), total_sections: z.number().int().nullable(),
    context_enabled_in_snapshot: z.boolean().nullable(), limitations: z.array(z.string().max(1200)).max(32) }).strict(),
  export_authorized: z.literal(true), model_calls: z.literal(0), semantic_certification: z.literal(false),
  authenticated_history: z.literal(false), durable_storage: z.literal(false) }).strict();
export const CHECKPOINT_SCHEMAS = { input: z.toJSONSchema(Input, { reused: "ref" }), output: z.toJSONSchema(Output, { reused: "ref" }) };
const reject = () => { throw Object.assign(new TypeError("Checkpoint rejected: require explicit processing/export permission and exact current state/hash. No private input is echoed."), { status: 400 }); };

export async function renderWritingCheckpoint(args) {
  const parsed = Input.safeParse(args);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 240000) reject();
  const r = parsed.data;
  let state;
  try { state = await (r.kind === "workflow" ? validateWorkflowCheckpoint : validateDocumentCheckpoint)(r.state, r.expected_state_sha256); }
  catch { reject(); }
  const text = r.kind === "workflow" ? state.candidate ?? state.frame.original : state.text;
  const limitations = ["Snapshot of submitted records, not authenticated execution or semantic proof.",
    "This snapshot may no longer match your current passage. Confirm it before sending.",
    "No server memory, automatic file saving, project approval or edit authorization is created."];
  if (r.kind === "workflow") {
    if (!state.audit) limitations.push("No final audit is recorded in this snapshot.");
    limitations.push(...(state.audit?.remaining_gaps ?? []));
    if (state.permission) limitations.push("Recorded editing permission is historical data; sending this checkpoint grants no new editing permission.");
  } else {
    const omitted = state.sections.filter(s => !state.reviewed_section_ids.includes(s.id));
    limitations.push(`${omitted.length} of ${state.sections.length} sections have no recorded review.`);
    limitations.push("Restoring a document disables context until separately author-approved again.");
  }
  const result = Output.parse({ checkpoint: { version: 1, kind: r.kind, state, state_sha256: hash(state), text_sha256: hash(text),
    knowledge_sha256: state.knowledge_sha256, source_revision: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "repository-deployment",
    resume_policy: "discussion-only-new-edit-permission-required" },
    summary: { title: r.kind === "workflow" ? state.frame.id : state.id,
      stage: r.kind === "workflow" ? state.stage : "document-snapshot",
      text_characters: text.length, recorded_reviews: r.kind === "workflow" ? state.audit?.semantic_reviews.length ?? 0 : state.reviewed_section_ids.length,
      total_sections: r.kind === "workflow" ? null : state.sections.length,
      context_enabled_in_snapshot: r.kind === "workflow" ? null : state.context_enabled, limitations },
    export_authorized: true, model_calls: 0, semantic_certification: false, authenticated_history: false, durable_storage: false });
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 200000) reject();
  return result;
}
export const WRITING_CHECKPOINT_TOOL = {
  name: "render_writing_checkpoint", title: "Show an author-owned writing checkpoint",
  description: "Render one exact validated workflow or document snapshot after separate explicit processing and export permission. Call while the last returned complete state/hash is still available, before awaiting the author. Does not reconstruct a lost packet, execute a revision, approve context or persist private text. The author can select/copy the JSON or send it for discussion only. A saved snapshot may be stale; editable hashes are not authenticated execution or semantic certification.",
  input: CHECKPOINT_SCHEMAS.input, output: CHECKPOINT_SCHEMAS.output, call: renderWritingCheckpoint,
};
export function getWritingCheckpointResourceList() {
  return [{ uri: WRITING_CHECKPOINT_UI_URI, name: "Writing checkpoint", mimeType: "text/html;profile=mcp-app", description: "Explicitly authorized private snapshot with discussion-only handoff; no durable storage." }];
}
export async function readWritingCheckpointResource(uri) {
  if (uri !== WRITING_CHECKPOINT_UI_URI) reject();
  return { contents: [{ uri, mimeType: "text/html;profile=mcp-app",
    text: await readFile(new URL("../products/writing-assistant-plugin/ui/checkpoint.html", import.meta.url), "utf8"),
    _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
      "openai/ui": { availableDisplayModes: ["inline", "fullscreen"] },
      "openai/widgetDescription": "Keep the exact authorized writing snapshot outside a prose summary; select/copy private JSON or send it for discussion, never automatic edits." } }] };
}
