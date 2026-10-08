# Working product intent model

This directory is **a proposed product model** for [Writing Assistant](../README.md) derived from existing code and tests. No model-authorized acceptance has been recorded.

- `01-frame.md`, `02-shaping.md`, and `03-breadboard.md` are human-readable planning authoring surfaces.
- `product-intent.json` adds typed, working invariants and decision candidates, plus suggested code links. It does **not** duplicate accepted planning requirements.
- The compiled `PlanningPackage.product_intent` is the derived machine-readable projection, assembled by [Planning Skills](https://github.com/mattlane66/planning-skills-for-agents-and-humans).
- A reproducible CI check pins the compiler to SHA `73453465567352fcbfe6475fd0cc47e1e9763725` and requires that no working material gets promoted to accepted status.
- Owner approval is required **before** setting requirements/invariants to Accepted or bindings to confirmed. A passing test is evidence of observed behavior; it is not a product decision.

To compile locally, use the pinned compiler revision:

```bash
python3 /path/to/planning-skills-for-agents-and-humans/scripts/publish-shaped-work.py --planning-dir planning --check
python3 /path/to/planning-skills-for-agents-and-humans/scripts/publish-shaped-work.py --planning-dir planning --json-output /tmp/writing-package.json --output /tmp/writing-intent.html
```

## Provisional code mapping review

The CI job compiles the model and uploads a `provisional-product-intent-bindings` JSON artifact from the code mapper. It inspects JS/TS declarations using lexical evidence and can report ambiguous or incorrect suggestions. **All proposals remain `inferred` and `requires_review`.** Do not copy them to `confirmed` without reviewing the code path and runnable evidence.

## Owner acceptance gate

Before marking any requirement or invariant Accepted:

1. Check that the wording still describes the *intended product*, not merely what current code happens to do.
2. Validate each linked screen, server boundary, state and existing decision against observable behavior; reject false or unsupported associations.
3. For consequential decisions, record alternatives that were tried or rejected and what evidence would reopen the decision; if that history is unknown, explicitly leave it unknown.
4. Verify an independent scenario from the protected base commit exercises the intended result, including failure/edge cases.
5. Record the human approver/date, then update the corresponding authority in the canonical planning artifact and recompile. **Do not** let a coding agent promote its own proposed intent.

Until that review, the model and mappings remain working and advisory. These instructions are a review procedure, not a second product source of truth.
