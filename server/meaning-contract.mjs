/**
 * Bounded, local scaffolding for preservation review. This is not a semantic
 * parser: lexical matches never establish entailment, identity, or consistency.
 * All offsets refer to the unmodified input, in UTF-16 code units.
 */
export const MEANING_CONTRACT_LIMITS = Object.freeze({
  inputCharacters: 60_000,
  clauses: 128,
  clauseCharacters: 640,
  anchorsPerClause: 24,
  formalChecks: 32,
  fidelityCandidates: 24,
});

const CAVEAT = "A bounded literal meaning-preservation scaffold, not a complete claim map or semantic proof. Review candidates can be benign paraphrases or requested changes. Confirm attribution, identity, scope, genre, and exceptions; absence of a signal does not certify fidelity.";
const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUMBER_PATTERN = "(?:[+-]?(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\.\\d+)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const NUMERIC_PATTERN = "([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))";
const DURATION = new RegExp(`(?<![\\p{L}\\p{N}_.])(${NUMBER_PATTERN})[\\s‐‑–-]+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\\b`, "giu");
const QUANTITY = new RegExp(`(?<![\\p{L}\\p{N}_.])(${NUMBER_PATTERN})(?:\\s*(%|percent(?:age points?)?|kg|kilograms?|g|grams?|km|kilomet(?:er|re)s?|m|met(?:er|re)s?|cm|centimet(?:er|re)s?|crates?|boxes|box|participants?|people|patients?|members?|votes?|units?|dollars?|euros?|pounds?|tickets?|bottles?|copies|pages?|students?|items?))(?![\\p{L}\\p{N}_])`, "giu");
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const CONTENT_STOP = new Set("a an the and or but so as of to in on for by with at from after before during some certain several few all every each no none only may might could can would should will must is are was were be been being has have had do does did not it its they their them this that these those we our us i my you your reported report reports says said self approximately about roughly possibly possible perhaps probably likely".split(" "));
const SUBJECT_VERB = /\b(?:may|might|could|can|would|should|will|must|is|are|was|were|has|have|had|holds?|held|weighs?|weighed|contains?|contained|received?|receives|owns?|owned|reported?|reports|said|says?|show(?:s|ed)?|suggest(?:s|ed)?|improv(?:e[sd]?|ing)|declin(?:e[sd]?|ing)|arriv(?:e[sd]?|ing)|depart(?:s|ed)?|left|remains?|remained|costs?|cost|scored?|scores|learn(?:s|ed)?|knows?|knew|requires?|required|reduces?|reduced|prevent(?:s|ed)?|approved?|approves|check(?:s|ed|ing)?|verif(?:y|ies|ied|ying)|confirm(?:s|ed|ing)?|audit(?:s|ed|ing)?|validat(?:e|es|ed|ing))\b/i;

