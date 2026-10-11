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
