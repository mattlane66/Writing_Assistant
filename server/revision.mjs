export const MAX_DRAFT_CHARACTERS = 30_000;
export const MAX_CONTEXT_CHARACTERS = 30_000;
export const MAX_VOICE_SAMPLES = 3;
export const MAX_VOICE_SAMPLE_CHARACTERS = 8_000;
export const MAX_VOICE_SAMPLE_TOTAL_CHARACTERS = 16_000;

export const REVISION_MODES = Object.freeze(["proofread", "edit", "rewrite", "compress", "draft", "analyze"]);
const ALLOWED_MODES = new Set(REVISION_MODES);

export class RevisionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RevisionValidationError";
    this.status = 400;
    this.publicMessage = message;
  }
}

function countCharacters(value) {
  return Array.from(value).length;
}

function optionalString(value, label, maxCharacters = MAX_CONTEXT_CHARACTERS) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    throw new RevisionValidationError(`${label} must be a string.`);
  }
  if (countCharacters(value) > maxCharacters) {
    throw new RevisionValidationError(
      `${label} cannot exceed ${maxCharacters.toLocaleString("en-US")} characters.`,
    );
  }
  return value;
}

function voiceSamples(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new RevisionValidationError("Voice samples must be an array of strings.");
  }
  if (value.length > MAX_VOICE_SAMPLES) {
    throw new RevisionValidationError(
      `Voice samples cannot contain more than ${MAX_VOICE_SAMPLES} samples.`,
    );
  }

  let total = 0;
  const samples = value.map((sample, index) => {
    if (typeof sample !== "string" || sample.trim().length === 0) {
      throw new RevisionValidationError(
        `Voice sample ${index + 1} must be a non-empty string.`,
      );
    }
    const size = countCharacters(sample);
    if (size > MAX_VOICE_SAMPLE_CHARACTERS) {
      throw new RevisionValidationError(
        `Each voice sample cannot exceed ${MAX_VOICE_SAMPLE_CHARACTERS.toLocaleString("en-US")} characters.`,
      );
    }
    total += size;
    return sample;
  });

  if (total > MAX_VOICE_SAMPLE_TOTAL_CHARACTERS) {
    throw new RevisionValidationError(
      `Voice samples cannot exceed ${MAX_VOICE_SAMPLE_TOTAL_CHARACTERS.toLocaleString("en-US")} characters in total.`,
    );
  }

  return samples;
}

export function validateRevisionInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RevisionValidationError("Request body must be a JSON object.");
  }

  const { draft } = body;
  const direction = body.direction ?? "";
  const mode = body.mode ?? "edit";
  const ceiling = body.ceiling ?? false;

  if (typeof draft !== "string" || draft.trim().length === 0) {
    throw new RevisionValidationError("Draft must be a non-empty string.");
  }

  if (countCharacters(draft) > MAX_DRAFT_CHARACTERS) {
    throw new RevisionValidationError(
      `Draft cannot exceed ${MAX_DRAFT_CHARACTERS.toLocaleString("en-US")} characters.`,
    );
  }

  if (typeof direction !== "string") {
    throw new RevisionValidationError("Direction must be a string.");
  }

  if (countCharacters(direction) > MAX_CONTEXT_CHARACTERS) {
    throw new RevisionValidationError(
      `Direction cannot exceed ${MAX_CONTEXT_CHARACTERS.toLocaleString("en-US")} characters.`,
    );
  }

  if (typeof mode !== "string" || !ALLOWED_MODES.has(mode)) {
    throw new RevisionValidationError(
      `Mode must be one of: ${Array.from(ALLOWED_MODES).join(", ")}.`,
    );
  }

  if (typeof ceiling !== "boolean") {
    throw new RevisionValidationError("Ceiling must be a boolean.");
  }

  return {
    draft,
    direction,
    mode,
    ceiling,
    audience: optionalString(body.audience, "Audience", 4_000),
    purpose: optionalString(body.purpose, "Purpose", 4_000),
    genre: optionalString(body.genre, "Genre", 1_000),
    sourceContext: optionalString(body.sourceContext, "Source context"),
    voiceSamples: voiceSamples(body.voiceSamples),
  };
}

export function publicRevisionData(revision) {
  return {
    draft: revision.draft,
    direction: revision.direction,
    mode: revision.mode,
    ceiling: revision.ceiling,
    ...(revision.audience ? { audience: revision.audience } : {}),
    ...(revision.purpose ? { purpose: revision.purpose } : {}),
    ...(revision.genre ? { genre: revision.genre } : {}),
    ...(revision.sourceContext ? { sourceContext: revision.sourceContext } : {}),
    ...(revision.voiceSamples?.length ? { voiceSamples: revision.voiceSamples } : {}),
  };
}
