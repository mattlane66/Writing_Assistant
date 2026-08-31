import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("behavioral contracts", () => {
  it("keeps writing and argument cases uniquely addressable", async () => {
    const [writing, arguments_] = await Promise.all([
      readFile(path.join(root, "evals", "writing.cases.json"), "utf8").then(JSON.parse),
      readFile(path.join(root, "evals", "argument-reconstruction.cases.json"), "utf8").then(
        JSON.parse,
      ),
    ]);

    const allCases = [...writing.cases, ...arguments_.cases];
    const allIds = allCases.map((testCase) => testCase.id);

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds).toContain("timeline-state-conflict");
    expect(allIds).toContain("fictional-rule-is-local");
    expect(allIds).toContain("policy-normative-bridge");
    expect(writing.cases.every((testCase) => testCase.required_moves.length > 0)).toBe(true);
    expect(allCases.every((testCase) => testCase.prohibited_moves.length > 0)).toBe(true);
  });
});
