const VALID_MODES = new Set([
  "proofread",
  "edit",
  "rewrite",
  "compress",
  "draft",
  "analyze",
]);

const PIPELINE_STAGE_NAMES = ["plan", "retrieve", "write", "audit", "repair"];

export const RESULTS_RELATIVE_DIRECTORY = "evals/results";

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values, label, { min = 1, max = Infinity } = {}) {
  invariant(Array.isArray(values), `${label} must be an array.`);
  invariant(values.length >= min, `${label} must contain at least ${min} item(s).`);
  invariant(values.length <= max, `${label} cannot contain more than ${max} items.`);
  invariant(values.every(nonEmptyString), `${label} must contain only non-empty strings.`);
  invariant(new Set(values).size === values.length, `${label} must not contain duplicates.`);
  return values;
}

function validateRequest(request, label) {
  invariant(isRecord(request), `${label} must be an object.`);
  invariant(nonEmptyString(request.draft), `${label}.draft must be a non-empty string.`);
  invariant(typeof request.direction === "string", `${label}.direction must be a string.`);
  invariant(VALID_MODES.has(request.mode), `${label}.mode is not supported.`);
  invariant(typeof request.ceiling === "boolean", `${label}.ceiling must be a boolean.`);
}

function validateDatasetHeader(dataset, kind, registryVersion) {
  invariant(isRecord(dataset), `${kind} dataset must be an object.`);
  invariant(dataset.schema_version === 1, `${kind} dataset schema_version must be 1.`);
  invariant(dataset.kind === kind, `${kind} dataset kind must be ${kind}.`);
  invariant(
    dataset.registry_version === registryVersion,
    `${kind} dataset registry_version must match the concept registry.`,
  );
  invariant(nonEmptyString(dataset.purpose), `${kind} dataset purpose is required.`);
  invariant(Array.isArray(dataset.cases) && dataset.cases.length > 0, `${kind} cases are required.`);
}

function validateConceptReferences(ids, registryIds, label) {
  for (const id of ids) {
    invariant(registryIds.has(id), `${label} references unknown concept ${id}.`);
  }
}

export function validateRecognitionDataset(dataset, registry) {
  const registryIds = new Set(registry.concepts.map((concept) => concept.id));
  validateDatasetHeader(dataset, "recognition", registry.registry_version);

  const caseIds = new Set();
  const coverage = new Set();

  for (const testCase of dataset.cases) {
    invariant(isRecord(testCase), "Each recognition case must be an object.");
    invariant(nonEmptyString(testCase.id), "Each recognition case needs an id.");
    invariant(!caseIds.has(testCase.id), `Duplicate recognition case id ${testCase.id}.`);
    caseIds.add(testCase.id);
    invariant(nonEmptyString(testCase.rationale), `${testCase.id}.rationale is required.`);
    validateRequest(testCase.request, `${testCase.id}.request`);

    const targets = uniqueStrings(
      testCase.target_concept_ids,
      `${testCase.id}.target_concept_ids`,
      { max: 8 },
    );
    const forbidden = uniqueStrings(
      testCase.forbidden_concept_ids,
      `${testCase.id}.forbidden_concept_ids`,
    );
    validateConceptReferences(targets, registryIds, `${testCase.id}.target_concept_ids`);
    validateConceptReferences(forbidden, registryIds, `${testCase.id}.forbidden_concept_ids`);
    invariant(
      forbidden.every((id) => !targets.includes(id)),
      `${testCase.id} cannot target and forbid the same concept.`,
    );
    targets.forEach((id) => coverage.add(id));
  }

  return { caseIds, coverage };
}

export function validateExecutionDataset(dataset, registry) {
  const registryIds = new Set(registry.concepts.map((concept) => concept.id));
  validateDatasetHeader(dataset, "execution", registry.registry_version);

  const caseIds = new Set();
  const coverage = new Set();

  for (const testCase of dataset.cases) {
    invariant(isRecord(testCase), "Each execution case must be an object.");
    invariant(nonEmptyString(testCase.id), "Each execution case needs an id.");
    invariant(!caseIds.has(testCase.id), `Duplicate execution case id ${testCase.id}.`);
    caseIds.add(testCase.id);
    validateRequest(testCase.request, `${testCase.id}.request`);
    invariant(
      Array.isArray(testCase.criteria) && testCase.criteria.length > 0,
      `${testCase.id}.criteria must be a non-empty array.`,
    );
    invariant(testCase.criteria.length <= 8, `${testCase.id} cannot target more than 8 concepts.`);

    const criterionIds = new Set();
    for (const criterion of testCase.criteria) {
      invariant(isRecord(criterion), `${testCase.id} criteria must be objects.`);
      invariant(
        nonEmptyString(criterion.concept_id),
        `${testCase.id} criterion concept_id is required.`,
      );
      invariant(
        !criterionIds.has(criterion.concept_id),
        `${testCase.id} has duplicate criterion ${criterion.concept_id}.`,
      );
      criterionIds.add(criterion.concept_id);
      validateConceptReferences(
        [criterion.concept_id],
        registryIds,
        `${testCase.id}.criteria`,
      );
      invariant(
        nonEmptyString(criterion.pass_condition),
        `${testCase.id}.${criterion.concept_id}.pass_condition is required.`,
      );
      uniqueStrings(
        criterion.failure_signals,
        `${testCase.id}.${criterion.concept_id}.failure_signals`,
      );
      coverage.add(criterion.concept_id);
    }
  }

  return { caseIds, coverage };
}

