import { describe, expect, it } from "vitest";
import { buildMeaningContract, compareMeaningContract, summarizeMeaningContract, MEANING_CONTRACT_LIMITS } from "../server/meaning-contract.mjs";

function grounded(value, original) {
  if (!value || typeof value !== "object") return;
  if ("start" in value && "end" in value && "text" in value) {
    expect(value.start).toBeGreaterThanOrEqual(0);
    expect(value.end).toBeGreaterThan(value.start);
    expect(value.end).toBeLessThanOrEqual(original.length);
    expect(original.slice(value.start, value.end)).toBe(value.text);
  }
  for (const child of Object.values(value)) grounded(child, original);
}
function review(original, candidate, options) { return compareMeaningContract(buildMeaningContract(original), candidate, options); }
function kinds(comparison) { return comparison.candidates.map(({ kind }) => kind); }

describe("bounded meaning contract", () => {
  it("anchors qualifications in untouched Unicode and CRLF source, with no prose in summary", () => {
    const draft = "# Café 🐦\r\nSome participants may have reported a one‑week improvement, except during winter.\r\nMara holds 4 crates.";
    const contract = buildMeaningContract(draft);
    grounded(contract, draft);
    expect(contract.clauses.flatMap(({ anchors }) => anchors.map(({ kind }) => kind))).toEqual(expect.arrayContaining(["quantifier", "modality", "attribution", "duration", "condition-or-exception", "quantity"]));
    expect(contract.clauses.find(({ subject }) => subject === "mara")).toBeDefined();
    expect(contract.coverage).toMatchObject({ inputTruncated: false, clausesOmitted: 0, semanticCompleteness: false });
    expect(contract.coverage.offsetUnit).toMatch(/UTF-16/);
    const summary = summarizeMeaningContract(contract);
    expect(summary.anchorCount).toBeGreaterThan(5);
    expect(JSON.stringify(summary)).not.toContain("participants");
    expect(summary).not.toHaveProperty("clauses");
  });

  it("finds the observed dropped duration, self-report, and population qualification", () => {
    const original = "Some participants reported improvement after one week.";
    const candidate = "Participants improved.";
    const comparison = review(original, candidate);
    expect(kinds(comparison)).toEqual(expect.arrayContaining(["duration-changed-or-not-recovered", "attribution-changed-or-not-recovered", "quantifier-changed-or-not-recovered"]));
    for (const finding of comparison.candidates) {
      expect(finding.status).toBe("requires-review");
      grounded(finding.originalEvidence, original);
      grounded(finding.anchorEvidence, original);
      grounded(finding.candidateEvidence, candidate);
    }
    expect(kinds(review("The one-week study found self-reported improvement.", "The study found improvement."))).toEqual(expect.arrayContaining(["duration-changed-or-not-recovered", "attribution-changed-or-not-recovered"]));
  });

  it("signals strengthened modality without claiming semantic certainty", () => {
    const result = review("The program may improve sleep.", "The program improves sleep.");
    expect(kinds(result)).toEqual(["modality-changed-or-not-recovered"]);
    expect(result.candidates[0]).toMatchObject({ status: "requires-review", subject: "program" });
    expect(result.caveat).toMatch(/not a complete claim map or semantic proof/);
    expect(review("The program may improve sleep.", "The program could improve sleep.").candidates).toEqual([]);
    expect(review("The program probably improves sleep.", "The program likely improves sleep.").candidates).toEqual([]);
    expect(kinds(review("Mara never approves requests.", "Mara does not approve requests."))).toContain("modality-changed-or-not-recovered");
    expect(kinds(review("Mara cannot approve requests.", "Mara does not approve requests."))).toContain("modality-changed-or-not-recovered");
  });

  it("accepts simple duration, attribution, and metric-unit paraphrases", () => {
    for (const [original, candidate] of [
      ["Some participants reported improvement after one week.", "Some participants reported improvement after seven days."],
      ["Mara reported feeling better.", "Mara said she felt better."],
      ["The crate weighs 1 kg.", "The crate weighs 1000 grams."],
      ["Mara may rest for 60 minutes.", "Mara might rest for one hour."],
    ]) expect(review(original, candidate).candidates).toEqual([]);
    // A month is not assumed to contain an exact number of days.
    expect(kinds(review("Mara may rest for one month.", "Mara may rest for 30 days."))).toContain("duration-changed-or-not-recovered");
  });

  it("does not reduce a condition to the presence of an if/exception token", () => {
    const original = "The gate opens only if Mara approves, except during winter.";
    expect(review(original, original).candidates).toEqual([]);
    expect(kinds(review(original, "The gate opens only if Lee approves, except during summer."))).toContain("condition-or-exception-changed-or-not-recovered");
    expect(kinds(review(original, "The gate opens."))).toContain("condition-or-exception-changed-or-not-recovered");
    // A defensible rephrasing can require review; it must never be called a
    // proved error solely because the literal wording wasn't recovered.
    const paraphrase = review(original, "The gate requires Mara's approval and stays closed in winter.");
    expect(paraphrase.candidates.every(({ status }) => status === "requires-review")).toBe(true);
  });

  it("retains explicit independent checking without treating every checking verb as equivalent", () => {
    for (const [original, candidate] of [
      ["The reports were not independently checked.", "The reports were not checked."],
      ["Mara independently verified the reports.", "Mara verified the reports."],
      ["The reports were independently checked.", "The reports were independently confirmed."],
    ]) expect(kinds(review(original, candidate))).toContain("checking-method-changed-or-not-recovered");
    for (const [original, candidate] of [
      ["The reports were not independently checked.", "The reports were not checked independently."],
      ["Mara independently verified the reports.", "Mara independently verified the reports."],
    ]) expect(review(original, candidate).candidates).toEqual([]);
    // Nonadjacent attachment is deliberately left to semantic review; a
    // checking verb anywhere in the clause cannot establish adverb scope.
    const reordered = review("Mara independently verified the reports.", "Mara verified the reports independently.");
    expect(kinds(reordered)).toEqual(["checking-method-changed-or-not-recovered"]);
    expect(reordered.candidates.every(({ status }) => status === "requires-review")).toBe(true);
    expect(kinds(review("Mara independently checked the reports.", "Mara checked the reports and filed them independently."))).toContain("checking-method-changed-or-not-recovered");
    const original = "Some participants reported improvement, although the reports were not independently checked.";
    const ambiguous = review(original, "Some participants reported improvement, although unverified.");
    expect(ambiguous.candidates.some(({ anchorEvidence }) => anchorEvidence.some(({ text }) => text === "independently checked"))).toBe(true);
    expect(ambiguous.candidates.every(({ status }) => status === "requires-review")).toBe(true);
    grounded(buildMeaningContract(original), original);
    expect(review('"The reports were independently verified," said Mara.', "Mara mentioned the reports.").candidates).toEqual([]);
  });

  it("links amounts to named clauses so swapped numbers cannot pass via inventory", () => {
    for (const connector of [". ", "; ", " and "]) {
      const original = `Mara holds 4 crates${connector}Lee holds 8 crates.`;
      const swapped = `Mara holds 8 crates${connector}Lee holds 4 crates.`;
      const comparison = review(original, swapped);
      expect(kinds(comparison)).toEqual(["quantity-changed-or-not-recovered", "quantity-changed-or-not-recovered"]);
      expect(comparison.candidates.map(({ subject }) => subject)).toEqual(["mara", "lee"]);
      expect(review(original, `Lee holds 8 crates${connector}Mara holds 4 crates.`).candidates).toEqual([]);
    }
    const objectSwap = review("Mara holds 4 crates and 8 boxes.", "Mara holds 8 crates and 4 boxes.");
    expect(kinds(objectSwap)).toContain("quantity-changed-or-not-recovered");
  });

  it("retains percentage denominator and date differences rather than treating every number as equal", () => {
    expect(review("Participation is 75%.", "Participation is 75 percent.").candidates).toEqual([]);
    expect(kinds(review("Participation is 5 percent.", "Participation is 5 percentage points."))).toContain("quantity-changed-or-not-recovered");
    expect(kinds(review("Mara arrived on 2026-09-08.", "Mara arrived on 2026-09-09."))).toContain("date-changed-or-not-recovered");
  });

  it("does not round quantity anchors into false equivalence", () => {
    for (const [original, candidate] of [
      ["Mara holds 1000000000000 crates.", "Mara holds 1000000000001 crates."],
      ["The crate weighs 1.000000000000001 kg.", "The crate weighs 1 kg."],
      ["Mara holds 9007199254740992 crates.", "Mara holds 9007199254740993 crates."],
      ["The crate weighs 0.0000000000000000001 kg.", "The crate weighs 0.0000000000000000002 kg."],
    ]) expect(kinds(review(original, candidate))).toContain("quantity-changed-or-not-recovered");
    for (const [original, candidate] of [
      ["Mara holds 4.0 crates.", "Mara holds four crates."],
      ["Mara holds 1,000 crates.", "Mara holds 1000 crates."],
      ["The crate weighs 1.25 kg.", "The crate weighs 1250.0 g."],
      ["The crate weighs 0.0000000000000001 kg.", "The crate weighs 0.0000000000001 g."],
    ]) expect(review(original, candidate).candidates).toEqual([]);
    const unsupported = buildMeaningContract("Mara holds 9007199254740993 crates.");
    expect(unsupported.clauses[0].anchors[0].canonical).toBe("crate:literal:9007199254740993*1");
  });

  it("does not treat quotations, rhetorical questions, fiction examples, or disputed claims as asserted facts", () => {
    const texts = [
      '"Mara may arrive after one week," said Lee.',
      "Could Mara arrive after one week?",
      "Imagine Mara could arrive after one week.",
      "In this fictional world, Mara may arrive after one week.",
      "Lee disputes the claim that Mara may arrive after one week.",
    ];
    for (const original of texts) {
      const result = review(original, "Mara arrived.");
      expect(result.candidates).toEqual([]);
      expect(result.coverage.nonassertedOrFragmentClausesSkipped).toBeGreaterThan(0);
    }
    // Metaphorical language without a supported formal template is not a
    // deterministic contradiction just because it describes impossible imagery.
    expect(buildMeaningContract("The night swallowed a thousand years. Her grief weighed 4 kg.").formalChecks).toEqual([]);
  });

  it("disables restatement requirements for analysis and new drafting", () => {
    for (const mode of ["analyze", "draft"]) {
      const result = review("Some participants may improve after one week.", "The evidence does not settle effectiveness.", { mode });
      expect(result).toMatchObject({ enabled: false, candidates: [] });
      expect(result.caveat).toMatch(/Fidelity comparison is disabled/);
    }
    expect(review("Mara may rest.", "Mara rests.", { mode: "proofread" }).enabled).toBe(true);
  });

  it("discloses incomplete alignment instead of inventing a claim deletion proof", () => {
    const result = review("Some participants reported improvement after one week.", "Those surveyed described benefits following seven days.");
    expect(result.candidates).toEqual([expect.objectContaining({ kind: "qualified-claim-not-aligned", status: "requires-review", candidateEvidence: [] })]);
    expect(result.coverage).toMatchObject({ unalignedClauses: 1, semanticCompleteness: false });
    expect(result.candidates[0].reason).toMatch(/merged, or paraphrased/);
  });

  it("reports truncation, sampled clauses, limited findings and fragmented statements", () => {
    const draft = "Some participants may improve after one week.\n".repeat(1800);
    const contract = buildMeaningContract(draft);
    expect(contract.coverage).toMatchObject({ scannedCharacters: 60_000, inputTruncated: true, clausesRetained: MEANING_CONTRACT_LIMITS.clauses, semanticCompleteness: false });
    expect(contract.coverage.clausesOmitted).toBeGreaterThan(1000);
    expect(contract.coverage.clauseFragments).toBeGreaterThan(0);
    grounded(contract, draft);
    const comparison = compareMeaningContract(contract, "Participants improved.");
    expect(comparison.candidates).toHaveLength(MEANING_CONTRACT_LIMITS.fidelityCandidates);
    expect(comparison.coverage.findingsOmitted).toBeGreaterThan(0);
    const longClause = buildMeaningContract("possibly ".repeat(100));
    expect(longClause.coverage.clauseFragments).toBeGreaterThan(0);
    expect(longClause.coverage.anchorsOmitted).toBeGreaterThan(0);
    expect(longClause.clauses.every(({ span }) => span.text.length <= MEANING_CONTRACT_LIMITS.clauseCharacters)).toBe(true);
    expect(buildMeaningContract("").clauses).toEqual([]);
    expect(() => buildMeaningContract(null)).toThrow(TypeError);
    expect(() => compareMeaningContract({}, "draft")).toThrow(TypeError);
    expect(() => compareMeaningContract(contract, null)).toThrow(TypeError);
  });
});

