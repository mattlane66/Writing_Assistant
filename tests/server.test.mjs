import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../server/app.mjs";

const originalEnvironment = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  vectorStore: process.env.OPENAI_VECTOR_STORE_ID,
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
});

afterEach(() => {
  restore("OPENAI_API_KEY", originalEnvironment.apiKey);
  restore("OPENAI_MODEL", originalEnvironment.model);
  restore("OPENAI_VECTOR_STORE_ID", originalEnvironment.vectorStore);
  restore("NODE_ENV", originalEnvironment.nodeEnvironment);
  vi.restoreAllMocks();
});

function mockClient(completion = { output_text: "A clearer sentence." }) {
  const create = vi.fn().mockResolvedValue(completion);
  return {
    client: { responses: { create } },
    create,
  };
}

describe("GET /api/status", () => {
  it("reports the local knowledge and reasoning versions without exposing credentials", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test_grounding";
    const app = createApp();

    const response = await request(app).get("/api/status").expect(200);

    expect(response.body).toEqual({
      ready: true,
      model: "test-writing-model",
      knowledgeSourceCount: 7,
      logicSkillVersion: "2.0.0",
      grounded: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("test-key-never-sent");
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("POST /api/revise", () => {
  it("rejects missing drafts and unknown modes before calling OpenAI", async () => {
    const { client, create } = mockClient();
    const app = createApp({ openAIClientFactory: () => client });

    await request(app).post("/api/revise").send({ mode: "edit" }).expect(400);
    await request(app)
      .post("/api/revise")
      .send({ draft: "Words.", mode: "invent" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects drafts above the character limit", async () => {
    const { client, create } = mockClient();
    const app = createApp({ openAIClientFactory: () => client });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "a".repeat(30_001), mode: "edit", ceiling: false })
      .expect(400);

    expect(response.body.error).toMatch(/30,000/);
    expect(create).not.toHaveBeenCalled();
  });

  it("loads the craft, coherence, and logic knowledge into a stateless request", async () => {
    const { client, create } = mockClient({ output_text: "The bridge washed away Monday." });
    const app = createApp({ openAIClientFactory: () => client });

    const response = await request(app)
      .post("/api/revise")
      .send({
        draft: "The bridge washed away Monday.",
        direction: "Preserve the fact.",
        mode: "edit",
        ceiling: true,
      })
      .expect(200);

    expect(response.body.result).toBe("The bridge washed away Monday.");
    expect(response.body.meta).toEqual({
      model: "test-writing-model",
      mode: "edit",
      ceiling: true,
      grounded: false,
    });

    const [parameters] = create.mock.calls[0];
    expect(parameters.store).toBe(false);
    expect(parameters.reasoning).toEqual({ effort: "high" });
    expect(parameters.instructions).toContain("COHERENCE ROUTING");
    expect(parameters.instructions).toContain("Argument Reconstruction");
    expect(parameters.instructions).toContain("Text-world coherence playbook");
    expect(parameters.tools).toBeUndefined();
    expect(JSON.parse(parameters.input[0].content[0].text)).toMatchObject({
      draft: "The bridge washed away Monday.",
      mode: "edit",
      ceiling: true,
    });
  });

  it("requires private-file retrieval when a vector store is configured", async () => {
    process.env.OPENAI_VECTOR_STORE_ID = "vs_test_grounding";
    const { client, create } = mockClient({
      output_text: "Analysis complete.",
      output: [
        {
          type: "file_search_call",
          status: "completed",
          results: [{ file_id: "file_test", filename: "guide.pdf" }],
        },
      ],
    });
    const app = createApp({ openAIClientFactory: () => client });

    const response = await request(app)
      .post("/api/revise")
      .send({
        draft: "Three members voted unanimously; one abstained.",
        direction: "Find anything that does not make sense.",
        mode: "analyze",
        ceiling: false,
      })
      .expect(200);

    const [parameters] = create.mock.calls[0];
    expect(parameters.tool_choice).toBe("required");
    expect(parameters.tools).toEqual([
      {
        type: "file_search",
        vector_store_ids: ["vs_test_grounding"],
        max_num_results: 12,
      },
    ]);
    expect(parameters.include).toEqual(["file_search_call.results"]);
    expect(parameters.instructions).toContain("timeline");
    expect(response.body.meta.grounded).toBe(true);
  });

  it("returns a sanitized service error when OpenAI rejects credentials", async () => {
    const create = vi.fn().mockRejectedValue({
      name: "AuthenticationError",
      status: 401,
      message: "bad secret test-key-never-sent",
    });
    const app = createApp({
      openAIClientFactory: () => ({ responses: { create } }),
    });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "edit", ceiling: false })
      .expect(503);

    expect(response.body.error).toMatch(/credentials were rejected/i);
    expect(JSON.stringify(response.body)).not.toContain("test-key-never-sent");
  });

  it("distinguishes exhausted API credits from a transient rate limit", async () => {
    const create = vi.fn().mockRejectedValue({
      name: "RateLimitError",
      status: 429,
      code: "credit_balance_exhausted",
    });
    const app = createApp({
      openAIClientFactory: () => ({ responses: { create } }),
    });

    const response = await request(app)
      .post("/api/revise")
      .send({ draft: "A draft.", mode: "analyze", ceiling: false })
      .expect(503);

    expect(response.body.error).toMatch(/no available API credits/i);
    expect(response.body.error).not.toMatch(/try again shortly/i);
  });
});
