import { beforeAll, describe, expect, it } from "vitest";
import { hash, DIMENSIONS, MODES, validateWritingWorkflow, WORKFLOW_SCHEMAS, WORKFLOW_TOOLS } from "../server/writing-workflow.mjs";
import { manageWritingDocument, DOCUMENT_SCHEMAS, DOCUMENT_TOOLS } from "../server/writing-document.mjs";
import { callWritingAssistantTool, handleWritingAssistantMcp } from "../server/mcp.mjs";

// Original public software fixtures, not unseen cases, host outputs or human grades.
const original = "The door was found open. Nobody knows who opened it.";
const quote = "The door was found open.";
const frame = (mode = "edit") => ({ id: "software-workflow", original, direction: "Preserve unknown agency.", mode,
  purpose: "Preserve the source commitments.", reader: "General reader.", genre: "Nonfiction.", invention_permission: "forbidden",
  invention_boundary: "No invented actor or cause.", scope: "whole-passage", project_context: null,
  dimensions: DIMENSIONS.map(domain => ({ domain, disposition: "checked", reason: "Original software fixture dimension record, not an actual semantic judgment." })),
  entries: [{ id: "agency", kind: "claim", status: "asserted", statement: "The door was found open; its opener is unknown.",
    evidence: [{ source: "original", start: 0, end: original.length, quote: original }] }] });
const start = (value = frame()) => validateWritingWorkflow({ request: { operation: "start", text_processing_authorized: true, frame: value,
  abstract_query: "unknown actor and justified passive voice", method_ids: ["passive-voice"] } });
const next = (result, operation, fields = {}) => validateWritingWorkflow({ request: { operation, text_processing_authorized: true,
  state: result.state, expected_state_sha256: result.state_sha256, ...fields } });
const finding = (id = "door", start = 0, text = quote) => ({ id, start, end: start + text.length, quote: text, status: "preserve",
  method_ids: ["passive-voice"], entry_ids: ["agency"], explanation: "Unknown agency supports this passive.", strongest_alternate_reading: "An explicit actor could be supplied if actually known.",
  alternate_reading_supported: true, exception_check: "Do not invent the unknown actor.", thinking_question: "Is the actor genuinely known?" });
