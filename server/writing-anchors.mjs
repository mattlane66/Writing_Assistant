import { createHash } from "node:crypto";
import { z } from "zod";

const Input = z.object({
  text_processing_authorized: z.literal(true),
  text: z.string().min(1).max(96000),
  quotes: z.array(z.object({
    quote: z.string().min(1).max(12000),
    occurrence: z.number().int().min(1).max(96000).nullable(),
  }).strict()).min(1).max(24),
}).strict();
const Span = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), occurrence: z.number().int().positive() }).strict();
const Output = z.object({
  offset_encoding: z.literal("UTF-16-code-units"), text_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  matches: z.array(z.object({ quote: z.string(), status: z.enum(["resolved", "ambiguous", "not-found", "occurrence-out-of-range"]),
    total_occurrences: z.number().int().nonnegative(), selected: Span.nullable(),
    first_matches: z.array(Span).max(8), matches_truncated: z.boolean() }).strict()),
  model_calls: z.literal(0), semantic_certification: z.literal(false), caveat: z.string(),
}).strict();
const fail = message => { throw Object.assign(new TypeError(message), { status: 400 }); };
// A quote must not select half of a supplementary Unicode character.
const splitSurrogate = (text, at) => at > 0 && at < text.length
  && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]);

export function locateWritingQuotes(args) {
  const parsed = Input.safeParse(args);
  if (!parsed.success) fail("Invalid quote-location arguments; explicit exact-text processing authorization is required.");
  const input = parsed.data;
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > 240000) fail("Quote-location request exceeds its aggregate byte bound.");
  const matches = input.quotes.map(({ quote, occurrence }) => {
    let cursor = 0, total = 0, requested = null;
    const first = [];
    while (cursor <= input.text.length - quote.length) {
      const start = input.text.indexOf(quote, cursor);
      if (start < 0) break;
      const end = start + quote.length;
      cursor = start + 1; // Include overlapping exact matches, not fuzzy matches.
      if (splitSurrogate(input.text, start) || splitSurrogate(input.text, end)) continue;
      const span = { start, end, occurrence: ++total };
      if (first.length < 8) first.push(span);
      if (total === occurrence) requested = span;
    }
    const selected = occurrence === null ? total === 1 ? first[0] : null : requested;
    const status = !total ? "not-found" : occurrence !== null && !selected ? "occurrence-out-of-range"
      : !selected ? "ambiguous" : "resolved";
    return { quote, status, total_occurrences: total, selected, first_matches: first, matches_truncated: total > first.length };
  });
  return Output.parse({ offset_encoding: "UTF-16-code-units", text_sha256: createHash("sha256").update(input.text).digest("hex"), matches,
    model_calls: 0, semantic_certification: false,
    caveat: "Exact positions only, not entailment, applicability, editorial judgment, consent authentication or workflow completion. Repeated quotes require an explicitly selected occurrence. Copy returned positions only into the identical source; changed text needs fresh locations. No normalization, fuzzy repair, model calls or intentional application persistence." });
}

export const WRITING_ANCHOR_TOOL = {
  name: "locate_writing_quotes", title: "Locate exact writing evidence",
  description: "With explicit exact-text processing permission, compute exact UTF-16 start/end positions for quotes before workflow/document evidence records. Pass occurrence null for a unique quote. Repeated quotes return ambiguous: inspect context and explicitly select the intended one-based occurrence, never assume the first. Returns at most eight match previews per quote. Does not rewrite, normalize, infer evidence or complete a workflow. No model calls or durable storage; exact text stays out of retrieval.",
  input: z.toJSONSchema(Input), output: z.toJSONSchema(Output), call: locateWritingQuotes,
};
