# Writing Diagnostic 1.1.0

Writing Diagnostic reviews whether prose has earned what it says. The packaged skill reasons about 18 writing primitives; the MCP server validates those supplied judgments and presents an interactive diagnostic. It does not independently analyze writing, retrieve documents, verify facts, or publish edits.

Findings distinguish **violation**, **pressure test**, and **pass**. The repair order is **think first → keep test → wording options**. Selecting a marked phrase or whole-passage check opens its reasoning and repair bank. Filters work by verdict, primitive group, and individual primitive. Keeping a phrase records a choice in the current view; it does not edit the passage or persist that choice.

## Status

This ZIP is a corrected local development package. Public submission remains incomplete: it needs a deployed HTTPS endpoint and widget origin, verified publisher and country choices, actual support/privacy/terms pages, a real installed-host recording, and host/portal verification. See `submission/REMAINING.md` and `submission/verification.md` for the exact status. Missing values have not been replaced with fictional URLs or attestations.

## Run and check locally

Requires Node.js 22 or later. ZIP packaging and its integration tests also require Python 3.9 or later. There are no npm or Python dependencies to install.

In the Writing_Assistant repository, this product lives at `products/writing-diagnostic/`. From the repository root, `npm run diagnostic:dev` serves its sample on port 8790, and `npm run diagnostic:check` checks the product. The standalone commands below use port 8787 by default.

```bash
npm test
npm run check
npm start
```

To create an independent plugin ZIP, run `npm run package` from this directory, or `npm run diagnostic:package` from the repository root. The result is `dist/writing-diagnostic-plugin-v1.1.0.zip`; it contains only this product under one `writing-diagnostic/` directory, including the hidden compatibility manifests. Generated ZIPs, secrets, dependencies, and build caches are excluded.

The HTTP server binds to `127.0.0.1:8787` by default. Open `http://127.0.0.1:8787/preview.html` to inspect the prepared sample through the real local renderer and a simulated Apps host. This sample is not an independent analysis service or a substitute for testing the installed plugin in ChatGPT or Codex.

`npm run check` validates the package and reports remaining public requirements separately. A passing package check does not mean the plugin is ready to submit.

The root `plugin.json` and `mcp.json` describe the portable plugin. `.codex-plugin/plugin.json` and `.mcp.json` provide the compatibility layout. Both MCP configurations use the bundled stdio server for local installation. To run stdio directly:

```bash
npm run stdio
```

Send newline-delimited JSON-RPC requests. The server supports legacy MCP initialization and current stateless discovery. All tool output containing structured data has a declared output schema.

## Tools and UI

| Tool | Behavior |
| --- | --- |
| `get_writing_framework` | Returns the canonical primitives, verdicts, and repair order. |
| `render_writing_diagnostic` | Validates a supplied passage and model-reasoned findings, then prepares the diagnostic UI. |

`findings` is required, even when it is an empty array. Every finding needs a unique ID across both finding arrays. Span quotes must match the original passage exactly; repeated quotes use the `occurrence` field. Spans cannot overlap. Whole-passage findings belong in `whole_passage_checks` and omit `quote`, `occurrence`, and `scope`. The renderer derives scope and character offsets without rewriting the passage. See `public/sample-diagnostic.json` for a complete input example.

The UI resource is `ui://writing-diagnostic/v1.1.0.html`. It includes a narrow CSP, the standard Apps bridge, and the direct `window.openai.toolOutput` compatibility bridge. Text is rendered through DOM text nodes rather than interpreted as HTML. Validation errors produce recovery guidance instead of a false clean diagnostic.

## Deploy when authorized

The package includes a Node HTTP server, a Dockerfile, and Vercel API handlers/configuration. No deployment was completed for this archive. Provider builds, a public endpoint, and real host behavior still need verification.

| Setting | Purpose |
| --- | --- |
| `HOST`, `PORT` | Node server binding; defaults to `127.0.0.1`, `8787`. For a container, use its provided `0.0.0.0` binding. |
| `WIDGET_ORIGIN` | The unique HTTPS origin registered for the deployed widget. No path, query, credentials, or placeholder domain. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Vercel-provided production hostname, used as a widget-origin fallback. Verify the value in the deployed environment. |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the HTTP MCP route. Configure the actual origins needed; there is no wildcard CORS. |
| `OPENAI_APPS_CHALLENGE` | The exact portal domain-verification token, served only when configured. |

Routes include `POST /mcp`, `GET /health`, and `GET /.well-known/openai-apps-challenge`. The local server also serves the product page, preview, sample input, and widget. Vercel serves those files from `public/` and routes the API paths through `api/`.

After deployment, copy `submission/public-settings.example.json` to a settings file and supply real values for every field. Use the helper below to check URL availability and the deployed tool listing, then update the manifest and MCP configurations:

```bash
node scripts/prepare-public.js /absolute/path/to/completed-settings.json
```

The helper cannot verify legal coverage, recording playback, publisher identity, or installed-host behavior. Complete those steps before rebuilding the public submission ZIP. `submission/review-cases.json` contains five positive and three negative cases; `submission/demo-walkthrough.md` describes the recording to make. `submission/policy-and-support-inputs.md` separates implementation facts from decisions the publisher still needs to make.

## Source layout

| Path | Contents |
| --- | --- |
| `skills/writing-diagnostic/` | Diagnostic instructions and canonical reference material. |
| `server/` | Fixed schemas, validation, normalization, MCP, stdio, and HTTP. |
| `public/` | Widget, prepared sample preview, product page, and icon. |
| `api/`, `vercel.json`, `Dockerfile` | Deployment entry points and configuration. |
| `tests/` | Server, transport, and simulated widget/bridge regression checks. |
| `scripts/` | Package checks and public-settings preparation. |
| `submission/`, `CHANGELOG.md` | Review cases, release evidence, and outstanding submission work. |
