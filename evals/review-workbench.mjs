import { z } from "zod";
import { digest, validateReliabilityEvidence, assessReliabilityEvidence, FAILURE_TYPES } from "./reliability-service.mjs";
import { BlindRatingsSchema } from "./blinded-comparison.mjs";

const Id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Text = z.string().trim().min(1).max(24000);
const Prose = z.string().min(1).max(24000).refine(s => s.trim().length > 0);
const Outcome = z.enum(["pass", "fail", "unresolved"]);
const Reviewer = z.object({ id: Id, independent: z.boolean(), human_attested: z.literal(true) }).strict();
const Criterion = z.object({ idea_id: Id, axis: z.enum(["recognition", "application", "exceptions", "omissions"]), outcome: Outcome, reason: Text }).strict();
const ReviewInput = z.object({ response_id: Id, reviewer: Reviewer, role: z.enum(["initial", "adjudicator"]),
  criteria: z.array(Criterion).min(1).max(12), failure_types: z.array(z.enum(FAILURE_TYPES)).max(8), rationale: Text }).strict();
const SectionInput = z.object({ section_id: Id, reviewer: Reviewer, outcome: z.enum(["agreed", "needs-correction"]),
  idea_ids: z.array(Id).max(203), notes: z.string().max(24000), source_checked: z.literal(true) }).strict();
const Packet = z.object({ schema_version: z.literal(1), assignment_sha256: Hash, rubric: Text,
  cases: z.array(z.object({ case_id: Id, prompt: Prose,
    responses: z.array(z.object({ id: Id, output_sha256: Hash, text: Prose }).strict()).min(3).max(4) }).strict()).min(1).max(2000) }).strict();
const RatingInput = z.object({ reviewer: Reviewer, ratings: BlindRatingsSchema.shape.ratings }).strict();
const fail = message => { throw new TypeError(message); };
function parse(schema, value) { const r = schema.safeParse(value); if (!r.success) fail("Review input is incomplete or invalid; private text is not echoed."); return r.data; }
function actor(reviewer) { if (reviewer.id === "codex-model") fail("A model identity cannot attest to human review."); return { id: reviewer.id, kind: "human", independent: reviewer.independent }; }
const artifact = value => ({ sha256: digest(value), description: "Human-submitted local review record hash; identity and independence remain externally verifiable attestations." });

export function importWorkspace(value, plan) {
  const evidence = validateReliabilityEvidence(value, plan);
  return { evidence, report: assessReliabilityEvidence(evidence, plan) };
}

export function appendHumanReview(value, input, plan, now = new Date().toISOString()) {
  const e = validateReliabilityEvidence(value, plan); const v = parse(ReviewInput, input);
  const r = e.responses.find(item => item.id === v.response_id);
  if (!r) fail("Select an observed response before reviewing it.");
  const c = e.cases.find(item => item.id === r.case_id); const reviewer = actor(v.reviewer);
  if (reviewer.independent && c.author_ids.includes(reviewer.id)) fail("The case author cannot claim independent review of that case.");
  if (e.reviews.some(item => item.response_id === r.id && item.reviewer.id === reviewer.id)) fail("This reviewer already recorded a locked review for this response. Preserve the existing record rather than overwrite it.");
  if (v.role === "adjudicator") {
    const initials = e.reviews.filter(item => item.response_id === r.id && item.role === "initial" && item.reviewer.kind === "human"
      && item.reviewer.independent && !c.author_ids.includes(item.reviewer.id) && item.reviewer.id !== "codex-model");
    if (!reviewer.independent || initials.length < 2 || initials.some(item => Date.parse(item.reviewed_at) > Date.parse(now))) {
      fail("Adjudication requires two earlier independent human reviews and a separate independent reviewer.");
    }
    if (e.reviews.some(item => item.response_id === r.id && item.role === "adjudicator")) fail("An adjudication is already recorded.");
  }
  // Every criterion is a deliberate human choice. No default passing grade,
  // generated rationale, replacement of a prior grade, or fake response exists.
  const outcome = v.criteria.some(g => g.outcome === "fail") || v.failure_types.length ? "fail"
    : v.criteria.some(g => g.outcome === "unresolved") ? "unresolved" : "pass";
  const body = { response_id: r.id, reviewer, role: v.role, reviewed_at: now,
    outcome, criteria: v.criteria, failure_types: v.failure_types, rationale: v.rationale };
  return importWorkspace({ ...e, reviews: [...e.reviews, { ...body, evidence: artifact(body) }] }, plan);
}

