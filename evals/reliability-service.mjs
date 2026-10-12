import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getWritingCoverage } from "../server/book-informed.mjs";
import { loadConceptRegistry } from "../server/concept-registry.mjs";

export const AXES = Object.freeze(["recognition", "application", "exceptions", "omissions"]);
export const DOMAINS = Object.freeze(["purpose-genre", "meaning-voice", "source-support", "scene-continuity", "sentence-function", "argument-relations"]);
export const FAILURE_TYPES = Object.freeze(["false-criticism", "missed-defect", "meaning-drift", "unsupported-invention", "mode-breach", "privacy-breach", "method-omission", "overconfidence"]);
export const HOST_CHECKS = Object.freeze(["eight-tools", "bounded-workflow", "portable-context", "revision-fingerprint", "abstract-retrieval", "complete-exceptions", "render-placement", "analysis-no-rewrite", "authorized-edit-handoff", "unanswered-question", "stale-choice-reset", "no-remote-text", "fallback-disclosure"]);
export const USABILITY_CHECKS = Object.freeze(["desktop-scroll", "mobile-scroll", "long-passage-readability", "keyboard-selection", "filters", "decision-handoff", "host-errors"]);
const Text = z.string().trim().min(1).max(24000);
const Prose = z.string().min(1).max(24000).refine(s => s.trim().length > 0);
const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
const Digest = z.string().regex(/^[a-f0-9]{64}$/);
const Time = z.iso.datetime({ offset: true });
const Strings = z.array(Id).max(40).refine(a => new Set(a).size === a.length);
const Outcome = z.enum(["pass", "fail", "unresolved"]);
const Actor = z.object({ id: Id, kind: z.enum(["human", "model"]), independent: z.boolean() }).strict();
const Target = z.object({ host: z.enum(["chatgpt-chat", "chatgpt-work", "codex", "local"]), model: Text.max(120), model_version: Text.max(120), plugin_version: Text.max(120) }).strict();
const Obligation = z.object({ idea_id: Id, axis: z.enum(AXES), expectation: Text }).strict();
const Criterion = z.object({ idea_id: Id, axis: z.enum(AXES), outcome: Outcome, reason: Text }).strict();
const ToolNames = ["search_writing_methods", "get_writing_methods", "get_writing_reference", "render_writing_diagnostic", "search_writing_examples", "get_writing_examples", "get_writing_coverage", "check_writing_revision", "validate_writing_workflow", "manage_writing_document"];
const ToolCall = z.object({ name: z.enum(ToolNames), reference: Id.optional(), method_ids: Strings.max(8), card_ids: z.array(Id).max(8), result_sha256: Digest }).strict();
const Artifact = z.object({ sha256: Digest, description: Text }).strict();
export const ReliabilityEvidenceSchema = z.object({
  schema_version: z.literal(1), validation_fingerprint: Digest, target: Target,
  section_audits: z.array(z.object({ section_id: Id, reviewer: Actor, reviewed_at: Time,
    outcome: z.enum(["agreed", "needs-correction"]), idea_ids: z.array(Id).max(203),
    omissions_or_disagreements: z.array(Text).max(100), evidence: Artifact }).strict()).max(1000),
  cases: z.array(z.object({ id: Id, family_id: Id, prompt: Prose, oracle: Prose, prompt_sha256: Digest, oracle_sha256: Digest,
    task_class: z.enum(["substantive", "mechanical"]), editing_mode: z.enum(["proofread", "edit", "heavy-rewrite", "compression", "draft", "craft-analysis", "pattern-imitation", "argument-analysis"]),
    origin: z.enum(["authored-development", "independent-held-out"]), author_ids: Strings.min(1),
    preregistered_at: Time, genre: Text.max(100), length_band: z.enum(["sentence", "passage", "long-document"]),
    scenario: z.enum(["single-method", "combined-methods", "adversarial"]),
    required_method_ids: Strings, forbidden_method_ids: Strings,
    obligations: z.array(Obligation).min(1).max(12) }).strict()).max(10000),
  responses: z.array(z.object({ id: Id, case_id: Id, target: Target, output: Prose, output_sha256: Digest,
    started_at: Time, completed_at: Time, source_revision: z.string().regex(/^[a-f0-9]{40}$/),
    trace: z.object({ retrieval_status: z.enum(["available", "unavailable"]),
      tool_calls: z.array(ToolCall).max(100), reused_contract_fingerprint: Digest.nullable(),
      method_decisions: z.array(z.object({ method_id: Id, disposition: z.enum(["apply", "retain", "inapplicable", "unresolved"]), reason: Text }).strict()).max(40),
      dimensions: z.array(z.object({ domain: z.enum(DOMAINS), disposition: z.enum(["checked", "inapplicable", "unresolved"]), evidence: Text }).strict()).max(6),
      permission: z.enum(["retrieval-only", "exact-text-authorized"]), final_audit_evidence: Text,
      gap_disclosed: z.boolean(), context_reframed: z.boolean(), artifact: Artifact }).strict() }).strict()).max(20000),
  reviews: z.array(z.object({ response_id: Id, reviewer: Actor, role: z.enum(["initial", "adjudicator"]),
    reviewed_at: Time, outcome: Outcome, criteria: z.array(Criterion).min(1).max(12),
    failure_types: z.array(z.enum(FAILURE_TYPES)).max(8).refine(a => new Set(a).size === a.length),
    rationale: Text, evidence: Artifact }).strict()).max(40000),
  host_sessions: z.array(z.object({ id: Id, host: z.enum(["chatgpt-chat", "chatgpt-work"]),
    type: z.enum(["fresh-install", "real-user-usability"]), target: Target, observer: Actor, observed_at: Time,
    checks: z.array(z.object({ id: Id, outcome: Outcome, evidence: Artifact }).strict()).min(1).max(20) }).strict()).max(1000),
}).strict();

