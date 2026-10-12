import { useState } from "react";
import type { BlindGrade, BlindPacket, Reviewer } from "./types";
import { hashReview } from "./client";
import { Reading } from "./ResponseReview";
type Draft = { score: string; fidelity: string; reason: string };
export function BlindReview({ packet, reviewer, busy, locked, submit }: { packet: BlindPacket | null; reviewer: Reviewer; busy: boolean; locked: boolean; submit: (value: unknown) => Promise<void> }) {
  const [caseId, setCaseId] = useState(""); const [grades, setGrades] = useState<Map<string, Draft>>(() => new Map());
  if (!packet) return <section className="review-empty"><h2>No anonymous packet loaded</h2><p>Import a reviewer packet produced by the existing blinded-comparison service. Keep its condition key separate and unavailable to the reviewer until ratings are locked.</p><p>This surface cannot generate comparator outputs or tell you which system produced a response.</p></section>;
  const task = packet.cases.find(c => c.case_id === caseId) ?? packet.cases[0];
  const all = packet.cases.flatMap(c => c.responses); const rated = all.filter(r => { const g = grades.get(r.id); return g?.score && g.fidelity && g.reason.trim(); }).length;
  const update = (id: string, field: keyof Draft, value: string) => setGrades(old => new Map(old).set(id, { score: old.get(id)?.score ?? "", fidelity: old.get(id)?.fidelity ?? "", reason: old.get(id)?.reason ?? "", [field]: value }));
  async function lock() {
    if (!packet) return;
    const ratings: BlindGrade[] = await Promise.all(packet.cases.flatMap(c => c.responses.map(async r => {
      const g = grades.get(r.id)!; const body = { case_id: c.case_id, response_id: r.id, output_sha256: r.output_sha256,
        score: Number(g.score), fidelity_failure: g.fidelity === "yes", reason: g.reason };
      return { ...body, evidence_sha256: await hashReview(body) };
    })));
    await submit({ reviewer, ratings });
  }
  return <section className="review-detail"><h2>Anonymous comparisons</h2><p>{packet.rubric}</p><p role="status">{rated} of {all.length} responses rated. No condition key has been imported.</p>
    <label>Comparison case<select value={task.case_id} onChange={e => setCaseId(e.target.value)}>{packet.cases.map(c => <option key={c.case_id} value={c.case_id}>{c.case_id}</option>)}</select></label>
    <Reading title="Shared user request" text={task.prompt} />
    {task.responses.map((r, i) => <fieldset key={r.id}><legend>Anonymous response {i + 1}</legend><pre className="review-prose" tabIndex={0}>{r.text}</pre>
      <label>Overall task success<select aria-label={`Score response ${i + 1}`} disabled={locked} value={grades.get(r.id)?.score ?? ""} onChange={e => update(r.id, "score", e.target.value)}><option value="">Choose a score</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} — {n === 1 ? "materially wrong" : n === 5 ? "strong, faithful and restrained" : "intermediate"}</option>)}</select></label>
      <label>Material fidelity failure?<select aria-label={`Fidelity response ${i + 1}`} disabled={locked} value={grades.get(r.id)?.fidelity ?? ""} onChange={e => update(r.id, "fidelity", e.target.value)}><option value="">Choose explicitly</option><option value="no">No</option><option value="yes">Yes</option></select></label>
      <label>Passage-based reason<textarea aria-label={`Reason response ${i + 1}`} disabled={locked} value={grades.get(r.id)?.reason ?? ""} onChange={e => update(r.id, "reason", e.target.value)} maxLength={24000} /></label></fieldset>)}
    <button className="review-primary" disabled={locked || busy || !reviewer.human_attested || !reviewer.id || rated !== all.length} onClick={() => void lock()}>{locked ? "Ratings locked — export before unblinding" : "Lock all anonymous ratings"}</button>
    <p className="review-note">Changing imported packets clears local draft ratings. The exported ratings require the separately held key for comparison; they never certify superiority.</p>
  </section>;
}
