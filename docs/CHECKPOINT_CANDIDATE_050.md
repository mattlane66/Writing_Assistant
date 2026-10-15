# Author-owned checkpoint candidate — 0.50.0 / MCP 2.7.0

Prepared October 14, 2026 after the actual 0.49.0 pilot exposed lost document and
workflow packets between turns. This is local implementation/development QA,
not deployed-host acceptance or proof of editorial mastery.

## Repair and boundary

`render_writing_checkpoint` is one read-only render operation. It requires
separate explicit processing and private-export permission, complete unchanged
workflow/document state and its exact hash. It reuses canonical pointer, stage,
state and knowledge validators without advancing a workflow, approving context,
writing prose or reconstructing a missing record.

The view exposes the exact snapshot and missing recorded reviews. The author can
select/copy private JSON, request a local download, or confirm that the snapshot
matches the passage and send it for discussion only. Historical permissions and
JSON values are data, not new authority. New text needs fresh framing and fresh
edit permission. Document restore disables context until newly approved.

The model must render while the packet is still available. This cannot recover
already lost state or guarantee host compliance. No provider, remote draft
retention, browser storage, new authentication, background export or automatic
clipboard write is added. A snapshot can be stale, and editable hashes do not
authenticate execution or certify semantic judgment.

The view uses the shared MCP Apps bridge and detects the existing legacy message
adapter as fallback. Only render tools have a UI resource. The new resource has
empty external-domain allowlists and a versioned cache URI. The
[official UI guidance](https://developers.openai.com/plugins/build/chatgpt-ui)
separates ephemeral widget state from durable storage; no widget state is used as
the data store here.

## Regression and version scope

Local source: plugin 0.50.0 / MCP 2.7.0, 24 tools and two UI resources. The live
service and selected private web assistant/portal draft remain 2.6.0 / 0.49.0
until separately released and observed. All previous operations remain.

The portable candidate archive was generated for the unchanged HTTPS endpoint:
`Writing-Assistant-0.50.0-MCP.zip`, SHA-256
`5de5446c9ddddd38584b224b90cc58403b1353ccf772bad91dd656b935ad0260`.
It contains seven package files, no PDFs, private drafts, credentials or evaluation
receipts. The new UI is served by the repository MCP deployment, not uploaded as
book knowledge. This archive is not an installed private release or an approved
public submission.

Twenty new regression tests cover permissions, exact snapshots, stale/altered
state, maximal document sections, context boundaries, missing audits, resource
metadata, modern/legacy handoff, resets and duplicate-send suppression. Six
original recognition/execution fixtures use existing stable concept IDs. Source
identities, caveats and idea IDs are unchanged. Fingerprints include the new
validator and UI; old 0.49.0 observations must never be relabeled as current.

Full `npm run check` passed: **658 main + 89 Diagnostic = 747 software tests**,
plus integrity checks, builds and packaging. Initial runs caught outdated exact
tool/resource expectations; the revised assertions enumerate all 24 tools and
both render resources, and require every other tool to remain UI-free. No
assertion/timeout was weakened and no hosted model API was used.

A repeat sandboxed run failed at local test-server socket binding (`EPERM`),
before those API assertions could run. The suite was rerun with reviewed local
socket access rather than skipping or weakening those checks. This environment
failure is not a passed test or evidence of an editorial defect.

## Local rendered verification

Flow: original public document fixture → inspect/select/scroll exact JSON →
confirm passage → send intact record to a simulated host for discussion →
refresh/reset or reject an altered snapshot. The loopback-only preview at port
8794 is visibly labeled development fixture, not Chat/Work evidence.

| Check | Observed result |
|---|---|
| Identity / content | Correct preview title/URL, exact passage and unreviewed-section count. |
| Framework overlay / console | No overlay or captured errors/warnings. |
| Selection / scrolling | All 1,067 fixture JSON characters selected; keyboard scroll reached the textarea bottom. |
| Confirmation / handoff | Disabled until confirmation; complete record sent with discussion-only boundary. |
| Fresh result | Confirmation cleared and handoff disabled again. |
| Altered snapshot | Visible hash error, old view hidden; a fresh valid snapshot restores it. |
| Download | Browser event not confirmed; UI claims only a request and preserves select/copy. No saved file asserted. |

Screenshots and preview harness are temporary local artifacts. Real host download,
mobile/touch, screen readers, refresh/context loss and full host console behavior
remain unverified. This local bridge is not an actual host acceptance test.

## Next acceptance and launch gates

### October 15 deployment and narrow host acceptance

The owner-approved release is live at feature commit `749a135` (deployment
`cbd916c1-1ad6-4fe2-8932-0f71f3094d78`, SUCCESS): MCP 2.7.0, 24 tools, two
resources and checkpoint UI 1.0.1. Live HTTP checks read the exact current UI,
preserved a complete fixture snapshot, rejected missing export permission and
altered state, and restored a document with context disabled. The provider
revision API remains disabled. The private assistant is still the same 0.50.0
identity/release with seven retained PDFs; the portal draft remains 0.49.0 and
unpublished. The usage-limit approval interruption was resolved by waiting past
reset and checking normal usage availability, not bypassing the approval path.

Fresh Chat and a new unreviewed Work record both visibly rendered the repaired
view with exact original passage, zero reviewed sections, disabled context and a
successful display integrity check. Their selectable JSON carried the exact
deployed revision (1,177 and 1,175 characters respectively). Handoff was disabled
until author confirmation; clicking it sent the complete record for discussion
only and then disabled duplicate sending. The older failed widgets remain as
history, not a passed result.

Chat's follow-up reported an exact restoration, matching state hash, disabled
context and no edits. Work initially declined restoration because app-authored
handoff text cannot itself grant new user authorization; a separate typed
restoration permission was then supplied for this test. That difference is a
real host boundary, not permission to weaken the trust model. Raw tool results
are not exposed; host-reported restoration is not authenticated execution proof.
After that separate typed authorization, Work reported a successful restore
using the exact supplied state hash, unchanged text, zero reviewed sections and
disabled/null active context. It explicitly distinguished structural validation
from semantic proof and durable memory. This is a new unreviewed record's
same-thread continuation, not recovery of the earlier reviewed packet or a
fresh-conversation reimport test.

Work's connection interruption was preserved, then a normal reload displayed the
completed response without resending the request. Console captures contain host
Statsig networking/403 warnings, so full host console health is not a clean pass.
No framework error overlay was visible in the repaired view. Desktop keyboard
selection and confirmation/handoff were exercised in the in-app browser (the
Browser plugin was unavailable). Mobile/touch, screen readers, downloads,
fresh-conversation reimport and selected-edit/final-audit completion remain open.
No independent editorial ratings or mastery/superiority claims were created.

Owner-approved deployment began with `02f2580`; the first live HTTP acceptance
probe found the checkpoint resource returned an internal error because the
runtime image omitted `products/writing-assistant-plugin/ui`. This also affects
workflow fingerprint loading, so health/tool discovery alone was insufficient.
The follow-up repair copies that directory and adds actual image-build resource
and workflow-fingerprint checks plus a regression for those Docker requirements.
Real host acceptance is held pending the corrected deployment and live recheck.
The repaired candidate passed the complete checks again: 659 main + 89
Diagnostic = 748 software tests, including the new runtime-image regression.
The same private assistant was saved as 0.50.0 with its App, audience, all seven
PDFs and presentation preserved; saving instructions is not host acceptance.

The repaired image at `23bccf9` deployed successfully as
`0e932c96-426b-4dee-b476-a05d8d780c23`. Live HTTP checks read the exact UI resource,
preserved an original document snapshot, rejected missing export permission and
altered state, and restored context disabled. The same connection's supported
refresh visibly declared 24 tools. No provider API was enabled.

Actual Work runs then rendered the UI but showed a hash-mismatch error; the
document answer's successful-call claim did not establish a working view. The
workflow answer also disclosed rejected framing/diagnosis and an incomplete
record. Both failures are preserved, not passed. The first intended Chat
composer inherited Work mode across tabs, so that document run is Work evidence,
not Chat evidence. Fresh Chat must be selected and checked immediately before
sending.

UI 1.0.1 fixes an identified order-sensitive integrity check: host JSON property
order is not semantic. A separate sorted-key integrity hash binds the whole
checkpoint envelope, including the unchanged canonical workflow hash. Reordered
objects must pass; changed values or envelope metadata must fail. The precise
host transport transformation is not exposed as a raw trace. Fresh host
rendering/continuation must be observed after this repair; prior errors remain.

The first full hash-repair run exposed a test fixture's fixed 35 ms crypto wait
(empty status before completion) and an unrelated authored-retrieval 5-second
timeout. The UI now shows a checking state, and its fixture waits for observed
completion within a bounded deadline instead of assuming crypto timing. No
semantic assertion or retrieval timeout was relaxed; the failed run is retained
as a development failure, not a pass.
A repeat run timed out on a different unchanged retrieval case. The main test
command now passes Vitest's explicit `--maxWorkers=1` flag even without an
environment override. Inspection of the installed runner confirmed that the
earlier environment variable already constrained it; parallelism is not an
established cause. Intermittent retrieval latency remains unresolved. No
assertion or retrieval timeout was enlarged. A subsequent pass would not erase
these failures or prove concurrent production traffic is performant.
The final complete hash-repair check passed: 661 main + 89 Diagnostic = 750
software tests, plus integrity checks, builds and package validation.

1. Release checked source to the same service under explicit owner authorization;
   verify the exact pin, disabled provider API, 24 tools and both resources. Main,
   hosting plans, endpoint and authentication remain unchanged.
2. Update only changed guidance/fallback and version in the same private assistant,
   preserving its App, private audience, presentation and seven PDFs. Refresh the
   existing registered tool catalog through the supported host action.
3. In fresh Chat and Work, authorize an original fixture checkpoint and observe
   render, confirmation, discussion-only handoff, intact state reuse and document
   restore with context disabled. Missing traces/errors remain unverified.
4. Observe an authorized selected edit and final audit using a carried checkpoint,
   plus stale-state rejection after a passage change. Copyable JSON alone is not
   completion of the editorial workflow.
5. Obtain Matthew's independent source/exception and response-quality judgments,
   representative unseen tests, adjudication and locked blind comparisons. Finish
   version-specific operational and public-review requirements separately.

The previous 28 answers remain ungraded development observations. There are zero
established independent judgments, 171 unaudited sections and 812 unverified
provisional idea-axis obligations. Page accounting does not prove every book idea
was captured or applied correctly. A clean scan, valid checkpoint or 747 tests
cannot establish mastery. Successful evaluation supports measured, bounded
reliability—not correctness on every future request. No human rating, legal
attestation, public review submission or publication is performed by this candidate.
