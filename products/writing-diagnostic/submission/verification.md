# Verification of version 1.1.0

Local checks on 2026-10-02 used Node.js 24.19.0 and Python 3.12.14. The package declares Node.js 22 or later, and Node.js 22 is configured in the repository CI. Docker and Vercel deployment builds have not been exercised locally.

## Completed checks

- `node --test --test-reporter=spec tests/*.test.js`: **75 passed**, 0 failed, 0 skipped. This covers diagnostic validation, quote coordinates, repeated quotes, duplicate IDs across both scopes, calibrated counts, declared schemas, annotations, CSP, protocol discovery, malformed initialization, HTTP errors/origins/body limits, and stdio recovery.
- Widget checks execute the actual inline widget script in a small DOM/host simulation. They cover standard Apps initialization, direct compatibility data, selection, primitive/status filters, expanded rationales, Keep choices, whole-passage checks, foreign-window messages, recovery, and fresh-result resets.
- `node scripts/check-package.js`: **passed**, no package failures; `readyToSubmit` remains **false** with explicit pending requirements.
- Syntax checks passed for all 16 JavaScript files and the 2 inline HTML scripts. All 9 JSON files parsed.
- The five positive and three negative review-case definitions match the manifest. The prepared sample passes real server validation with 4 findings.
- Referenced icons are included, square SVG assets. The archive contains the portable files and hidden compatibility files and excludes credentials, dependency directories, and Git internals.

## Repository integration

The repository-wide `npm run check` passed: knowledge/source integrity, concept-eval contracts, lint, 18 Writing Assistant tests, TypeScript and production build, followed by all 75 Diagnostic tests and package/syntax checks. The existing app runtime, UI, prompts, and concept registry are unchanged.

`npm run diagnostic:package` builds this product independently. Packaging checks cover deterministic output, inclusion of hidden manifests, exclusion of secrets/dependencies/generated output and sibling products, and rejection of symlinks or a missing MCP server. The CI also extracts the standalone ZIP and runs its tests and package checks outside the repository. CI outcomes are recorded on the GitHub pull request rather than claimed in advance by this local receipt.

## Checks still required

The widget simulation does not test browser layout, accessibility with assistive technology, mobile rendering, or behavior in a real Apps host. A Chromium launch was attempted but the runtime had no installed browser executable. No actual ChatGPT/Codex installation or recorded host walkthrough was completed.

No public deployment or endpoint verification was completed. Automatic approval review rejected the Vercel source upload because the request was interpreted as authorizing local packaging only. The API handler is covered locally; that does not establish that Vercel builds, bundles, rewrites, environment settings, or production behavior are correct.

The publisher still needs to supply and verify the public URL fields, support arrangements, policy commitments, countries, identity/domain verification, actual recording, portal scan results, and attestations. The product page and recording guide are prepared files, not published or recorded evidence. See `REMAINING.md` for the next steps.
