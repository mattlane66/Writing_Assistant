import { describe, expect, it } from "vitest";
import { buildTextWorld, compareTextWorld, summarizeTextWorld, TEXT_WORLD_LIMITS } from "../server/text-world.mjs";

function assertGroundedSpans(value, original) {
  if (!value || typeof value !== "object") return;
  if ("start" in value && "end" in value && "text" in value) {
    expect(value.start).toBeGreaterThanOrEqual(0);
    expect(value.end).toBeLessThanOrEqual(original.length);
    expect(value.end).toBeGreaterThan(value.start);
    expect(original.slice(value.start, value.end)).toBe(value.text);
  }
  for (const child of Object.values(value)) assertGroundedSpans(child, original);
}

function assertGroundedReferences(graph) {
  const assertionIds = new Set(graph.assertions.map(({ id }) => id));
  const nodeIds = new Set(graph.argument.nodes.map(({ id }) => id));
  for (const item of [...graph.potentialConflicts, ...graph.ruleEvidence, ...graph.knowledgeEvidence, ...graph.argument.edges]) {
    expect(item.evidenceRefs.length).toBeGreaterThan(0);
    for (const id of item.evidenceRefs) expect(assertionIds.has(id)).toBe(true);
  }
  for (const edge of graph.argument.edges) {
    expect(nodeIds.has(edge.from)).toBe(true);
    expect(nodeIds.has(edge.to)).toBe(true);
  }
}

