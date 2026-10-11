import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const exec = promisify(execFile), script = fileURLToPath(new URL("../evals/run-reliability-service.mjs", import.meta.url));
const run = args => exec(process.execPath, [script, ...args], { timeout: 15000, maxBuffer: 2_000_000 });
describe("offline reliability service command interface", () => {
  it("provides a strict machine-readable private evidence schema", async () => {
    const { stdout } = await run(["schema"]), schema = JSON.parse(stdout);
    expect(schema.additionalProperties).toBe(false); expect(schema.required).toContain("validation_fingerprint");
    expect(schema.properties.cases.items.properties).toHaveProperty("oracle_sha256");
  });
  it("starts with an empty evidence template rather than fake passing judgments", async () => {
    const { stdout } = await run(["template"]), template = JSON.parse(stdout);
    expect(template.reviews).toEqual([]); expect(template.responses).toEqual([]); expect(template.host_sessions).toEqual([]);
  });
  it("reports honest gaps without provider calls", async () => {
    const { stdout } = await run(["report"]), report = JSON.parse(stdout);
    expect(report.provider_calls).toBe(0); expect(report.missing_obligations).toHaveLength(812);
    expect(report.metrics.distinct_held_out_cases_judged).toBe(0);
  });
  it("returns unsuccessful while required evidence is missing", async () => {
    try { await run(["report", "--require-complete"]); throw new Error("Expected incomplete evidence gate."); }
    catch (error) { expect(error.code).toBe(1); expect(JSON.parse(error.stdout).semantic_guarantee).toBe(false); }
  });
  it("rejects provider/live switches rather than starting a paid grader", async () => {
    await expect(run(["report", "--live"])).rejects.toMatchObject({ code: 1 });
  });
  it("refuses packet files outside ignored local results without exposing private input", async () => {
    try { await run(["blind-packet", "--input", "/does-not-exist", "--packets-out", "/private/tmp/not-allowed.json", "--key-out", "/private/tmp/not-allowed-key.json"]); throw new Error("Expected path refusal."); }
    catch (error) { expect(error.code).toBe(1); expect(error.stderr).not.toContain("/does-not-exist"); expect(error.stderr).toContain("No model or network calls"); }
  });
  it("requires paired comparison inputs", async () => {
    await expect(run(["comparison"])).rejects.toMatchObject({ code: 1 });
  });
});
