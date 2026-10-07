import { describe, expect, it } from "vitest";

import {
  callWritingAssistantTool,
  discoverWritingAssistantMcp,
  getWritingAssistantTools,
  handleWritingAssistantMcp,
} from "../server/mcp.mjs";

describe("Writing Assistant MCP tool metadata", () => {
  it("exposes three repository-retrieval tools with explicit safety annotations", () => {
    const tools = getWritingAssistantTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "search_writing_methods",
      "get_writing_methods",
      "get_writing_reference",
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

  it("advertises repository knowledge retrieval rather than hosted model execution", () => {
    const result = discoverWritingAssistantMcp();
    expect(result.supportedVersions).toContain("2026-07-28");
    expect(result.capabilities).toEqual({ tools: {} });
    expect(result.instructions).toMatch(/read-only repository knowledge server/i);
    expect(result.instructions).toMatch(/host model/i);
    expect(result.resultType).toBe("complete");
  });
});

describe("Writing Assistant MCP tool execution", () => {
  it("searches the canonical method registry deterministically", async () => {
    const result = await callWritingAssistantTool("search_writing_methods", {
      query: "Preserve voice and meaning while editing a paragraph with a causality risk.",
      limit: 5,
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.registry_version).toBe("1.0.0");
    expect(result.structuredContent.methods.length).toBeGreaterThan(0);
    expect(result.structuredContent.methods.some(({ id }) => id === "meaning-voice-fidelity")).toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain("procedure");
  });

  it("fetches full methods by id", async () => {
    const result = await callWritingAssistantTool("get_writing_methods", {
      ids: ["task-contract", "mode-boundary"],
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.methods.map(({ id }) => id)).toEqual([
      "task-contract",
      "mode-boundary",
    ]);
    expect(result.structuredContent.methods[0].eval_criteria.execution.length).toBeGreaterThan(0);
  });

  it("fetches a canonical repository reference", async () => {
    const result = await callWritingAssistantTool("get_writing_reference", {
      reference: "semantic-composition",
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.source_path).toBe("knowledge/SEMANTIC_COMPOSITION.md");
    expect(result.structuredContent.content).toContain("Semantic failure classes");
  });

  it("fetches the complete example-derived repertoire", async () => {
    const result = await callWritingAssistantTool("get_writing_reference", {
      reference: "example-derived-patterns",
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.source_path).toBe(
      "knowledge/EXAMPLE_DERIVED_PATTERNS.md",
    );
    expect(result.structuredContent.content).toContain("appositive-fragment");
    expect(result.structuredContent.content).toContain("cleft-focus");
    expect(result.structuredContent.content).toContain("abstract-to-concrete-turn");
    expect(result.structuredContent.content).toMatch(/not templates, style targets/i);
  });

  it("rejects invalid retrieval arguments without a model call", async () => {
    const empty = await callWritingAssistantTool("search_writing_methods", { query: "" });
    expect(empty.isError).toBe(true);
    expect(empty.content[0].text).toMatch(/non-empty/i);

    const missing = await callWritingAssistantTool("get_writing_methods", {
      ids: ["not-a-real-method"],
    });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toMatch(/unknown method/i);
  });
});

describe("Writing Assistant MCP protocol", () => {
  it("lists tools and calls repository retrieval over JSON-RPC", async () => {
    const list = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(list.result.tools).toHaveLength(3);

    const call = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "search_writing_methods",
        arguments: {
          query: "Check chronology and text-world coherence.",
          limit: 4,
        },
      },
    });

    expect(call.result.structuredContent.methods.length).toBeGreaterThan(0);
    expect(
      call.result.structuredContent.methods.some(({ category }) => category === "coherence"),
    ).toBe(true);
  });

  it("validates legacy initialize parameters before negotiation", async () => {
    const invalid = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: "bad-init",
      method: "initialize",
      params: { protocolVersion: "2025-11-25" },
    });
    expect(invalid.error.code).toBe(-32602);

    const valid = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        clientInfo: { name: "test-client", version: "1.0.0" },
        capabilities: {},
      },
    });
    expect(valid.result.protocolVersion).toBe("2025-11-25");
    expect(valid.result.serverInfo.name).toBe("writing-assistant");
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
      { protocolVersion: "2026-07-28" },
    );
    expect(discover.result.supportedVersions).toContain("2026-07-28");

    const unsupported = await handleWritingAssistantMcp(
      { jsonrpc: "2.0", id: 9, method: "ping", params: {} },
      { protocolVersion: "2099-01-01" },
    );
    expect(unsupported.error.code).toBe(-32022);
  });
});
