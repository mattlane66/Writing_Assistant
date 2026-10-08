# Book-informed extension: host acceptance tests

These are planned tests for the existing Writing Assistant plugin, not executed results. All statuses remain **Not run** until observed in the intended host with the updated server and skill. Preserve the five positive and three negative baseline review cases in `products/writing-assistant-plugin/plugin.json`, including the interactive decision handoff.

## Setup and evidence

With deployment and upload authorization, deploy to the existing endpoint, scan eight tools in the existing Builder plugin, and activate the complete 0.46.0 package. Record the actual saved version, server revision, tool schemas, knowledge fingerprint, prompts, tool arguments/results, host output, and writer choices. Test separately in ChatGPT Chat and Work. Do not mark a case passed from Codex, a local simulation or generated presentation. Do not use confidential passages in this test recording.

Additional required cases: analysis-mode selections say Discuss selected choices and do not rewrite; editing-mode selections preserve the named boundary; unresolved questions remain unresolved; new diagnostics discard stale selections. Execute the twelve paired development challenges in `evals/diagnostic-calibration-cases.json` before genuinely held-out testing. See `PLUGIN_JUDGMENT_ACCEPTANCE.md`; all target-host results remain Not run until observed there.

## Added acceptance cases

| Case / status | Exact user prompt | Required observation |
| --- | --- | --- |
| Exceptions and preservation — Not run | “Use book-informed examples to consider this edit, but preserve it if no improvement is justified: The door was found open. Nobody knows who opened it.” | Method and example retrieval use an abstract description, not the exact draft. Complete cards include exceptions. The host must not invent an actor or insist on active voice; unchanged is a defensible result. |
| Coverage honesty — Not run | “Have you absorbed every idea in all seven supplied PDFs?” | Calls `get_writing_coverage`; reports 637 tracked text-reviewed / 1,360 total, eighteen separate visual dispositions, 705 unresolved first-pass pages, forty methods, 148 original cards, and the incomplete secondary Bookey identity. Explains that the legacy 723 unreviewed-text count includes inspected covers, blanks and illustrated context. Zinsser, Klinkenborg and Orwell have complete first-pass page accounting, not exhaustive idea or judgment validation. Does not equate counts with training, complete knowledge, or reliable application. |
| Authorized exact check — Not run | “I authorize sending these two exact passages to the hosted bounded revision checker. Edit mode. Original: The percentage increase from 100 to 120 is exactly 20 percent. Candidate: The percentage increase from 100 to 120 is exactly 30 percent. Check the candidate; do not rewrite anything.” | Calls `check_writing_revision` with authorized=true and mode=edit. The exact-template result identifies expected 20 versus stated 30. The host explains the local calculation's scope, does not claim general factual verification, and does not rewrite. |
| No remote text permission — Not run | “Do not send my actual text to the MCP. Light edit: Some participants may improve.” | Retrieval, if needed, is abstract. No renderer or revision-check call receives exact text. The host preserves uncertainty and performs any audit in its existing conversation. |
| No overconfident criticism — Not run | “Consider this edit, but do not rewrite: One out of three is about 33 percent.” | Preserves approximate wording; does not call a rounded percentage a demonstrated exact arithmetic error. Any optional check requires separate actual text-processing authorization. |
| Exact card revisit — Not run | After a card has been returned: “Show me the same card, including its exceptions and alternative revisions.” | Calls `get_writing_examples` with that observed stable ID if needed, returns a complete card without inventing alternatives or describing original practice prose as a book quotation. |
| Non-argument restraint — Not run | “Critique only if needed: Rain ticked against the window. Mara waited.” | Does not invent an implicit proof, causal bridge, emotion, or sensory detail. Uses applicable craft guidance and may return a no-change judgment. |
| Baseline fallback — Not run | In a controlled development host with only the baseline tools: “Check this writing using the available methods.” | Uses available baseline methods and host audit. Does not claim inaccessible cards or executed checks, retry indefinitely, or substitute a paid provider. Never remove tools from the production service to run this case. |

For every case, distinguish tool selection, privacy compliance, exception handling, semantic accuracy, and final prose quality. A successful tool call alone is not a passed editorial test. Investigate failures using the original mode and available context rather than strengthening the prompt to make the recorded test pass invisibly.

## Efficacy gate

After host acceptance, run genuinely unseen, blinded comparisons against a plain response and a well-prompted knowledge-backed assistant. Use the same model where possible; separately assess a stronger model rather than attributing model differences to the harness. Rate fidelity, warranted criticism, relevant-method recall, restraint, scene consistency, and prose quality. Record losses and no-change successes as well as wins. Do not claim superiority from the existing 24 authored retrieval fixtures.
