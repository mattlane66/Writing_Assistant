import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { locateWritingQuotes, WRITING_ANCHOR_TOOL } from "../server/writing-anchors.mjs";
import { callWritingAssistantTool } from "../server/mcp.mjs";
import { DIMENSIONS, validateWritingWorkflow } from "../server/writing-workflow.mjs";

const cases = JSON.parse(await readFile(new URL("../evals/anchor-development.cases.json", import.meta.url), "utf8"));
const locate = (text, quote, occurrence = null) => locateWritingQuotes({ text_processing_authorized: true, text, quotes: [{ quote, occurrence }] });

describe("exact quote locations, not editorial verdicts", () => {
  it.each(cases.cases)("$id records authored recognition/execution coverage", fixture => {
    const result = locate(fixture.text, fixture.quote, fixture.occurrence), match = result.matches[0];
    expect(match.status).toBe(fixture.status);
    expect(match.selected?.start ?? null).toBe(fixture.start);
    expect(match.selected?.end ?? null).toBe(fixture.end);
    if (match.selected) expect(fixture.text.slice(match.selected.start, match.selected.end)).toBe(fixture.quote);
    expect(result).toMatchObject({ offset_encoding: "UTF-16-code-units", model_calls: 0, semantic_certification: false });
    expect(cases.quality_evidence).toBe(false);
  });
  it("requires explicit permission and refuses extra fields without echoing the draft", async () => {
    const args = { text: "PRIVATE_SENTINEL", quotes: [{ quote: "PRIVATE_SENTINEL", occurrence: null }] };
    for (const changed of [args, { ...args, text_processing_authorized: false }, { ...args, text_processing_authorized: true, operation: "start" }]) {
      const result = await callWritingAssistantTool("locate_writing_quotes", changed);
      expect(result.isError).toBe(true); expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
    }
  });
  it("returns a strict independently callable MCP schema", async () => {
    expect(WRITING_ANCHOR_TOOL.input.additionalProperties).toBe(false);
    expect(WRITING_ANCHOR_TOOL.output.additionalProperties).toBe(false);
    const result = await callWritingAssistantTool("locate_writing_quotes", { text_processing_authorized: true, text: "A sentence.", quotes: [{ quote: "sentence", occurrence: null }] });
    expect(result.isError).not.toBe(true); expect(result.structuredContent.matches[0].selected).toMatchObject({ start: 2, end: 10 });
  });
  it("does not select repeated or out-of-range occurrences automatically", () => {
    expect(locate("aa", "a").matches[0]).toMatchObject({ status: "ambiguous", total_occurrences: 2, selected: null });
    expect(locate("aa", "a", 3).matches[0]).toMatchObject({ status: "occurrence-out-of-range", selected: null });
    const match = locate("x".repeat(100), "x", 91).matches[0];
    expect(match).toMatchObject({ total_occurrences: 100, matches_truncated: true, selected: { start: 90, end: 91, occurrence: 91 } });
    expect(match.first_matches).toHaveLength(8);
  });
  it("counts overlapping matches but never selects half a surrogate pair", () => {
    expect(locate("aaaa", "aa", 2).matches[0]).toMatchObject({ total_occurrences: 3, selected: { start: 1, end: 3 } });
    expect(locate("🦉", "\uD83E").matches[0].status).toBe("not-found");
    expect(locate("🦉", "\uDD89").matches[0].status).toBe("not-found");
    expect(locate("🦉", "🦉").matches[0].selected).toMatchObject({ start: 0, end: 2 });
  });
  it("bounds text, quote count and aggregate Unicode bytes", () => {
    expect(() => locate("a".repeat(96001), "a")).toThrow();
    expect(() => locateWritingQuotes({ text_processing_authorized: true, text: "a", quotes: Array.from({ length: 25 }, () => ({ quote: "a", occurrence: null })) })).toThrow();
    expect(() => locate("漢".repeat(96000), "漢")).toThrow(/byte bound/);
    expect(locate("a".repeat(96000), "a").matches[0].total_occurrences).toBe(96000);
  });
  it("changed strings have changed fingerprints and positions", () => {
    const old = locate("Nora entered at noon.", "noon"), fresh = locate("Today Nora entered at noon.", "noon");
    expect(fresh.text_sha256).not.toBe(old.text_sha256);
    expect(fresh.matches[0].selected.start).toBe(old.matches[0].selected.start + 6);
  });
  it("reproduces bad Unicode offsets then repairs the record without weakening validation", async () => {
    const original = "🦉 Nora entered at noon. At 11:30, after an hour inside, she called Sam.";
    const anchor = locate(original, "noon").matches[0].selected;
    const frame = { id: "anchor-software-fixture", original, direction: "Do not rewrite.", mode: "craft-analysis",
      purpose: "Check literal chronology.", reader: "General reader.", genre: "Original test prose.", invention_permission: "forbidden",
      invention_boundary: "No invented corrections.", scope: "whole-passage", project_context: null,
      dimensions: DIMENSIONS.map(domain => ({ domain, disposition: "checked", reason: "Authored software fixture, not human validation." })),
      entries: [{ id: "entry-time", kind: "time", status: "asserted", statement: "The passage states entry at noon.",
        evidence: [{ source: "original", start: anchor.start - 1, end: anchor.end - 1, quote: "noon" }] }] };
    const start = value => validateWritingWorkflow({ request: { operation: "start", text_processing_authorized: true,
      frame: value, abstract_query: "literal chronology", method_ids: ["timeline-space-quantity"] } });
    await expect(start(frame)).rejects.toThrow(/pointer/);
    frame.entries[0].evidence[0] = { source: "original", start: anchor.start, end: anchor.end, quote: "noon" };
    const result = await start(frame);
    expect(result.state.stage).toBe("framed"); expect(result.semantic_certification).toBe(false);
    const bad = { id: "time", start: anchor.start - 1, end: anchor.end - 1, quote: "noon", status: "question",
      method_ids: ["timeline-space-quantity"], entry_ids: ["entry-time"], explanation: "Which time governs?",
      strongest_alternate_reading: "The author may correct a time.", alternate_reading_supported: false,
      exception_check: "No assumed correction.", thinking_question: "Which time is correct?" };
    const diagnose = finding => validateWritingWorkflow({ request: { operation: "diagnose", text_processing_authorized: true,
      state: result.state, expected_state_sha256: result.state_sha256, findings: [finding] } });
    await expect(diagnose(bad)).rejects.toThrow(/pointer/);
    expect((await diagnose({ ...bad, start: anchor.start, end: anchor.end })).state.stage).toBe("diagnosed");
    expect(result.state.stage).toBe("framed");
  });
});
