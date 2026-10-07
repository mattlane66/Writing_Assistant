/**
 * A literal, local evidence graph for editorial review. This module does not
 * resolve pronouns, infer unstated premises, or decide semantic consistency.
 * Every text-bearing span uses offsets into the unmodified input string.
 */
export const TEXT_WORLD_LIMITS = Object.freeze({
  inputCharacters: 60_000,
  assertions: 72,
  assertionCharacters: 360,
  entities: 32,
  mentionsPerEntity: 6,
  timeAnchors: 48,
  quantityAnchors: 48,
  ruleEvidence: 24,
  knowledgeEvidence: 24,
  argumentNodes: 32,
  argumentEdges: 24,
  potentialConflicts: 20,
  fidelityCandidates: 16,
});

const TIME = /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}|(?:19|20)\d{2}|\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?|noon|midnight|today|tomorrow|yesterday|now|later|earlier|meanwhile|previously|subsequently|next\s+(?:day|week|month|year)|last\s+(?:day|week|month|year))\b/gi;
const WORD_NUMBER = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const QUANTITY = /(?<![\p{L}\p{N}_.])(?:[$£€]\s*)?(?:[+-]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s*(?:percentage points?|percent\b|%|°[CF]\b|kilograms?\b|grams?\b|kilometers?\b|kilometres?\b|meters?\b|metres?\b|centimeters?\b|centimetres?\b|kg\b|km\b|cm\b|g\b|m\b|lbs?\b|pounds?\b|ounces?\b|oz\b|miles?\b|hours?\b|minutes?\b|seconds?\b|days?\b|weeks?\b|months?\b|years?\b|people\b|members?\b|votes?\b|units?\b|boxes\b|box\b|dollars?\b))?(?![\p{L}\p{N}_]|\.\d)/giu;
const RULE = /\b(?:must|cannot|can't|never|always|only if|only\s+\w+(?:\s+\w+){0,3}\s+can|required|prohibited|forbidden|rule|exception|defined as)\b/i;
const KNOWLEDGE = /\b(?:knows?|knew|known(?!\s+as)|learn(?:ed|s)?|discover(?:ed|s)?|remember(?:ed|s)?|hear|hears|heard|told|inform(?:ed|s)?|realiz(?:e|ed|es)|believ(?:e|ed|es)|witness(?:ed|es)?)\b/i;
const ARGUMENT = /\b(?:therefore|thus|hence|it follows|premise|conclusion|objection|consequently)\b/i;
const ARGUMENT_REQUEST = /\b(?:argument(?:ation|ative)?|premises?|conclusions?|cogenc[ey]|cogent|logical?|reasoning|fallac(?:y|ies))\b/i;
const ENTITY_STOP = new Set("a an and as at before after but by for from he her his i if in it its later meanwhile next no on or our she so that the their then they this those to we when while with you today tomorrow yesterday therefore thus however premise conclusion objection at noon midnight".split(" "));
const OPPOSITES = new Map([["open", "closed"], ["closed", "open"], ["alive", "dead"], ["dead", "alive"], ["locked", "unlocked"], ["unlocked", "locked"]]);
const CAVEAT = "Literal pattern evidence, not a semantic world model or a finding. Confirm identity, quotation, time, scope, genre, and exceptions before reporting a conflict. Missing evidence does not establish consistency.";

function normal(value) {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function makeSpan(draft, start, end) {
  return { start, end, text: draft.slice(start, end) };
}

function trimmedSpan(draft, start, end) {
  while (start < end && /\s/.test(draft[start])) start += 1;
  while (end > start && /\s/.test(draft[end - 1])) end -= 1;
  return makeSpan(draft, start, end);
}

function allAssertions(draft) {
  const scanned = draft.slice(0, TEXT_WORLD_LIMITS.inputCharacters);
  const result = [];
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  // Paragraph boundaries must remain visible even without terminal punctuation.
  for (const paragraph of scanned.matchAll(/[^\r\n]+/g)) {
    for (const sentence of segmenter.segment(paragraph[0])) {
      const origin = paragraph.index + sentence.index;
      const finish = origin + sentence.segment.length;
      let start = origin;
      while (start < finish) {
        let end = Math.min(finish, start + TEXT_WORLD_LIMITS.assertionCharacters);
        if (end < finish) {
          const space = scanned.lastIndexOf(" ", end);
          if (space > start + TEXT_WORLD_LIMITS.assertionCharacters / 2) end = space;
        }
        const span = trimmedSpan(draft, start, end);
        if (span.text) {
          const fragment = start !== origin || end !== finish || (draft.length > scanned.length && finish === scanned.length);
          const kind = /[?]\s*$/.test(span.text) ? "question" : /^\s*(?:if|suppose|imagine|perhaps|maybe)\b/i.test(span.text) ? "hypothetical" : /[“”"]/.test(span.text) ? "contains-quotation" : "statement-candidate";
          result.push({ id: `a${result.length + 1}`, span, fragment, kind });
        }
        start = end;
        while (start < finish && /\s/.test(scanned[start])) start += 1;
      }
    }
  }
  return result;
}

function timeRecords(assertion) {
  return [...assertion.span.text.matchAll(TIME)].map((match) => ({
    assertionId: assertion.id,
    span: { start: assertion.span.start + match.index, end: assertion.span.start + match.index + match[0].length, text: match[0] },
    normalized: normal(match[0]).replace(/\./g, ""),
    relative: /^(?:today|tomorrow|yesterday|now|later|earlier|meanwhile|previously|subsequently|next|last)\b/i.test(match[0]),
  }));
}

function normalizedQuantity(text) {
  const match = text.match(/^([$£€])?\s*([+-]?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)|[a-z]+)\s*(.*)$/i);
  if (!match) return null;
  const amount = WORD_NUMBER[normal(match[2])] ?? Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  const rawUnit = normal(match[3]);
  const units = [
    [/^(?:kg|kilograms?)$/, "mass", "g", 1000],
    [/^(?:g|grams?)$/, "mass", "g", 1],
    [/^(?:km|kilometers?|kilometres?)$/, "distance", "m", 1000],
    [/^(?:m|meters?|metres?)$/, "distance", "m", 1],
    [/^(?:cm|centimeters?|centimetres?)$/, "distance", "m", 0.01],
    [/^(?:hours?)$/, "duration", "s", 3600],
    [/^(?:minutes?)$/, "duration", "s", 60],
    [/^(?:seconds?)$/, "duration", "s", 1],
    [/^(?:percent|%)$/, "percentage", "%", 1],
    [/^(?:percentage points?)$/, "percentage-points", "pp", 1],
  ];
  let dimension = rawUnit ? `literal-unit:${rawUnit.replace(/s$/, "")}` : "scalar";
  let unit = rawUnit.replace(/s$/, "");
  let multiplier = 1;
  for (const [pattern, candidateDimension, candidateUnit, candidateMultiplier] of units) {
    if (pattern.test(rawUnit)) { dimension = candidateDimension; unit = candidateUnit; multiplier = candidateMultiplier; break; }
  }
  if (rawUnit === "boxes") { dimension = "literal-unit:box"; unit = "box"; }
  if (rawUnit === "people") { dimension = "literal-unit:person"; unit = "person"; }
  if (match[1] || /^dollars?$/.test(rawUnit)) {
    unit = match[1] ?? "$";
    dimension = `currency:${unit}`;
  }
  return { amount, unit, dimension, normalizedAmount: Number((amount * multiplier).toPrecision(12)) };
}

function quantityRecords(assertion) {
  const times = timeRecords(assertion);
  const result = [];
  for (const match of assertion.span.text.matchAll(QUANTITY)) {
    const start = assertion.span.start + match.index;
    const end = start + match[0].length;
    if (times.some(({ span }) => start < span.end && end > span.start)) continue;
    const quantity = normalizedQuantity(match[0]);
    if (!quantity) continue;
    result.push({ assertionId: assertion.id, span: { start, end, text: match[0] }, ...quantity, approximate: /\b(?:about|around|roughly|approximately|nearly|over|under|at least|at most)\s*$/i.test(assertion.span.text.slice(0, match.index)) });
  }
  return result;
}

function literalState(assertion) {
  if (assertion.fragment || assertion.kind !== "statement-candidate") return null;
  let text = assertion.span.text.replace(/^[#*]+\s*/, "").trim();
  const times = timeRecords(assertion);
  const frame = text.match(/^((?:at|on|in)\s+[^,]{1,48}),\s*/i)?.[1];
  const contextScope = frame && !times.some(({ normalized }) => normal(frame.replace(/^(?:at|on|in)\s+/i, "")) === normalized) ? normal(frame) : null;
  // Recognize explicit leading frames without inheriting them across sentences.
  text = text.replace(/^(?:(?:at|on|in)\s+[^,]{1,48},\s*|(?:later|earlier|now|today|tomorrow|yesterday|meanwhile),?\s*)/i, "");
  const match = text.match(/^([\p{L}][\p{L}\d'’ -]{0,60}?)\s+(isn't|aren't|wasn't|weren't|cannot|can't|is|are|was|were|can|has|had|weighs|weighed|contains|contained|holds|held)\s+(?:(not)\s+)?(.+?)[.!]?$/iu);
  if (!match) return null;
  // Repeated indefinite descriptions need not refer to the same thing.
  if (/^(?:a|an)\s+/i.test(match[1])) return null;
  const subject = normal(match[1]).replace(/^the\s+/, "");
  if (/^(?:he|she|they|it|we|i|you|there|this|that|these|those)$/.test(subject)) return null;
  if (/\b(?:if|may|might|could|would|believes?|thinks?|says?|according)\b/i.test(match[1])) return null;
  const verb = normal(match[2]);
  const negative = Boolean(match[3]) || /n't|cannot/.test(verb);
  const predicate = /^(?:is|are|was|were)/.test(verb) ? "be" : /^(?:can)/.test(verb) ? "can" : /^(?:has|had)$/.test(verb) ? "has" : /^(?:weigh)/.test(verb) ? "weighs" : /^(?:contain)/.test(verb) ? "contains" : "holds";
  const object = normal(match[4]).replace(/[.!]+$/, "");
  if (/\b(?:but|although|unless|except|if|maybe|perhaps)\b/.test(object)) return null;
  const quantities = quantityRecords(assertion);
  const quantity = quantities.length === 1 && normal(match[4]).replace(/[.!]+$/, "") === normal(quantities[0].span.text) ? quantities[0] : null;
  return { subject, predicate, object, polarity: negative ? "negative" : "positive", tense: /^(?:was|were|had|weighed|contained|held)/.test(verb) ? "past" : "present", timeScope: times.map(({ normalized }) => normalized).sort(), contextScope, relativeTime: times.some(({ relative }) => relative), quantity };
}

function conflictRecords(assertions) {
  const conflicts = [];
  const seen = new Map();
  const add = (kind, left, right, reason, evidence) => {
    if (conflicts.length >= TEXT_WORLD_LIMITS.potentialConflicts) return;
    conflicts.push({ id: `conflict-${conflicts.length + 1}`, kind, status: "requires-review", evidenceRefs: [left.id, right.id], reason, deterministicEvidence: evidence });
  };
  for (const assertion of assertions) {
    const state = literalState(assertion);
    if (state && !state.relativeTime) {
      // Exact shared time anchors are a candidate scope; unspecified time remains
      // explicitly uncertain. Different explicit times are not contradictions.
      const key = JSON.stringify([state.subject, state.predicate, state.tense, state.timeScope, state.contextScope]);
      const previous = seen.get(key) ?? [];
      for (const item of previous) {
        const prior = item.state;
        const scope = state.timeScope.length ? "same explicit time anchor" : "time unspecified; a change of state may explain this";
        if (prior.object === state.object && prior.polarity !== state.polarity) {
          add("opposite-polarity", item.assertion, assertion, `The same literal subject and predicate have opposite polarity (${scope}).`, { subject: state.subject, predicate: state.predicate, timeScope: state.timeScope });
        } else if (state.predicate === "be" && prior.polarity === "positive" && state.polarity === "positive" && OPPOSITES.get(prior.object) === state.object) {
          add("opposed-state", item.assertion, assertion, `The same literal subject has a conventional opposed state pair (${scope}). Confirm that the descriptions have the same scope.`, { subject: state.subject, states: [prior.object, state.object], timeScope: state.timeScope });
        } else if (prior.quantity && state.quantity && !prior.quantity.approximate && !state.quantity.approximate && prior.polarity === state.polarity && prior.quantity.dimension === state.quantity.dimension && prior.quantity.unit === state.quantity.unit && prior.quantity.normalizedAmount !== state.quantity.normalizedAmount) {
          add("quantity-disagreement", item.assertion, assertion, `The same literal subject and predicate specify different comparable quantities (${scope}).`, { subject: state.subject, unit: state.quantity.unit, normalizedAmounts: [prior.quantity.normalizedAmount, state.quantity.normalizedAmount], timeScope: state.timeScope });
        }
      }
      // Keep distinct literal states so a distant opposing statement can still
      // match an early statement, without quadratic repeated-state comparisons.
      if (!previous.some(({ state: prior }) => prior.object === state.object && prior.polarity === state.polarity) && previous.length < 12) previous.push({ assertion, state });
      seen.set(key, previous);
    }
    if (assertion.kind !== "statement-candidate") continue;
    for (const match of assertion.span.text.matchAll(/(?<![\w.])([+-]?\d+(?:\.\d+)?)\s*([+\-*×])\s*([+-]?\d+(?:\.\d+)?)\s*=\s*([+-]?\d+(?:\.\d+)?)(?!\w|\.\d)/g)) {
      const before = assertion.span.text.slice(0, match.index);
      const after = assertion.span.text.slice(match.index + match[0].length);
      // Do not mistake the tail of a longer expression for a complete equality.
      if (/[+\-*×/^=(]\s*$/.test(before) || /^\s*[+\-*×/^)]/.test(after)) continue;
      const left = Number(match[1]);
      const right = Number(match[3]);
      const stated = Number(match[4]);
      const computed = match[2] === "+" ? left + right : match[2] === "-" ? left - right : left * right;
      if (Math.abs(computed - stated) > 1e-9 * Math.max(1, Math.abs(computed))) add("arithmetic-mismatch", assertion, assertion, "An explicit numeric equality does not hold under ordinary arithmetic; check whether the passage asserts, quotes, or challenges it.", { operator: match[2], operands: [left, right], stated, computed });
    }
  }
  return conflicts.map((conflict) => ({ ...conflict, evidenceRefs: [...new Set(conflict.evidenceRefs)] }));
}

function evenlySelect(items, limit) {
  if (items.length <= limit) return items;
  if (limit === 1) return [items[0]];
  return Array.from({ length: limit }, (_, index) => items[Math.round(index * (items.length - 1) / (limit - 1))]);
}

function selectAssertions(all, conflicts) {
  const byId = new Map(all.map((assertion) => [assertion.id, assertion]));
  const chosen = new Map();
  const add = (assertion) => {
    if (chosen.size < TEXT_WORLD_LIMITS.assertions) chosen.set(assertion.id, assertion);
  };
  conflicts.flatMap(({ evidenceRefs }) => evidenceRefs).forEach((id) => add(byId.get(id)));
  // Sample signal-bearing sentences throughout the document, not only its start.
  const signals = all.filter(({ span }) => RULE.test(span.text) || KNOWLEDGE.test(span.text) || ARGUMENT.test(span.text));
  evenlySelect(signals, Math.min(24, TEXT_WORLD_LIMITS.assertions - chosen.size)).forEach(add);
  evenlySelect(all, TEXT_WORLD_LIMITS.assertions - chosen.size).forEach(add);
  if (chosen.size < Math.min(all.length, TEXT_WORLD_LIMITS.assertions)) all.forEach(add);
  return [...chosen.values()].sort((left, right) => left.span.start - right.span.start);
}

function entityRecords(assertions) {
  const entities = new Map();
  const get = (label) => {
    const key = normal(label);
    if (!entities.has(key)) entities.set(key, { name: label, aliases: [], mentions: [] });
    return entities.get(key);
  };
  for (const assertion of assertions) {
    for (const match of assertion.span.text.matchAll(/\b[A-Z][\p{L}]+(?:[ '-][A-Z][\p{L}]+){0,2}\b/gu)) {
      if (ENTITY_STOP.has(normal(match[0])) || normal(match[0]).split(" ").some((word) => ENTITY_STOP.has(word))) continue;
      const entity = get(match[0]);
      if (entity.mentions.length < TEXT_WORLD_LIMITS.mentionsPerEntity) entity.mentions.push({ assertionId: assertion.id, span: { start: assertion.span.start + match.index, end: assertion.span.start + match.index + match[0].length, text: match[0] } });
    }
    for (const match of assertion.span.text.matchAll(/\b([A-Z][\p{L}]+(?: [A-Z][\p{L}]+){0,2}),?\s+(?:also known as|also called|alias)\s+([A-Z][\p{L}]+(?: [A-Z][\p{L}]+){0,2})\b/gu)) {
      const entity = get(match[1]);
      if (!entity.aliases.some(({ name }) => name === match[2])) entity.aliases.push({ name: match[2], evidenceRefs: [assertion.id], kind: "explicit-alias-candidate" });
    }
  }
  return [...entities.values()].sort((a, b) => b.mentions.length - a.mentions.length).slice(0, TEXT_WORLD_LIMITS.entities).map((entity, index) => ({ id: `entity-${index + 1}`, ...entity, aliases: entity.aliases.slice(0, 4) }));
}

function argumentGraph(assertions, { mode, direction }) {
  const requested = ARGUMENT_REQUEST.test(`${mode ?? ""} ${direction ?? ""}`);
  const cueAssertions = assertions.filter(({ kind, span }) => kind !== "contains-quotation" && ARGUMENT.test(span.text));
  const enabled = requested || cueAssertions.length > 0;
  if (!enabled) return { enabled: false, routingSignals: [], nodes: [], edges: [], caveat: "No strong argument marker or explicit reasoning request detected. This does not establish that no argument is present." };
  const nodes = [];
  const edges = [];
  const relevantIds = new Set();
  for (let index = 0; index < assertions.length; index += 1) {
    if (ARGUMENT.test(assertions[index].span.text)) {
      if (index > 0) relevantIds.add(assertions[index - 1].id);
      relevantIds.add(assertions[index].id);
      if (index + 1 < assertions.length) relevantIds.add(assertions[index + 1].id);
    }
  }
  const relevantAssertions = cueAssertions.length ? assertions.filter(({ id }) => relevantIds.has(id)) : evenlySelect(assertions, TEXT_WORLD_LIMITS.argumentNodes);
  let previousAssertionNumber = null;
  for (const assertion of relevantAssertions) {
    const text = assertion.span.text;
    const markers = [...text.matchAll(/\b(?:therefore|thus|hence|it follows|consequently|because|however|nevertheless|but|premise|conclusion|objection)\b\s*[:,-]?\s*/gi)];
    const starts = [...new Set([0, ...markers.map(({ index }) => index)])];
    for (let index = 0; index < starts.length; index += 1) {
      if (nodes.length >= TEXT_WORLD_LIMITS.argumentNodes) break;
      const offset = starts[index];
      const end = starts[index + 1] ?? text.length;
      const span = trimmedSpan(text, offset, end);
      if (!span.text || /^[;,\s]*$/.test(span.text)) continue;
      const cue = markers.find(({ index: at }) => at === offset)?.[0]?.trim() ?? null;
      const role = cue && /^(?:therefore|thus|hence|it follows|consequently|conclusion)/i.test(cue) ? "conclusion-candidate" : cue && /^(?:because|premise)/i.test(cue) ? "premise-candidate" : cue && /^(?:however|nevertheless|but|objection)/i.test(cue) ? "objection-candidate" : "claim-candidate";
      const node = { id: `argument-${nodes.length + 1}`, assertionId: assertion.id, span: { ...span, start: assertion.span.start + span.start, end: assertion.span.start + span.end }, role, explicitCue: cue };
      const previous = nodes.at(-1);
      nodes.push(node);
      const adjacent = previous && (previous.assertionId === assertion.id || Number(assertion.id.slice(1)) === previousAssertionNumber + 1);
      if (adjacent && cue && edges.length < TEXT_WORLD_LIMITS.argumentEdges) {
        const kind = role === "conclusion-candidate" || role === "premise-candidate" ? "supports-candidate" : role === "objection-candidate" ? "objects-to-candidate" : null;
        if (kind) edges.push({ from: role === "conclusion-candidate" ? previous.id : node.id, to: role === "conclusion-candidate" ? node.id : previous.id, kind, evidenceRefs: [...new Set([previous.assertionId, assertion.id])], basis: "explicit connective plus adjacent span; logical relation requires review" });
      }
      previousAssertionNumber = Number(assertion.id.slice(1));
    }
  }
  return { enabled: true, routingSignals: [...(requested ? ["explicit-reasoning-request"] : []), ...cueAssertions.slice(0, 8).map(({ id }) => id)], nodes, edges, caveat: "Candidate roles and edges reflect literal cues and adjacency. They do not establish validity, premise truth, causal proof, or unstated assumptions." };
}

export function buildTextWorld(draft, options = {}) {
  if (typeof draft !== "string") throw new TypeError("Draft must be a string.");
  const all = allAssertions(draft);
  const potentialConflicts = conflictRecords(all);
  const selected = selectAssertions(all, potentialConflicts);
  const assertions = selected.map((assertion) => {
    const state = literalState(assertion);
    return { ...assertion, ...(state ? { literalState: state } : {}) };
  });
  const times = selected.flatMap(timeRecords);
  const quantities = selected.flatMap(quantityRecords);
  const rules = selected.filter(({ span }) => RULE.test(span.text));
  const knowledge = selected.filter(({ span }) => KNOWLEDGE.test(span.text));
  const argument = argumentGraph(selected, options);
  const coverage = {
    offsetUnit: "UTF-16 code units into original input",
    inputCharacters: draft.length,
    scannedCharacters: Math.min(draft.length, TEXT_WORLD_LIMITS.inputCharacters),
    inputTruncated: draft.length > TEXT_WORLD_LIMITS.inputCharacters,
    assertionsDetected: all.length,
    assertionsRetained: selected.length,
    assertionsOmitted: all.length - selected.length,
    sampled: all.length > selected.length,
    assertionFragments: all.filter(({ fragment }) => fragment).length,
    conflictScan: "all detected spans within character limit; literal state history limited to 12 distinct states per subject/predicate/time",
    conflictLimitReached: potentialConflicts.length >= TEXT_WORLD_LIMITS.potentialConflicts,
    anchorScope: "retained assertions only; uniformly sampled when an anchor limit is exceeded",
    timeAnchorsOmitted: Math.max(0, times.length - TEXT_WORLD_LIMITS.timeAnchors),
    quantityAnchorsOmitted: Math.max(0, quantities.length - TEXT_WORLD_LIMITS.quantityAnchors),
    ruleEvidenceOmitted: Math.max(0, rules.length - TEXT_WORLD_LIMITS.ruleEvidence),
    knowledgeEvidenceOmitted: Math.max(0, knowledge.length - TEXT_WORLD_LIMITS.knowledgeEvidence),
    argumentNodeLimitReached: argument.nodes.length >= TEXT_WORLD_LIMITS.argumentNodes,
    argumentEdgeLimitReached: argument.edges.length >= TEXT_WORLD_LIMITS.argumentEdges,
    semanticCompleteness: false,
  };
  return {
    schemaVersion: 1,
    kind: "deterministic-text-world",
    coverage,
    assertions,
    entities: entityRecords(selected),
    timeAnchors: evenlySelect(times, TEXT_WORLD_LIMITS.timeAnchors).map((item, index) => ({ id: `time-${index + 1}`, ...item })),
    quantityAnchors: evenlySelect(quantities, TEXT_WORLD_LIMITS.quantityAnchors).map((item, index) => ({ id: `quantity-${index + 1}`, ...item })),
    ruleEvidence: evenlySelect(rules, TEXT_WORLD_LIMITS.ruleEvidence).map(({ id }) => ({ id: `rule-${id}`, evidenceRefs: [id], status: "literal-rule-cue" })),
    knowledgeEvidence: evenlySelect(knowledge, TEXT_WORLD_LIMITS.knowledgeEvidence).map(({ id }) => ({ id: `knowledge-${id}`, evidenceRefs: [id], status: "literal-knowledge-cue" })),
    argument,
    potentialConflicts,
    caveat: CAVEAT,
  };
}

export function summarizeTextWorld(graph) {
  return {
    schemaVersion: graph.schemaVersion,
    kind: graph.kind,
    coverage: graph.coverage,
    assertionCount: graph.assertions.length,
    entityCount: graph.entities.length,
    timeAnchorCount: graph.timeAnchors.length,
    quantityAnchorCount: graph.quantityAnchors.length,
    ruleEvidenceCount: graph.ruleEvidence.length,
    knowledgeEvidenceCount: graph.knowledgeEvidence.length,
    argumentEnabled: graph.argument.enabled,
    argumentNodeCount: graph.argument.nodes.length,
    argumentEdgeCount: graph.argument.edges.length,
    potentialConflictCount: graph.potentialConflicts.length,
  };
}

function quoteSpans(draft) {
  return [...draft.slice(0, TEXT_WORLD_LIMITS.inputCharacters).matchAll(/"[^"\r\n]{2,360}"|“[^”\r\n]{2,360}”/g)].map((match) => makeSpan(draft, match.index, match.index + match[0].length));
}

function difference(left, right, key) {
  const counts = new Map();
  for (const item of right) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return left.filter((item) => {
    const id = key(item);
    const count = counts.get(id) ?? 0;
    if (!count) return true;
    counts.set(id, count - 1);
    return false;
  });
}

/** Fidelity signals are review candidates; a requested rewrite can justify them. */
export function compareTextWorld(original, candidate, { mode = "rewrite" } = {}) {
  if (typeof original !== "string" || typeof candidate !== "string") throw new TypeError("Original and candidate must be strings.");
  const before = allAssertions(original);
  const after = allAssertions(candidate);
  const candidates = [];
  const add = (kind, originalEvidence, candidateEvidence, note) => {
    if (candidates.length >= TEXT_WORLD_LIMITS.fidelityCandidates) return;
    candidates.push({ id: `fidelity-${candidates.length + 1}`, kind, status: "requires-review", originalEvidence: originalEvidence.slice(0, 8), candidateEvidence: candidateEvidence.slice(0, 8), note });
  };
  for (const span of quoteSpans(original)) {
    if (!candidate.slice(0, TEXT_WORLD_LIMITS.inputCharacters).includes(span.text)) add("quotation-removed-or-changed", [span], [], "An exact quotation is absent. Check whether omission or punctuation changes were requested; do not silently rewrite quoted speech.");
  }
  const beforeQuantities = before.flatMap(quantityRecords);
  const afterQuantities = after.flatMap(quantityRecords);
  const quantityKey = ({ normalizedAmount, unit, dimension, approximate }) => JSON.stringify([normalizedAmount, unit, dimension, approximate]);
  const removed = difference(beforeQuantities, afterQuantities, quantityKey);
  const added = difference(afterQuantities, beforeQuantities, quantityKey);
  if (removed.length || added.length) add("quantity-inventory-change", removed.map(({ span }) => span), added.map(({ span }) => span), `The literal quantity inventory changed in ${mode} mode. These are inventory differences, not matched factual claims; inspect referents and requested omissions.`);
  const beforeTimes = before.flatMap(timeRecords);
  const afterTimes = after.flatMap(timeRecords);
  const timeRemoved = difference(beforeTimes, afterTimes, ({ normalized }) => normalized);
  const timeAdded = difference(afterTimes, beforeTimes, ({ normalized }) => normalized);
  if (timeRemoved.length || timeAdded.length) add("time-inventory-change", timeRemoved.map(({ span }) => span), timeAdded.map(({ span }) => span), "The explicit time-anchor inventory changed. Check chronology and whether the new wording preserves the original timing.");
  const afterStates = new Map();
  for (const assertion of after) {
    const state = literalState(assertion);
    if (!state) continue;
    const key = JSON.stringify([state.subject, state.predicate, state.object, state.tense, state.timeScope, state.contextScope]);
    const values = afterStates.get(key) ?? [];
    values.push({ assertion, state });
    afterStates.set(key, values);
  }
  for (const assertion of before) {
    const state = literalState(assertion);
    if (!state) continue;
    const key = JSON.stringify([state.subject, state.predicate, state.object, state.tense, state.timeScope, state.contextScope]);
    const matches = afterStates.get(key) ?? [];
    if (matches.some(({ state: other }) => state.polarity === other.polarity)) continue;
    const flipped = matches.find(({ state: other }) => state.polarity !== other.polarity);
    if (flipped) add("polarity-change", [assertion.span], [flipped.assertion.span], "A literal subject/predicate changed polarity. Check that the revision preserves the intended proposition.");
  }
  return {
    schemaVersion: 1,
    kind: "deterministic-fidelity-candidates",
    coverage: { originalScannedCharacters: Math.min(original.length, TEXT_WORLD_LIMITS.inputCharacters), candidateScannedCharacters: Math.min(candidate.length, TEXT_WORLD_LIMITS.inputCharacters), inputTruncated: Math.max(original.length, candidate.length) > TEXT_WORLD_LIMITS.inputCharacters, candidateLimitReached: candidates.length >= TEXT_WORLD_LIMITS.fidelityCandidates, evidenceLimitPerSide: 8, semanticCompleteness: false },
    candidates,
    caveat: "Literal quotation, quantity, time, and polarity checks are incomplete fidelity evidence. Differences may be justified by the user's request; unchanged inventories do not guarantee unchanged meaning.",
  };
}
