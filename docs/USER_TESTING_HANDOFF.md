# Candidate handoff — developer work versus actual observations

Prepared for Matthew Lane, October 12, 2026. Source candidate: plugin 0.48.0,
MCP 2.5.0, workflow/document contracts 1.0.0. The existing eight baseline tools
remain, with six workflow steps and eight document operations individually exposed
(22 tools total). Corpus stays 2.20.0: forty methods,
203 original cards and complete supplied-page first-pass dispositions, not full
independent idea validation. This document is not release approval.

## What is implemented for testing

Local verification: full `npm run check` passed with 604 main and 89 Diagnostic
tests (693 total), including per-operation schema and complete exposed-step
transport tests. Built-page desktop 1440×1000 and mobile-sized 390×844 checks
passed for identity, meaningful rendering, no overlays, clean console, mocked
editor action/clear, privacy disclosure, seven-source review, unfinished-note
clearing and no horizontal overflow. Local MCP document transport, private-error
suppression and provider-API disabling passed. Three existing browser journeys
also passed with mocked replies; their development-server font warning came from
this checkout's dependency symlink, while compiled-page checks had no such errors.
Shared schemas preserve strict bounds within each step. None of this is actual
Chat/Work or independent editorial evidence.

The build-time audit exposed a development-only command-runner dependency issue.
The lockfile now uses concurrently 10.0.6 and shell-quote 1.12.0 within the existing
declared range; the registry audit reports zero known vulnerabilities. No shared
working dependency directory was modified. Fingerprints include the canonical
deep references, literal/world checkers and lockfile, so changing those sources
cannot silently reuse current evidence or portable state. This is conservative
configuration binding, not authenticated history or a security certification.

The owner explicitly authorized updating the existing service/plugin for testing
without new hosting, changed plans, paid model calls or public submission. The
portal's 0.46.0 review required cancellation; after explicit confirmation, it was
returned to an editable unpublished draft. This is not publication or host
activation. Version 0.47.0 was uploaded as a draft; the platform scan flagged the
two dispatch tools and required each operation to be separately exposed. The
0.48.0 candidate addresses that finding without adding model calls or persistence.
The older 0.43.0 personal plugin found by discovery is not substituted
for the selected portal-backed plugin. The 0.48.0 package is now uploaded to the
same unpublished draft. Live MCP 2.5.0 is pinned to
`a0968bc8d0f351999bd968d5304c0f96d4105e92` (Railway deployment
`8d480471-131e-457c-9df7-494cd56149d0`, SUCCESS). All 22 tools are discovered;
the platform MCP rescan reports no findings. Live HTTP tests of the six workflow
and eight document steps passed with original software fixtures and matching
local/live knowledge fingerprints. No provider calls occurred. This is not
Chat/Work activation or human editorial evidence. The skill scan passed; the
portal reports a non-blocking inability to complete the name/description check.
An identical-archive retry hit a platform fetch error; reloading recovered the
saved 0.48.0 draft with its passed skill status and notice. No public review or
publication was triggered. The installed-host execution must still be checked.
After the owner signed in
and explicitly authorized updating the existing private test copy, plugin
`plugins_6ac57f7470f4819182abb71f146152b2` was updated from 0.43.0 to 0.48.0
(release `pluginrel_6acd5efc637c8191bc7d462534d63722`). Its skill and fallback
reference match the checked package byte-for-byte; identity, audience,
presentation and existing MCP configuration remain unchanged. The signed-in
detail page shows 0.48.0 and an **Open in desktop app** control, not a verified
web Chat/Work execution. No login details were requested or entered by the
assistant. Later main-branch pushes cannot change this pinned testing runtime.

- A private local workbench for actual grades, source-section audits, locked
  anonymous ratings and missing-obligation reports.
- Strict source-linked task records, six relevance dimensions, asserted/inferred/
  unknown commitments, full method/example transport and three-call recovery.
- Findings with exact pointers, method/commitment links, alternate readings,
  exception checks and definite-versus-question restraint controls.
- Discussion versus separately authorized selected edits. Exact replacements
  preserve unselected strings; overlap or stale state is rejected. Final audits
  must cover submitted commitments, methods/exceptions and criticisms.
- Portable document records with up to 96,000 characters, twenty-four sections,
  forty-eight ledger items, omitted-section reporting, conservative edit
  invalidation and explicit author-context approval/disable/export/restore/clear.
- Diagnostic IDs change when the findings or editing mode change, not only when
  the passage changes. Existing replacement-render selection-reset tests remain.
- Fourteen public development pilot cases across all eight modes, with negative
  controls. Preparation records no responses or human grades. Hidden expectations
  remain separate from the prompt-only host packet.
- Versioned package source and fallback references, candidate privacy disclosures,
  regression tests and a local provider-disabled MCP test surface.

These validate submitted structure, not semantic truth, authentic permission,
identity/history or every direct host answer. The server does not write with a
model; it composes supplied selected replacements and checks records. No added
provider request, durable private storage or automatic project-fact promotion.
Client-carried records may be unavailable after host context loss; report that
loss and restart/restore explicitly rather than claiming continued memory.

## Release sequence before testing the new candidate in Chat/Work

1. Finish `npm run check` and inspect the candidate archive. Keep the existing
   endpoint and plugin identity. Do not upload the new skill against old tools.
2. Under a separately authorized deployment, release this source to the existing
   MCP service. Do not add a hosting plan, paid provider or retention service.
   Verify health reports 2.5.0 and discovery includes all twenty-two tools. Record the
   exact deployed commit. Local success is not live acceptance.