export const digest = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const assert = (condition, message) => { if (!condition) throw new TypeError(message); };
const unique = (items, key, label) => assert(new Set(items.map(key)).size === items.length, `Duplicate ${label}.`);
const sameTarget = (a, b) => ["host", "model", "model_version", "plugin_version"].every(key => a[key] === b[key]);
const humanIndependent = (actor, authors = []) => actor.kind === "human" && actor.independent && !authors.includes(actor.id) && actor.id !== "codex-model";
const obligationKey = o => `${o.idea_id}:${o.axis}`;

export async function buildReliabilityPlan() {
  const paths = ["knowledge/SOURCE_CARDS.json", "knowledge/SOURCE_REVIEW.json", "knowledge/CONCEPT_REGISTRY.json",
    "knowledge/SOURCE_MANIFEST.json", "knowledge/SYSTEM_PROMPT.md", "knowledge/RELIABILITY_WORKFLOW.md",
    "server/mcp.mjs", "server/editorial-retrieval.mjs", "server/book-informed.mjs", "server/source-cards.mjs",
    "server/source-semantic.mjs", "server/concept-registry.mjs", "server/writing-diagnostic.mjs",
    "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md",
    "evals/reliability-service.mjs", "evals/blinded-comparison.mjs", "evals/reliability-composition-cases.json",
    "knowledge/BOUNDED_WORKFLOW.md", "server/writing-workflow.mjs", "server/writing-document.mjs",
    "knowledge/SEMANTIC_COMPOSITION.md", "knowledge/EXAMPLE_DERIVED_PATTERNS.md", "knowledge/EDITORIAL_PLAYBOOK.md", "knowledge/COHERENCE_PLAYBOOK.md",
    "knowledge/argument-reconstruction/SKILL.md", "knowledge/argument-reconstruction/references/evaluation-standards.md",
    "knowledge/argument-reconstruction/references/mapping-and-tests.md", "server/meaning-contract.mjs", "server/text-world.mjs", "package-lock.json"];
  const raw = await Promise.all(paths.map(p => readFile(new URL(`../${p}`, import.meta.url), "utf8")));
  const [corpus, ledger] = raw.slice(0, 2).map(JSON.parse);
  const registry = await loadConceptRegistry();
  const coverage = await getWritingCoverage({});
  return { schema_version: 1, service_version: "1.0.0", validation_fingerprint: digest(raw),
    corpus_sha256: coverage.corpus_sha256, corpus_version: corpus.corpus_version,
    source_revision: coverage.source_revision, method_ids: registry.concepts.map(c => c.id),
    axes: [...AXES], dimensions: [...DOMAINS], minimum_distinct_cases_per_idea_axis: 2,
    ideas: corpus.cards.map(c => ({ id: c.id, title: c.title, method_ids: c.concept_ids,
      sources: c.sources.map(s => ({ kind: s.kind, ref: s.ref, locator: s.locator })),
      obligations: AXES.map(axis => ({ idea_id: c.id, axis, status: "not-tested" })) })),
    sections: ledger.reviews.map(r => ({ id: r.id, source_id: r.source_id, pages: r.pages,
      title: r.section_title ?? r.id, original_card_ids: r.card_ids, kind: r.status, independent_audit: "not-reviewed" })),
    source_limitations: ledger.source_content_caveats,
    totals: { ideas: corpus.cards.length, methods: registry.concepts.length, sections: ledger.reviews.length,
      idea_axis_obligations: corpus.cards.length * AXES.length },
    public_fixture_ids: await publicFixtureIds(),
    caveat: "Cards are provisional operational idea units, not proof that every book idea is registered. Two cases per axis are an initial coverage floor, not a reliability estimate or guarantee. Independent human identities, hold-out secrecy and observations require external verification. This service makes no provider calls." };
}