describe("text world evidence graph", () => {
  it("grounds every span in original Unicode and CRLF input without resolving pronouns", () => {
    const draft = "# Café 🐦\r\n\r\nMara, also known as Wren, arrived on September 2, 2026.\r\nMara knew the door was locked. She heard a bell.";
    const graph = buildTextWorld(draft);
    assertGroundedSpans(graph, draft);
    assertGroundedReferences(graph);
    expect(graph.entities.find(({ name }) => name === "Mara").aliases).toEqual([
      expect.objectContaining({ name: "Wren", kind: "explicit-alias-candidate" }),
    ]);
    expect(graph.entities.map(({ name }) => name)).not.toContain("She");
    expect(graph.timeAnchors.map(({ span }) => span.text)).toContain("September 2, 2026");
    expect(graph.knowledgeEvidence.length).toBe(2);
    expect(graph.coverage.offsetUnit).toMatch(/UTF-16/);
    expect(graph.coverage.semanticCompleteness).toBe(false);
  });

  it("flags an explicit same-time polarity conflict with both passages", () => {
    const draft = "At noon, Mara was inside. At noon, Mara was not inside.";
    const graph = buildTextWorld(draft);
    expect(graph.potentialConflicts).toEqual([
      expect.objectContaining({ kind: "opposite-polarity", status: "requires-review", evidenceRefs: ["a1", "a2"], deterministicEvidence: { subject: "mara", predicate: "be", timeScope: ["noon"] } }),
    ]);
    assertGroundedReferences(graph);
    expect(graph.potentialConflicts[0].reason).toMatch(/same explicit time/);
  });

  it("allows explicit time changes and does not equate unresolved relative times", () => {
    for (const draft of [
      "In 2024, the door was open. In 2025, the door was closed.",
      "The door was open. Later, the door was closed.",
      "Today, the door is open. Tomorrow, the door is closed.",
      "Now, Mara is inside. Now, Mara is not inside.",
    ]) expect(buildTextWorld(draft).potentialConflicts).toEqual([]);
    const unspecified = buildTextWorld("The door was open. The door was closed.");
    expect(unspecified.potentialConflicts[0]).toMatchObject({ kind: "opposed-state" });
    expect(unspecified.potentialConflicts[0].reason).toMatch(/time unspecified/);
  });

  it("normalizes explicit comparable units and preserves denominator distinctions", () => {
    expect(buildTextWorld("The crate weighs 1 kg. The crate weighs 1000 g.").potentialConflicts).toEqual([]);
    const graph = buildTextWorld("The crate weighs 1 kg. The crate weighs 500 g. Participation is 75 percent. Growth is 5 percentage points. There are 12 boxes.");
    expect(graph.potentialConflicts.map(({ kind }) => kind)).toEqual(["quantity-disagreement"]);
    expect(graph.potentialConflicts[0].deterministicEvidence).toMatchObject({ unit: "g", normalizedAmounts: [1000, 500] });
    expect(graph.quantityAnchors).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: 75, dimension: "percentage", unit: "%" }),
      expect.objectContaining({ amount: 5, dimension: "percentage-points", unit: "pp" }),
      expect.objectContaining({ amount: 12, dimension: "literal-unit:box" }),
    ]));
    expect(buildTextWorld("The crate weighs about 1 kg. The crate weighs 990 g.").potentialConflicts).toEqual([]);
    expect(buildTextWorld("The crate weighs 1 kg. The crate weighs 2 miles.").potentialConflicts).toEqual([]);
  });

  it("keeps fictional rules and knowledge-state cues as evidence without inventing causal links", () => {
    const draft = "Only the Keeper can open the gate. Mara had never learned the Keeper's name. Mara opened the gate. In this world, dragons cannot fly. In this world, dragons can fly.";
    const graph = buildTextWorld(draft);
    expect(graph.ruleEvidence.length).toBeGreaterThanOrEqual(3);
    expect(graph.knowledgeEvidence).toHaveLength(1);
    expect(graph.potentialConflicts).toHaveLength(1);
    expect(graph.potentialConflicts[0]).toMatchObject({ kind: "opposite-polarity", deterministicEvidence: { subject: "dragons" } });
    expect(graph.caveat).toMatch(/not a semantic world model/);
    assertGroundedReferences(graph);
  });

  it("keeps questions, hypotheses, and quotations out of literal conflict decisions", () => {
    const graph = buildTextWorld('Mara is inside. Is Mara not inside? If Mara is not inside, call her. "Mara is not inside," said Tom.');
    expect(graph.potentialConflicts).toEqual([]);
    expect(graph.assertions.some(({ kind }) => kind === "question")).toBe(true);
    expect(graph.assertions.some(({ kind }) => kind === "hypothetical")).toBe(true);
  });

  it("does not conflate separate worlds or indefinite referents", () => {
    expect(buildTextWorld("In this world, dragons cannot fly. In another world, dragons can fly.").potentialConflicts).toEqual([]);
    expect(buildTextWorld("A crate weighs 2 kg. A crate weighs 3 kg.").potentialConflicts).toEqual([]);
  });

  it("recognizes explicit arithmetic errors but not merely different numbers", () => {
    const graph = buildTextWorld("The equation is 3 + 4 = 8. The corrected equation is 3 + 4 = 7. The morning count was 5; the evening count was 6.");
    expect(graph.potentialConflicts).toHaveLength(1);
    expect(graph.potentialConflicts[0]).toMatchObject({ kind: "arithmetic-mismatch", deterministicEvidence: { computed: 7, stated: 8 } });
    assertGroundedReferences(graph);
    expect(buildTextWorld("The equations are -3 + 4 = 1 and 3 - 4 = -1. The longer expression is 2 + 3 * 4 = 14.").potentialConflicts).toEqual([]);
    expect(buildTextWorld("The equation is -3 + 4 = 2.").potentialConflicts[0]).toMatchObject({ kind: "arithmetic-mismatch", deterministicEvidence: { computed: 1, stated: 2 } });
  });

  it("routes ordinary narrative without an argument map, even with a causal connective", () => {
    const narrative = buildTextWorld("Mara hurried home because rain was falling. She left her boots by the door.");
    expect(narrative.argument).toMatchObject({ enabled: false, nodes: [], edges: [] });
    const requested = buildTextWorld("The roads are flooded. We should postpone the trip.", { direction: "Analyze the argument and its unstated premise." });
    expect(requested.argument.enabled).toBe(true);
    expect(requested.argument.routingSignals).toContain("explicit-reasoning-request");
    expect(requested.argument.edges).toEqual([]);
  });

  it("records premise/conclusion/objection candidates with exact connective evidence", () => {
    const draft = "The roads are flooded. Therefore, the trip should be postponed. However, a safe rail route is available.";
    const graph = buildTextWorld(draft);
    expect(graph.argument.enabled).toBe(true);
    expect(graph.argument.nodes.map(({ role }) => role)).toEqual(["claim-candidate", "conclusion-candidate", "objection-candidate"]);
    expect(graph.argument.edges.map(({ kind }) => kind)).toEqual(["supports-candidate", "objects-to-candidate"]);
    expect(graph.argument.caveat).toMatch(/do not establish validity/);
    assertGroundedSpans(graph, draft);
    assertGroundedReferences(graph);
    const intraSentence = buildTextWorld("The trip should be postponed because the roads are flooded.", { mode: "argument" });
    expect(intraSentence.argument.nodes).toHaveLength(2);
    expect(intraSentence.argument.edges[0]).toMatchObject({ from: "argument-2", to: "argument-1", kind: "supports-candidate" });
    assertGroundedSpans(intraSentence, "The trip should be postponed because the roads are flooded.");
  });

  it("finds distant literal conflicts before sampling and discloses bounded coverage of 60,000 characters", () => {
    const first = "At noon, Mara was inside.\n";
    const last = "\nAt noon, Mara was not inside.";
    const filler = "The wind moved gently through the garden.\n";
    const body = filler.repeat(Math.floor((60_000 - first.length - last.length) / filler.length));
    const draft = first + body + " ".repeat(60_000 - first.length - body.length - last.length) + last;
    expect(draft).toHaveLength(60_000);
    const graph = buildTextWorld(draft);
    expect(graph.coverage).toMatchObject({ scannedCharacters: 60_000, inputTruncated: false, sampled: true, semanticCompleteness: false });
    expect(graph.coverage.assertionsOmitted).toBeGreaterThan(1000);
    expect(graph.assertions.length).toBeLessThanOrEqual(TEXT_WORLD_LIMITS.assertions);
    expect(graph.entities.length).toBeLessThanOrEqual(TEXT_WORLD_LIMITS.entities);
    expect(graph.argument.nodes.length).toBeLessThanOrEqual(TEXT_WORLD_LIMITS.argumentNodes);
    expect(graph.potentialConflicts).toHaveLength(1);
    expect(graph.assertions.at(-1).span.text).toBe("At noon, Mara was not inside.");
    assertGroundedReferences(graph);
    assertGroundedSpans(graph, draft);
    const summary = summarizeTextWorld(graph);
    expect(summary.potentialConflictCount).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("Mara");
    expect(summary).not.toHaveProperty("assertions");
  });

  it("discloses input truncation and oversized sentence fragmentation", () => {
    const draft = "x".repeat(60_005);
    const graph = buildTextWorld(draft);
    expect(graph.coverage).toMatchObject({ inputCharacters: 60_005, scannedCharacters: 60_000, inputTruncated: true, sampled: true });
    expect(graph.coverage.assertionFragments).toBeGreaterThan(0);
    expect(graph.assertions.every(({ span }) => span.text.length <= TEXT_WORLD_LIMITS.assertionCharacters)).toBe(true);
    assertGroundedSpans(graph, draft);
    expect(buildTextWorld("").assertions).toEqual([]);
    expect(() => buildTextWorld(null)).toThrow(TypeError);
  });
});

