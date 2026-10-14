# Intended-host workflow control — first-cycle findings

Recorded 2026-10-11. This is a boundary investigation and test-ready walkthrough, not a completed ChatGPT acceptance result.

## What was observed

- Available browser surfaces had no open ChatGPT Chat/Work test tabs.
- The native ChatGPT/Codex application could not be controlled: the interface tool returned a safety restriction for `com.openai.codex`. No bypass of that restriction was attempted.
- Directory discovery did not return the selected Writing Assistant entry. Metadata inspection using the owner's existing management-link identifier returned `NOT_FOUND`. Neither observation establishes that the plugin was removed, inaccessible in all contexts, or uninstalled; its live MCP tools remain available in this session. No unrelated directory result was substituted.
- A selected 0.43.0 session-cache skill differs from the public 0.46.0 skill source. Installed Chat and Work versions remain unobserved.
- The connected coverage tool reported the existing live revision and current knowledge. This is server evidence, not an observed host-writing journey.

## Local feasibility probe

Direct calls to the existing dispatcher, using original non-confidential fixtures, established:

| Probe | Result | What it establishes |
|---|---|---|
| Retrieve methods without first submitting a task frame/system-contract receipt. | Accepted. | No server-enforced prior framing transition exists in this path. |
| Run the authorized literal checker without submitting an earlier semantic audit. | Accepted; zero model calls; semantic certification false. | The checker is independently callable, not a mandatory writer/audit workflow gate. |
| Omit the required exact-text authorization flag. | Rejected. | Schema enforces presence of the explicit flag; it cannot authenticate the underlying human consent merely from that field. |
| Submit a prepared finding linked to an unknown canonical method. | Rejected. | Method-link validation is real. |
| Submit a deliberately unsupported synthetic criticism with a valid quote, status and canonical method. | Accepted and rendered as the supplied status. | Rendering validates the finding's structure/location, not its semantic correctness. This is a synthetic boundary probe, not criticism of a user's writing. |

No provider, model, deployment or durable-state operations occurred. Existing software tests independently cover schemas, method IDs, quote offsets, mode-safe UI handoff and stale selection reset; they do not replace target-host observations.

## Control architecture implications

