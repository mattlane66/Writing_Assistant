import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const runner=resolve(root,"product-intent/verify-app.mjs");

describe("independent product intent API/UI verification",()=>{
  it("tests real API and React rendered states without hosted model calls",()=>{
    const outcome=spawnSync(process.execPath,[runner,"--source-root",root],{
      encoding:"utf8",timeout:30000,env:{...process.env,OPENAI_API_KEY:"",NODE_ENV:"test"}
    });
    expect(outcome.status,outcome.stderr || outcome.stdout).toBe(0);
    const report=JSON.parse(outcome.stdout);
    expect(report.error).toBeNull();
    expect(report.failures).toEqual([]);
    expect(report.missing).toEqual([]);
    expect(report.checked_scenarios).toBe(4);
    expect(report.passed_scenarios).toBe(4);
  });
});
