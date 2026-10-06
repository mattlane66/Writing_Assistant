import { describe, expect, it, vi } from "vitest";

import {
  callWritingAssistantTool,
  discoverWritingAssistantMcp,
  getWritingAssistantTools,
  handleWritingAssistantMcp,
} from "../server/mcp.mjs";

function completion(result = "Revised text.", mode = "edit") {
  return {
    result,
    grounded: false,
    pipeline: {
      version: "1.2",
      registryVersion: "1.0.0",
      selectedConcepts: [],
      stages: [
        { name: "plan", status: "completed" },
        { name: "retrieve", status: "completed" },
        { name: "write", status: "completed" },
        { name: "audit", status: "completed" },
        { name: "repair", status: "skipped" },
      ],
      auditDisposition: "passed",
    },
    mode,
  };
}

describe("Writing Assistant MCP tool metadata", () => {
  it("exposes three high-level read-only tools with explicit safety annotations", () => {
    const tools = getWritingAssistantTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "edit_writing",
      "draft_writing",
      "analyze_writing",
    ]);

    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      });
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(tool.outputSchema.additionalProperties).toBe(false);
    }
  });

  it("advertises the bounded server through modern discovery", () => {
    const result = discoverWritingAssistantMcp();
    expect(result.supportedVersions).toContain("2026-07-28");
    expect(result.capabilities).toEqual({ tools: {} });
    expect(result.instructions).toMatch(/bounded editorial pipeline/i);
    expect(result.resultType).toBe("complete");
  });
});

describe("Writing Assistant MCP tool execution", () => {
  it("maps edit context into the canonical revision contract", async () => {
    const executeRevision = vi.fn().mockResolvedValue(completion("Keep this plain."));
    const result = await callWritingAssistantTool(
      "edit_writing",
      {
        text: "Keep this plain.",
        mode: "edit",
        direction: "Do not dress this up.",
        audience: "A colleague",
        purpose: "State what happened",
        genre: "email",
        source_context: "The train was late.",
        voice_samples: ["I prefer plain sentences."],
        ceiling: true,
      },
      { executeRevision },
    );

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.result).toBe("Keep this plain.");
    expect(executeRevision).toHaveBeenCalledWith({
      draft: "Keep this plain.",
      direction: "Do not dress this up.",
      mode: "edit",
      ceiling: true,
      audience: "A colleague",
      purpose: "State what happened",
      genre: "email",
      sourceContext: "The train was late.",
      voiceSamples: ["I prefer plain sentences."],
    });
  });

  it("fixes draft and analysis modes instead of letting callers override them", async () => {
    const executeRevision = vi.fn()
      .mockResolvedValueOnce(completion("A draft.", "draft"))
      .mockResolvedValueOnce(completion("Analysis.", "analyze"));

    await callWritingAssistantTool(
      "draft_writing",
      { material: "Fact one. Fact two.", direction: "Two sentences." },
      { executeRevision },
    );
    await callWritingAssistantTool(
      "analyze_writing",
      { text: "Because A, B.", direction: "Check causality." },
      { executeRevision },
    );

    expect(executeRevision.mock.calls[0][0].mode).toBe("draft");
    expect(executeRevision.mock.calls[1][0].mode).toBe("analyze");
  });

  it("rejects invalid tool arguments without running the pipeline", async () => {
    const executeRevision = vi.fn();
    const result = await callWritingAssistantTool(
      "edit_writing",
      { text: "", mode: "edit" },
      { executeRevision },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/non-empty/i);
    expect(executeRevision).not.toHaveBeenCalled();
  });
});

describe("Writing Assistant MCP protocol", () => {
  it("lists tools and calls them over JSON-RPC", async () => {
    const list = await handleWritingAssistantMcp(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      { executeRevision: vi.fn() },
    );
    expect(list.result.tools).toHaveLength(3);

    const executeRevision = vi.fn().mockResolvedValue(completion("Edited."));
    const call = await handleWritingAssistantMcp(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "edit_writing",
          arguments: { text: "Edited.", mode: "edit" },
        },
      },
      { executeRevision },
    );

    expect(call.result.structuredContent.result).toBe("Edited.");
    expect(executeRevision).toHaveBeenCalledOnce();
  });

  it("supports modern server discovery and rejects unsupported versions", async () => {
    const discover = await handleWritingAssistantMcp(
      {
        jsonrpc: "2.0",
        id: "d",
        method: "server/discover",
        params: {
          _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
        },
      },
      { executeRevision: vi.fn(), protocolVersion: "2026-07-28" },
    );
    expect(discover.result.supportedVersions).toContain("2026-07-28");

    const unsupported = await handleWritingAssistantMcp(
      { jsonrpc: "2.0", id: 9, method: "ping", params: {} },
      { executeRevision: vi.fn(), protocolVersion: "2099-01-01" },
    );
    expect(unsupported.error.code).toBe(-32022);
  });
});
