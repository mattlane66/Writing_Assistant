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
