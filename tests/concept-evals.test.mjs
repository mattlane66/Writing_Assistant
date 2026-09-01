import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  assessRecognition,
  validateConceptEvalSuite,
  validatePipelineTrace,
  validateSemanticGrade,
} from "../evals/concept-eval-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let registry;
let recognition;
let execution;

beforeAll(async () => {
  [registry, recognition, execution] = await Promise.all(
    [
      "knowledge/CONCEPT_REGISTRY.json",
      "evals/concept-recognition.cases.json",
      "evals/concept-execution.cases.json",
    ].map(async (relativePath) =>
      JSON.parse(await readFile(path.join(root, relativePath), "utf8")),
    ),
  );
});

describe("concept eval contracts", () => {
  it("covers every registry concept in both recognition and execution datasets", () => {
    expect(validateConceptEvalSuite({ registry, recognition, execution })).toEqual({
      conceptCount: 40,
      recognitionCaseCount: 18,
      executionCaseCount: 18,
    });
  });

  it("grades required and forbidden concept routing separately", () => {
    const testCase = recognition.cases.find(
      ({ id }) => id === "recognition-transition-and-knowledge-path",
    );

    expect(
      assessRecognition(testCase, ["contradiction-vs-transition", "knowledge-state"]),
    ).toMatchObject({ pass: true, missing: [], forbidden: [] });
    expect(assessRecognition(testCase, ["countermodels-stress-tests"])).toMatchObject({
      pass: false,
      missing: ["contradiction-vs-transition", "knowledge-state"],
      forbidden: ["countermodels-stress-tests"],
    });
  });

  it("validates the bounded pipeline trace and one grade per execution concept", () => {
    const pipeline = {
      version: "1.0",
      registryVersion: "1.0.0",
      selectedConcepts: [
        { id: "contradiction-vs-transition", name: "Contradiction versus transition gap" },
        { id: "knowledge-state", name: "Knowledge-state tracking" },
      ],
      stages: [
        { name: "plan", status: "completed" },
        { name: "retrieve", status: "completed" },
        { name: "write", status: "completed" },
        { name: "audit", status: "completed" },
        { name: "repair", status: "skipped" },
      ],
      auditDisposition: "passed",
    };

    expect(validatePipelineTrace(pipeline, "1.0.0")).toEqual([
      "contradiction-vs-transition",
      "knowledge-state",
    ]);
    expect(
      validateSemanticGrade(
        {
          grades: [
            {
              concept_id: "contradiction-vs-transition",
              pass: true,
              reason: "The response identifies a bridge gap rather than a contradiction.",
            },
            {
              concept_id: "knowledge-state",
              pass: true,
              reason: "The response identifies the absent information path.",
            },
          ],
        },
        ["contradiction-vs-transition", "knowledge-state"],
      ),
    ).toMatchObject({ pass: true });
  });
});