async function publicFixtureIds() {
  const { readdir } = await import("node:fs/promises");
  const names = (await readdir(new URL("./", import.meta.url))).filter(n => /cases\.json$/.test(n));
  const suites = await Promise.all(names.map(async n => JSON.parse(await readFile(new URL(n, import.meta.url), "utf8"))));
  return [...new Set(suites.flatMap(s => (Array.isArray(s) ? s : s.cases ?? []).map(c => c.id)).filter(id => typeof id === "string"))].sort();
}

export function emptyReliabilityEvidence(plan, target = { host: "chatgpt-chat", model: "not-recorded", model_version: "not-recorded", plugin_version: "0.47.0" }) {
  return { schema_version: 1, validation_fingerprint: plan.validation_fingerprint, target,
    section_audits: [], cases: [], responses: [], reviews: [], host_sessions: [] };
}

export function validateReliabilityEvidence(value, plan) {
  // Generic errors must not echo evaluated prose, filenames, or unexpected field values.
  const result = ReliabilityEvidenceSchema.safeParse(value);
  assert(result.success, "Reliability evidence schema invalid; inspect the local schema without publishing private input.");
  const e = result.data;
  assert(e.validation_fingerprint === plan.validation_fingerprint, "Stale validation fingerprint; rerun or explicitly revalidate against the current workflow and corpus.");
  unique(e.cases, c => c.id, "case IDs"); unique(e.responses, r => r.id, "response IDs");
  unique(e.section_audits, a => a.section_id, "section audits"); unique(e.host_sessions, s => s.id, "host sessions");
  unique(e.reviews, r => `${r.response_id}:${r.reviewer.id}`, "reviewer/response records");
  const ideas = new Set(plan.ideas.map(i => i.id)), methods = new Set(plan.method_ids);
  const sections = new Map(plan.sections.map(s => [s.id, s]));
  const cases = new Map(e.cases.map(c => [c.id, c])), responses = new Map(e.responses.map(r => [r.id, r]));
  const checkIds = (ids, known, label) => assert(ids.every(id => known.has(id)), `Unknown ${label}.`);
  for (const a of e.section_audits) {
    assert(sections.has(a.section_id), "Unknown section audit."); checkIds(a.idea_ids, ideas, "audited idea");
    unique(a.idea_ids, id => id, "audited idea IDs");
    if (a.outcome === "agreed") {
      assert(!a.omissions_or_disagreements.length, "An agreed audit cannot hide unresolved omissions or disagreements.");
      assert(sections.get(a.section_id).original_card_ids.every(id => a.idea_ids.includes(id)), "Audit omits an existing section idea mapping.");
    }
  }
  for (const c of e.cases) {
    assert(digest(c.prompt) === c.prompt_sha256 && digest(c.oracle) === c.oracle_sha256, "Registered prompt or oracle digest mismatch.");
    if (c.length_band === "long-document") assert(c.prompt.split(/\s+/).length >= 1200, "A long-document label requires a genuinely long prompt.");
    checkIds(c.required_method_ids, methods, "required method"); checkIds(c.forbidden_method_ids, methods, "forbidden method");
    assert(!c.required_method_ids.some(id => c.forbidden_method_ids.includes(id)), "Method is both required and forbidden.");
    unique(c.obligations, obligationKey, "case obligations"); checkIds(c.obligations.map(o => o.idea_id), ideas, "case idea");
    assert(new Set(c.obligations.map(o => o.idea_id)).size <= 3, "A case cannot blanket-credit more than three idea units.");
    if (c.origin === "independent-held-out") assert(!plan.public_fixture_ids.includes(c.id) && !c.author_ids.includes("codex-model"), "Public/development fixtures cannot be relabeled held-out.");
  }
  for (const r of e.responses) {
    assert(digest(r.output) === r.output_sha256, "Observed output digest mismatch.");
    assert(cases.has(r.case_id), "Response lacks its registered case.");
    const c = cases.get(r.case_id);
    assert(Date.parse(c.preregistered_at) < Date.parse(r.started_at) && Date.parse(r.started_at) <= Date.parse(r.completed_at), "Case and oracle must be registered before the response starts.");
    if (/^[a-f0-9]{40}$/.test(plan.source_revision)) assert(r.source_revision === plan.source_revision, "Response came from a different deployment revision.");
    unique(r.trace.dimensions, d => d.domain, "request dimensions"); unique(r.trace.method_decisions, d => d.method_id, "method decisions");
    checkIds(r.trace.method_decisions.map(d => d.method_id), methods, "trace method");
    for (const call of r.trace.tool_calls) { checkIds(call.method_ids, methods, "returned method"); checkIds(call.card_ids, ideas, "returned card"); }
  }
  for (const review of e.reviews) {
    const r = responses.get(review.response_id); assert(r, "Review lacks an observed response.");
    const c = cases.get(r.case_id);
    assert(Date.parse(review.reviewed_at) >= Date.parse(r.completed_at), "Review predates the output.");
    unique(review.criteria, obligationKey, "graded criteria");
    assert(review.criteria.length === c.obligations.length && review.criteria.every(g => c.obligations.some(o => obligationKey(o) === obligationKey(g))), "Every declared obligation needs its own criterion judgment.");
    if (review.outcome === "pass") assert(review.criteria.every(g => g.outcome === "pass") && !review.failure_types.length, "Passing review contradicts failed/unresolved criteria or failure flags.");
    if (review.outcome === "fail") assert(review.criteria.some(g => g.outcome === "fail") || review.failure_types.length > 0, "Failed review has no failed criterion or failure flag.");
    if (review.outcome === "unresolved") assert(review.criteria.some(g => g.outcome === "unresolved"), "Unresolved review lacks an unresolved criterion.");
    if (review.role === "adjudicator") assert(humanIndependent(review.reviewer, c.author_ids), "Adjudicator must be an independent human, not the case author.");
  }
  for (const s of e.host_sessions) {
    assert(s.host === s.target.host, "Session and target hosts disagree."); unique(s.checks, c => c.id, "session checks");
    checkIds(s.checks.map(c => c.id), new Set(s.type === "fresh-install" ? HOST_CHECKS : USABILITY_CHECKS), "session check");
  }
  return e;
}