export function validateConceptEvalSuite({ registry, recognition, execution }) {
  invariant(isRecord(registry), "Concept registry must be an object.");
  invariant(registry.schema_version === 1, "Concept registry schema_version must be 1.");
  invariant(nonEmptyString(registry.registry_version), "Concept registry version is required.");
  invariant(Array.isArray(registry.concepts) && registry.concepts.length > 0, "Concepts are required.");

  const registryIds = uniqueStrings(
    registry.concepts.map((concept) => concept.id),
    "registry concept ids",
  );
  const recognitionResult = validateRecognitionDataset(recognition, registry);
  const executionResult = validateExecutionDataset(execution, registry);

  for (const id of registryIds) {
    invariant(
      recognitionResult.coverage.has(id),
      `Concept ${id} has no recognition evaluation.`,
    );
    invariant(
      executionResult.coverage.has(id),
      `Concept ${id} has no execution evaluation.`,
    );
  }

  const overlappingCaseIds = [...recognitionResult.caseIds].filter((id) =>
    executionResult.caseIds.has(id),
  );
  invariant(
    overlappingCaseIds.length === 0,
    `Case ids must be unique across datasets: ${overlappingCaseIds.join(", ")}.`,
  );

  return {
    conceptCount: registryIds.length,
    recognitionCaseCount: recognition.cases.length,
    executionCaseCount: execution.cases.length,
  };
}

export function assessRecognition(testCase, selectedConceptIds) {
  const selected = new Set(
    uniqueStrings(selectedConceptIds, "selected concept ids", { min: 0, max: 8 }),
  );
  const missing = testCase.target_concept_ids.filter((id) => !selected.has(id));
  const forbidden = testCase.forbidden_concept_ids.filter((id) => selected.has(id));

  return {
    pass: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
    selected: [...selected],
  };
}

export function validatePipelineTrace(pipeline, expectedRegistryVersion) {
  invariant(isRecord(pipeline), "meta.pipeline must be an object.");
  invariant(pipeline.version === "1.0", "Pipeline trace version must be 1.0.");
  invariant(
    pipeline.registryVersion === expectedRegistryVersion,
    "Pipeline trace registryVersion does not match the eval dataset.",
  );
  invariant(
    Array.isArray(pipeline.selectedConcepts) && pipeline.selectedConcepts.length > 0,
    "Pipeline trace must include selectedConcepts.",
  );
  invariant(pipeline.selectedConcepts.length <= 8, "Pipeline selected more than 8 concepts.");

  const ids = pipeline.selectedConcepts.map((concept, index) => {
    invariant(isRecord(concept), `selectedConcepts[${index}] must be an object.`);
    invariant(nonEmptyString(concept.id), `selectedConcepts[${index}].id is required.`);
    invariant(nonEmptyString(concept.name), `selectedConcepts[${index}].name is required.`);
    return concept.id;
  });
  uniqueStrings(ids, "pipeline selected concept ids", { max: 8 });

  invariant(Array.isArray(pipeline.stages), "Pipeline trace stages must be an array.");
  const stageNames = pipeline.stages.map((stage, index) => {
    invariant(isRecord(stage), `pipeline.stages[${index}] must be an object.`);
    invariant(PIPELINE_STAGE_NAMES.includes(stage.name), `Unknown pipeline stage ${stage.name}.`);
    invariant(
      stage.status === "completed" || stage.status === "skipped",
      `Invalid status for pipeline stage ${stage.name}.`,
    );
    return stage.name;
  });
  invariant(
    PIPELINE_STAGE_NAMES.every((name) => stageNames.includes(name)),
    "Pipeline trace must report every bounded stage.",
  );
  invariant(new Set(stageNames).size === stageNames.length, "Pipeline stages must not repeat.");
  invariant(
    pipeline.auditDisposition === "passed" || pipeline.auditDisposition === "repaired",
    "Pipeline auditDisposition must be passed or repaired.",
  );

  return ids;
}

export function validateSemanticGrade(grade, expectedConceptIds) {
  invariant(isRecord(grade), "Semantic grade must be an object.");
  invariant(Array.isArray(grade.grades), "Semantic grade must contain grades.");

  const expected = new Set(expectedConceptIds);
  const seen = new Set();
  for (const item of grade.grades) {
    invariant(isRecord(item), "Each semantic grade must be an object.");
    invariant(expected.has(item.concept_id), `Unexpected semantic grade ${item.concept_id}.`);
    invariant(!seen.has(item.concept_id), `Duplicate semantic grade ${item.concept_id}.`);
    invariant(typeof item.pass === "boolean", `${item.concept_id}.pass must be boolean.`);
    invariant(nonEmptyString(item.reason), `${item.concept_id}.reason is required.`);
    seen.add(item.concept_id);
  }
  invariant(seen.size === expected.size, "Semantic grade is missing one or more concepts.");

  return {
    pass: grade.grades.every((item) => item.pass),
    grades: grade.grades,
  };
}
