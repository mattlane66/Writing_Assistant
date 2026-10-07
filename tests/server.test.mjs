import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../server/app.mjs";

const originalEnvironment = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  vectorStore: process.env.OPENAI_VECTOR_STORE_ID,
  challenge: process.env.OPENAI_APPS_CHALLENGE,
  nodeEnvironment: process.env.NODE_ENV,
};

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "test-key-never-sent";
  process.env.OPENAI_MODEL = "test-writing-model";
  delete process.env.OPENAI_VECTOR_STORE_ID;
  delete process.env.OPENAI_APPS_CHALLENGE;
});

afterEach(() => {
  restore("OPENAI_API_KEY", originalEnvironment.apiKey);
  restore("OPENAI_MODEL", originalEnvironment.model);
  restore("OPENAI_VECTOR_STORE_ID", originalEnvironment.vectorStore);
  restore("OPENAI_APPS_CHALLENGE", originalEnvironment.challenge);
  restore("NODE_ENV", originalEnvironment.nodeEnvironment);
  vi.restoreAllMocks();
});

function pipelineResult(overrides = {}) {
  return {
    result: "A clearer sentence.",
    grounded: false,
    pipeline: {
      version: "1.2",
      registryVersion: "1.0.0",
      selectedConcepts: [{ id: "functional-diction", name: "Functional diction" }],
      stages: [
        { name: "plan", status: "completed" },
        { name: "retrieve", status: "completed" },
        { name: "write", status: "completed" },
        { name: "audit", status: "completed" },
        { name: "repair", status: "skipped" },
      ],
      auditDisposition: "passed",
    },
    ...overrides,
  };
}

function mockPipeline(result = pipelineResult()) {
  return vi.fn().mockResolvedValue(result);
}

describe("GET /api/status", () => {
  it("reports the bounded agent and registry without exposing credentials", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test_grounding";
    const app = createApp();

    const response = await request(app).get("/api/status").expect(200);

    expect(response.body).toEqual({
      ready: true,
      mcpReady: true,
      hostModelExecution: true,
      revisionApiReady: true,
      provider: "openai",
      model: "test-writing-model",
      knowledgeSourceCount: 7,
      logicSkillVersion: "2.0.0",
      grounded: true,
      agentic: true,
      pipelineVersion: "1.2",
      registryVersion: "1.0.0",
    });
    expect(JSON.stringify(response.body)).not.toContain("test-key-never-sent");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("MCP hosting routes", () => {
  it("reports health without exposing credentials", async () => {
    const app = createApp();
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      mcp_ready: true,
      revision_api_ready: true,
      service: "writing-assistant",
      version: "2.1.0",
      pipelineVersion: "1.2",
      registryVersion: "1.0.0",
    });
    expect(JSON.stringify(response.body)).not.toContain("test-key-never-sent");
  });

  it("keeps MCP healthy without a hosted OpenAI API key", async () => {
    delete process.env.OPENAI_API_KEY;
    const app = createApp();

    const health = await request(app).get("/health").expect(200);
    expect(health.body).toMatchObject({
      ok: true,
      mcp_ready: true,
      revision_api_ready: false,
    });

    const status = await request(app).get("/api/status").expect(200);
    expect(status.body).toMatchObject({
      ready: true,
      mcpReady: true,
      hostModelExecution: true,
      revisionApiReady: false,
      provider: null,
      model: null,
      agentic: false,
    });

    const tools = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 7, method: "tools/list", params: {} })
      .expect(200);
    expect(tools.body.result.tools).toHaveLength(4);
  });

  it("serves the OpenAI domain verification challenge only when configured", async () => {
    const app = createApp();
    await request(app).get("/.well-known/openai-apps-challenge").expect(404);

    process.env.OPENAI_APPS_CHALLENGE = "verify-writing-assistant";
    const configured = createApp();
    const response = await request(configured)
      .get("/.well-known/openai-apps-challenge")
      .expect(200);
    expect(response.text).toBe("verify-writing-assistant");
  });

  it("does not let production HTML fallback answer GET /mcp", async () => {
    const app = createApp();
    const response = await request(app).get("/mcp").expect(405);

    expect(response.headers.allow).toBe("POST, OPTIONS");
    expect(response.body.error).toMatch(/use post/i);
  });

  it("exposes MCP tool discovery from the same service", async () => {
    const app = createApp();
    const response = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
      .expect(200);

    expect(response.body.result.tools.map(({ name }) => name)).toEqual([
      "search_writing_methods",
      "get_writing_methods",
      "get_writing_reference",
      "render_writing_diagnostic",
    ]);
  });
});

