# Private editorial review workbench

The workbench makes the existing reliability service usable for real reviews. It does not generate judgments, certify identity, or turn software tests into evidence of writing quality. Matthew Lane is the designated reviewer; his name is prefilled, but human and independence attestations are never preselected.

## Open and use it

From this checkout, run `npm run review:local`, then open [the local workbench](http://127.0.0.1:8791/review.html). The server binds only to `127.0.0.1`. It does not replace the public editor or change the installed ChatGPT plugin.

Five views share temporary browser-session state:

- **Coverage & gaps:** inspect the four recognition/application/exception/omission obligations for each provisional idea. Missing observations stay missing, rather than becoming passing grades.
- **Capture a test:** faithfully save an actual Chat/Work request and visible answer, error or incomplete outcome. Select actual observation versus synthetic fixture deliberately; leave unknown versions, times and tool results blank. These records are separate, ungraded observations, not quality verdicts or reliability evidence. Export them separately; re-import retains that distinction.
- **Review responses:** import a valid reliability evidence JSON file containing actual captured responses; inspect the prompt, output, oracle and trace; deliberately grade every criterion with reasons. Mark failures or unresolved questions. Lock the review and export the updated evidence.
- **Review source ideas:** consult the lawful PDF separately, compare each mapped idea and its qualifications with the actual source, and record agreement or a specific correction. The first batch contains one section from each of the seven supplied sources. The toggle exposes all 171 sections. Prepared sections are not independently reviewed sections.
- **Compare anonymously:** import the reviewer packet created by the existing blinded-comparison service. Rate every anonymous response, lock the ratings, and export them. Keep the condition key elsewhere; this interface rejects it.

Imports must follow the existing [reliability protocol](RELIABILITY_SERVICE.md) and blinded-comparison schemas. The workbench does not invent observed responses, register unseen cases automatically, run models, or create comparison outputs. Use the existing service to prepare cases, evidence and anonymous packets. Synthetic development fixtures are software evidence only.

## Capture answers without inventing missing evidence

Use **Capture a test** when a host answer or operational error exists but the
strict reliability record cannot honestly be completed. The result categories
describe what appeared, never whether the writing was correct. A platform error
can coexist with a visible answer. No-answer and partial records require a stated
limitation; answer and fallback records require the copied answer. Faithful-copy
attestation is not human editorial review or authenticated provenance.

The `writing-host-observations` packet preserves exact request/output text and
nullable metadata. Its `capture_plan_fingerprint` identifies the local collection
plan, not the server/model actually invoked. Visible model labels are separate
from model versions; a selected plugin's page version is not a runtime receipt.
Tool evidence is copied text only, never inferred or certified by this service.
Linking to an already registered case requires its exact prompt to occur in the
actual request and neither registers a new case nor supplies its oracle.

Record hashes detect edited content, not fraudulent transcription. Duplicate IDs,
modified hashes, unknown fields, stale plan fingerprints and collections above
100 entries are rejected. A failed import leaves existing captures unchanged.
Raw legacy observations are deliberately not guessed into this schema; retain
the original and faithfully transcribe the visible information into a new record.
Do not fill unknown fields just to enable reliability import. The strict review
ledger still requires its own complete, real case/response/version/trace evidence
and independently submitted human judgments. There is no automatic promotion.

Export observations before refresh. **Clear session** opens an in-page choice:
**Keep session** cancels without losing data; **Confirm clear session** clears
imported text, observations and unsaved grades from memory. Exported files remain
on disk. This replaces a built-in dialog that stalled background browser controls
during testing; it does not remove the deliberate confirmation requirement.

## First review batch

Begin in **Review source ideas**. For each section:

1. Open the actual local PDF at the displayed physical page range. Source caveats, including the incomplete secondary summary and missing printed page, remain visible.
2. Read every displayed original card, linked method, exception, alternative and restraint example against those pages.
3. Look for omitted ideas and qualifications, not only errors in existing mappings. Record specific omissions or disagreements as **needs correction**.
4. Confirm that you personally checked the source; choose a judgment; explicitly attest to human review and independence only when accurate.
5. Record the audit and **export the workspace** before refreshing or closing the page.

One reviewed section per source does not validate all ideas in the source. The underlying plan has 203 provisional units and 812 axis obligations. The units themselves remain subject to independent completeness review. Existing source defects cannot be fixed by declaring an audit agreed.

## Reviews, independence and disputes

Every criterion requires an explicit pass, fail or unresolved choice and a written reason. Failure flags force a failed overall result; unresolved criteria cannot silently become passes. Case authors cannot claim independent review of their own cases. Independence is a human attestation, not authenticated by an editable JSON record or a hash.

Response judgments are locked per reviewer and response. Third-reviewer adjudication requires two earlier independent human initial reviews and a separate independent human reviewer. Matthew alone cannot supply all three roles. Source-section audits also retain their history: a correction is not silently overwritten with agreement. Correct the canonical content through a reviewed change, retain the old export, then collect version-scoped evidence using the service's new configuration. Do not merge old grades into a changed configuration merely to clear a gate.

Reports distinguish development data from held-out evidence and independent human observations. A source audit is not an execution grade; a passing execution grade is not complete book mastery. Real intended-host observations and fair comparative evidence remain separate gates.

## Privacy and operational boundary

The browser holds the current private workspace in memory. Refresh discards it. There is no local storage, telemetry, provider call, external network dependency or automatic save. Explicit exports create private JSON downloads under your control; keep them outside Git and other shared folders. Imported content is processed by this local server for validation, then returned without business-state retention or private-text logging.

The separately built page and server are excluded from the public runtime container. The server restricts Host and Origin, requires a per-process token for writes, sets no-store and a self-only content policy, rejects unknown input fields, and bounds JSON requests to 16 MB. These controls do not authenticate the human reviewer or encrypt exported files. Do not expose this loopback service through a tunnel or shared deployment.

Clearing the workspace or refreshing removes in-memory session data, not previously downloaded files. The UI never receives source PDFs or extracted book text. Missing mappings must block agreement rather than be guessed.

## Verification and remaining limits

Contract, server and rendering tests cover deliberate grades, immutability, independence restrictions, source disagreements, anonymous hashes, condition-key rejection, local access restrictions and exclusion from the public server. Browser interaction checks exercised desktop and a simulated mobile viewport, separate pane scrolling, review/export, anonymous lock/export and refresh clearing, without external requests.

The earlier workbench browser checks used bundled Playwright with a fresh headless installed Chrome profile because the browser plugin and bundled browser binary were unavailable. They are not physical-phone, Safari, screen-reader, real-user, or ChatGPT Chat/Work acceptance tests. No real human grade or quality improvement was established by those synthetic checks. The intended-host workflow, independent source audits, unseen execution judgments, and final fair comparisons still need actual observations.

October 13 capture checks used supported computer-use browser controls in the
in-app browser (the separate Browser plugin/skill was not available). Desktop
and simulated 390 × 844 layout checks exercised save, export, re-import, rejected
legacy import preserving prior data, cancel/confirm clearing, and actual native
scrolling inside a long textarea. Coverage stayed at zero judged requests / 812
open obligations / 171 unaudited sections. Mac keyboard shortcut scrolling did
not produce a verified movement in this harness; keyboard/screen-reader and
physical-phone usability remain unaccepted. Local console checks showed no
errors/warnings or framework overlay.

The two previously authorized real Chat/Work responses were also copied through
this form and exported separately, with missing tool results/model versions left
null. They retain fallback/error limitations and the Chat primer incident; they
are not software fixtures, independent grades, clean runtime passes or evidence
of method execution. Private exports and screenshots are excluded from Git.

Full `npm run check` passed: 624 main + 89 Diagnostic software tests (713 total),
including 20 new capture/confirmation safeguards. This is engineering evidence,
not a writing-quality score or launch decision.
