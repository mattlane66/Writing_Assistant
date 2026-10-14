# Private host pilot — October 14, 2026

## Scope and completed answer capture

The specifically upgraded private web assistant is
`plugin_d0a8b730c2208191b980d39b57dda3cd`, version 0.49.0. Its existing private
connection points to MCP 2.6.0, pinned feature revision `629df63`, with 23 tools.
The owner authorized original non-confidential development prompts, Chat/Work
test conversations and restricted local capture. No additional paid provider,
hosting plan, book upload or public publication was enabled.

All fourteen prompts in `evals/workflow-development.cases.json` have actual
captured answers in each host: **28 observations**, **zero human grades**. Two
earlier 0.49.0 observations (Chat belief, Work chronology) are included once;
26 fresh observations complete the batch. Older versions and same-case control
follow-ups do not multiply case coverage. The evaluated hosts received only the
prompt packet, not the workspace containing expected judgments.

The batch covers all eight supported modes and controls for already-sound prose,
uncertainty, quoted instruction injection, ambiguous attachment, argument validity
versus premise support, belief versus fact, literal chronology, missing scene
transitions and refusal of exact-text transmission. Captured answers are not
independent pass/fail ratings, unseen quality evidence or competitor comparisons.

## Evidence distinctions

- Raw files preserve the actual submitted prompt, visible assistant container,
  conversation URL, time, activated private-plugin identity and visible model label.
- Some assistant containers include writing-block titles and follow-up UI buttons.
  Supplemental DOM captures identify the writing artifact separately; UI button
  labels must not be graded as extra prose.
- Exact model build versions and upstream tool parameters/results were not exposed.
  They remain null. A stage table or assertion that tools ran is a host report,
  not independently authenticated execution.
- The permission-refusal answers preserve the original, but a claim of no
  transmission without raw calls cannot certify privacy behavior.
- Timestamps include setup, retries and user/approval interruptions. They are not
  clean performance measurements.
- The strict quality ledger is unchanged. Incomplete observations are not silently
  converted into certified responses, human grades or idea-axis coverage.

## Auxiliary control walkthroughs

| Control | Observed boundary | Remaining evidence |
|---|---|---|
| Chat analysis-only choice | Selected direction says discussion-only; **Discuss selected choices** sends it. The host leaves the passage unchanged and asks which fact is correct. | Raw transition packets not exposed. |
| Chat separately authorized edit | Only the requested `noon` → `10:30 a.m.` replacement appears. The existing sentence-ending period is retained, producing `a.m..`, as required by the literal every-other-character boundary. | The host reports the location-through-final-audit path; raw results remain absent. |
| Chat replacement diagnostic | Fresh current text has a chronology pass and a separate duplicate-period finding. Old selection and repair directions are cleared; no edit is made in analysis mode. | This is a fresh-result reset, not an adversarial raw-packet replay test. |
| Work analysis-only choice | The actual widget sends the selected entry-time direction for discussion; the answer distinguishes a conditional calculation from established fact and makes no rewrite. | Raw transition packets not exposed. |
| Work separately authorized edit | After a preserved platform error and normal Retry, the exact requested replacement appears. The answer discloses that the earlier workflow state is unavailable and selected-revision/final workflow-audit steps were not run. | The visible edit is not a completed bounded-workflow pass. |
| Chat later reviewed-record export | Host discloses the complete earlier review packet/hash is unavailable and refuses to reconstruct it. No export is claimed. | Reviewed-record continuity is not established. |
| Chat new-record immediate export | With distinct creation/export permission, a new unreviewed record is visibly returned with disabled context, no approved facts and its hash. | It is not the earlier review; raw export trace is unavailable. |
| Fresh Chat restore | A fresh private Chat receives that exact visible portable payload. Its answer reports structural restore, the matching hash, one unreviewed section, null project context and disabled context, with no rewrite. | This is a host-reported restore, not an authenticated raw-tool receipt or reviewed-record continuity. |

No broad mastery claim follows from plausible judgments, valid quoted spans or
submitted audits. The scene-gap prompt is only two paragraphs; its case name is
not evidence of performance on a genuinely long manuscript.