export function appendSourceAudit(value, input, plan, now = new Date().toISOString()) {
  const e = validateReliabilityEvidence(value, plan); const v = parse(SectionInput, input);
  if (e.section_audits.some(a => a.section_id === v.section_id)) fail("This workspace already contains an audit for that section. Preserve its history in a separate revision rather than overwrite it.");
  if (v.outcome === "needs-correction" && !v.notes.trim()) fail("Record the missing qualification, interpretation problem or disagreement.");
  if (v.outcome === "agreed" && v.notes.trim()) fail("Unresolved notes cannot be hidden by an agreed outcome.");
  const body = { section_id: v.section_id, reviewer: actor(v.reviewer), reviewed_at: now,
    outcome: v.outcome, idea_ids: v.idea_ids, omissions_or_disagreements: v.notes.trim() ? [v.notes.trim()] : [] };
  return importWorkspace({ ...e, section_audits: [...e.section_audits, { ...body, evidence: artifact(body) }] }, plan);
}

export function validateBlindPacket(value) {
  const packet = parse(Packet, value); const cases = new Set(), responses = new Set();
  for (const c of packet.cases) {
    if (cases.has(c.case_id)) fail("Duplicate blind case."); cases.add(c.case_id);
    for (const r of c.responses) {
      if (responses.has(r.id) || digest(r.text) !== r.output_sha256) fail("Blind response identifiers or hashes do not match.");
      responses.add(r.id);
    }
  }
  return packet;
}

export function lockBlindRatings(packetValue, input, now = new Date().toISOString()) {
  const packet = validateBlindPacket(packetValue); const v = parse(RatingInput, input);
  const expected = packet.cases.flatMap(c => c.responses.map(r => ({ case_id: c.case_id, response_id: r.id, output_sha256: r.output_sha256 })));
  if (v.ratings.length !== expected.length || new Set(v.ratings.map(r => r.response_id)).size !== expected.length
    || expected.some(r => !v.ratings.some(g => g.response_id === r.response_id && g.case_id === r.case_id && g.output_sha256 === r.output_sha256))) {
    fail("Every anonymous response needs exactly one matching rating before locking.");
  }
  // The condition key is never accepted by this reviewer surface. Actual
  // blinding and human independence are not authenticated by this program.
  return BlindRatingsSchema.parse({ schema_version: 1, assignment_sha256: packet.assignment_sha256,
    rater: actor(v.reviewer), ratings_locked_at: now, ratings: v.ratings });
}

export function sourceAuditBatch(plan) {
  const chosen = []; const seen = new Set();
  for (const section of plan.sections) {
    if (section.kind !== "principles-reviewed" || !section.original_card_ids.length || seen.has(section.source_id)) continue;
    chosen.push(section); seen.add(section.source_id);
  }
  return { id: "source-audit-batch-01", status: "prepared-not-reviewed", sections: chosen,
    review_questions: ["Does each mapped idea faithfully reflect these source pages?", "Which qualifications or exceptions are missing?",
      "Which important ideas are not represented at all?", "Does the advice change with genre, purpose, uncertainty or viewpoint?",
      "Are the original examples and restraint controls defensible?"],
    caveat: "One section per supplied source is an initial audit batch, not complete book interpretation. Consult the lawful primary source locally; no PDFs or extracted text are served here. Missing source content remains missing." };
}
