import { useState } from "react";
import type { Evidence, HostObservation, HostObservationPacket } from "./types";
import { Reading } from "./ResponseReview";

const META = [{ key: "model_label", label: "Visible model label" }, { key: "model_version", label: "Observed model version" },
  { key: "plugin_id", label: "Observed plugin ID" }, { key: "plugin_version", label: "Observed plugin version" },
  { key: "server_revision", label: "Observed server revision" }] as const;
const optional = (value: string) => value.trim() ? value : null;

export function ObservationCapture({ evidence, packet, busy, submit }: {
  evidence: Evidence; packet: HostObservationPacket; busy: boolean; submit: (value: unknown) => Promise<boolean>;
}) {
  const [generation, setGeneration] = useState(0);
  return <section className="review-detail"><h2>Capture an actual test</h2>
    <p className="review-warning">These are ungraded observations, not reliability evidence. Unknown versions and missing tool results stay unknown. Saving here does not change coverage, create a human grade or prove the assistant used a method.</p>
    <p className="review-note">Session only. Export the observation packet before refreshing. Do not paste credentials, source books or unrelated private information.</p>
    <CaptureForm key={generation} evidence={evidence} busy={busy} submit={async value => {
      const saved = await submit(value); if (saved) setGeneration(old => old + 1); return saved;
    }} />
    <h3>Saved observations ({packet.observations.length})</h3>
    {packet.observations.length ? packet.observations.map(record => <details key={record.id}>
      <summary>{record.host} · {record.result_kind} · {record.capture_origin === "synthetic-ui-fixture" ? "Synthetic fixture" : "Actual host observation"} · {record.id}</summary>
      <p className="review-note">Case: {record.case_id ?? "Not linked"} · Captured: {record.captured_at} · Observed time: {record.observed_at ?? "Unknown"}</p>
      <div className="review-reading-grid"><Reading title={`Captured prompt ${record.id}`} text={record.actual_prompt} /><Reading title={`Captured answer ${record.id}`} text={record.output ?? "No answer captured"} /></div>
      <Reading title={`Visible error ${record.id}`} text={record.visible_error ?? "No error captured (not proof that no error occurred)"} />
      <Reading title={`Tool evidence ${record.id}`} text={record.raw_tool_evidence ?? "Tool results not captured — unavailable or unknown"} />
      <pre className="review-prose" tabIndex={0} aria-label={`Version observations ${record.id}`}>{JSON.stringify(record.metadata, null, 2)}</pre>
      {record.notes ? <Reading title={`Capture notes ${record.id}`} text={record.notes} /> : null}
      <p className="review-note">Record hash detects edits only; it does not authenticate the observer or validate judgment.</p>
    </details>) : <p>No observations captured. Nothing has been invented or graded.</p>}
  </section>;
}

function CaptureForm({ evidence, busy, submit }: { evidence: Evidence; busy: boolean; submit: (value: unknown) => Promise<boolean> }) {
  const [host, setHost] = useState(""); const [origin, setOrigin] = useState(""); const [kind, setKind] = useState("");
  const [caseId, setCaseId] = useState(""); const [prompt, setPrompt] = useState(""); const [output, setOutput] = useState("");
  const [error, setError] = useState(""); const [tools, setTools] = useState(""); const [notes, setNotes] = useState("");
  const [observedAt, setObservedAt] = useState(""); const [attested, setAttested] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const hasResult = ["answer", "fallback"].includes(kind) ? !!output.trim() : kind === "platform-error" ? !!error.trim()
    : kind === "no-answer" ? !output.trim() && !!(error.trim() || notes.trim()) : kind === "partial" && !!(error.trim() || notes.trim());
  const complete = host && origin && kind && prompt.trim() && hasResult && attested;
  return <form onSubmit={event => { event.preventDefault(); if (!complete || busy) return;
    void submit({ id: `observation-${crypto.randomUUID()}`, case_id: caseId || null, host, capture_origin: origin, result_kind: kind,
      observed_at: optional(observedAt), actual_prompt: prompt, output: optional(output), visible_error: optional(error),
      raw_tool_evidence: optional(tools), notes: optional(notes), faithful_capture_attested: true,
      metadata: Object.fromEntries(META.map(({ key }) => [key, optional(metadata[key] ?? "")])) });
  }}>
    <div className="review-reading-grid"><label>Test host<select value={host} onChange={event => setHost(event.target.value)} required><option value="">Choose the actual host</option><option value="chatgpt-chat">ChatGPT Chat</option><option value="chatgpt-work">ChatGPT Work</option></select></label>
      <label>Capture origin<select value={origin} onChange={event => setOrigin(event.target.value)} required><option value="">Choose the origin</option><option value="actual-host-observation">Actual host observation</option><option value="synthetic-ui-fixture">Synthetic UI fixture — not a host test</option></select></label></div>
    <label>Observed result<select value={kind} onChange={event => setKind(event.target.value)} required><option value="">Choose what actually happened</option><option value="answer">Answer appeared — not a quality verdict</option><option value="fallback">Fallback answer / tools unavailable</option><option value="platform-error">Platform error (an answer may also be visible)</option><option value="no-answer">No answer captured</option><option value="partial">Partial or uncertain completion</option></select></label>
    <label>Registered case (optional)<select value={caseId} onChange={event => setCaseId(event.target.value)}><option value="">Not linked to a registered case</option>{evidence.cases.map(task => <option key={task.id} value={task.id}>{task.id}</option>)}</select></label>
    <p className="review-note">Link only to a case whose exact registered prompt occurs in the actual request. Linking does not register a new case or promote this observation.</p>
    <label>Actual submitted request<textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={24000} required /></label>
    <label>Actual answer (leave blank if none)<textarea value={output} onChange={event => setOutput(event.target.value)} maxLength={24000} /></label>
    <label>Visible error (optional)<textarea value={error} onChange={event => setError(event.target.value)} maxLength={24000} /></label>
    <label>Actual visible tool evidence (optional)<textarea value={tools} onChange={event => setTools(event.target.value)} maxLength={24000} /></label>
    <p className="review-note">Copy only visible calls/results. Do not infer tool use from an answer or paste hidden reasoning. Missing evidence stays null.</p>
    <details><summary>Versions and observation time — leave unknown fields blank</summary>
      <div className="review-reading-grid">{META.map(({ key, label }) => <label key={key}>{label}<input value={metadata[key] ?? ""} onChange={event => setMetadata(old => ({ ...old, [key]: event.target.value }))} maxLength={24000} /></label>)}</div>
      <label>Observed time (ISO timestamp with timezone, optional)<input value={observedAt} onChange={event => setObservedAt(event.target.value)} placeholder="2026-10-13T12:00:00Z" maxLength={100} /></label>
      <p className="review-note">The save time is recorded separately. A visible model label is not a verified model version; the current local plan is not an observed server revision.</p>
    </details>
    <label>Capture notes (optional)<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={24000} /></label>
    <label className="review-check"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} />This is a faithful capture of the stated observation, or it is explicitly marked as a synthetic fixture. I have not invented missing results.</label>
    <button className="review-primary" disabled={busy || !complete}>Save ungraded observation</button>
  </form>;
}
export type { HostObservation };