function normal(text) { return text.toLowerCase().replace(/[’]/g, "'").replace(/[‐‑–]/g, "-").replace(/\s+/g, " ").trim(); }
function number(text) { return NUMBER_WORDS[normal(text)] ?? Number(text.replace(/,/g, "")); }
function span(text, start, end) { return { start, end, text: text.slice(start, end) }; }
function trimSpan(text, start, end) {
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return span(text, start, end);
}
function sampled(items, limit) {
  if (items.length <= limit) return items;
  if (limit <= 0) return [];
  if (limit === 1) return [items[0]];
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * (items.length - 1) / (limit - 1))]);
}
function unitName(unit) {
  const value = normal(unit);
  if (/^(?:kg|kilograms?)$/.test(value)) return ["mass:g", 1000];
  if (/^(?:g|grams?)$/.test(value)) return ["mass:g", 1];
  if (/^(?:km|kilomet(?:er|re)s?)$/.test(value)) return ["distance:m", 1000];
  if (/^(?:m|met(?:er|re)s?)$/.test(value)) return ["distance:m", 1];
  if (/^(?:cm|centimet(?:er|re)s?)$/.test(value)) return ["distance:m", 0.01];
  if (/^(?:percent|%)$/.test(value)) return ["percentage", 1];
  if (/^percentage points?$/.test(value)) return ["percentage-points", 1];
  return [{ boxes: "box", people: "person", copies: "copy" }[value] ?? value.replace(/s$/, ""), 1];
}
function durationValue(amount, unit) {
  const name = normal(unit).replace(/s$/, "");
  const multiplier = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 }[name];
  return multiplier ? `seconds:${amount * multiplier}` : `${name}:${amount}`;
}
function kindOf(text) {
  if (/[?]\s*$/.test(text)) return "question";
  if (/[“”"]/.test(text) || /^\s*['‘].+['’]\s*[.!]?\s*$/.test(text)) return "contains-quotation";
  if (/^\s*(?:suppose|imagine|what if|for example|for instance|in (?:a|the|this) (?:story|poem|novel|fictional world))\b/i.test(text)) return "hypothetical-or-illustrative";
  if (/\b(?:false|incorrect|wrong|absurd|impossible)\s+(?:claim|equation|assertion)|\b(?:denies?|denied|disputes?|disputed|rejects?|rejected)\b/i.test(text)) return "nonasserted-or-disputed";
  return "statement-candidate";
}
function subjectOf(text) {
  let leading = text.replace(/^\s*(?:according to [^,]{1,80},\s*|(?:after|before|during|at|on|in)\s+[^,]{1,60},\s*)/i, "");
  leading = leading.replace(/^\s*(?:and|but|however|therefore),?\s+/i, "");
  const verb = SUBJECT_VERB.exec(leading);
  if (!verb || verb.index === 0 || verb.index > 80) return null;
  const result = normal(leading.slice(0, verb.index)).replace(/^(?:the|a|an|some|certain|several|a few|all|every|each|no|only)\s+/, "").replace(/\s+(?:possibly|perhaps|maybe|probably|likely|apparently|independently)$/, "");
  if (!result || /[,:;!?]|\b(?:if|unless|except|not|according|possibly|perhaps|maybe)\b/.test(result)) return null;
  return result;
}
function anchorRecords(clause) {
  const text = clause.span.text;
  const records = [];
  const add = (kind, match, canonical) => records.push({ kind, span: { start: clause.span.start + match.index, end: clause.span.start + match.index + match[0].length, text: match[0] }, canonical });
  for (const match of text.matchAll(/\b(?:may|might|could|possibly|perhaps|maybe|possible|potentially|likely|probably|apparently|appears? to|seems? to|suggest(?:s|ed)?|cannot|can't|must|should|not|never)\b/gi)) {
    const value = normal(match[0]);
    const canonical = /^(?:may|might|could|possibly|perhaps|maybe|possible|potentially)$/.test(value) ? "possibility" : /^(?:likely|probably)$/.test(value) ? "probability" : /^(?:apparently|appears? to|seems? to|suggest(?:s|ed)?)$/.test(value) ? "tentative-evidence" : /^(?:cannot|can't)$/.test(value) ? "inability-or-prohibition" : value === "not" ? "negation" : value;
    add("modality", match, canonical);
  }
  for (const match of text.matchAll(/\b(?:some|certain|several|a few|all|every|each|none|no|only|at least|at most|up to|approximately|roughly|about)\b/gi)) {
    const value = normal(match[0]);
    add("quantifier", match, /^(?:some|certain)$/.test(value) ? "limited-unspecified" : /^(?:all|every|each)$/.test(value) ? "universal" : /^(?:approximately|roughly|about)$/.test(value) ? "approximate" : value);
  }
  for (const match of text.matchAll(/\b(?:self[‐‑–-]reported?|reported?|reports|said|says?|according to\s+[^,;.!?]{1,80})\b/gi)) add("attribution", match, /^according to/i.test(match[0]) ? normal(match[0]) : "attributed-report");
  // Preserve the explicitly stated checking method separately from negation.
  // 'Not independently checked' does not say no checking of any kind occurred.
  // Reordered forms normalize; different checking verbs remain distinguishable.
  const checkingVerb = "(?:check(?:s|ed|ing)?|verif(?:y|ies|ied|ying)|confirm(?:s|ed|ing)?|audit(?:s|ed|ing)?|validat(?:e|es|ed|ing))";
  const independentCheck = new RegExp(`\\b(?:independently\\s+(${checkingVerb})|(${checkingVerb})\\s+independently)\\b`, "gi");
  for (const match of text.matchAll(independentCheck)) {
    const verb = normal(match[1] ?? match[2]);
    const family = verb.startsWith("verif") ? "verify" : verb.startsWith("validat") ? "validate" : verb.startsWith("confirm") ? "confirm" : verb.startsWith("audit") ? "audit" : "check";
    add("checking-method", match, `independent:${family}`);
  }
  for (const match of text.matchAll(DURATION)) add("duration", match, durationValue(number(match[1]), match[2]));
  for (const match of text.matchAll(ISO_DATE)) add("date", match, match[0]);
  for (const match of text.matchAll(QUANTITY)) {
    const [unit, factor] = unitName(match[2]);
    const literal = Object.hasOwn(NUMBER_WORDS, normal(match[1])) ? String(NUMBER_WORDS[normal(match[1])]) : match[1].replace(/,/g, "");
    const amount = decimalRational(literal);
    const scaled = amount ? arithmeticRational(amount, decimalRational(String(factor)), "*") : null;
    // Never merge different supplied counts by rounding to a precision budget.
    // Unsupported numbers retain their literal identity, including scale: a
    // failed normalization is not evidence of numerical equivalence.
    add("quantity", match, `${unit}:${scaled && boundedRational(scaled) ? rationalLabel(scaled) : `literal:${literal}*${factor}`}`);
  }
  for (const match of text.matchAll(/\b(?:unless|except(?: for)?|provided(?: that)?|only if|if|without|subject to|excluding|other than)\b[^;.!?]{0,100}/gi)) {
    // Preserve the literal condition, not merely presence of the word "if".
    add("condition-or-exception", match, normal(match[0]));
  }
  return records.sort((left, right) => left.span.start - right.span.start);
}
function allClauses(draft) {
  const scanned = draft.slice(0, MEANING_CONTRACT_LIMITS.inputCharacters);
  const clauses = [];
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  for (const paragraph of scanned.matchAll(/[^\r\n]+/g)) {
    for (const sentence of segmenter.segment(paragraph[0])) {
      const base = paragraph.index + sentence.index;
      // Split semicolons and clearly repeated-subject coordination. Commas are
      // not split: a preceding condition/attribution can govern the whole sentence.
      // Do not distribute those frames over conjunctions without parsing scope.
      const parts = /[“”"]/.test(sentence.segment) ? [{ 0: sentence.segment, index: 0 }] : [...sentence.segment.matchAll(/[^;]+;?/g)].flatMap((part) => {
        if (/\b(?:if|unless|except|according to)\b/i.test(part[0])) return [part];
        const boundaries = [{ start: 0, end: 0 }, ...[...part[0].matchAll(/\s+(?:and|but)\s+/gi)].filter((match) => subjectOf(part[0].slice(0, match.index)) && subjectOf(part[0].slice(match.index + match[0].length))).map((match) => ({ start: match.index, end: match.index + match[0].length })), { start: part[0].length, end: part[0].length }];
        return boundaries.slice(0, -1).map((boundary, index) => ({ 0: part[0].slice(boundary.end, boundaries[index + 1].start), index: part.index + boundary.end }));
      });
      for (const part of parts) {
        const origin = base + part.index;
        const finish = origin + part[0].length;
        for (let start = origin; start < finish;) {
          let end = Math.min(finish, start + MEANING_CONTRACT_LIMITS.clauseCharacters);
          if (end < finish) {
            const space = scanned.lastIndexOf(" ", end);
            if (space > start + MEANING_CONTRACT_LIMITS.clauseCharacters / 2) end = space;
          }
          const evidence = trimSpan(draft, start, end);
          if (evidence.text) {
            const clause = { id: `meaning-${clauses.length + 1}`, span: evidence, kind: kindOf(sentence.segment), fragment: start !== origin || end !== finish || (draft.length > scanned.length && end === scanned.length), subject: subjectOf(evidence.text) };
            clause.anchors = anchorRecords(clause);
            clauses.push(clause);
          }
          start = end;
        }
      }
    }
  }
  return clauses;
}

// Equality is exact for the deliberately small decimal grammar, not an
// arbitrary relative/absolute floating-point tolerance. Bounded operands keep
// BigInt work small; unsupported precision/magnitude yields no formal verdict.
function decimalRational(text) {
  const match = text.match(/^([+-]?)(\d*)(?:\.(\d+))?$/);
  if (!match || (!match[2] && !match[3])) return null;
  const fraction = match[3] ?? "";
  if (text.length > 36 || fraction.length > 18) return null;
  const value = { n: BigInt(`${match[1] === "-" ? "-" : ""}${match[2] || "0"}${fraction}`), d: 10n ** BigInt(fraction.length) };
  return boundedRational(value) ? value : null;
}
function boundedRational(value) { return value.d > 0n && (value.n < 0n ? -value.n : value.n) <= BigInt(Number.MAX_SAFE_INTEGER) * value.d; }
function equalRationals(left, right) { return left.n * right.d === right.n * left.d; }
function rationalNumber(value) { return Number(value.n) / Number(value.d); }
function rationalLabel(value) {
  let left = value.n < 0n ? -value.n : value.n;
  let right = value.d;
  while (right) [left, right] = [right, left % right];
  const n = value.n / left, d = value.d / left;
  return d === 1n ? String(n) : `${n}/${d}`;
}
function arithmeticRational(left, right, operation) {
  if (operation === "+") return { n: left.n * right.d + right.n * left.d, d: left.d * right.d };
  if (/[−-]/.test(operation)) return { n: left.n * right.d - right.n * left.d, d: left.d * right.d };
  if (/[*×]/.test(operation)) return { n: left.n * right.n, d: left.d * right.d };
  if (right.n === 0n) return null;
  const sign = right.n < 0n ? -1n : 1n;
  return { n: left.n * right.d * sign, d: left.d * right.n * sign };
}
function utcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** Only complete explicit templates are computed, never narrative inferences. */
function formalRecords(clauses) {
  const checks = [];
  for (const clause of clauses) {
    if (clause.fragment || clause.kind !== "statement-candidate") continue;
    const text = clause.span.text.trim().replace(/[.;]$/, "");
    const expression = text.replace(/^The (?:equation|calculation|sum|conversion) is\s+/i, "");
    const arithmetic = expression.match(new RegExp(`^${NUMERIC_PATTERN}\\s*([+*/×−-])\\s*${NUMERIC_PATTERN}\\s*=\\s*${NUMERIC_PATTERN}$`));
    if (arithmetic) {
      const left = decimalRational(arithmetic[1]), right = decimalRational(arithmetic[3]), stated = decimalRational(arithmetic[4]);
      const op = arithmetic[2];
      if (!left || !right || !stated) continue;
      const expected = arithmeticRational(left, right, op);
      if (expected && boundedRational(expected)) checks.push({ kind: "explicit-arithmetic", status: equalRationals(stated, expected) ? "satisfied" : "mismatch", evidence: clause.span, stated: rationalNumber(stated), expected: rationalNumber(expected), statedExact: rationalLabel(stated), expectedExact: rationalLabel(expected), operation: op, scope: "Exact rational equality of the supported decimal operands under ordinary arithmetic; numeric display fields may round, exact fields do not. Not a judgment about the surrounding prose." });
      continue;
    }
    const units = expression.match(new RegExp(`^${NUMERIC_PATTERN}\\s*(kg|kilograms?|g|grams?|km|kilomet(?:er|re)s?|m|met(?:er|re)s?|cm|centimet(?:er|re)s?)\\s*(?:=|equals|is equal to)\\s*${NUMERIC_PATTERN}\\s*(kg|kilograms?|g|grams?|km|kilomet(?:er|re)s?|m|met(?:er|re)s?|cm|centimet(?:er|re)s?)$`, "i"));
    if (units) {
      const [leftUnit, leftFactor] = unitName(units[2]);
      const [rightUnit, rightFactor] = unitName(units[4]);
      if (leftUnit !== rightUnit) continue;
      const left = decimalRational(units[1]), right = decimalRational(units[3]);
      if (!left || !right) continue;
      const expected = arithmeticRational(left, decimalRational(String(leftFactor)), "*");
      const stated = arithmeticRational(right, decimalRational(String(rightFactor)), "*");
      if (boundedRational(expected) && boundedRational(stated)) checks.push({ kind: "explicit-unit-equivalence", status: equalRationals(expected, stated) ? "satisfied" : "mismatch", evidence: clause.span, expected: rationalNumber(expected), stated: rationalNumber(stated), expectedExact: rationalLabel(expected), statedExact: rationalLabel(stated), normalizedUnit: leftUnit, scope: "Exact rational metric-unit equality; numeric display fields may round, exact fields do not. Approximate quantities and cross-dimensional conversions are excluded." });
      continue;
    }
    // Require an explicit exactness claim: ordinary prose percentages are
    // often deliberately rounded and must not be turned into false errors.
    const percentChange = expression.match(new RegExp(`^The percentage (increase|decrease|change) from ${NUMERIC_PATTERN} to ${NUMERIC_PATTERN} is exactly ${NUMERIC_PATTERN}\\s*(?:percent|%)$`, "i"));
    const exactRatio = expression.match(new RegExp(`^${NUMERIC_PATTERN}\\s+(?:out of|of)\\s+${NUMERIC_PATTERN}\\s+(?:is|equals)\\s+exactly\\s+${NUMERIC_PATTERN}\\s*(?:percent|%)$`, "i"));
    if (percentChange || exactRatio) {
      const base = decimalRational(percentChange ? percentChange[2] : exactRatio[2]);
      const other = decimalRational(percentChange ? percentChange[3] : exactRatio[1]);
      const stated = decimalRational(percentChange ? percentChange[4] : exactRatio[3]);
      if (!base || !other || !stated || base.n <= 0n || other.n < 0n) continue;
      const difference = percentChange
        ? arithmeticRational(percentChange[1].toLowerCase() === "decrease" ? base : other, percentChange[1].toLowerCase() === "decrease" ? other : base, "-")
        : other;
      const expected = arithmeticRational(arithmeticRational(difference, base, "/"), decimalRational("100"), "*");
      if (boundedRational(expected)) checks.push({
        kind: percentChange ? "explicit-exact-percentage-change" : "explicit-exact-percentage-ratio",
        status: equalRationals(stated, expected) ? "satisfied" : "mismatch",
        evidence: clause.span,
        expected: rationalNumber(expected), stated: rationalNumber(stated),
        expectedExact: rationalLabel(expected), statedExact: rationalLabel(stated),
        scope: "Exact rational percentage equality only for this complete explicitly exact template, with a positive supplied denominator and nonnegative operands. Does not verify measurements, populations, causal claims, or ordinary rounded percentages.",
      });
      continue;
    }
    const dateSum = expression.match(/^(\d{4}-\d{2}-\d{2})\s*(?:\+|plus)\s*(\d{1,5})\s+days?\s*(?:=|is|equals)\s*(\d{4}-\d{2}-\d{2})$/i);
    if (dateSum) {
      const start = utcDate(dateSum[1]), end = utcDate(dateSum[3]);
      if (!start || !end) continue;
      start.setUTCDate(start.getUTCDate() + Number(dateSum[2]));
      // The supported grammar uses four-digit years. Expanded ISO years must
      // not be sliced into a malformed expected date or treated as supported.
      if (start.getUTCFullYear() < 0 || start.getUTCFullYear() > 9999) continue;
      const expected = start.toISOString().slice(0, 10);
      checks.push({ kind: "explicit-calendar-addition", status: expected === dateSum[3] ? "satisfied" : "mismatch", evidence: clause.span, expected, stated: dateSum[3], scope: "Gregorian calendar days between explicit ISO dates; not working days or elapsed local-clock hours." });
      continue;
    }
    const order = expression.match(/^(\d{4}-\d{2}-\d{2})\s+(?:is\s+)?(before|after)\s+(\d{4}-\d{2}-\d{2})$/i);
    if (order) {
      const left = utcDate(order[1]), right = utcDate(order[3]);
      if (!left || !right) continue;
      const holds = normal(order[2]) === "before" ? left < right : left > right;
      checks.push({ kind: "explicit-date-order", status: holds ? "satisfied" : "mismatch", evidence: clause.span, expected: holds, stated: true, relation: normal(order[2]), scope: "Strict ordering of the two explicit Gregorian ISO dates only." });
    }
  }
  return checks;
}

export function buildMeaningContract(draft) {
  if (typeof draft !== "string") throw new TypeError("Draft must be a string.");
  const all = allClauses(draft);
  const protectedClauses = all.filter(({ anchors }) => anchors.length > 0);
  const selected = sampled(protectedClauses, MEANING_CONTRACT_LIMITS.clauses);
  const chosen = new Set(selected.map(({ id }) => id));
  selected.push(...sampled(all.filter(({ id }) => !chosen.has(id)), MEANING_CONTRACT_LIMITS.clauses - selected.length));
  selected.sort((left, right) => left.span.start - right.span.start);
  const formalChecks = formalRecords(all);
  const mismatches = formalChecks.filter(({ status }) => status === "mismatch");
  const retainedChecks = [...mismatches, ...formalChecks.filter(({ status }) => status !== "mismatch")].slice(0, MEANING_CONTRACT_LIMITS.formalChecks).sort((left, right) => left.evidence.start - right.evidence.start);
  return {
    schemaVersion: 1,
    kind: "bounded-meaning-contract",
    clauses: selected.map((clause) => ({ ...clause, anchorsOmitted: Math.max(0, clause.anchors.length - MEANING_CONTRACT_LIMITS.anchorsPerClause), anchors: sampled(clause.anchors, MEANING_CONTRACT_LIMITS.anchorsPerClause) })),
    formalChecks: retainedChecks,
    coverage: {
      offsetUnit: "UTF-16 code units into original input",
      inputCharacters: draft.length,
      scannedCharacters: Math.min(draft.length, MEANING_CONTRACT_LIMITS.inputCharacters),
      inputTruncated: draft.length > MEANING_CONTRACT_LIMITS.inputCharacters,
      clausesDetected: all.length,
      clausesRetained: selected.length,
      clausesOmitted: all.length - selected.length,
      clauseFragments: all.filter(({ fragment }) => fragment).length,
      anchorsOmitted: selected.reduce((total, { anchors }) => total + Math.max(0, anchors.length - MEANING_CONTRACT_LIMITS.anchorsPerClause), 0),
      selection: "Uniformly sample signal-bearing clauses first, then other clauses across the scanned input.",
      formalCheckScope: "All complete detected clauses within input limit; only explicit supported standalone templates.",
      formalChecksDetected: formalChecks.length,
      formalChecksOmitted: Math.max(0, formalChecks.length - MEANING_CONTRACT_LIMITS.formalChecks),
      formalCheckSelection: "Prioritize mismatches before satisfied checks, retaining original span order within the selected evidence.",
      formalMismatchesDetected: mismatches.length,
      formalMismatchesRetained: retainedChecks.filter(({ status }) => status === "mismatch").length,
      formalMismatchesOmitted: Math.max(0, mismatches.length - MEANING_CONTRACT_LIMITS.formalChecks),
      semanticCompleteness: false,
    },
    caveat: CAVEAT,
  };
}

function tokens(text) { return new Set(normal(text).match(/[\p{L}]+/gu)?.filter((word) => !CONTENT_STOP.has(word)) ?? []); }
function overlap(left, right) {
  if (!left.size || !right.size) return 0;
  return [...left].filter((word) => right.has(word)).length / Math.max(left.size, right.size);
}
function bestMatches(source, candidates) {
  const exact = candidates.filter(({ span: evidence }) => normal(evidence.text).replace(/[.;]$/, "") === normal(source.span.text).replace(/[.;]$/, ""));
  if (exact.length) return exact.slice(0, 1);
  const sourceTokens = tokens(source.span.text);
  return candidates.map((item) => {
    const contentOverlap = overlap(sourceTokens, tokens(item.span.text));
    const sameSubject = source.subject && item.subject === source.subject;
    const incompatibleSubject = source.subject && item.subject && source.subject !== item.subject;
    return { item, contentOverlap, score: contentOverlap + (sameSubject ? 1 : 0) - (incompatibleSubject ? 1 : 0) };
  }).filter(({ score, contentOverlap }) => score >= 0.25 && contentOverlap > 0)
    .sort((a, b) => b.score - a.score || a.item.span.start - b.item.span.start)
    .slice(0, 1).map(({ item }) => item);
}
function preserved(anchor, match) {
  if (match.anchors.some((other) => other.kind === anchor.kind && other.canonical === anchor.canonical)) return true;
  if (anchor.kind === "condition-or-exception") {
    // Lexical reordering is reviewable; literal containment alone is safe to
    // recognize here. No broad synonym list is treated as semantic equivalence.
    return normal(match.span.text).includes(anchor.canonical);
  }
  return false;
}

export function compareMeaningContract(contract, candidate, { mode = "rewrite" } = {}) {
  if (!contract || contract.kind !== "bounded-meaning-contract" || !Array.isArray(contract.clauses)) throw new TypeError("A built meaning contract is required.");
  if (typeof candidate !== "string") throw new TypeError("Candidate must be a string.");
  const result = buildMeaningContract(candidate);
  const enabled = !["analyze", "draft"].includes(mode);
  const possible = result.clauses.filter(({ fragment, kind }) => !fragment && kind === "statement-candidate");
  const candidates = [];
  let considered = 0;
  let unaligned = 0;
  let ignored = 0;
  // Formal mismatches concern what the candidate actually says, not whether it
  // repeats the source. They require disposition in every mode/outcome, and go
  // first so a capped review packet cannot hide them behind lexical signals.
  let detected = result.coverage.formalMismatchesOmitted;
  for (const check of result.formalChecks.filter(({ status }) => status === "mismatch")) {
    detected += 1;
    if (candidates.length >= MEANING_CONTRACT_LIMITS.fidelityCandidates) continue;
    candidates.push({
      id: `meaning-review-${candidates.length + 1}`,
      kind: `formal-${check.kind}-mismatch`,
      status: "requires-review",
      clauseId: null,
      subject: null,
      originalEvidence: [],
      candidateEvidence: [check.evidence],
      anchorEvidence: [],
      formalCheck: check,
      reason: "The candidate contains a supported explicit calculation that fails within the attached formalCheck.scope. Review this exact candidate span even in analysis or drafting mode. This is a scoped calculation mismatch, not proof that the prose is defective: an explicit illustration, quoted convention, or other text-supported exception can make correction inappropriate. Do not require the result to repeat or correct unrelated source calculations.",
    });
  }
  const add = (kind, source, match, anchors, reason) => {
    detected += 1;
    if (candidates.length >= MEANING_CONTRACT_LIMITS.fidelityCandidates) return;
    candidates.push({ id: `meaning-review-${candidates.length + 1}`, kind, status: "requires-review", clauseId: source.id, subject: source.subject, originalEvidence: [source.span], candidateEvidence: match ? [match.span] : [], anchorEvidence: anchors.map(({ span: evidence }) => evidence), reason });
  };
  if (enabled) for (const source of contract.clauses) {
    if (source.fragment || source.kind !== "statement-candidate") { ignored += 1; continue; }
    if (!source.anchors.length) continue;
    considered += 1;
    const [match] = bestMatches(source, possible);
    if (!match) {
      unaligned += 1;
      add("qualified-claim-not-aligned", source, null, source.anchors, "No sufficiently similar complete clause was aligned. The claim may have been omitted, merged, or paraphrased; do not call this a confirmed loss without semantic review.");
      continue;
    }
    const missing = source.anchors.filter((anchor) => !preserved(anchor, match));
    for (const kind of [...new Set(missing.map((anchor) => anchor.kind))]) {
      add(`${kind}-changed-or-not-recovered`, source, match, missing.filter((anchor) => anchor.kind === kind), `A source ${kind} anchor was not recovered in the aligned clause. Check equivalent paraphrases, shared scope, and authorized changes before reporting a fidelity error; numbers are linked to this clause/subject, not a whole-document inventory.`);
    }
  }
  return {
    schemaVersion: 1,
    kind: "meaning-preservation-review",
    enabled,
    candidates,
    formalChecks: result.formalChecks,
    coverage: { original: contract.coverage, candidate: result.coverage, clausesCompared: considered, unalignedClauses: unaligned, nonassertedOrFragmentClausesSkipped: ignored, findingsDetected: detected, findingsOmitted: Math.max(0, detected - candidates.length), formalMismatchCandidatesDetected: result.coverage.formalMismatchesDetected, formalMismatchCandidatesRetained: candidates.filter(({ formalCheck }) => Boolean(formalCheck)).length, formalMismatchCandidatesOmitted: result.coverage.formalMismatchesDetected - candidates.filter(({ formalCheck }) => Boolean(formalCheck)).length, semanticCompleteness: false, matching: "One lexical/subject-aligned clause; no pronoun resolution, cross-clause entailment, or evidence that unaligned claims are absent." },
    caveat: enabled ? CAVEAT : `Fidelity comparison is disabled in ${mode} mode because the result need not restate the draft. Candidate formal mismatches still require scoped review in every mode. ${CAVEAT}`,
  };
}

export function summarizeMeaningContract(contract) {
  return { schemaVersion: contract.schemaVersion, kind: contract.kind, coverage: contract.coverage, clauseCount: contract.clauses.length, anchorCount: contract.clauses.reduce((total, clause) => total + clause.anchors.length, 0), formalCheckCount: contract.formalChecks.length, formalMismatchCount: contract.formalChecks.filter(({ status }) => status === "mismatch").length };
}