const permission = mode => ({ mode, user_authorized: true, explicit_user_request: "Edit only the selected sentence; preserve other text." });
function audit(result, outcome = "unchanged", candidate = original) {
  return { outcome, candidate, semantic_reviews: result.state.frame.entries.map(e => ({ entry_id: e.id, disposition: "preserved", reason: "Software review only.", candidate_quote: candidate === original ? quote : candidate.slice(0, 500) })),
    method_decisions: result.state.method_ids.map(method_id => ({ method_id, disposition: "retain", reason: "Unknown actor.", exception_check: "Preserve justified passive." })),
    criticism_reviews: result.state.findings.map(f => ({ finding_id: f.id, disposition: "supported", reason: "Synthetic audit of the recorded preservation choice." })), remaining_gaps: [], final_reason: "No semantic certification." };
}
let initial;
beforeAll(async () => { initial = await start(); }, 20000);
describe("individually exposed editorial operations", () => {
  it.each([...WORKFLOW_TOOLS, ...DOCUMENT_TOOLS])("$name has one explicit operation and refuses a dispatch envelope", async tool => {
    expect(tool.input.type).toBe("object");
    expect(tool.input.additionalProperties).toBe(false);
    expect(tool.input.properties.operation).toBeUndefined();
    expect(tool.input.properties.request).toBeUndefined();
    const bad = await callWritingAssistantTool(tool.name, { operation: "clear", request: { text: "PRIVATE_SENTINEL" } });
    expect(bad.isError).toBe(true); expect(JSON.stringify(bad)).not.toContain("PRIVATE_SENTINEL");
  });
  it("executes the six exposed workflow steps without weakening stage checks", async () => {
    const call = async (name, fields, previous) => {
      const r = await callWritingAssistantTool(name, { text_processing_authorized: true, ...(previous ? { state: previous.state, expected_state_sha256: previous.state_sha256 } : {}), ...fields });
      expect(r.isError).not.toBe(true); return r.structuredContent;
    };
    let r = await call("start_writing_workflow", { frame: frame(), abstract_query: "unknown actor", method_ids: ["passive-voice"] });
    r = await call("recover_writing_guidance", { abstract_query: "unknown actor", method_ids: ["passive-voice"] }, r);
    r = await call("record_writing_diagnosis", { findings: [finding()] }, r);
    r = await call("record_writing_decisions", { choices: [{ finding_id: "door", action: "repair" }], action: "apply", permission: permission("edit") }, r);
    r = await call("apply_selected_writing_revisions", { changes: [{ finding_id: "door", replacement: quote, kind: "local" }] }, r);
    r = await call("audit_writing_workflow", { audit: audit(r, "revision", original) }, r);
    expect(r.state.stage).toBe("reviewed");
    expect((await callWritingAssistantTool("validate_writing_workflow", {})).isError).toBe(true);
  });
  it("executes all eight exposed document operations and preserves export/restore controls", async () => {
    const call = async (name, fields, previous) => {
      const r = await callWritingAssistantTool(name, { text_processing_authorized: true, ...(previous ? { state: previous.state, expected_state_sha256: previous.state_sha256 } : {}), ...fields });
      expect(r.isError).not.toBe(true); return r.structuredContent;
    };
    let r = await call("create_writing_document", { id: "public-test", text: original });
    r = await call("record_writing_document_review", { reviewed_section_ids: ["section-1"], ledger: [] }, r);
    r = await call("approve_writing_document_context", { context: { version: 1, title: "Public fixture", facts: "", terminology: "", voice_samples: "", decisions: "", open_questions: "", author_approved: true }, enabled: true }, r);
    r = await call("disable_writing_document_context", {}, r); expect(r.active_context).toBeNull();
    expect((await callWritingAssistantTool("export_writing_document", { text_processing_authorized: true, state: r.state, expected_state_sha256: r.state_sha256, export_authorized: false })).isError).toBe(true);
    r = await call("export_writing_document", { export_authorized: true }, r);
    r = await call("restore_writing_document", { portable: r.state, expected_state_sha256: r.state_sha256 });
    expect(r.state.context_enabled).toBe(false);
    r = await call("replace_writing_document_text", { text: "The door remains open." }, r); expect(r.state.reviewed_section_ids).toEqual([]);
    r = await call("clear_writing_document", {}, r); expect(r.state).toBeNull();
    expect((await callWritingAssistantTool("manage_writing_document", {})).isError).toBe(true);
  });
});
describe("bounded host-first writing workflow", () => {
  it("returns full methods and original examples without another model", () => {
    expect(initial.guidance.methods.methods[0].exceptions.length).toBeGreaterThan(0);
    expect(initial.guidance.examples.cards.length).toBeGreaterThan(0);
    expect(initial).toMatchObject({ model_calls: 0, semantic_certification: false, status: "recorded-not-semantic-proof" });
    expect(initial.caveat).toMatch(/Direct host answers can bypass/);
  });
  it("requires explicit text-processing permission and rejects extra fields", async () => {
    const r = { operation: "start", frame: frame(), abstract_query: "unknown actor", method_ids: ["passive-voice"] };
    await expect(validateWritingWorkflow({ request: r })).rejects.toThrow(/authorization/);
    await expect(validateWritingWorkflow({ request: { ...r, text_processing_authorized: false } })).rejects.toThrow();
    await expect(validateWritingWorkflow({ request: { ...r, text_processing_authorized: true, api_key: "PRIVATE_SENTINEL" } })).rejects.toThrow();
  });
  it("checks exact source pointers, duplicates and all six dimensions", async () => {
    const f = frame(); f.entries[0].evidence[0].quote = "Invented evidence"; await expect(start(f)).rejects.toThrow(/pointer/);
    const missing = frame(); missing.dimensions.pop(); await expect(start(missing)).rejects.toThrow();
    const duplicate = frame(); duplicate.entries.push(duplicate.entries[0]); await expect(start(duplicate)).rejects.toThrow(/Duplicate/);
  });
  it("does not turn unknowns into asserted facts", async () => {
    const f = frame(); f.entries[0].kind = "unknown"; await expect(start(f)).rejects.toThrow(/Unknown/);
  });
  it("rejects altered state and stale task or knowledge fingerprints", async () => {
    const changed = structuredClone(initial); changed.state.frame.original += "PRIVATE_SENTINEL";
    await expect(next(changed, "diagnose", { findings: [] })).rejects.toThrow(/Stale/);
    changed.state_sha256 = hash(changed.state); await expect(next(changed, "diagnose", { findings: [] })).rejects.toThrow(/fingerprint/);
    const old = structuredClone(initial); old.state.knowledge_sha256 = "0".repeat(64); old.state_sha256 = hash(old.state);
    await expect(next(old, "diagnose", { findings: [] })).rejects.toThrow(/Stale/);
  });
  it("bounds focused recovery to three additional calls", async () => {
    let r = initial;
    for (let i = 0; i < 3; i++) r = await next(r, "recover", { abstract_query: "passive justified unknown agency", method_ids: ["passive-voice"] });
    await expect(next(r, "recover", { abstract_query: "agency", method_ids: ["passive-voice"] })).rejects.toThrow(/three/);
  });
  it("rejects definite criticisms with supported alternate readings", async () => {
    await expect(next(initial, "diagnose", { findings: [{ ...finding(), status: "defect" }] })).rejects.toThrow(/question/);
    const f = frame(); f.entries[0].status = "inferred"; const r = await start(f);
    await expect(next(r, "diagnose", { findings: [{ ...finding(), status: "defect", alternate_reading_supported: false }] })).rejects.toThrow(/question/);
  });
  it("rejects invented finding quotes, methods and source commitments", async () => {
    for (const change of [{ quote: "not in passage" }, { method_ids: ["unknown-method"] }, { entry_ids: ["unknown-entry"] }]) {
      await expect(next(initial, "diagnose", { findings: [{ ...finding(), ...change }] })).rejects.toThrow();
    }
  });
  it("keeps discussion separate from editing even in an edit-mode task", async () => {
    const d = await next(initial, "diagnose", { findings: [finding()] });
    const c = await next(d, "decide", { choices: [{ finding_id: "door", action: "discuss" }], action: "discuss", permission: null });
    await expect(next(c, "revise", { changes: [{ finding_id: "door", replacement: "Changed.", kind: "local" }] })).rejects.toThrow(/Discussion/);
    await expect(next(c, "audit", { audit: audit(c, "revision", "Changed.") })).rejects.toThrow(/discussion/);
    expect((await next(c, "audit", { audit: audit(c, "analysis", "This construction is defensible.") })).state.audit.outcome).toBe("analysis");
  });
  it("requires separate explicit editing authorization for selected repairs", async () => {
    const d = await next(initial, "diagnose", { findings: [finding()] });
    await expect(next(d, "decide", { choices: [{ finding_id: "door", action: "repair" }], action: "apply", permission: null })).rejects.toThrow(/explicit/);
    await expect(next(d, "decide", { choices: [{ finding_id: "door", action: "discuss" }], action: "apply", permission: permission("edit") })).rejects.toThrow(/discussion/);
  });
  it("changes only the selected exact span and preserves unselected text byte-for-byte", async () => {
    const d = await next(initial, "diagnose", { findings: [finding(), finding("unknown", quote.length + 1, original.slice(quote.length + 1))] });
    const c = await next(d, "decide", { choices: [{ finding_id: "door", action: "repair" }, { finding_id: "unknown", action: "keep" }], action: "apply", permission: permission("edit") });
    const r = await next(c, "revise", { changes: [{ finding_id: "door", replacement: "The door stood open.", kind: "local" }] });
    expect(r.state.candidate).toBe("The door stood open. Nobody knows who opened it.");
    expect(r.literal_review.semantic_certification).toBe(false);
    await expect(next(c, "revise", { changes: [{ finding_id: "unknown", replacement: "Nora opened it.", kind: "local" }] })).rejects.toThrow(/selected/);
    const a = audit(r, "revision", r.state.candidate); a.semantic_reviews[0].candidate_quote = "Nobody knows who opened it.";
    const done = await next(r, "audit", { audit: a }); expect(done.state.stage).toBe("reviewed");
    await expect(next(done, "audit", { audit: a })).rejects.toThrow(/already/);
  });
  it("rejects overlapping selected spans and wider proofread change labels", async () => {
    const d = await next(initial, "diagnose", { findings: [finding(), finding("whole", 0, original)] });
    const c = await next(d, "decide", { choices: d.state.findings.map(f => ({ finding_id: f.id, action: "repair" })), action: "apply", permission: permission("proofread") });
    await expect(next(c, "revise", { changes: c.state.choices.map(x => ({ finding_id: x.finding_id, replacement: "Changed.", kind: "mechanical" })) })).rejects.toThrow(/overlap/);
    const one = await next(d, "decide", { choices: [{ finding_id: "door", action: "repair" }], action: "apply", permission: permission("proofread") });
    await expect(next(one, "revise", { changes: [{ finding_id: "door", replacement: "Changed.", kind: "structural" }] })).rejects.toThrow(/mode/);
  });
  it("requires every semantic, method and criticism review", async () => {
    const d = await next(initial, "diagnose", { findings: [finding()] });
    for (const field of ["semantic_reviews", "method_decisions", "criticism_reviews"]) {
      const a = audit(d); a[field] = []; await expect(next(d, "audit", { audit: a })).rejects.toThrow();
    }
  });
  it("does not let final audit replace a selected candidate", async () => {
    const d = await next(initial, "diagnose", { findings: [finding()] });
    const c = await next(d, "decide", { choices: [{ finding_id: "door", action: "repair" }], action: "apply", permission: permission("edit") });
    await expect(next(c, "audit", { audit: audit(c, "revision", original) })).rejects.toThrow(/bounded revise/);
    const r = await next(c, "revise", { changes: [{ finding_id: "door", replacement: quote, kind: "local" }] });
    await expect(next(r, "audit", { audit: audit(r, "revision", original + " More.") })).rejects.toThrow(/replace/);
  });
  it("surfaces unresolved reviews without certification", async () => {
    const a = audit(initial); a.semantic_reviews[0].disposition = "uncertain";
    const r = await next(initial, "audit", { audit: a }); expect(r.status).toBe("needs-clarification"); expect(r.semantic_certification).toBe(false);
  });
  it.each(MODES)("supports the %s boundary without widening permission", async mode => {
    const r = await start(frame(mode)); const outcome = /analysis/.test(mode) ? "analysis" : mode === "draft" ? "draft" : "unchanged";
    const result = await next(r, "audit", { audit: audit(r, outcome) }); expect(result.state.audit.outcome).toBe(outcome);
  });
  it("keeps no-change, clarification and withheld outcomes literally unchanged", async () => {
    for (const outcome of ["unchanged", "clarify", "withheld"]) await expect(next(initial, "audit", { audit: audit(initial, outcome, "Changed.") })).rejects.toThrow(/exact original/);
  });
  it("exposes strict schemas and privacy-safe failures over MCP", async () => {
    expect(WORKFLOW_SCHEMAS.input.additionalProperties).toBe(false); expect(WORKFLOW_SCHEMAS.output.additionalProperties).toBe(false);
    const bad = await callWritingAssistantTool("start_writing_workflow", { original: "PRIVATE_SENTINEL" });
    expect(bad.isError).toBe(true); expect(JSON.stringify(bad)).not.toContain("PRIVATE_SENTINEL");
    const rpc = await handleWritingAssistantMcp({ jsonrpc: "2.0", id: "workflow", method: "tools/call", params: { name: "audit_writing_workflow", arguments: { text_processing_authorized: true, state: initial.state, expected_state_sha256: initial.state_sha256, audit: audit(initial) } } });
    expect(rpc.result.structuredContent.state.stage).toBe("reviewed");
  });
  it("keeps schemas bounded and all shared references resolvable locally", () => {
    for (const schema of [WORKFLOW_SCHEMAS.input, WORKFLOW_SCHEMAS.output, DOCUMENT_SCHEMAS.input, DOCUMENT_SCHEMAS.output, ...[...WORKFLOW_TOOLS, ...DOCUMENT_TOOLS].map(t => t.input)]) {
      const walk = value => { if (!value || typeof value !== "object") return;
        if (value.$ref) { expect(value.$ref).toMatch(/^#\/\$defs\//); expect(schema.$defs[value.$ref.split("/").at(-1)]).toBeTruthy(); }
        Object.values(value).forEach(walk);
      }; walk(schema);
      expect(JSON.stringify(schema).length).toBeLessThan(14000);
    }
  });
});

const docCall = request => manageWritingDocument({ request });
const docNext = (r, operation, fields = {}) => docCall({ operation, state: r.state, expected_state_sha256: r.state_sha256, text_processing_authorized: true, ...fields });
const context = { version: 1, title: "Author project", facts: "Unknown opener.", terminology: "Door", voice_samples: "Plain.", decisions: "Preserve uncertainty.", open_questions: "Who opened it?", author_approved: true };
describe("portable bounded document and approved context", () => {
  it("can replace a maximum-length ASCII document without a smaller accidental bound", async () => {
    const r = await docCall({ operation: "create", id: "max-document", text: "a".repeat(96000), text_processing_authorized: true });
    expect((await docNext(r, "replace-text", { text: "b".repeat(96000) })).state.text).toHaveLength(96000);
  });
  it("rejects Unicode states that would exceed the reusable transport byte bound", async () => {
    await expect(docCall({ operation: "create", id: "unicode-document", text: "語".repeat(80000), text_processing_authorized: true })).rejects.toThrow(/byte bound/);
  });
  it("indexes every character without claiming sections reviewed", async () => {
    const r = await docCall({ operation: "create", id: "long-document", text: "a".repeat(96000), text_processing_authorized: true });
    expect(r.state.sections).toHaveLength(24); expect(r.state.sections.at(-1).end).toBe(96000);
    expect(r.coverage.omitted_section_ids).toHaveLength(24); expect(r.coverage.label).toBe("unreviewed");
  });
  it("records exact cross-section commitments and exposes omitted sections", async () => {
    const text = original + " ".repeat(4000) + "Later, Nora learned about the door.";
    const r = await docCall({ operation: "create", id: "document", text, text_processing_authorized: true });
    const reviewed = await docNext(r, "record-review", { reviewed_section_ids: ["section-1"], ledger: [{ id: "opener", kind: "knowledge", status: "unknown", statement: "Opener unknown.", evidence: [{ section_id: "section-1", start: quote.length + 1, end: original.length, quote: original.slice(quote.length + 1) }] }] });
    expect(reviewed.coverage.label).toBe("partial-recorded-review"); expect(reviewed.coverage.omitted_section_ids).toEqual(["section-2"]);
    expect(reviewed.active_context).toBeNull(); expect(reviewed.state.ledger[0].status).toBe("unknown");
  });
  it("rejects missing permission, oversized text, stale hashes and invented evidence", async () => {
    await expect(docCall({ operation: "create", id: "document", text: original })).rejects.toThrow();
    await expect(docCall({ operation: "create", id: "document", text: "a".repeat(96001), text_processing_authorized: true })).rejects.toThrow();
    const r = await docCall({ operation: "create", id: "document", text: original, text_processing_authorized: true });
    await expect(docNext({ ...r, state_sha256: "0".repeat(64) }, "disable-context", { export_authorized: false })).rejects.toThrow(/Stale/);
    await expect(docNext(r, "record-review", { reviewed_section_ids: ["section-1"], ledger: [{ id: "fake", kind: "claim", status: "asserted", statement: "Invented.", evidence: [{ section_id: "section-1", start: 0, end: 4, quote: "Fake" }] }] })).rejects.toThrow(/pointer/);
  });
  it("requires author approval and disables restored context", async () => {
    const r = await docCall({ operation: "create", id: "document", text: original, text_processing_authorized: true });
    await expect(docNext(r, "approve-context", { context: { ...context, author_approved: false }, enabled: true })).rejects.toThrow();
    const approved = await docNext(r, "approve-context", { context, enabled: true }); expect(approved.active_context.facts).toBe(context.facts);
    const restored = await docCall({ operation: "restore", portable: approved.state, expected_state_sha256: approved.state_sha256, text_processing_authorized: true });
    expect(restored.active_context).toBeNull(); expect(restored.state.context_enabled).toBe(false);
    const disabled = await docNext(approved, "disable-context", { export_authorized: false }); expect(disabled.active_context).toBeNull(); expect(disabled.state.project_context).toEqual(context);
  });
  it("invalidates reviewed sections and ledger after an edit without promoting facts", async () => {
    const r = await docCall({ operation: "create", id: "document", text: original, text_processing_authorized: true });
    const reviewed = await docNext(r, "record-review", { reviewed_section_ids: ["section-1"], ledger: [] });
    const approved = await docNext(reviewed, "approve-context", { context, enabled: true });
    const updated = await docNext(approved, "replace-text", { text: original + " Later." });
    expect(updated.invalidated_section_ids).toEqual(["section-1"]); expect(updated.state.reviewed_section_ids).toEqual([]);
    expect(updated.state.ledger).toEqual([]); expect(updated.active_context).toBeNull(); expect(updated.state.project_context).toEqual(context);
    expect((await docNext(updated, "clear", { export_authorized: false })).state).toBeNull();
  });
  it("requires separate export permission and rejects stale workflow restore", async () => {
    const r = await docCall({ operation: "create", id: "document", text: original, text_processing_authorized: true });
    await expect(docNext(r, "export", { export_authorized: false })).rejects.toThrow(/export/);
    expect((await docNext(r, "export", { export_authorized: true })).state).toEqual(r.state);
    const old = structuredClone(r.state); old.knowledge_sha256 = "0".repeat(64);
    await expect(docCall({ operation: "restore", portable: old, expected_state_sha256: hash(old), text_processing_authorized: true })).rejects.toThrow(/different workflow/);
  });
});
