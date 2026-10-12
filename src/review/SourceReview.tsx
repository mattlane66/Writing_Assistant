import { useState } from "react";
import type { Bootstrap, Evidence, Reviewer, Section } from "./types";
import { Reading } from "./ResponseReview";
export function SourceReview({ data, evidence, reviewer, busy, submit }: { data: Bootstrap; evidence: Evidence; reviewer: Reviewer; busy: boolean; submit: (value: unknown) => Promise<void> }) {
  const [id, setId] = useState(""); const [showAll, setShowAll] = useState(false);
  const sections = showAll ? data.plan.sections : data.batch.sections;
  const section = sections.find(s => s.id === id) ?? sections[0];
  return <><p>{data.batch.caveat}</p><label className="review-check"><input type="checkbox" checked={showAll} onChange={e => { setShowAll(e.target.checked); setId(""); }} />Show all {data.plan.totals.sections} source sections rather than the first batch</label>
    <div className="review-columns"><aside className="review-list"><h2>Source sections</h2>{sections.map(s => <button key={s.id} aria-pressed={s.id === section?.id} onClick={() => setId(s.id)}>{s.source_id}<small>{s.pages.map(p => `${p.start}–${p.end}`).join(", ")} · {evidence.section_audits.some(a => a.section_id === s.id) ? "Record exists" : "Not independently reviewed"}</small></button>)}</aside>
    {section ? <SourceForm key={section.id} section={section} data={data} evidence={evidence} reviewer={reviewer} busy={busy} submit={submit} /> : <p>No source sections available.</p>}</div></>;
}
function SourceForm({ section, data, evidence, reviewer, busy, submit }: { section: Section; data: Bootstrap; evidence: Evidence; reviewer: Reviewer; busy: boolean; submit: (value: unknown) => Promise<void> }) {
  const [checked, setChecked] = useState(false); const [outcome, setOutcome] = useState(""); const [notes, setNotes] = useState("");
  const existing = evidence.section_audits.find(a => a.section_id === section.id);
  const missingMapping = section.original_card_ids.some(id => !data.catalog.cards.some(card => card.id === id));
  return <section className="review-detail"><h2>{section.title}</h2><p>Source: {section.source_id} · Physical PDF pages {section.pages.map(p => `${p.start}–${p.end}`).join(", ")}</p>
    {data.plan.source_limitations.filter(c => c.source_id === section.source_id).map(c => <p className="review-warning" key={c.source_id}>{c.description}</p>)}
    <h3>Questions for independent review</h3><ol>{data.batch.review_questions.map(q => <li key={q}>{q}</li>)}</ol>
    <p className="review-note">Open your lawful local source separately. What follows is the original operational example bank, not extracted book text.</p>
    {section.original_card_ids.map(id => { const card = data.catalog.cards.find(c => c.id === id); return card ? <details key={id}><summary>{card.title}</summary><p>{card.mechanism}</p><h3>Procedure</h3><ol>{card.steps.map(s => <li key={s}>{s}</li>)}</ol><h3>Exceptions</h3><ul>{card.exceptions.map(s => <li key={s}>{s}</li>)}</ul><Reading title="Original practice passage" text={card.example.before} /><Reading title="One defensible revision" text={card.example.after} /><p>{card.example.why}</p>
      {card.example.practice ? <><h3>Preserve these commitments</h3><ul>{card.example.practice.invariants.map(s => <li key={s}>{s}</li>)}</ul>{card.example.practice.alternatives.map(a => <div key={a.text}><Reading title="Another defensible revision" text={a.text} /><p>{a.when_to_prefer}</p><p className="review-note">Tradeoff: {a.tradeoff}</p></div>)}</> : null}
      {card.counterexample ? <><Reading title="When not to apply this method" text={card.counterexample.text} /><p>{card.counterexample.why_not_apply}</p></> : null}
      <h3>Linked canonical methods</h3>{card.concept_ids.map(methodId => { const method = data.catalog.methods.find(m => m.id === methodId); return method ? <details key={methodId}><summary>{method.name}</summary><ol>{method.procedure.map(s => <li key={s}>{s}</li>)}</ol><ul>{method.exceptions.map(s => <li key={s}>{s}</li>)}</ul></details> : null; })}
      <h3>Provenance and caveats</h3>{card.sources.map((s, i) => <p key={i}>{s.ref}: {s.locator}. {s.caveat}</p>)}</details> : <p className="review-warning" key={id}>Mapped card unavailable: {id}. Do not approve an incomplete mapping.</p>; })}
    {existing ? <div className="review-history"><h3>Recorded audit</h3><p>{existing.reviewer.id}: {existing.outcome}. Independence attested: {existing.reviewer.independent ? "yes" : "no"}.</p>{existing.omissions_or_disagreements.map(n => <p key={n}>{n}</p>)}<p>This record is retained, not silently overwritten.</p></div> : <form onSubmit={e => { e.preventDefault(); void submit({ section_id: section.id, reviewer, outcome, idea_ids: section.original_card_ids, notes, source_checked: checked }); }}>
      <label className="review-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I checked these source pages, every mapped idea, and its qualifications against the actual source.</label>
      <label>Section judgment<select value={outcome} onChange={e => setOutcome(e.target.value)} required><option value="">Choose a judgment</option><option value="agreed">Mapped ideas agree; no unresolved omissions found</option><option value="needs-correction">Correction, missing idea, exception or disagreement</option></select></label>
      <label>Missing ideas, exceptions or disagreements<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={24000} required={outcome === "needs-correction"} /></label>
      <p className="review-note">An agreed judgment cannot contain unresolved notes. A recorded audit does not certify every idea in the book.</p>
      <button className="review-primary" disabled={busy || !reviewer.human_attested || !reviewer.id || !checked || !outcome || (outcome === "needs-correction" && !notes.trim()) || (outcome === "agreed" && (!!notes.trim() || missingMapping))}>Record and lock source audit</button>
    </form>}
  </section>;
}
