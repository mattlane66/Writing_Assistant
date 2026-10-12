import { useEffect, useState } from "react";
import type { BlindPacket, Bootstrap, Evidence, Report, Reviewer, WorkspaceResult } from "./types";
import { downloadPrivateJson, readPrivateJson, reviewRequest } from "./client";
import { ReviewerFields } from "./ReviewerFields";
import { ResponseReview } from "./ResponseReview";
import { SourceReview } from "./SourceReview";
import { CoverageReview } from "./CoverageReview";
import { BlindReview } from "./BlindReview";
const TABS = [{ id: "coverage", label: "Coverage & gaps" }, { id: "responses", label: "Review responses" }, { id: "sources", label: "Review source ideas" }, { id: "blind", label: "Compare anonymously" }];
export default function ReviewApp() {
  const [data, setData] = useState<Bootstrap | null>(null); const [evidence, setEvidence] = useState<Evidence | null>(null); const [report, setReport] = useState<Report | null>(null);
  const [tab, setTab] = useState("coverage"); const [reviewer, setReviewer] = useState<Reviewer>({ id: "matthew-lane", independent: false, human_attested: false });
  const [packet, setPacket] = useState<BlindPacket | null>(null); const [lockedRatings, setLockedRatings] = useState<unknown>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/review/bootstrap", { signal: abort.signal }).then(async r => { if (!r.ok) throw new Error("Local review API unavailable. Start the private workbench; this is not the public plugin server."); return r.json() as Promise<Bootstrap>; })
      .then(value => { setData(value); setEvidence(value.workspace); setReport(value.report); })
      .catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Local review could not start."); });
    return () => abort.abort();
  }, []);
  async function update(operation: "review" | "source-audit", value: unknown) {
    if (!data || !evidence) return;
    setBusy(true); setError("");
    try { const result = await reviewRequest<WorkspaceResult>(data.token, operation, { evidence, [operation === "review" ? "review" : "audit"]: value });
      setEvidence(result.evidence); setReport(result.report); setMessage("Record locked in this session. Export your private workspace to keep it; no server file was saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Review not accepted."); } finally { setBusy(false); }
  }
  async function importFile(file: File | undefined, blind = false) {
    if (!file || !data) return;
    setBusy(true); setError("");
    try { const value = await readPrivateJson(file);
      if (blind) { const result = await reviewRequest<{ packet: BlindPacket }>(data.token, "blind-import", { packet: value }); setPacket(result.packet); setLockedRatings(null); setTab("blind"); }
      else { const result = await reviewRequest<WorkspaceResult>(data.token, "import", { evidence: value }); setEvidence(result.evidence); setReport(result.report); setWorkspaceRevision(old => old + 1); setTab("responses"); }
      setReviewer(old => ({ ...old, independent: false, human_attested: false })); setMessage("Imported into this session only. Nothing was uploaded beyond this loopback service or saved on the server.");
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed; the current workspace is unchanged."); } finally { setBusy(false); }
  }
  async function lockRatings(value: unknown) {
    if (!data || !packet) return;
    setBusy(true); setError("");
    try { const result = await reviewRequest<{ ratings: unknown }>(data.token, "blind-lock", { packet, ratings: value }); setLockedRatings(result.ratings); setMessage("Anonymous ratings locked. Export them before the condition key is revealed."); }
    catch (e) { setError(e instanceof Error ? e.message : "Ratings could not be locked."); } finally { setBusy(false); }
  }
  function clear() {
    if (!data || !window.confirm("Clear all imported text and unsaved reviews from this session? Export first if you need to keep them.")) return;
    setEvidence(data.workspace); setReport(data.report); setPacket(null); setLockedRatings(null); setReviewer(old => ({ ...old, independent: false, human_attested: false })); setError(""); setMessage("Session cleared. Previously downloaded files are not deleted.");
    setWorkspaceRevision(old => old + 1);
  }
  return <div className="app-shell review-shell"><header className="app-header"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span>A</span></span><h1>Writing Assistant · Review</h1></div><p className="review-local">Local only · no model calls</p></header>
    <main><section className="review-intro"><h2>Make the judgments inspectable.</h2><p>Review what the assistant actually did, what it missed, and when it should have left the writing alone.</p><p className="review-warning">Private text is processed only by this local workbench. Session memory is temporary. Exports contain private evidence; keep them protected. No human judgments are generated or assumed.</p></section>
      {error ? <p className="review-error" role="alert">{error}</p> : null}{message ? <p className="review-message" role="status">{message}</p> : null}
      {!data || !evidence || !report ? <p>{error ? "The review workspace is unavailable." : "Loading the current methods and validation plan…"}</p> : <>
        <div className="review-toolbar"><label>Import private workspace<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label><label>Import anonymous reviewer packet<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { void importFile(e.target.files?.[0], true); e.target.value = ""; }} /></label>
          <button disabled={busy} onClick={() => downloadPrivateJson(evidence, "writing-private-review-workspace.json")}>Export private workspace</button><button disabled={busy || !lockedRatings} onClick={() => downloadPrivateJson(lockedRatings, "writing-locked-blind-ratings.json")}>Export locked ratings</button><button disabled={busy} onClick={clear}>Clear session</button></div>
        <dl className="review-summary"><div><dt>Independently judged requests</dt><dd>{report.metrics.distinct_held_out_cases_judged}</dd></div><div><dt>Idea-axis obligations still open</dt><dd>{report.missing_obligations.length}</dd></div><div><dt>Source sections still unaudited</dt><dd>{report.missing_sections.length}</dd></div></dl>
        <p className="review-note">Corpus {data.plan.corpus_version} · {data.plan.totals.methods} methods · {data.plan.totals.ideas} provisional idea units. Passing records are bounded evidence, not launch approval or guaranteed mastery.</p>
        <nav className="review-nav" aria-label="Review workflow">{TABS.map(t => <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
        {tab === "coverage" ? <CoverageReview plan={data.plan} report={report} /> : <><ReviewerFields value={reviewer} onChange={setReviewer} />
          {tab === "responses" ? <ResponseReview key={workspaceRevision} evidence={evidence} reviewer={reviewer} busy={busy} submit={value => update("review", value)} />
            : tab === "sources" ? <SourceReview key={workspaceRevision} data={data} evidence={evidence} reviewer={reviewer} busy={busy} submit={value => update("source-audit", value)} />
              : <BlindReview key={packet?.assignment_sha256 ?? "empty"} packet={packet} reviewer={reviewer} busy={busy} locked={!!lockedRatings} submit={lockRatings} />}</>}
      </>}
    </main><footer className="review-footer">No source PDFs, extracted book text, provider credentials or condition keys are loaded by this service. Existing public plugin permissions and hosting are unchanged.</footer>
  </div>;
}
