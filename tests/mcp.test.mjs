import { describe, expect, it } from "vitest";

import {
  callWritingAssistantTool,
  discoverWritingAssistantMcp,
  getWritingAssistantTools,
  handleWritingAssistantMcp,
} from "../server/mcp.mjs";
import { WRITING_DIAGNOSTIC_UI_URI } from "../server/writing-diagnostic.mjs";

describe("Writing Assistant MCP tool metadata", () => {
  it("preserves the four baseline tools and adds four bounded book-informed tools", () => {
    const tools = getWritingAssistantTools();
    expect(tools.map(({ name }) => name)).toEqual([
      "search_writing_methods",
      "get_writing_methods",
      "get_writing_reference",
      "render_writing_diagnostic",
      "search_writing_examples",
      "get_writing_examples",
      "get_writing_coverage",
      "check_writing_revision",
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

    const render = tools.find(({ name }) => name === "render_writing_diagnostic");
    expect(render._meta.ui.resourceUri).toBe(WRITING_DIAGNOSTIC_UI_URI);
    for (const tool of tools.filter(({ name }) => name !== "render_writing_diagnostic")) {
      expect(tool._meta.ui).toBeUndefined();
      expect(tool._meta["openai/outputTemplate"]).toBeUndefined();
    }
  });

  it("advertises repository knowledge retrieval rather than hosted model execution", () => {
    const result = discoverWritingAssistantMcp();
    expect(result.supportedVersions).toContain("2026-07-28");
    expect(result.capabilities).toEqual({ tools: {}, resources: {} });
    expect(result.instructions).toMatch(/repository-guided editorial server/i);
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

  it("renders a method-linked diagnostic without performing editorial reasoning on the server", async () => {
    const result = await callWritingAssistantTool("render_writing_diagnostic", {
      passage: "A better candidate.",
      editing_mode: "craft-analysis",
      findings: [
        {
          id: "criterion",
          quote: "better",
          status: "pressure",
          primitives: ["Distinction"],
          diagnosis: "The comparison needs a recoverable criterion.",
          question: "Better by which measure?",
          think_first: "Name the comparison criterion before changing the wording.",
          method_ids: ["task-contract", "meaning-voice-fidelity"],
        },
      ],
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.integration).toMatchObject({
      registry_version: "1.0.0",
      editing_mode: "craft-analysis",
    });
    expect(result.structuredContent.integration.source_revision).toBeTruthy();
    expect(result.structuredContent.findings[0].method_ids).toEqual([
      "task-contract",
      "meaning-voice-fidelity",
    ]);
    expect(result.content[0].text).toMatch(/host model/i);
  });

  it("rejects diagnostic findings linked to non-canonical method ids", async () => {
    const result = await callWritingAssistantTool("render_writing_diagnostic", {
      passage: "A better candidate.",
      editing_mode: "craft-analysis",
      findings: [
        {
          id: "criterion",
          quote: "better",
          status: "pressure",
          primitives: ["Distinction"],
          diagnosis: "The comparison needs a criterion.",
          question: "Better by which measure?",
          think_first: "Name the criterion.",
          method_ids: ["not-a-canonical-method"],
        },
      ],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/unknown canonical method/i);
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
    expect(list.result.tools).toHaveLength(8);

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

  it("lists and reads the diagnostic UI resource", async () => {
    const list = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: "resources",
      method: "resources/list",
      params: {},
    });
    expect(list.result.resources).toEqual([
      expect.objectContaining({ uri: WRITING_DIAGNOSTIC_UI_URI }),
    ]);

    const read = await handleWritingAssistantMcp({
      jsonrpc: "2.0",
      id: "resource",
      method: "resources/read",
      params: { uri: WRITING_DIAGNOSTIC_UI_URI },
    });
    expect(read.result.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(read.result.contents[0].text).toContain("Revise with these decisions");
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
