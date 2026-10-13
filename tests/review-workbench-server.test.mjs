import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createReviewWorkbench } from "../server/review-workbench.mjs";
import { createApp } from "../server/app.mjs";
import { buildReliabilityPlan } from "../evals/reliability-service.mjs";
import { reviewFixture, reviewInput } from "./review-workbench-fixture.mjs";
import { emptyHostObservations } from "../evals/host-observations.mjs";
let plan, app, token;
const origin = "http://127.0.0.1:8791", host = "127.0.0.1:8791";
beforeAll(async () => {
  plan = await buildReliabilityPlan(); app = createReviewWorkbench({ planProvider: async () => plan, catalogProvider: async () => ({ methods: [], cards: [] }) });
  token = (await request(app).get("/api/review/bootstrap").set("Host", host)).body.token;
});
const post = operation => request(app).post(`/api/review/${operation}`).set("Host", host).set("Origin", origin).set("X-Review-Token", token);
describe("loopback-only private review server", () => {
  it("boots with public plan metadata and no invented observed outputs", async () => {
    const r = await request(app).get("/api/review/bootstrap").set("Host", host).expect(200);
    expect(r.body.workspace.responses).toEqual([]); expect(r.body.report.metrics.distinct_held_out_cases_judged).toBe(0);
    expect(r.body.batch.sections).toHaveLength(7); expect(r.body.provider_calls).toBe(0);
    expect(r.body.observations.observations).toEqual([]);
    expect(r.headers["cache-control"]).toBe("no-store"); expect(r.headers["content-security-policy"]).toContain("connect-src 'self'");
  });
  it("rejects cross-origin requests, opaque origins and DNS-rebinding hosts", async () => {
    for (const value of ["https://example.test", "null"]) await request(app).get("/api/review/bootstrap").set("Host", host).set("Origin", value).expect(403);
    await request(app).get("/api/review/bootstrap").set("Host", "attacker.test:8791").expect(403);
    await request(app).get("/api/review/bootstrap").set("Host", host).set("Sec-Fetch-Site", "cross-site").expect(403);
  });
  it("requires a fresh same-origin token and handles malicious Unicode safely", async () => {
    for (const value of ["", "f".repeat(64), "é".repeat(64)]) await request(app).post("/api/review/import").set("Host", host).set("Origin", origin).set("X-Review-Token", value).send({ evidence: {} }).expect(403);
  });
  it("imports and reviews explicit evidence without retaining it on the server", async () => {
    const e = reviewFixture(plan); const imported = await post("import").send({ evidence: e }).expect(200);
    expect(imported.body.evidence.responses[0].output).toBe(e.responses[0].output);
    const reviewed = await post("review").send({ evidence: e, review: reviewInput(e) }).expect(200);
    expect(reviewed.body.evidence.reviews).toHaveLength(1); expect(reviewed.body.report.metrics.distinct_held_out_cases_judged).toBe(0);
    const after = await request(app).get("/api/review/bootstrap").set("Host", host);
    expect(after.body.workspace.responses).toEqual([]); expect(after.body.workspace.reviews).toEqual([]);
  });
  it("does not read arbitrary paths or echo private prose in invalid requests", async () => {
    const marker = "PRIVATE_REVIEW_SENTINEL";
    for (const body of [{ path: ".env.local" }, { evidence: { output: marker } }, { evidence: {}, unexpected: marker }]) {
      const r = await post("import").send(body).expect(400); expect(JSON.stringify(r.body)).not.toContain(marker);
    }
  });
  it("leaves the public plugin API without any private review routes", async () => {
    await request(createApp()).post("/api/review/import").send({ evidence: {} }).expect(404);
  });
  it("never allows binding an external origin", () => {
    for (const bad of ["http://0.0.0.0:8791", "https://127.0.0.1:8791", "http://attacker.test:8791", "http://user:secret@127.0.0.1:8791", "http://127.0.0.1:8791/other"]) expect(() => createReviewWorkbench({ origin: bad })).toThrow(/loopback/);
  });
  it("refuses unknown operations without generating results", async () => {
    const r = await post("generate").send({ prompt: "invent a passing judgment" }).expect(400);
    expect(r.body).toHaveProperty("error"); expect(r.body).not.toHaveProperty("evidence");
  });
  it("captures and round-trips incomplete observations without server retention or quality promotion", async () => {
    const observation = { id: "original-ui-test", case_id: null, host: "chatgpt-work", capture_origin: "synthetic-ui-fixture",
      result_kind: "platform-error", observed_at: null, actual_prompt: "Diagnose, do not rewrite.", output: null,
      visible_error: "cloudflare_challenge", raw_tool_evidence: null, notes: "Synthetic transport test, not a host execution.",
      metadata: { model_label: null, model_version: null, plugin_id: null, plugin_version: null, server_revision: null }, faithful_capture_attested: true };
    const workspace = (await request(app).get("/api/review/bootstrap").set("Host", host)).body.workspace;
    const saved = await post("observe").send({ evidence: workspace, observations: emptyHostObservations(plan), observation }).expect(200);
    expect(saved.body.observations.observations[0].output).toBeNull(); expect(saved.body).not.toHaveProperty("report");
    const imported = await post("observations-import").send({ observations: saved.body.observations }).expect(200);
    expect(imported.body.observations).toEqual(saved.body.observations);
    const after = await request(app).get("/api/review/bootstrap").set("Host", host);
    expect(after.body.observations.observations).toEqual([]); expect(after.body.report.metrics.distinct_held_out_cases_judged).toBe(0);
    await post("import").send({ evidence: saved.body.observations }).expect(400);
  });
  it("rejects raw legacy files and unrecognized observation fields without leaking private text", async () => {
    for (const observations of [{ kind: "incomplete-host-observation-not-editorial-grade", output: "PRIVATE_SENTINEL" },
      { ...emptyHostObservations(plan), reviewer: "PRIVATE_SENTINEL" }]) {
      const response = await post("observations-import").send({ observations }).expect(400);
      expect(JSON.stringify(response.body)).not.toContain("PRIVATE_SENTINEL");
    }
    await request(createApp()).post("/api/review/observe").send({ observations: {} }).expect(404);
  });
  it("keeps the new capture operations behind the same loopback origin and token gates", async () => {
    for (const operation of ["observe", "observations-import"]) {
      await request(app).post(`/api/review/${operation}`).set("Host", host).set("Origin", origin).send({}).expect(403);
      await request(app).post(`/api/review/${operation}`).set("Host", host).set("Origin", "https://attacker.test")
        .set("X-Review-Token", token).send({}).expect(403);
    }
  });
});
