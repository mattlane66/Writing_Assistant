---
planning: true
artifact_type: shaping
status: working
---

# Writing Assistant — Shaping

## Appetite
- Authority: Working
- Time budget: bounded pilot
- Team shape: maintainers and CI
- Cut line: no production functionality changes, credentials, or hosted model calls

## Requirements

All requirements below are **working inferences** from existing code/tests, not approved requirements.

| ID | Requirement | Status | Authority |
|---|---|---|---|
| R0 | Reject an empty or invalid revision request before running any agent pipeline. | Observed | Working |
| R1 | Flag dropped explicit qualifications as review candidates without claiming semantic certainty. | Observed | Working |
| R2 | Preserve original source text and exact offsets in reported evidence spans. | Observed | Working |
| R3 | Flag conflicting comparable quantities while accepting equivalent unit conversions. | Observed | Working |
| R4 | Do not enable editor submission for an empty draft or during revision loading. | Observed | Working |
| R5 | Display distinct loading, error, and successful-result states in the editor. | Observed | Working |
| R6 | Do not invoke the hosted writing pipeline without configured API credentials. | Observed | Working |

## Shapes

### A: Source-grounded working contract
| Part | Mechanism |
|---|---|
| A1 | Extract observed behaviors from existing code and tests |
| A2 | Attach working invariants and typed implementation bindings |
| A3 | Verify with protected baseline scenarios and a review gate |

## Fit Check

| Req | Requirement | Status | A |
|---|---|---|---|
| R0 | Validate before pipeline | Working | Candidate |
| R1 | Preserve modal qualifications | Working | Candidate |
| R2 | Ground evidence spans | Working | Candidate |
| R3 | Detect quantity conflicts | Working | Candidate |
| R4 | Disable inappropriate submissions | Working | Candidate |
| R5 | Show editor states | Working | Candidate |
| R6 | Require API credentials | Working | Candidate |

## Human Decision
- Status: working
- Chosen direction: none
- Why: Product owner has not yet reviewed or accepted this retrospective proposal.
