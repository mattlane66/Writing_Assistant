import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assessPluginReadiness } from "../evals/plugin-readiness.mjs";
import { loadConceptRegistry } from "../server/concept-registry.mjs";

describe("plugin judgment safeguards", () => {
  it("cannot certify launch or semantic judgment from software tests", async () => {
    const result = await assessPluginReadiness();
    expect(result).toMatchObject({ public_launch_verified: false, semantic_guarantee: false, provider_calls: 0 });
    expect(result.coverage).toMatchObject({ reviewed_pages: 243, total_pages: 1360, unreviewed_pages: 1117 });
    expect(result.gates.find(g => g.id === "source-review").status).toBe("incomplete");
    for (const id of ["chatgpt-chat-fresh-install", "chatgpt-work-fresh-install", "unseen-semantic-judgments", "blinded-comparison"]) expect(result.gates.find(g => g.id === id).status).toBe("unverified");
  });
  it("keeps paired calibration challenges traceable without claiming they ran", async () => {
    const suite = JSON.parse(await readFile(new URL("../evals/diagnostic-calibration-cases.json", import.meta.url), "utf8"));
    const registry = await loadConceptRegistry();const ids = new Set(registry.concepts.map(c => c.id));
    expect(suite.exposure).toBe("authored-development-not-unseen");expect(suite.cases).toHaveLength(12);
    expect(new Set(suite.cases.map(c => c.id)).size).toBe(12);
    for (const c of suite.cases) {expect(c.method_ids.every(id => ids.has(id))).toBe(true);expect(c.acceptance.length).toBeGreaterThan(40);expect(["pass","pressure","violation"]).toContain(c.expected_status);}
    for (const pair of new Set(suite.cases.map(c => c.pair))) {const controls=suite.cases.filter(c=>c.pair===pair);expect(controls).toHaveLength(2);expect(new Set(controls.map(c=>c.expected_status)).size).toBe(2);}
  });
  it("keeps the canonical contract and packaged skill aligned on restraint", async () => {
    for (const url of ["../knowledge/SYSTEM_PROMPT.md", "../products/writing-assistant-plugin/skills/writing-assistant/SKILL.md"]) {
      const text = await readFile(new URL(url, import.meta.url), "utf8");
      expect(text).toContain("Evidence-first diagnostic audit");expect(text).toMatch(/strongest reasonable alternate reading/);expect(text).toMatch(/separate explicit editing request/);expect(text).toMatch(/stale/);expect(text).toMatch(/not.*guarantee/i);
    }
  });
});
