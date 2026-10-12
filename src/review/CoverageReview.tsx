import { useState } from "react";
import type { Plan, Report } from "./types";
const AXES = ["recognition", "application", "exceptions", "omissions"];
export function CoverageReview({ plan, report }: { plan: Plan; report: Report }) {
  const [query, setQuery] = useState(""); const needle = query.toLowerCase();
  const ideas = plan.ideas.filter(i => `${i.id} ${i.title} ${i.method_ids.join(" ")}`.toLowerCase().includes(needle));
  const missing = new Map(report.missing_obligations.map(o => [o.obligation, o]));
  return <section className="review-detail"><h2>What still needs evidence</h2><p>These are provisional operational ideas, not a claim that every book idea has been captured. Each axis needs distinct cases, exceptions and human judgment.</p>
    <div className="review-gates">{report.gates.map(g => <p key={g.id}><strong>{g.id.replaceAll("-", " ")}</strong><span>{g.status === "unverified" ? "Not yet verified" : "Evidence recorded — not certified"}</span></p>)}</div>
    <label>Find an idea or method<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="For example: passive voice, uncertainty, chronology" /></label>
    <div className="review-table-scroll" tabIndex={0} aria-label="Idea validation coverage"><table><thead><tr><th>Operational idea</th>{AXES.map(a => <th key={a}>{a}</th>)}</tr></thead><tbody>{ideas.map(i => <tr key={i.id}><th scope="row">{i.title}<small>{i.method_ids.join(", ")}</small></th>{AXES.map(a => { const gap = missing.get(`${i.id}:${a}`); return <td key={a}>{gap ? `${gap.passing_distinct_cases}/${gap.required} cases` : "Recorded floor met"}</td>; })}</tr>)}</tbody></table></div>
    <p className="review-note">{report.metrics.development_responses_excluded} development responses excluded; {report.metrics.unresolved_or_disputed} unresolved/disputed cases; {report.metrics.trace_failures} incomplete traces. Repeated outputs do not multiply idea coverage.</p>
    <details><summary>Source limitations and interpretation gaps</summary>{plan.source_limitations.map(c => <p key={c.source_id}>{c.source_id}: {c.description}</p>)}<p>All supplied physical pages were dispositioned, but missing primary content and independent interpretation review remain separate issues.</p></details>
    <p className="review-note">{report.caveat}</p>
  </section>;
}
