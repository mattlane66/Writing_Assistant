import { useState } from "react";
import type { Case, Criterion, Evidence, Outcome, Response, Reviewer } from "./types";
const FAILURES = ["false-criticism", "missed-defect", "meaning-drift", "unsupported-invention", "mode-breach", "privacy-breach", "method-omission", "overconfidence"];
export function ResponseReview({ evidence, reviewer, busy, submit }: { evidence: Evidence; reviewer: Reviewer; busy: boolean; submit: (review: unknown) => Promise<void> }) {
  const [id, setId] = useState(""); const response = evidence.responses.find(r => r.id === id) ?? evidence.responses[0];
  const task = evidence.cases.find(c => c.id === response?.case_id);
  if (!response || !task) return <section className="review-empty"><h2>No observed responses yet</h2><p>Import a private evidence workspace with registered cases and actual observed outputs. No responses or passing judgments are generated here.</p><p>You can begin reviewing source sections without importing writing outputs.</p></section>;
  return <div className="review-columns"><aside className="review-list"><h2>Observed responses</h2>{evidence.responses.map(r => <button key={r.id} aria-pressed={r.id === response.id} onClick={() => setId(r.id)}>{r.id}<small>{evidence.cases.find(c => c.id === r.case_id)?.origin === "independent-held-out" ? "Held-out case" : "Development case — excluded from reliability"}</small></button>)}</aside>
    <ResponseForm key={`${response.id}:${reviewer.id}`} response={response} task={task} existing={evidence.reviews.filter(r => r.response_id === response.id)} reviewer={reviewer} busy={busy} submit={submit} />
  </div>;
}
function ResponseForm({ response, task, existing, reviewer, busy, submit }: { response: Response; task: Case; existing: Evidence["reviews"]; reviewer: Reviewer; busy: boolean; submit: (value: unknown) => Promise<void> }) {
  const [grades, setGrades] = useState<Record<string, { outcome: string; reason: string }>>({}); const [failures, setFailures] = useState<string[]>([]);
  const [reason, setReason] = useState(""); const [role, setRole] = useState("initial");
  const alreadyRecorded = existing.some(r => r.reviewer.id === reviewer.id);
  const complete = task.obligations.every(o => grades[`${o.idea_id}:${o.axis}`]?.outcome && grades[`${o.idea_id}:${o.axis}`]?.reason.trim());
  const criteria = task.obligations.map(o => ({ idea_id: o.idea_id, axis: o.axis, outcome: grades[`${o.idea_id}:${o.axis}`]?.outcome as Outcome, reason: grades[`${o.idea_id}:${o.axis}`]?.reason ?? "" }));
  const update = (key: string, field: "outcome" | "reason", value: string) => setGrades(old => ({ ...old, [key]: { outcome: old[key]?.outcome ?? "", reason: old[key]?.reason ?? "", [field]: value } }));
  return <section className="review-detail"><h2>{task.id}</h2><p className="review-note">Mode: {task.editing_mode} · Author IDs: {task.author_ids.join(", ")} · {response.target.host} / {response.target.model_version}</p>
    <div className="review-reading-grid"><Reading title="User request" text={task.prompt} /><Reading title="Observed response" text={response.output} /></div>
    <details><summary>Registered expectations and captured trace</summary><Reading title="Oracle registered before execution" text={task.oracle} /><pre className="review-prose" tabIndex={0}>{JSON.stringify(response.trace, null, 2)}</pre></details>
    {existing.length ? <div className="review-history"><h3>Recorded judgments</h3>{existing.map(r => <p key={r.reviewer.id}>{r.reviewer.id} — {r.role}: {r.outcome}. {r.rationale}</p>)}</div> : null}
    {alreadyRecorded ? <p role="status">Your review of this response is locked. Select another response or reviewer; existing judgments are not overwritten.</p> : <form onSubmit={e => { e.preventDefault(); void submit({ response_id: response.id, reviewer, role, criteria, failure_types: failures, rationale: reason }); }}>
      <h3>Judge every declared criterion</h3><p className="review-note">Pass means the criterion is met in this response, not that the model has mastered the idea.</p>
      {task.obligations.map(o => { const key = `${o.idea_id}:${o.axis}`; return <fieldset key={key}><legend>{o.axis} · {o.idea_id}</legend><p>{o.expectation}</p><label>Judgment<select aria-label={`Judgment ${o.axis} ${o.idea_id}`} value={grades[key]?.outcome ?? ""} onChange={e => update(key, "outcome", e.target.value)} required><option value="">Choose a judgment</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="unresolved">Unresolved</option></select></label><label>Passage-based reason<textarea aria-label={`Reason ${o.axis} ${o.idea_id}`} value={grades[key]?.reason ?? ""} onChange={e => update(key, "reason", e.target.value)} maxLength={24000} required /></label></fieldset>; })}
      <fieldset><legend>Observed failure types</legend><div className="review-failure-grid">{FAILURES.map(f => <label className="review-check" key={f}><input type="checkbox" checked={failures.includes(f)} onChange={e => setFailures(old => e.target.checked ? [...old, f] : old.filter(x => x !== f))} />{f.replaceAll("-", " ")}</label>)}</div></fieldset>
      <label>Review role<select value={role} onChange={e => setRole(e.target.value)}><option value="initial">Initial review</option><option value="adjudicator">Third-reviewer adjudication</option></select></label>
      <p className="review-note">Adjudication requires two earlier independent human reviews and a separate independent reviewer.</p>
      <label>Overall rationale<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={24000} required /></label>
      <button className="review-primary" disabled={busy || !reviewer.human_attested || !reviewer.id || !complete || !reason.trim()}>Record and lock review</button>
    </form>}
  </section>;
}
export function Reading({ title, text }: { title: string; text: string }) { return <div><h3>{title}</h3><pre className="review-prose" tabIndex={0} aria-label={title}>{text}</pre></div>; }
export type { Criterion };
