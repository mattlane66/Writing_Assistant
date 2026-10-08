# Working product intent model

This directory is **a proposed product model** for [Writing Assistant](../README.md) derived from existing code and tests. No model-authorized acceptance has been recorded.

- `01-frame.md`, `02-shaping.md`, and `03-breadboard.md` are human-readable planning authoring surfaces.
- `product-intent.json` adds typed, working invariants and decision candidates, plus suggested code links. It does **not** duplicate accepted planning requirements.
- The compiled `PlanningPackage.product_intent` is the derived machine-readable projection, assembled by [Planning Skills](https://github.com/mattlane66/planning-skills-for-agents-and-humans).
- A reproducible CI check pins the compiler to SHA `f4edc5c8fada2c7e44ef8c63870f9ac4ec8ef1e0` and requires that no working material gets promoted to accepted status.
- Owner approval is required **before** setting requirements/invariants to Accepted or bindings to confirmed. A passing test is evidence of observed behavior; it is not a product decision.

To compile locally, use the pinned compiler revision:

```bash
python3 /path/to/planning-skills-for-agents-and-humans/scripts/publish-shaped-work.py --planning-dir planning --check
python3 /path/to/planning-skills-for-agents-and-humans/scripts/publish-shaped-work.py --planning-dir planning --json-output /tmp/writing-package.json --output /tmp/writing-intent.html
```
