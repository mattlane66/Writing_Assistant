# Idea-by-idea reliability service

Implemented: an offline evidence intake, coverage planner, per-request trace
checker, scoped measurement report, shuffled comparison packet generator and
blinded paired-rating analysis. It uses no model, network, paid provider or new
hosting service. The public MCP serves the operating procedure through its
existing `get_writing_reference` tool as `reliability-workflow`; it does not
accept private evaluation uploads or certify editorial judgments.

## What is and is not completed

The initial inventory contains 203 **provisional operational idea units**, using
existing stable card IDs, and forty method mappings. Each unit has four separate
obligations: recognition, application, exceptions and omissions (812 total).
The planner also lists all 171 tracked source-review sections for independent
omission/interpretation audit. This is an addressable starting inventory, not
proof that every idea in the books has already been captured.

Twelve additional original development challenges test interactions and
non-application in six contrast pairs. Software tests validate evidence handling
and retrieval transport. They are not independently graded model outputs, unseen
cases, actual fresh installations, or real-user usability sessions. No human
observations or efficacy wins have been invented to fill those requirements.

Source limitations remain visible: Grammar as Style's printed page 2 is absent
from the supplied scan; Bookey is an incomplete secondary summary, with a gate,
unverified quotation attributions and missing external quiz keys. An independent
review cannot recover absent primary-book content. Obtain a legitimate complete
primary source if completeness of that original work is part of the claim.

## Use the service

From the repository root:

```bash
npm run reliability:plan
npm run reliability:report
npm run reliability:service -- schema
npm run reliability:service -- template
npm run reliability:service -- report --evidence evals/results/observations.json
npm run readiness:plugin -- --evidence evals/results/observations.json
```

To include completed comparisons in the readiness report, also supply
`--comparison-key evals/results/private-condition-key.json` and
`--comparison-ratings evals/results/locked-ratings.json` together. These are
local inputs; the key is never sent to the evaluated host or reviewer.

`plan`, `schema` and `template` print JSON; save generated templates locally,
not in public source control. The default report intentionally shows no
independent judgments, 812 missing idea-axis obligations and 171 unaudited
sections. `report --require-complete` returns unsuccessful while its evidence
gates remain unresolved; it does not check the separate comparison gate or issue
launch approval. `readiness:plugin --require-complete` still fails because this
program cannot independently authenticate the full launch evidence.

Keep prompts, hidden oracles, actual outputs, reviewer notes, screenshots and
host captures in ignored `evals/results/`. Never commit those receipts, private
drafts, full source text or keys. Reports print only IDs, metrics and gap counts,
not the supplied prompts, outputs or critiques. Error messages do not echo
evaluated text. File input is bounded to 16 MB per run; split larger evidence
into explicit target-scoped runs rather than silently truncating it.

## Independent collection protocol

1. An independent reader compares each meaningful source section with its
   paraphrased audit and idea mappings. Record omissions, misinterpretations,
   exceptions, conflicting prescriptions and source defects. Existing mappings
   cannot disappear from an agreed audit. A correction stays unresolved until
   the canonical knowledge and its tests are actually repaired. New ideas get
   stable cards; rebuild the plan rather than hiding them in an old certificate.
2. An outside evaluator registers new prompts **and grading oracles before**
   model execution. Keep the oracle out of the evaluated model's context. Record
   authors, case family, genre, mode, length and scenario. Prompt/oracle/output
   SHA-256 fields bind grades to exact captured bytes; an outside receipt must
   still substantiate the claimed preregistration time. Public examples and
   fixtures remain development material, even after a person rates them.
3. Run each prompt in the actual target host and record the exact model/version,
   installed plugin version, deployed revision, complete tool-result captures,
   final output and writer choices. Tool-call hashes and short decision evidence
   point to the privately retained capture; they are not replacements for it.
   Never collect or require private chain of thought.
4. An independent human judges every declared criterion and final task result,
   including appropriate preservation and non-application. Score exact missed
   defects, false accusations, invention, meaning drift, mode/privacy breaches
   and overconfidence. A missing bridge is not automatically a contradiction;
   taste is not automatically a definite error. Record unresolved readings.
5. If initial independent judgments disagree, retain the disagreement until a
   third independent human adjudicates it after both reviews. A second model or
   the case author cannot act as that independent adjudicator. Self-grades can
   be development notes, not evidence clearing reliability coverage.

Minimum coverage policy: two distinct independent case families per idea-axis,
with no more than three idea units credited by one case. This is **not** enough
by itself for a strong statistical claim. The broader gate initially requires
12 combined-method and 12 adversarial passing cases, six genuinely long prompts
(at least 1,200 words), five genres and all eight modes. These are explicit
coverage floors, not confidence targets derived from observed performance.

The report separates available-guidance execution from a disclosed fallback.
A useful fallback can pass its immediate task without being counted as evidence
of effective book retrieval. Different models/hosts are not pooled. Repeated
generations never multiply idea coverage, and a failed run cannot be erased by
a passing retry. Cases from the same family do not count as independent coverage;
simple confidence intervals are withheld when graded cases share families.

