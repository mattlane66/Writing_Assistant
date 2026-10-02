# Products

This repository holds two independently runnable products.

| Product | Location | What it does |
| --- | --- | --- |
| Writing Assistant | Repository root | A web editor that plans, writes, audits, and repairs prose using its editorial contract and concept registry. |
| [Writing Diagnostic](writing-diagnostic/README.md) | `products/writing-diagnostic/` | A skill and MCP plugin that presents calibrated findings on a passage, primitive filters, and thinking-first repair options. |

Writing Diagnostic has its own `package.json`, plugin manifests, MCP configurations, server, widget, canonical references, tests, release notes, and submission materials. Its renderer displays model-reasoned findings; it does not independently diagnose prose or call the Writing Assistant API.

## Writing Diagnostic commands

Run these from the repository root. Runtime and server checks require Node.js 22 or later. ZIP packaging and its integration tests also require Python 3.9 or later; no Python or npm packages need to be installed for Diagnostic.

```bash
npm run diagnostic:dev
npm run diagnostic:stdio
npm run diagnostic:check
npm run diagnostic:package
```

The first command serves the Diagnostic sample at `http://127.0.0.1:8790/preview.html` and MCP at `http://127.0.0.1:8790/mcp`, allowing it to run alongside the Writing Assistant API on port 8787. Stdio is a separate alternative to the HTTP server.

The package command writes `products/writing-diagnostic/dist/writing-diagnostic-plugin-v1.1.0.zip`. The ZIP contains one `writing-diagnostic/` directory and includes only that product's source. Generated archives are ignored by Git. The archived product can also run on its own with `npm start` and its documented settings.

From within the product directory, use `npm test`, `npm run check`, and `npm run package`. The repository-wide `npm run check` runs both the existing Writing Assistant verification and Diagnostic's checks. Diagnostic's JavaScript is isolated from the app's TypeScript lint configuration and uses its own server, schema, syntax, transport, widget, and packaging checks.

## Release status

Writing Diagnostic 1.1.0 is a corrected local development package. Its [remaining submission work](writing-diagnostic/submission/REMAINING.md) includes a deployed endpoint, actual public URLs, publisher/country confirmation, a real installed-host recording, and host/portal verification. Adding source to this repository does not complete those steps.

For a separate deployment, use `products/writing-diagnostic/` as that project's root and follow its README. That directory contains its own Vercel configuration and Dockerfile. The Writing Assistant app continues to use the repository root.