describe("POST /api/revise", () => {
  it("rejects missing drafts and unknown modes before running the pipeline", async () => {
    const pipelineRunner = mockPipeline();
    const app = createApp({ pipelineRunner });

    await request(app).post("/api/revise").send({ mode: "edit" }).expect(400);
    await request(app)
      .post("/api/revise")
      .send({ draft: "Words.", mode: "invent" })
      .expect(400);

    expect(pipelineRunner).not.toHaveBeenCalled();
  });

  it("rejects drafts above the character limit", async () => {
    const pipelineRunner = mockPipeline();
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "a".repeat(30_001), mode: "edit", ceiling: false })
      .expect(400);

    expect(response.body.error).toMatch(/30,000/);
    expect(pipelineRunner).not.toHaveBeenCalled();
  });

  it("runs the bounded pipeline and returns inspectable stage metadata", async () => {
    const pipelineRunner = mockPipeline(
      pipelineResult({ result: "The bridge washed away Monday." }),
    );
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({
        draft: "The bridge washed away Monday.",
        direction: "Preserve the fact.",
        mode: "edit",
        ceiling: true,
        audience: "Board members",
        purpose: "Record the event",
        genre: "memo",
        sourceContext: "The bridge washed away Monday.",
        voiceSamples: ["Plain, direct, and specific."],
      })
      .expect(200);

    expect(response.body.result).toBe("The bridge washed away Monday.");
    expect(response.body.meta).toMatchObject({
      model: "test-writing-model",
      mode: "edit",
      ceiling: true,
      grounded: false,
      pipeline: {
        version: "1.2",
        registryVersion: "1.0.0",
        auditDisposition: "passed",
      },
    });

    const [parameters] = pipelineRunner.mock.calls[0];
    expect(parameters.model).toBe("test-writing-model");
    expect(parameters.vectorStoreId).toBe("");
    expect(parameters.registry.concepts.length).toBe(40);
    expect(parameters.systemPrompt).toContain("COHERENCE ROUTING");
    expect(parameters.systemPrompt).toContain("SEMANTIC COMPOSITION REFERENCE");
    expect(parameters.revision).toMatchObject({
      draft: "The bridge washed away Monday.",
      mode: "edit",
      ceiling: true,
      audience: "Board members",
      purpose: "Record the event",
      genre: "memo",
      sourceContext: "The bridge washed away Monday.",
      voiceSamples: ["Plain, direct, and specific."],
    });
    expect(parameters.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes the configured private vector store to the agent pipeline", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test_grounding";
    const pipelineRunner = mockPipeline(
      pipelineResult({ grounded: true, result: "Analysis complete." }),
    );
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({
        draft: "Three members voted unanimously; one abstained.",
        direction: "Find anything that does not make sense.",
        mode: "analyze",
        ceiling: false,
      })
      .expect(200);

    expect(pipelineRunner.mock.calls[0][0].vectorStoreId).toBe("vs_test_grounding");
    expect(response.body.meta.grounded).toBe(true);
  });

  it("requires an OpenAI API key before starting an agent run", async () => {
    delete process.env.OPENAI_API_KEY;
    const pipelineRunner = mockPipeline();
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "edit", ceiling: false })
      .expect(503);

    expect(response.body.error).toMatch(/openai is not configured/i);
    expect(pipelineRunner).not.toHaveBeenCalled();
  });

  it("returns a sanitized service error when OpenAI rejects credentials", async () => {
    const pipelineRunner = vi.fn().mockRejectedValue({
      name: "AuthenticationError",
      status: 401,
      message: "bad secret test-key-never-sent",
    });
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "edit", ceiling: false })
      .expect(503);

    expect(response.body.error).toMatch(/credentials were rejected/i);
    expect(JSON.stringify(response.body)).not.toContain("test-key-never-sent");
  });

  it("distinguishes exhausted API credits from a transient rate limit", async () => {
    const pipelineRunner = vi.fn().mockRejectedValue({
      name: "RateLimitError",
      status: 429,
      code: "credit_balance_exhausted",
    });
    const app = createApp({ pipelineRunner });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "analyze", ceiling: false })
      .expect(503);

    expect(response.body.error).toMatch(/no available API credits/i);
    expect(response.body.error).not.toMatch(/try again shortly/i);
  });

  it("bounds the overall request and reports a timeout", async () => {
    const pipelineRunner = vi.fn(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
        }),
    );
    const app = createApp({ pipelineRunner, requestTimeoutMs: 5 });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "edit", ceiling: false })
      .expect(504);

    expect(response.body.error).toMatch(/timed out/i);
  });
});
