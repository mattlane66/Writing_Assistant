# Release notes

## Repository integration

- Adds this product independently under `products/writing-diagnostic/` in Writing_Assistant.
- Adds a reproducible standalone ZIP command and packaging boundary checks.
- Declares the product's CommonJS scope explicitly, alongside the existing app's ES modules.
- Adds repository commands and documentation for running and verifying the products separately.

## 1.1.0 — 2026-10-02

- Reject missing or malformed findings instead of displaying a false clean result.
- Enforce unique IDs, canonical primitives, quote occurrences, array limits, and non-overlapping spans.
- Align the skill's whole-passage instructions with the tool schema.
- Declare output schemas, explicit tool annotations, authentication behavior, and a narrow widget CSP.
- Support current MCP discovery/response fields and preserve legacy initialization.
- Correct Apps initialization and the direct `window.openai.toolOutput` compatibility path.
- Add individual primitive filters, accessible selection states, a working Keep it choice, and recovery messages.
- Add local regression checks, a sample preview, public review cases, and Vercel/container deployment files.

This source release is not a completed public submission. Its live endpoint, public policies/support, hosted recording, installed-host tests, and portal checks remain pending.
