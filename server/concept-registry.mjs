import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { z } from "zod";

const SERVER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = path.resolve(SERVER_DIRECTORY, "..");

export const CONCEPT_REGISTRY_PATH = path.join(
  PROJECT_DIRECTORY,
  "knowledge",
  "CONCEPT_REGISTRY.json",
);

const SOURCE_KINDS = ["repository", "private-pdf"];
const SOURCE_PROVENANCE = [
  "controlling-synthesis",
  "operational-synthesis",
  "vendored-method",
  "primary-reference",
  "secondary-corroboration",
];
const CONCEPT_CATEGORIES = [
  "editorial-contract",
  "craft",
  "syntax",
  "source-discipline",
  "coherence",
  "argument-reasoning",
];

const NonEmptyString = z.string().trim().min(1);
const NonEmptyStringArray = z
  .array(NonEmptyString)
  .min(1)
  .refine((values) => new Set(values).size === values.length, {
    message: "String arrays must not contain duplicates.",
  });

export const ConceptRegistrySchema = z
  .object({
    schema_version: z.literal(1),
    registry_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    concepts: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            name: NonEmptyString,
            category: z.enum(CONCEPT_CATEGORIES),
            description: NonEmptyString,
            procedure: NonEmptyStringArray,
            triggers: NonEmptyStringArray,
            anti_triggers: NonEmptyStringArray,
            exceptions: NonEmptyStringArray,
            sources: z
              .array(
                z
                  .object({
                    kind: z.enum(SOURCE_KINDS),
                    ref: NonEmptyString,
                    locator: NonEmptyString,
                    provenance: z.enum(SOURCE_PROVENANCE),
                    note: NonEmptyString.optional(),
                  })
                  .strict(),
              )
              .min(1),
            eval_criteria: z
              .object({
                recognition: NonEmptyStringArray,
                execution: NonEmptyStringArray,
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export class ConceptRegistryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ConceptRegistryError";
    this.status = 503;
    this.publicMessage =
      "The writing concept registry is unavailable or invalid. Restore it and try again.";
  }
}

function assertUniqueConceptIds(registry) {
  const seen = new Set();

  for (const concept of registry.concepts) {
    if (seen.has(concept.id)) {
      throw new ConceptRegistryError(`Duplicate concept id: ${concept.id}`);
    }
    seen.add(concept.id);
  }
}

export function parseConceptRegistry(value) {
  const parsed = ConceptRegistrySchema.safeParse(value);
  if (!parsed.success) {
    throw new ConceptRegistryError("Concept registry schema validation failed.", {
      cause: parsed.error,
    });
  }

  assertUniqueConceptIds(parsed.data);
  return parsed.data;
}

export async function loadConceptRegistry(filePath = CONCEPT_REGISTRY_PATH) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new ConceptRegistryError("Concept registry could not be read.", {
      cause: error,
    });
  }

  try {
    return parseConceptRegistry(JSON.parse(source));
  } catch (error) {
    if (error instanceof ConceptRegistryError) throw error;
    throw new ConceptRegistryError("Concept registry is not valid JSON.", {
      cause: error,
    });
  }
}

export function buildConceptCatalog(registry) {
  return registry.concepts.map(
    ({ id, name, category, description, triggers, anti_triggers }) => ({
      id,
      name,
      category,
      description,
      triggers,
      antiTriggers: anti_triggers,
    }),
  );
}

export function retrieveConcepts(
  registry,
  plannedIds,
  { requiredIds = [], maxConcepts = 8 } = {},
) {
  const byId = new Map(registry.concepts.map((concept) => [concept.id, concept]));
  const orderedIds = [...requiredIds, ...plannedIds];
  const selected = [];
  const seen = new Set();

  for (const id of orderedIds) {
    if (seen.has(id)) continue;

    const concept = byId.get(id);
    if (!concept) {
      throw new ConceptRegistryError(`Unknown concept id selected: ${id}`);
    }

    seen.add(id);
    selected.push(concept);
  }

  if (selected.length === 0) {
    throw new ConceptRegistryError("Concept selection was empty.");
  }

  if (selected.length > maxConcepts) {
    throw new ConceptRegistryError(
      `Concept selection exceeded the ${maxConcepts}-concept bound.`,
    );
  }

  return selected;
}