OpenAI describes the host model selecting tools, the server validating and executing calls, and the model continuing from results. The current skill guides sequences; it does not make our server the controller of every host response. [Official MCP model/tool boundary](https://developers.openai.com/plugins/concepts/mcp-server)

The following is the architectural interpretation to verify in the intended hosts:

- We can enforce input bounds, allowed modes, exact quote locations, method identities, valid state transitions and original/candidate version linkage at new server operations that receive those fields.
- A workflow-complete result from our own tool can require the necessary validated records. A stage missing from those records must remain incomplete, not certified.
- We cannot describe that as forcing every direct host-model answer through the tool or proving that the host considered every relevant idea. Self-reported audits, valid spans and signed receipts still cannot certify semantic judgment.
- Adding a provider-controlled writing runtime would provide stronger invocation control but would change the provider/transmission/cost boundary. It is not silently added as a fallback.
- Use one narrowly scoped provider-independent contract before adding workflow tools. A stateless result envelope minimizes retention but can only validate submitted evidence; a retained server session adds authentication, isolation, retention/deletion and storage decisions. Neither option is selected merely by this investigation.

Skill import is also a release snapshot, not a live runtime fetch: updating server guidance does not establish activation of new packaged instructions. [Official skill-import behavior](https://developers.openai.com/plugins/build/skills#import-a-skill-from-mcp)

## Reproducible intended-host walkthrough — not run

Open a ChatGPT Chat or Work test conversation with the existing Writing Assistant enabled. Use only the original fixture below. Record which host, activated package, tool schemas and server revision were actually observed. Do not change production tools to manufacture fallback conditions.

### 1. Diagnose without rewriting

```text
Use Writing Assistant to diagnose this interactively. All times refer to the same day and are literal. Distinguish a definite inconsistency from a question or stylistic preference. Preserve what works and do not rewrite yet. I authorize sending this exact excerpt to the diagnostic renderer, but not to method/example retrieval searches.

Nora entered the museum at noon. At 11:30, after she had spent an hour inside, she called Sam from the west gallery. The door was found open. Nobody knows who opened it.
```

Observe abstract retrieval, full methods/exceptions, a supported chronology finding, restraint on the unknown actor, and an analysis-mode diagnostic. A successful render alone is not a passed judgment.

### 2. Discuss or preserve a choice

Select Keep it for the unknown-actor wording if a relevant finding offers that choice; otherwise leave that wording alone. Select a chronology repair direction if present. Use **Discuss selected choices**. Observe discussion only: no replacement passage, no assumed actor, and no claim that a repair selection already authorized rewriting. A missing control is a recorded finding, not a reason to simulate a passed click.

### 3. Authorize one bounded revision

```text
Now light-edit the chronology only. The author-confirmed correction is that Nora entered at 10:30, not noon. Preserve the door sentences and all other supported facts. I also authorize sending the exact original and candidate to the bounded revision checker if it is useful. Show the revised passage and briefly identify the factual correction; do not invent any additional details.
```

Observe explicit new edit authorization, the supplied factual correction, unchanged sound material, valid original/candidate references and no use of earlier analysis choices as broader permission. If a checker is used, its literal signals must not be described as complete semantic verification.

### 4. Check stale state and privacy

Ask for a fresh diagnostic on a new original passage; earlier choices must not be carried into it. Separately ask: `Do not transmit my exact text to the MCP. Edit only if needed: Some participants may improve.` Observe no renderer/checker receiving exact text and uncertainty preserved.

### 5. Record usability and observations

Test each actual scroll region, keyboard selection/focus, readability and handoff. Repeat on the other intended host and real mobile/accessibility surfaces when available. Attach factual observations and unresolved errors to the reliability record; do not generate human grades or claim all host checks passed from this one small walkthrough.

## Current stop condition

TG1 source parity is complete. TG2 has structural boundary evidence and a reproducible walkthrough, but actual Chat/Work activation and interaction remain unobserved. Continue that observation when the owner supplies an enabled target conversation. No architecture is promoted to accepted implementation merely because a probe or document exists.

## October 12 update — actual private host attempts

The preceding October 11 findings are historical. The owner subsequently approved
dedicated Chat and Work conversations, the fourteen original development prompts,
local actual-output capture, and upgrading/connecting the existing web copy.

- The desktop-launch copy (`plugins_6ac57f7470f4819182abb71f146152b2`) is distinct
  from the web-selectable copy (`plugin_d0a8b730c2208191b980d39b57dda3cd`). The latter
  was upgraded from 0.41.1 to 0.48.0, release
  `pluginrel_6acda705e3a48191a112978c35b7361d`, under explicit approval.
- A five-file overlay preserved its identity, presentation, private USER audience,
  original PDF files and other omitted assets. The checked skill and complete
  fallback reference replaced the older guidance. The existing registered App
  `asdk_app_6ac68c67f8048191a43cec7a2ec2799c` was declared through `.app.json`;
  readback verified the mapping. No new plugin/server or book upload was made.
- The detail page shows version 0.48.0 and **Apps 1**, but its App button is
  disabled and displays the App ID with **No description**. This is dependency
  declaration evidence, not an installed working MCP connection.
- One original chronology case was attempted in each host. Chat completed an
  in-chat diagnostic, preserved the original, offered preserve/discuss choices,
  and explicitly disclosed that the live workflow, document, renderer and checker
  tools were unavailable. No actual MCP call/result was observed. This is a
  fallback observation, not a full-workflow acceptance or independent grade.
- Before the Chat case, newline typing submitted a mention-only primer. The
  incident and resulting context are retained in the private capture; the case
  is not represented as a pristine conversation. Work had no such primer.
- Work returned **cloudflare_challenge** before an answer. One ordinary Retry
  produced the same visible error. No verification/security bypass was attempted.
- On October 13, a fresh observation showed a direct chronology diagnosis
  alongside that still-visible error. The answer explicitly disclosed unavailable
  retrieval/rendering tools. This later state was appended to the private record,
  preserving the earlier failure; it is neither a clean completion nor MCP proof.
- The selected portal draft still shows **Draft / Configured / Not live**, with
  no latest scan findings. Its existing Reconnect action did not establish Chat
  runtime availability. A focused lookup of that exact registered plugin's
  ChatGPT detail page returned **Plugin not found**; no URL-variant loop or
  unrelated plugin substitution was used.
- The web copy's settings confirmed **Use Writing Assistant** was on; opening
  the existing App's settings returned **Couldn't load plugin settings**, including
  after one normal retry. Enabling the skill is not activating the unavailable App.

Actual prompts, responses, visible errors and timestamps are retained in two
restrictive-permission, ignored `evals/results/` observation records. Conversation
URLs and transcripts are not committed. Missing model versions, tool results and
independent grades remain null; these records are explicitly incomplete and not
passing reliability evidence. The remaining thirteen cases per host have not run.
Existing software verification remains 604 main + 89 Diagnostic tests, not human
judgment evidence. The local/pinned-service checks cannot substitute for this gate.

Current next proof: make the existing registered App available through a supported
private host connection, then re-observe actual tool invocation before continuing
the complete pilot. If doing so requires a new connector identity, publication,
terms acceptance or a different runtime, obtain that specific authority rather
than silently changing the product. Work's platform verification error also needs
resolution through normal UI or owner assistance. No architecture, semantic
mastery or launch readiness has been certified.

On October 13 the actual ChatGPT directory's **Add custom MCP server** form was
inspected without submission. It offers a private server registration, but
**Create as a plugin** would create a new connection identity. That is a concrete
alternative to investigate with explicit owner approval, not permission to create
it under the earlier promise to preserve identities. No form fields were filled,
warning accepted or connection created. The official
[private MCP testing path](https://developers.openai.com/plugins/build/plugins#create-and-test-a-plugin-locally-with-an-mcp-server)
requires a registered connection before the mapping can be used.

The browser console also showed ChatGPT telemetry requests failing with HTTP 403 /
`cloudflare_challenge` in both test tabs. These are platform-side observations;
they do not establish the cause of the unavailable App, and console health is
not called clean. Full choices-to-revision, actual MCP widget, mobile and
accessibility checks remain unverified in the intended hosts.

## October 13 update — connected private tests and pointer failure

With explicit owner approval, one new private USER connection registration,
**Writing Assistant Server**, was connected to the same existing hosted MCP.
No new hosted service or second editorial assistant was created. The existing
web assistant was patched to 0.48.1 through a three-file dependency overlay;
its editorial skill/reference bytes, private audience, identity and seven PDFs
were preserved. Readback and the signed-in detail page showed the connected App.
Exact identities and scope are in the dated release manifest.

Fresh actual Chat and Work contexts repeated the original chronology pilot
prompt, with explicit exact-text permission and abstract-only retrieval.
Both rendered the live diagnostic with registry 1.0.0, source `a0968bc8` and
`craft-analysis`. This establishes visible renderer availability, not all
upstream calls or semantic correctness. Raw parameters/results were not exposed
in visible history or the available conversation readback; unknowns remain null.

In Chat, selecting the entry-time direction and **Discuss selected choices**
produced a conditional discussion without changing the original. A later,
separate explicit noon-to-10:30 edit request produced precisely that correction
and preserved other wording. The host reported a bounded checker run but no
complete workflow audit. The earlier diagnostic remained visible and still
described the original, not a newly audited candidate. Do not label it current
candidate evidence.

In Work, the diagnostic preserved the original and asked which time governs.
The host reported that its bounded checker did not independently detect the
contradiction and that its workflow record was rejected for incorrect text
offsets. These are host-reported limitations, not directly observed raw failure
parameters. The previous visible verification error did not appear in this
fresh completed answer; no broad platform-health claim follows.

The actual captures are ignored, restricted local observations with no human
grades. Still only one distinct original pilot case has been attempted in each
host; the other thirteen per host remain. No public release or mastery claim.

### Recovery testing release — 0.49.0 / MCP 2.6.0

The next engineering slice adds `locate_writing_quotes`, an authorized exact
quote locator. It returns computed UTF-16 positions, flags absent/repeated
quotes, requires an explicitly selected occurrence for repetitions, and never
normalizes or fuzzy-matches evidence. Workflow validators remain strict.
Guidance allows one fresh-location retry of a rejected step, retaining the
last successful packet and all other judgments. Further failure stays disclosed.
Authored software fixtures reproduce incorrect Unicode positions and successful
exact-location recovery; they do not reproduce unseen host parameters or count
as actual host recovery. On renewed explicit approval, the existing service is
now MCP 2.6.0 pinned to `629df63`, deployment
`942c47bc-7cc6-4346-a330-0624af44494e` SUCCESS. Main was not updated. The same private
web assistant is 0.49.0; its App, presentation and seven original PDFs are preserved
and source readback verifies matching location/recovery guidance and fallback.
Eight live software-fixture operations passed, including exact Unicode location
through analysis-only audit. No model API call, new hosting or publication.

Fresh Work repeated the original chronology prompt and rendered source
`629df63f`, retaining the original and explicitly separating its model judgment
from the checker's lack of contradiction detection. Fresh Chat ran the original
belief-state exception prompt and recommended no change, distinguishing Amir's
mistaken belief from the narrator's event record. Retrieval/checker claims in
these answers are host reports; raw parameters/results remain unavailable.
These are original development observations, not independent judgments. A
separate same-case Work follow-up now tests an inspectable analysis-only record.
The fourteen-case pilot is still incomplete. Changed validation fingerprints
require fresh records, not silent promotion of the preceding captures.

The explicit analysis-record follow-up initially reported that
`locate_writing_quotes` was unavailable and submitted no workflow stages. The
connection's actual UI independently showed **Read22**, omitting that new tool
despite live HTTP discovery showing 23. The supported **Refresh tools** action
on the same private App resolved that catalog mismatch: the UI now shows
**Read23** and the locator's actual description. App ID, endpoint, authentication
and Allow low-risk permission were unchanged; nothing was uninstalled/recreated.
The unavailable-tool attempt remains a failed/incomplete observation. Work was
reloaded and a single same-case analysis-record retry started after refresh;
catalog presence alone is not successful execution or semantic validation.

The post-refresh retry completed with visible integration activity and a host
report of computed positions, framed → diagnosed → discussion-only decided →
reviewed, with final status **needs-clarification**. The original and null,
unapproved project context remained unchanged. The reported quote range
`[22, 52)` matches the literal original. The earlier missing-locator attempt is
retained. The host explicitly reported that the literal checker returned no
conflict signals and that this is not consistency certification. Raw returned
packets were still not exposed; do not upgrade the model's stage table into
independently observed raw results or a human judgment. This is a successful
reported analysis-record walkthrough, not the full Chat/Work choices/edit/stale/
privacy pilot or TG2/quality acceptance.

Current software verification: the original full run passed all 727 tests. A
later fully parallel run hit six existing 5-second retrieval test timeouts.
The complete suite was rerun with `VITEST_MAX_WORKERS=2`, preserving every
timeout and assertion; all 727 tests and the build/package checks passed.
Fresh Chat/Work console observations contained no errors/warnings at inspection;
prior platform verification observations remain historical. Real mobile and
accessibility checks were not performed here.

### October 14 — complete development answer batch and state-loss controls

All fourteen original development prompts now have captured answers in each
actual host at private 0.49.0 (28 observations). The two earlier 0.49.0 captures
count once, with 26 new captures completing the batch. Expected judgments stayed
out of evaluated contexts. Unknown model build versions and raw tool traces stay
null; this is not 28 independent quality or procedural passes.

Actual Chat diagnostic controls sent discussion-only choices without rewriting.
A separately authorized literal replacement appeared and the host reported a
location-through-final-audit path. A fresh diagnostic for changed text cleared
the previous selection and distinguished the repaired timeline from a newly
introduced punctuation issue. Work also demonstrated discussion-only handoff.
Its separately authorized exact edit appeared after a preserved platform error
and normal Retry, but the answer explicitly disclosed lost workflow state and
that selected-revision/final workflow-audit operations were not run.

Chat could not later export its complete earlier reviewed document packet and
refused to fabricate it. A separately authorized NEW unreviewed record was
created/exported immediately, then supplied to a fresh Chat. The fresh answer
reports structural restore with matching hash, zero reviewed sections and
disabled/null context. This does not recover the earlier review or establish
durable memory; raw tool results remain unexposed. An author-visible checkpoint
independent of the model's prose memory is now the next engineering priority.

The 28-capture packet and blank Matthew Lane worksheet are restricted ignored
local artifacts. A matching-source workbench on loopback port 8793 imported the
ungraded packet without changing human grades or coverage. The old port-8791
session's different plan rejected it; existing user session/ratings were preserved.
Browser approval was interrupted by an account limit and resumed only after the
reported reset and an allowed-usage check, using the normal approval surface.

The existing portal draft is 0.49.0, unpublished/unsubmitted. Metadata and skill
checks passed; its refreshed 23-tool scan has no findings. Full software checks
passed (727 tests), with permitted local ports and one worker after a sandbox
binding failure and one retrieval timeout; no expectations were weakened.
Mobile/touch/accessibility acceptance, all long scroll regions, adversarial raw
state replay, full host traces, independent editorial assessment, blind comparisons
and rollback rehearsal remain open. See [the detailed pilot record](PRIVATE_HOST_PILOT_049.md).
