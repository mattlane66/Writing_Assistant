import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runner = resolve(root, "product-intent/run-pilot.mjs");

function candidate() {
  const directory = mkdtempSync(join(tmpdir(), "writing-intent-candidate-"));
  mkdirSync(resolve(directory, "server"), { recursive: true });
  for (const file of ["meaning-contract.mjs", "text-world.mjs"]) {
    writeFileSync(resolve(directory, "server", file),
      readFileSync(resolve(root, "server", file)));
  }
  return directory;
}
function check(directory) {
  const result = spawnSync(process.execPath,
    [runner, "--verify-only", "--source-root", directory], { encoding: "utf8" });
  return { exit: result.status, report: JSON.parse(result.stdout), stderr: result.stderr };
}

describe("protected product intent runner", () => {
  it("evaluates an independent checkout using trusted scenarios", () => {
    const directory = candidate();
    try {
      const result = check(directory);
      expect(result.exit, result.stderr).toBe(0);
      expect(result.report.mode).toBe("candidate-verification");
      expect(result.report.scenarios_passed).toBe(4);
      expect(result.report.mutation_score).toEqual({ skipped: true });
      expect(result.report.benign_control).toEqual({ skipped: true });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("fails when a coding agent removes the qualifier-preservation check", () => {
    const directory = candidate();
    try {
      const file = resolve(directory, "server/meaning-contract.mjs");
      const original = readFileSync(file, "utf8");
      const changed = original.replace('const enabled = !["analyze", "draft"].includes(mode);', "const enabled = false;");
      expect(changed).not.toBe(original);
      writeFileSync(file, changed);
      const result = check(directory);
      expect(result.exit).toBe(1);
      expect(result.report.baseline_failures).toContain("SC-1");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
