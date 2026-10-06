# Writing Assistant MCP plugin package

This folder is the source package for the public Writing Assistant plugin once the repository-backed MCP pipeline is enabled.

The repository remains the canonical source of editorial behavior. The distributable package keeps only two conceptual writing files:

1. `skills/writing-assistant/SKILL.md` — routing, interaction, and tool-use instructions.
2. `skills/writing-assistant/references/WRITING_EDITORIAL_REFERENCE.md` — generated at package time from the canonical repository knowledge.

The MCP server itself is the root Writing Assistant service at `/mcp`. It exposes three high-level read-only tools:

- `edit_writing`
- `draft_writing`
- `analyze_writing`

Each substantive call runs the same bounded repository pipeline used by the web app: method planning, deterministic retrieval, writing, an independent audit, and at most one targeted repair.

## Build a package

Deploy the root service first so that it has a public HTTPS endpoint ending in `/mcp`.

Then run:

```bash
WRITING_ASSISTANT_MCP_URL=https://your-domain.example/mcp \
  npm run writing-assistant-plugin:package
```

The ZIP is written to `products/writing-assistant-plugin/dist/`.

The packager rejects non-HTTPS production MCP URLs and regenerates the editorial reference from:

- `knowledge/SEMANTIC_COMPOSITION.md`
- `knowledge/EDITORIAL_PLAYBOOK.md`
- `knowledge/COHERENCE_PLAYBOOK.md`
- `knowledge/argument-reconstruction/SKILL.md`
- `knowledge/argument-reconstruction/references/mapping-and-tests.md`
- `knowledge/argument-reconstruction/references/evaluation-standards.md`

Do not hand-edit the generated editorial reference in `dist`.

## Test before public review

1. Run `npm run check`.
2. Start the server and connect `http://localhost:8787/mcp` with MCP Inspector.
3. Deploy to a public HTTPS host.
4. Add the remote MCP server to ChatGPT as a custom MCP server and run the positive/negative cases in the manifest.
5. Verify `/.well-known/openai-apps-challenge` when the submission portal gives you a domain token.
6. In the submission portal, scan tools and confirm every tool advertises:
   - `readOnlyHint: true`
   - `destructiveHint: false`
   - `openWorldHint: false`

The server has no custom UI, so screenshots are not required for MCP review.

## Production note

The MCP service uses the server's configured OpenAI API project. Before public launch, deploy with rate limits and abuse controls appropriate to the hosting environment so an unauthenticated public endpoint cannot create unbounded API spend.