export function checkRequestTrace(c, r, plan) {
  const issues = [];
  if (!r.trace.context_reframed) issues.push("context-not-reframed");
  if (c.task_class === "substantive") {
    if (!DOMAINS.every(d => r.trace.dimensions.some(item => item.domain === d))) issues.push("missing-review-dimension");
    if (r.trace.dimensions.some(d => d.disposition === "unresolved") && !r.trace.gap_disclosed) issues.push("undisclosed-dimension-gap");
    if (r.trace.retrieval_status === "available") {
      const loaded = r.trace.tool_calls.some(t => t.name === "get_writing_reference" && t.reference === "system-contract") || r.trace.reused_contract_fingerprint === plan.validation_fingerprint;
      if (!loaded) issues.push("operating-contract-not-loaded");
      const retrieved = new Set(r.trace.tool_calls.flatMap(t => t.method_ids));
      if (!c.required_method_ids.every(id => retrieved.has(id))) issues.push("required-method-not-retrieved");
      if (!r.trace.tool_calls.some(t => t.name === "search_writing_examples" || t.name === "get_writing_examples")) issues.push("application-restraint-examples-not-loaded");
      const cards = new Set(r.trace.tool_calls.flatMap(t => t.card_ids));
      if (!c.obligations.every(o => cards.has(o.idea_id))) issues.push("tested-idea-not-retrieved");
    } else if (!r.trace.gap_disclosed) issues.push("unavailable-retrieval-not-disclosed");
  }
  if (!c.required_method_ids.every(id => r.trace.method_decisions.some(d => d.method_id === id))) issues.push("missing-method-decision");
  if (r.trace.method_decisions.some(d => c.forbidden_method_ids.includes(d.method_id) && d.disposition === "apply")) issues.push("forbidden-method-applied");
  if (r.trace.permission !== "exact-text-authorized" && r.trace.tool_calls.some(t => ["render_writing_diagnostic", "check_writing_revision", "validate_writing_workflow", "manage_writing_document"].includes(t.name))) issues.push("exact-text-without-authorization");
  return { status: issues.length ? "trace-incomplete" : "trace-recorded-not-semantic-proof", issues };
}