3. Update the existing plugin with the complete 0.48.0 package, then activate the
   new snapshot in a fresh Chat test conversation and separately in Work. If the
   owner-linked management tools are inaccessible, activation remains pending;
   do not create another plugin to hide that gap.
4. Run the walkthrough and pilot below. Preserve failures and unavailable-tool
   cases. Actual human tests decide readiness, not the deployment or archive.

No main-branch push, shared deployment, account update or public submission is
implied by a local commit/archive. The live baseline remains separately recorded
in the release manifest. Existing-hosting charges must not be represented as zero
without checking the account; no new spend has been authorized.

## Your first session

For web testing, use [the specifically upgraded web copy](https://chatgpt.com/plugins/plugin_d0a8b730c2208191b980d39b57dda3cd),
not another same-named entry. It now shows 0.48.0, preserving its private PDFs.
The earlier [desktop-launch copy](https://chatgpt.com/plugins/plugins_6ac57f7470f4819182abb71f146152b2)
and unpublished portal draft remain separate identities. The web copy's existing
App dependency is declared but visibly disabled; the first actual Chat case used
the disclosed fallback. Work initially returned `cloudflare_challenge`; a later
observation showed a direct fallback answer alongside the persistent error.
The remaining thirteen cases per host are paused at that gate. See the dated
[actual findings](HOST_WORKFLOW_CONTROL_FINDINGS.md#october-12-update--actual-private-host-attempts).

Once the existing App is available, use a fresh matching host context and confirm
actual invocation of the 22 tools / 2.5.0 server, not just HTTP discovery. The
actual Chat/Work conversation must demonstrate tool availability, proper
diagnosis/decision handoff and updated skill usage. Do not claim activation
merely because the dependency, detail page or service is updated. See
[OpenAI's general testing quickstart](https://developers.openai.com/plugins/quickstart#test-the-plugin).

Use [the intended-host walkthrough](HOST_WORKFLOW_CONTROL_FINDINGS.md): diagnosis
without rewriting, discussion/keep, an explicit chronology-only edit, then fresh
passage/stale-selection and no-transmission controls. Use only non-confidential
original fixtures. Check that every actual scroll region and keyboard control
works and that the actual final revision preserves unselected sound sentences.

The fourteen-case pilot is generated by `npm run user-testing:prepare`. The two
private files go into ignored `evals/results/` with restrictive permissions and
unique names. The prompt packet contains only prompts, never oracles. Paste one
prompt at a time in a fresh matching test context; do not upload the workspace
or oracle to the evaluated assistant. The exact-text refusal test deliberately
has no permission prefix. Keep the actual host/model/package version and observed
server revision with every response. The cases are authored development, not a
held-out reliability sample even if Matthew grades them.

For each test, save the actual answer, tool calls/results and any visible error;
note what you expected and what failed. **Capture a test** in the local workbench
now supports faithful answer/error capture and a separately exported observation
packet, including missing versions and tool results. It does not automatically
promote incomplete observations into the strict reliability ledger or generate
human grades. Import complete real evidence separately for criterion review; do
not invent fields to make it acceptable. Full case registration/trace completion
and independent assessment still require actual information. Developer assistance
with faithful capture remains
available after testing. A guessed or missing trace stays missing.

Next, use [the source-review instructions](REVIEW_WORKBENCH.md) to review the first
seven sections against your lawful PDFs and export the actual audits. Source
agreement and response-quality judgments are different evidence categories.
Additional independent reviewers are needed when disputes require adjudication.

## What developer work follows your observations

1. Correct observed interface, handoff, preservation and interpretation failures;
   turn reviewed failures into regressions without relabeling them held-out.
2. Continue independent section/idea/exception review and bounded retrieval/execution
   tests; missing primary-book material remains a source defect.
3. Lock the intended task mix, practical improvement target, sampling/precision,
   tie handling and stopping rule before the confirmatory comparisons. Same-model
   plain and knowledge-prompted baselines need equal eligible knowledge and fair
   opportunity; actual custom GPT and stronger-model conditions require genuine
   access. Missing competitors are untested, not beaten. Do not upload books
   without separate permission.
4. Analyze authentic blinded ratings, fidelity failures, false criticisms,
   omissions and latency. Keep, simplify or remove mechanisms using the results.
5. Repeat affected tests after changes; rehearse rollback and verify package,
   server and activated versions before any owner-approved public release.

These empirical optimization/release steps cannot be honestly completed before
the observations they consume. No finite sample guarantees infallible mastery.
The first pilot is intentionally small; full 812-axis and 171-section evidence,
representative unseen cases and long-document/usability validation remain pending.

## Rollback and private-data boundary

Retain the prior deployed commit and 0.46.0 package. If candidate tools/handoff
fail, stop the pilot, roll back the existing service through its normal deployment
history under owner authorization, restore the matching prior skill snapshot,
and re-observe health/discovery and a fresh host session. This is a rollback
procedure, not an assertion that a production rollback was rehearsed.

Local candidate MCP: `npm run candidate:mcp`, binding only
`http://127.0.0.1:8792/mcp`. The optional API-backed revision endpoint is disabled
even if a credential is inherited. Private review: `npm run review:local`, at
`http://127.0.0.1:8791/review.html`. Neither URL is a production ChatGPT HTTPS
connector or proof of activation. No tunneling is added.

Do not commit private workspaces, exports, original books, extracted text or
credentials. Keep the condition key separate from anonymous ratings. Clearing
local/client state cannot delete conversation history or exported files. No
raw-draft analytics, new accounts or cross-user memory is introduced.
