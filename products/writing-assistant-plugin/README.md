# Writing Assistant MCP plugin package

This folder is the source package for the public Writing Assistant plugin.

The repository is the canonical source of editorial behavior. The package contains the workflow skill, a generated fallback editorial reference, and the MCP connection.

## Runtime architecture

The user's current ChatGPT or Codex model performs all writing and reasoning.

The MCP server does not call OpenAI or another language model. It preserves the baseline retrieval/rendering tools and adds four bounded book-informed tools:

- `search_writing_methods` — retrieve the best-matching full method records from the 40-concept registry;
- `get_writing_methods` — retrieve full methods by id;
- `get_writing_reference` — retrieve a deeper canonical reference document;
- `render_writing_diagnostic` — validate and display findings already reasoned by the host model, with canonical method links, repository provenance, and writer choices returned to the conversation.
- `search_writing_examples` and `get_writing_examples` — complete original practice cards with alternatives, exceptions, counterexamples and source caveats; no private draft is needed for retrieval.
- `get_writing_coverage` — honest tracked page/method/example coverage and gaps, not a mastery claim.
- `check_writing_revision` — opt-in exact-passage literal checks; review candidates, not semantic verdicts. No model calls or application persistence.

The 0.45.0 candidate extends the same plugin identity and MCP URL; it does not replace the 0.44.0 baseline until explicitly deployed/scanned and its updated skill is uploaded. The example corpus and review ledger live on the MCP server, not in the ZIP. Real-host execution and prose-quality comparisons remain acceptance gates. See `docs/BOOK_INFORMED_MCP.md`.

For substantive work, the skill retrieves only the guidance it needs, then the host model performs the frame → semantic model → thought movement → information order → compose → audit → one repair workflow itself.

The skill tells the host model to send a short abstract task description to method retrieval rather than forwarding the user's full draft or voice samples merely to choose methods. The render tool is intentionally different: when an interactive diagnostic is useful, it receives the exact passage and already-reasoned findings because it must validate marked spans and display the user's text.

The Diagnostic remains independently packageable under `products/writing-diagnostic/`. The integrated Writing Assistant reuses its renderer rather than maintaining a fork.

## Build a package

The production MCP endpoint is:

https://writing-assistant-mcp.up.railway.app/mcp

Build the package with:

WRITING_ASSISTANT_MCP_URL=https://writing-assistant-mcp.up.railway.app/mcp npm run writing-assistant-plugin:package

The ZIP is written to products/writing-assistant-plugin/dist/.

The packager regenerates the fallback editorial reference from the canonical system contract, semantic-composition reference, example-derived sentence/paragraph repertoire, editorial playbook, coherence playbook, and argument-method files. Do not hand-edit the generated reference in dist.

## Test before public review

1. Run npm run check.
2. Verify GET /health reports the MCP as ready without any model credential.
3. Connect the public MCP server and run tools/list.
4. Call `search_writing_methods` with a non-sensitive editorial problem description and verify it returns canonical method records. Then call `get_writing_reference` for `example-derived-patterns` and verify the concrete repertoire is available.
5. Call `render_writing_diagnostic` only after analysis. Verify exact span validation, canonical method-id validation, repository provenance, and the UI resource.
6. In the installed host, select Keep it or a repair direction and verify “Revise with these decisions” posts one follow-up turn that preserves the authorized editing mode and leaves unresolved findings unresolved.
7. Run the positive and negative review cases in the manifest.
8. Verify `/.well-known/openai-apps-challenge` when the submission portal gives you a domain token.
9. In the submission portal, scan tools and confirm every tool advertises readOnlyHint true, destructiveHint false, and openWorldHint false.