describe("fidelity comparison", () => {
  it("finds changed quotations, quantities, times, and exact literal polarity with grounded evidence", () => {
    const original = 'In 2024, Mara was inside. The crate weighs 2 kg. Mara can swim. "Leave now," she said.';
    const candidate = 'In 2025, Mara was inside. The crate weighs 3 kg. Mara cannot swim. "Go now," she said.';
    const comparison = compareTextWorld(original, candidate, { mode: "proofread" });
    expect(comparison.candidates.map(({ kind }) => kind)).toEqual(expect.arrayContaining(["quotation-removed-or-changed", "quantity-inventory-change", "time-inventory-change", "polarity-change"]));
    for (const issue of comparison.candidates) {
      expect(issue.status).toBe("requires-review");
      assertGroundedSpans(issue.originalEvidence, original);
      assertGroundedSpans(issue.candidateEvidence, candidate);
    }
  });

  it("accepts equivalent number spelling and compatible unit normalization", () => {
    const comparison = compareTextWorld("The crate weighs 1 kg. There are 5 boxes.", "The crate weighs 1000 g. There are five boxes.");
    expect(comparison.candidates).toEqual([]);
    expect(compareTextWorld("Mara cannot swim.", "Mara cannot swim.").candidates).toEqual([]);
    expect(compareTextWorld("The distance is .5 km.", "The distance is 500 m.").candidates).toEqual([]);
    expect(compareTextWorld("The temperature is -2 °C.", "The temperature is 2 °C.").candidates.map(({ kind }) => kind)).toContain("quantity-inventory-change");
  });

  it("labels unmatched additions as inventory changes, bounds candidate output, and discloses incomplete semantics", () => {
    const original = Array.from({ length: 50 }, (_, index) => `"Quotation number ${index}."`).join("\n");
    const comparison = compareTextWorld(original, "Different prose with 15 boxes.");
    expect(comparison.candidates.length).toBeLessThanOrEqual(TEXT_WORLD_LIMITS.fidelityCandidates);
    expect(comparison.coverage.candidateLimitReached).toBe(true);
    expect(comparison.coverage.semanticCompleteness).toBe(false);
    expect(compareTextWorld("x".repeat(60_001), "ok").coverage.inputTruncated).toBe(true);
    expect(() => compareTextWorld("text", null)).toThrow(TypeError);
  });
});