## Failures and safe recovery

One Work attachment submission encountered an account-loading error. A normal
reload showed the original unsent test input; a subsequent supported send produced
the captured answer. The error and completed answer are kept separately.
The later Work selected-edit control encountered **Something went wrong** and
the normal Retry action was used. A later actual answer shows the literal edit,
but explicitly discloses missing workflow state and unrun final workflow audit.

The existing port-8791 review server has a different plan fingerprint and rejected
the new observation packet. Its existing session/ratings were not cleared. A
separate loopback-only checked-source workbench on port 8793 accepted all 28
observations; coverage stayed at zero independent requests, 812 open obligations
and 171 unaudited source sections. No packet fingerprint was rewritten to bypass
the mismatch.

An automatic browser-approval attempt was interrupted by an account usage limit,
not a determination that the action was unsafe. No payment or alternative control
surface was used. After the reported reset time and an account check allowing
ordinary usage, the normal browser flow resumed. Its fresh UI showed the import
had completed, so it was not blindly resent.

## Review packet and interface scope

Restricted ignored local artifacts include the 28 original captures, a matching
ungraded-observation import packet, an index of original conversations and an
offline HTML worksheet with blank Matthew Lane review fields. They are not
committed or publicly uploaded. Existing older user-review state is preserved.
The worksheet does not persist its editable fields automatically: the reviewer
must print/save a completed copy. The separate workbench is also session-only;
export before refresh.

Actual desktop diagnostic interaction, discussion handoff and fresh-result reset
were observed. A requested 390×844 override produced a screenshot still showing
a wider desktop layout, so this run does **not** establish mobile layout or touch
acceptance. Keyboard traversal, all long scroll regions, screen readers and
complete current-host console health remain separate unverified checks. Bounded
console inspection found no errors/warnings in the matching local workbench,
but the three inspected Chat/Work pages had host telemetry 403/challenge errors
and related dropped-event warnings. They are not demonstrated application-code
failures, nor grounds to claim the full host console is clean. No security
challenge was bypassed.

The offline HTML worksheet was generated with escaped capture text and blank
judgment fields. Its attempted browser preview was rejected because that browser
allows only HTTP/HTTPS, not local-file URLs. No alternate serving/proxy route was
used to work around the rejection; the worksheet's browser rendering remains
unverified. The separate existing loopback review application and its 28-observation
import were actually rendered and verified.

## Engineering and portal status

Full `npm run check` passed: 638 main tests and 89 Diagnostic tests, builds and
package checks. A preceding sandbox run failed local socket binding and one
5-second retrieval timeout. The rerun used permitted temporary local test ports
and one worker, without changing an assertion or timeout. These are software
checks, not 727 editorial judgments.

The same existing portal draft is now **0.49.0**, developer Matthew Lane,
configured to the unchanged endpoint/App, unpublished and unsubmitted. Metadata
and skill checks passed. A refreshed MCP scan lists all 23 tools, including the
locator, with no findings. No review submission, publication, new connection or
legal attestation was performed in this draft update.

Public submission still needs version-specific review-case evidence, verified
recording/access, current attestations and applicable package requirements. The
archive still uses the existing SVG icon; the submission guide's square PNG
requirement has not been satisfied by the portal scan. Do not equate a clean
scan with completed public readiness. The separate desktop private copy remains
0.48.0; the testing service remains pinned, and rollback has not been rehearsed.

## Next gate

The next dependency-ready engineering slice is an **author-visible checkpoint**
for workflow and document records: retain the exact validated client-carried
packet outside the model's prose summary; show its passage/version and missing
checks; require explicit export/restore permission; preserve disabled context on
restore; reject stale or mismatched state. Investigate supported host artifact/UI
transport before promising it works. No remote draft retention, new paid provider
or assumed durable host API is approved. A prose instruction to remember state
does not solve the observed failures.

Finish remaining host UI, raw replay, scroll/keyboard, genuinely long-document
and rollback checks. Matthew then supplies genuine source-agreement and response-quality
judgments. Independent unseen cases, disputed-grade adjudication and locked blind
comparisons remain necessary before measured editorial or superiority claims.
