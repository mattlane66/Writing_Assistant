---
planning: true
artifact_type: breadboard
mode: candidate-shape
status: working
---

# Writing Assistant — Breadboard

## Mode and authority
- Mode: candidate-shape
- Requirements authority: Working
- Appetite authority: Working
- Reconciliation: provisional model reconstructed from observable implementation; no human-selected shape

## Places

| ID | Place | Description |
|---|---|---|
| P1 | Writing editor | Draft input, revision mode, submission and result presentation |
| P2 | Revision API | Request validation and bounded agent pipeline boundary |
| P3 | Local review | Meaning and consistency checks on candidate text |

## UI Affordances

| ID | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|---|
| U1 | P1 | EditorWorkspace | draft text | input | → S1 | — |
| U2 | P1 | RevisionActions | submit revision | submit | → N1 | ← S2 |
| U3 | P1 | EditorWorkspace | loading, error, result | display | — | ← S2 |

## Non-UI Affordances

| ID | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|---|---|---|---|---|
| N1 | P2 | createApp | validate revision and authorize pipeline | call | → N2 | ← S1 |
| N2 | P2 | agent-pipeline | execute bounded revision | call | → S2 | — |
| N3 | P3 | meaning-contract | compare qualifications and spans | call | — | — |
| N4 | P3 | text-world | compare scoped quantities | call | — | — |

## Stores

| ID | Place | Store | Description |
|---|---|---|---|
| S1 | P1 | draft | Current user-supplied draft |
| S2 | P1 | revision state | Idle, loading, result, or error state |

## Behavior traces

| Scenario | Entry | Control path | Decision / branch | State / data effect | Observable consequence | Status |
|---|---|---|---|---|---|---|
| Reject invalid submission | U2 | U2 → N1 | Invalid input | S2 does not run pipeline | API returns validation error | Working |
| Show result | U2 | U2 → N1 → N2 → S2 | Valid input and configured model | New response state | U3 shows response | Working |
| Review qualifications | N3 | N3 | Explicit modality missing | No automatic factual rewrite | Review candidate is emitted | Working |
| Detect quantity disagreement | N4 | N4 | Same comparable quantity scope | No automatic correction | Review candidate is emitted | Working |

## Candidate vertical slices

### V1 — Protect deterministic behavior
Demo:
- Regression tests identify changed qualifications or ungrounded spans

Produces:
- Meaning and text-world behavior evidence

### V2 — Protect API and editor behavior
Demo:
- Invalid submissions do not run the pipeline
- Editor shows appropriate disabled and result states

Produces:
- API/UI contract evidence

## Notes
- This model is provisional, not an accepted selected-design breadboard.
- Runtime traces and exhaustive intent-to-code bindings are not established.
