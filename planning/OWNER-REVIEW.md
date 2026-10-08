# Product-owner decision review (required before changing authority)

This is an **approval request**, not an approval or an automatically verified product specification.

The current PlanningPackage compiles, and the protected checkers verify named scenarios. That does not prove the reconstructed requirements reflect the intended product, and it cannot infer why other plausible approaches were rejected.

## Explicit product decisions to review

| ID | Proposed contract | Status |
|---|---|---|
| R0 | Validate requests before running agents | Working |
| R1 | Flag dropped qualifications | Working |
| R2 | Preserve exact source-span grounding | Working |
| R3 | Flag conflicting quantities, not equivalent units | Working |
| R4 | Disable draft submission when empty/loading | Working |
| R5 | Show loading, error, and success states | Working |
| R6 | Require API credentials for hosted agent run | Working |
| INV-1–INV-3 | Meaning and source grounding regressions | Working |
| INV-4–INV-5 | Validation and credential safety | Working |
| INV-6 | Editor submission and revision display | Working |
| INV-7 | Draft persistence, clear, and disabling submit | Working |
| DEC-1 | Base-protected test expectations | Working |

For each, the owner should check the wording and actual user value, record previously rejected alternatives **only if known**, and explicitly accept or revise the entry. Marking a record `accepted` requires `approved_by`, `approved_at`, and evidence. A reviewer must examine all seven provisional code bindings and their **runtime/scenario evidence** before marking any `confirmed`.

The owner should also decide whether the rejected alternative in DEC-1 reflects an actual past decision or is only a proposed operating policy. Do not fabricate historical decisions.

## Applying approval

1. Review [the canonical plan](./01-frame.md), [shaping](./02-shaping.md), [breadboard](./03-breadboard.md), [proposed intent](./product-intent.json), and [browser/meaning scenarios](../product-intent/scenarios.json).
2. Update the canonical planning file and proposed intent records with explicit acceptance only for the items you actually approve. Leave disputed items Working and note the decision needed.
3. Review every mapping and scenario against **real code execution**. Confirm the mapping only when supported; unknowns remain inferred.
4. Record a model fingerprint in a separate `owner-approval.json`, tied to the reviewed commit, and approve the PR using a separate human GitHub code-owner review.
5. In GitHub Settings → Rules → Rulesets, require `Product Intent (trusted baseline)` and code-owner approval for changes to `planning/**`, `product-intent/**`, and CI workflows.

The repository cannot establish a human signature by having an agent write `approved_by`. A checklist or editable JSON is not independent authorization. Until an actual owner review and branch rules are configured, checks report REVIEW and should not be described as fully enforced protection.

## Readiness audit

```sh
node product-intent/owner-readiness.mjs
# Strict mode should fail while intent is unapproved:
node product-intent/owner-readiness.mjs --strict
```