describe("narrow formal checks", () => {
  it("checks explicitly exact percentage ratios and changes without inferring a population or cause", () => {
    for (const [draft, kind, status, expected] of [
      ["The percentage increase from 100 to 120 is exactly 20 percent.", "explicit-exact-percentage-change", "satisfied", 20],
      ["The percentage decrease from 100 to 80 is exactly 30%.", "explicit-exact-percentage-change", "mismatch", 20],
      ["The percentage change from 100 to 80 is exactly -20 percent.", "explicit-exact-percentage-change", "satisfied", -20],
      ["3 out of 4 is exactly 75 percent.", "explicit-exact-percentage-ratio", "satisfied", 75],
      ["1 of 8 equals exactly 15 percent.", "explicit-exact-percentage-ratio", "mismatch", 12.5],
    ]) {
      const checks = buildMeaningContract(draft).formalChecks;
      expect(checks).toEqual([expect.objectContaining({ kind, status, expected })]);
      expect(checks[0].scope).toContain("Does not verify measurements");
      grounded(checks, draft);
    }
  });

  it("does not criticize ordinary rounded percentages, uncertain denominators, or quoted ratio examples", () => {
    for (const draft of [
      "The percentage change from 7 to 9 is 28.6 percent.",
      "1 out of 3 is 33.3 percent.",
      "About 1 out of 3 is exactly 33 percent.",
      "1 out of 0 is exactly 100 percent.",
      "-1 out of 4 is exactly -25 percent.",
      '"1 out of 4 is exactly 50 percent," said Mara.',
      "Suppose 1 out of 4 is exactly 50 percent.",
      "Could 1 out of 4 be exactly 50 percent?",
      "The program grew 20 percent because participants recovered.",
    ]) expect(buildMeaningContract(draft).formalChecks).toEqual([]);
    expect(review("", "1 out of 8 is exactly 15 percent.", { mode: "analyze" }).candidates[0]).toMatchObject({ kind: "formal-explicit-exact-percentage-ratio-mismatch", status: "requires-review" });
  });

  it("computes complete arithmetic templates, including signed operands and division", () => {
    for (const [draft, status, expected] of [
      ["3 + 4 = 7.", "satisfied", 7],
      ["The equation is 3 + 4 = 8.", "mismatch", 7],
      ["-3 + 4 = 1.", "satisfied", 1],
      ["3 − 4 = -1.", "satisfied", -1],
      ["3 * 4 = 13.", "mismatch", 12],
      ["3 × 4 = 12.", "satisfied", 12],
      ["8 / 4 = 2.", "satisfied", 2],
      ["0.1 + 0.2 = 0.3.", "satisfied", 0.3],
    ]) {
      const contract = buildMeaningContract(draft);
      expect(contract.formalChecks).toEqual([expect.objectContaining({ kind: "explicit-arithmetic", status, expected })]);
      grounded(contract.formalChecks, draft);
    }
  });

  it("uses exact bounded decimals rather than swallowing small or large integer errors in tolerance", () => {
    for (const draft of ["1000000000 + 1 = 1000000000.", "0.0000000001 + 0 = 0.", "1000000000 kg = 1000000001 kg.", "1 / 3 = 0.333333333333333333."]) {
      const [check] = buildMeaningContract(draft).formalChecks;
      expect(check.status).toBe("mismatch");
      expect(check.expectedExact).not.toBe(check.statedExact);
    }
    expect(buildMeaningContract("0.1 + 0.2 = 0.3.").formalChecks[0]).toMatchObject({ status: "satisfied", expectedExact: "3/10", statedExact: "3/10" });
    expect(buildMeaningContract("0 + 0 = 0.").formalChecks[0]).toMatchObject({ status: "satisfied", expectedExact: "0" });
    expect(buildMeaningContract("1 / -2 = -0.5.").formalChecks[0]).toMatchObject({ status: "satisfied", expectedExact: "-1/2" });
    for (const draft of ["9007199254740992 + 1 = 9007199254740992.", "9007199254740991 * 2 = 18014398509481982.", "0.0000000000000000001 + 0 = 0.", "9007199254740991 kg = 9007199254740991 g."]) expect(buildMeaningContract(draft).formalChecks).toEqual([]);
  });

  it("checks explicit metric equalities only within a supported dimension", () => {
    for (const [draft, status] of [["1 kg = 1000 g.", "satisfied"], ["1 kg equals 500 g.", "mismatch"], ["The conversion is 1 km = 1000 m.", "satisfied"], ["1 m is equal to 90 cm.", "mismatch"]]) {
      expect(buildMeaningContract(draft).formalChecks).toEqual([expect.objectContaining({ kind: "explicit-unit-equivalence", status })]);
    }
    for (const draft of ["1 kg = 1 m.", "About 1 kg = 990 g.", "The crate weighs 1 kg or 1000 g.", "5 percent = 5 percentage points."]) expect(buildMeaningContract(draft).formalChecks).toEqual([]);
  });

  it("checks explicit Gregorian calendar addition and date ordering", () => {
    for (const [draft, kind, status, expected] of [
      ["2024-02-28 plus 1 day = 2024-02-29.", "explicit-calendar-addition", "satisfied", "2024-02-29"],
      ["2025-02-28 + 1 day = 2025-02-29.", "explicit-calendar-addition", "invalid", null],
      ["2026-09-08 + 2 days equals 2026-09-11.", "explicit-calendar-addition", "mismatch", "2026-09-10"],
      ["2026-09-08 is before 2026-09-09.", "explicit-date-order", "satisfied", true],
      ["2026-09-08 is after 2026-09-09.", "explicit-date-order", "mismatch", false],
    ]) {
      const contract = buildMeaningContract(draft);
      if (status === "invalid") expect(contract.formalChecks).toEqual([]);
      else expect(contract.formalChecks).toEqual([expect.objectContaining({ kind, status, expected })]);
    }
    for (const draft of ["2026-09-08 plus 2 working days = 2026-09-11.", "Next Tuesday is before tomorrow.", "2026-09-08 plus 1 month = 2026-10-08."]) expect(buildMeaningContract(draft).formalChecks).toEqual([]);
  });

  it("does not calculate longer-expression tails, quotations, hypotheticals, or prose implications", () => {
    for (const draft of [
      "2 + 3 * 4 = 14.", "(2 + 3) * 4 = 20.", "3 + 4 = 8 is false.",
      '"3 + 4 = 8," said Mara.', "‘3 + 4 = 8.’", "Could 3 + 4 = 8?", "Suppose 3 + 4 = 8.",
      "The false equation is 3 + 4 = 8.", "In this fictional world, 3 + 4 = 8.",
      "There were 18 crates, 4 left, and now there are 16 crates.",
      "3 / 0 = 1.", "9007199254740992 + 1 = 9007199254740992.",
    ]) expect(buildMeaningContract(draft).formalChecks).toEqual([]);
  });

  it("skips calendar additions whose result needs an unsupported expanded ISO year", () => {
    for (const draft of ["9999-12-31 + 1 day = 0000-01-01.", "9999-01-01 plus 99999 days = 9999-12-31."]) {
      const contract = buildMeaningContract(draft);
      expect(contract.formalChecks).toEqual([]);
      expect(contract.coverage.formalChecksDetected).toBe(0);
      expect(review("", draft, { mode: "analyze" }).candidates).toEqual([]);
    }
    expect(buildMeaningContract("9999-12-30 + 1 day = 9999-12-31.").formalChecks).toEqual([
      expect.objectContaining({ kind: "explicit-calendar-addition", status: "satisfied", expected: "9999-12-31" }),
    ]);
  });

  it("reports bounded formal coverage and checks the candidate separately", () => {
    const contract = buildMeaningContract("3 + 4 = 8.\n".repeat(40));
    expect(contract.formalChecks).toHaveLength(MEANING_CONTRACT_LIMITS.formalChecks);
    expect(contract.coverage).toMatchObject({ formalChecksDetected: 40, formalChecksOmitted: 8 });
    expect(summarizeMeaningContract(contract).formalMismatchCount).toBe(32);
    const comparison = compareMeaningContract(contract, "3 + 4 = 7.", { mode: "analyze" });
    expect(comparison.formalChecks).toEqual([expect.objectContaining({ status: "satisfied" })]);
    expect(comparison.candidates).toEqual([]);
  });

  it("requires scoped review of candidate formal mismatches in every mode, before lexical signals", () => {
    for (const mode of ["rewrite", "analyze", "draft"]) {
      const comparison = review("Some participants reported improvement after one week.", "Participants improved.\n3 + 4 = 8.", { mode });
      expect(comparison.candidates[0]).toMatchObject({ kind: "formal-explicit-arithmetic-mismatch", status: "requires-review", originalEvidence: [], formalCheck: { expectedExact: "7", statedExact: "8" } });
      grounded(comparison.candidates[0].candidateEvidence, "Participants improved.\n3 + 4 = 8.");
      expect(comparison.candidates[0].reason).toMatch(/not proof that the prose is defective/);
      expect(comparison.coverage.formalMismatchCandidatesDetected).toBe(1);
      if (mode !== "rewrite") {
        expect(comparison.enabled).toBe(false);
        expect(comparison.candidates).toHaveLength(1);
      } else expect(comparison.candidates.length).toBeGreaterThan(1);
    }
  });

  it("does not require an analysis or new draft to repeat original formal mistakes", () => {
    for (const mode of ["analyze", "draft"]) expect(review("3 + 4 = 8.", "The passage contains a numerical claim.", { mode }).candidates).toEqual([]);
    for (const candidate of ['"3 + 4 = 8," said Mara.', "Suppose 3 + 4 = 8.", "In this fictional world, 3 + 4 = 8.", "Could 3 + 4 = 8?"]) expect(review("", candidate, { mode: "analyze" }).candidates).toEqual([]);
  });

  it("prioritizes late mismatches and reports all omitted formal review signals", () => {
    const late = buildMeaningContract("3 + 4 = 7.\n".repeat(40) + "3 + 4 = 8.");
    expect(late.formalChecks).toHaveLength(MEANING_CONTRACT_LIMITS.formalChecks);
    expect(late.formalChecks.at(-1).status).toBe("mismatch");
    expect(late.coverage).toMatchObject({ formalMismatchesDetected: 1, formalMismatchesRetained: 1, formalMismatchesOmitted: 0 });
    const capped = review("", "3 + 4 = 8.\n".repeat(40), { mode: "analyze" });
    expect(capped.candidates).toHaveLength(MEANING_CONTRACT_LIMITS.fidelityCandidates);
    expect(capped.coverage).toMatchObject({ findingsDetected: 40, findingsOmitted: 16, formalMismatchCandidatesDetected: 40, formalMismatchCandidatesRetained: 24, formalMismatchCandidatesOmitted: 16 });
    expect(capped.coverage.candidate.formalMismatchesOmitted).toBe(8);
  });
});