export function wilsonInterval(successes, total) {
  if (!total) return null;
  const z = 1.959963984540054, p = successes / total, den = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / den;
  const radius = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / den;
  return { lower: Math.max(0, center - radius), upper: Math.min(1, center + radius), confidence_level: 0.95 };
}

function consensus(reviews, authors) {
  const eligible = reviews.filter(r => humanIndependent(r.reviewer, authors));
  const adjudicators = eligible.filter(r => r.role === "adjudicator");
  if (adjudicators.length > 1) return null;
  if (adjudicators.length === 1) {
    const a = adjudicators[0], initials = eligible.filter(r => r.role === "initial");
    if (initials.length < 2 || initials.some(r => Date.parse(r.reviewed_at) > Date.parse(a.reviewed_at))) return null;
    return a;
  }
  if (!eligible.length) return null;
  const judgments = eligible.map(r => JSON.stringify({ outcome: r.outcome, criteria: [...r.criteria].sort((a,b) => obligationKey(a).localeCompare(obligationKey(b))).map(g => [obligationKey(g),g.outcome]), failures: [...r.failure_types].sort() }));
  return new Set(judgments).size === 1 ? eligible[0] : null;
}

export function assessReliabilityEvidence(value, plan) {
  const e = validateReliabilityEvidence(value, plan);
  const cases = new Map(e.cases.map(c => [c.id, c]));
  const samples = e.responses.filter(r => sameTarget(r.target, e.target));
  const slots = new Map(plan.ideas.flatMap(i => AXES.map(axis => [`${i.id}:${axis}`, new Set()])));
  const methodSamples = new Set(), failures = Object.fromEntries(FAILURE_TYPES.map(t => [t,0]));
  let judged = 0, passed = 0, traceFailures = 0, unresolved = 0, development = 0;
  const judgedFamilies = new Set(), passingCases = [];
  const observed = [];
  // Group repeated generations conservatively: any failure survives, and an
  // ungraded repeat prevents a clean pass. Retries cannot erase earlier failures.
  for (const caseId of new Set(samples.map(r => r.case_id))) {
    const c = cases.get(caseId), runs = samples.filter(r => r.case_id === caseId).map(r => ({ r,
      trace: checkRequestTrace(c, r, plan), grade: consensus(e.reviews.filter(v => v.response_id === r.id), c.author_ids) }));
    traceFailures += runs.filter(run => run.trace.issues.length).length;
    if (c.origin !== "independent-held-out") { development += runs.length; continue; }
    const hasFailure = runs.some(run => run.grade?.outcome === "fail" || run.trace.issues.length);
    const hasUnresolved = runs.some(run => !run.grade || run.grade.outcome === "unresolved");
    if (hasUnresolved && !runs.some(run => run.grade?.outcome === "fail")) {
      unresolved++; observed.push({ case_id: c.id, outcome: "unresolved", generations: runs.length,
        trace_issues: [...new Set(runs.flatMap(run => run.trace.issues))] }); continue;
    }
    if (hasUnresolved) unresolved++;
    judged++; judgedFamilies.add(c.family_id);
    for (const flag of new Set(runs.flatMap(run => run.grade?.failure_types ?? []))) failures[flag]++;
    const pass = !hasFailure && !hasUnresolved;
    if (pass) { passed++; passingCases.push(c); }
    if (pass && runs.every(run => run.r.trace.retrieval_status === "available")) {
      for (const o of c.obligations) slots.get(obligationKey(o)).add(c.family_id);
      for (const id of c.required_method_ids) methodSamples.add(id);
    }
    observed.push({ case_id: c.id, outcome: pass ? "pass" : "fail", generations: runs.length,
      trace_issues: [...new Set(runs.flatMap(run => run.trace.issues))] });
  }
  const missing = [...slots].filter(([, ids]) => ids.size < plan.minimum_distinct_cases_per_idea_axis).map(([key, ids]) => ({ obligation: key, passing_distinct_cases: ids.size, required: plan.minimum_distinct_cases_per_idea_axis }));
  const missingSections = plan.sections.filter(s => !e.section_audits.some(a => a.section_id === s.id && a.outcome === "agreed" && humanIndependent(a.reviewer))).map(s => s.id);
  const hostEvidence = (host, type, required) => e.host_sessions.some(s => s.host === host && s.type === type && humanIndependent(s.observer)
    && sameTarget({ ...s.target, host: e.target.host }, e.target) && required.every(id => s.checks.some(c => c.id === id && c.outcome === "pass")));
  const hostGates = ["chatgpt-chat", "chatgpt-work"].flatMap(host => [
    { id: `${host}-fresh-install`, status: hostEvidence(host, "fresh-install", HOST_CHECKS) ? "independent-evidence-recorded" : "unverified" },
    { id: `${host}-usability`, status: hostEvidence(host, "real-user-usability", USABILITY_CHECKS) ? "independent-evidence-recorded" : "unverified" },
  ]);
  const variety = { combined_method_cases: passingCases.filter(c => c.scenario === "combined-methods").length,
    adversarial_cases: passingCases.filter(c => c.scenario === "adversarial").length,
    long_document_cases: passingCases.filter(c => c.length_band === "long-document").length,
    genres: [...new Set(passingCases.map(c => c.genre))], modes: [...new Set(passingCases.map(c => c.editing_mode))] };
  const varietyComplete = variety.combined_method_cases >= 12 && variety.adversarial_cases >= 12
    && variety.long_document_cases >= 6 && variety.genres.length >= 5 && variety.modes.length === 8;
  const independentFamilies = judged === judgedFamilies.size;
  return { service_version: plan.service_version, validation_fingerprint: plan.validation_fingerprint, target: e.target,
    public_launch_verified: false, semantic_guarantee: false, provider_calls: 0,
    gates: [{ id: "idea-and-exception-audit", status: missingSections.length ? "unverified" : "independent-evidence-recorded", missing_sections: missingSections.length },
      { id: "unseen-semantic-judgments", status: missing.length || plan.method_ids.some(id => !methodSamples.has(id)) || unresolved || passed !== judged ? "unverified" : "bounded-evidence-recorded-not-mastery", missing_obligations: missing.length },
      { id: "combined-and-cross-genre-judgments", status: varietyComplete ? "bounded-evidence-recorded-not-mastery" : "unverified", coverage: variety,
        policy_floor: "12 combined, 12 adversarial, 6 long-document cases; 5 genres and 8 modes. These are coverage floors, not statistical guarantees." }, ...hostGates],
    metrics: { distinct_held_out_cases_judged: judged, passed, pass_rate: judged ? passed / judged : null,
      pass_rate_interval: independentFamilies ? wilsonInterval(passed, judged) : null,
      distinct_case_families: judgedFamilies.size, interval_withheld_for_clustered_cases: !independentFamilies,
      unresolved_or_disputed: unresolved,
      development_responses_excluded: development, trace_failures: traceFailures,
      reported_failure_rates: Object.fromEntries(FAILURE_TYPES.map(t => [t, { cases: failures[t], denominator: judged, rate: judged ? failures[t] / judged : null, interval: independentFamilies ? wilsonInterval(failures[t], judged) : null }])) },
    missing_obligations: missing, missing_sections: missingSections,
    methods_without_passing_observed_cases: plan.method_ids.filter(id => !methodSamples.has(id)), observations: observed,
    caveat: "Self-reported traces do not prove cognition. Human independence, provenance, hold-out secrecy and recorded host sessions are attestations requiring external verification. Intervals assume independent representative cases, not clustered paraphrases or arbitrary future writing. Evidence is scoped to this target and fingerprint; unresolved cases and development examples are not passing evidence. Blinded comparison is a separate gate. No launch or universal correctness certification is issued." };
}