Failure rates count **cases with reported failure types**, not every defect
opportunity. Reviewers may miss a defect; no claim of objective ground truth is
made from their labels alone. Wilson intervals are descriptive and assume
independent, representative cases. Zero recorded failures does not mean zero
future risk. Unresolved/ungraded cases are reported rather than passed.

## Actual host and usability evidence

Run fresh installation tests separately in ChatGPT Chat and Work. Required
captures include eight tools, revision/fingerprint, abstract retrieval, complete
exceptions, render placement, analysis-only no-rewrite handoff, authorized
editing, unanswered questions, stale-choice reset, no-remote-text permission and
fallback disclosure. A Codex/local run cannot count as either target host.

Real-user usability is a separate observation: desktop and mobile scrolling,
long-passage readability, keyboard selection, filters, decision handoff and host
errors. A rendering screenshot does not prove all those interactions worked.
Use the existing host-test runbook; do not change account, audience, permission
or payment settings merely to conduct a test.

The service structurally validates evidence and retains receipt hashes. It
cannot authenticate a person from a JSON actor ID, independently witness a
session from a screenshot hash, or prove a secret hold-out remained secret.
Evidence statuses therefore say **recorded**, not certified. An external reviewer
must check the actual private receipts and provenance before any release claim.

## Blinded comparisons

Collect outputs for the same new tasks from (a) the plugin, (b) the same plain
model, and (c) a well-prompted knowledge-backed baseline. Keep model/version,
host and sampling conditions matched; retain the baseline prompt and available
knowledge in private receipts. A stronger model is an optional fourth, separately
named comparator, not evidence attributable to the writing harness.

Input follows `BlindInputSchema` in `evals/blinded-comparison.mjs`: each case has
a common prompt, case-family ID, origin/authors and one output/receipt per condition. Preregister
the protocol before those outputs. Prepare anonymous packets and a separate key:

```bash
npm run reliability:service -- blind-packet --input evals/results/comparison-input.json --packets-out evals/results/reviewer-packets.json --key-out evals/results/private-condition-key.json
npm run reliability:service -- comparison --key evals/results/private-condition-key.json --ratings evals/results/locked-ratings.json
```

Generated outputs are owner-readable/writable files in the ignored results
directory. Existing files are never overwritten and symlink escapes are refused.
If one output creation fails after the other succeeds, that partial private
artifact remains; choose fresh filenames after checking it. The service does not
silently delete it.

Give only reviewer packets to a human who did not author the cases. Keep the
key private until ratings are locked. Do not announce model labels or expose
condition metadata elsewhere. The actual prose can sometimes reveal its source;
record suspected unblinding rather than claiming perfect blinding. Scores are
paired task-success ratings with a separate fidelity-failure flag. Preserve wins,
losses and ties. Output hashes prevent accidental swapping of rated responses.

Thirty distinct held-out case families is an initial collection floor, not proof of
superiority. Win-rate intervals are exploratory, exclude ties and do not adjust
for multiple comparisons. Shared case families suppress those intervals.
Confirmatory superiority needs a preregistered primary
outcome, sampling/cluster analysis, sufficient sample size and independent
adjudication. No automatic advantage claim is emitted even when the plugin wins.

## Reliably applied on every request

The live server now advertises a request coverage contract: load the current
operating contract at the first substantive pass, reframe each request, sweep
six material dimensions, retrieve missing guidance, test exceptions, audit the
output/criticism and disclose unresolved gaps. Existing eight tools and the
package identity/connection are preserved; this update does not upload a ZIP or
replace the user's installed skill.

A static MCP cannot force a host model to call it, prevent the host from losing
context, or prove that a retrieved idea changed the final output. Check the
actually installed skill and host behavior in fresh Chat and Work sessions.
The next stronger architecture, if required, is an authorized execution wrapper
that owns per-request state, checks observable coverage and refuses an unqualified
"complete pass" until obligations are met. Even that wrapper can guarantee a
procedure, not perfect semantic judgment, and would be a separate implementation
decision—not silently substituted for the existing read-only plugin.

## Regressions, costs and release claims

`npm run check` includes offline service integrity and regression tests. These
make zero provider calls. New guidance, corpus, service policy or installed-skill
source changes alter the validation fingerprint and reject stale evidence;
changed host model/version is a different target. Rerun failures after repairs,
retain original failures, and periodically obtain genuinely new cases. Do not
turn repaired development cases into a fresh held-out sample.

Independent editorial review and actual target-host observations are still
external inputs. No paid grader, new provider account or recurring automation
was created. The attainable claim is bounded measured reliability, not universal
mastery or guaranteed superiority. The methodological design is informed by
[CheckList behavioral testing](https://aclanthology.org/2020.acl-main.442/) and
[HELM's multi-scenario evaluation](https://arxiv.org/abs/2211.09110); the specific
coverage floors and receipt protocol above are this repository's operational
choices, not guarantees asserted by those papers.
