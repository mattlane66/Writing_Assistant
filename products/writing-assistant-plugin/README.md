# Writing Assistant MCP plugin package

This folder is the source package for the public Writing Assistant plugin.

The repository is the canonical source of editorial behavior. The package contains the workflow skill, a generated fallback editorial reference, and the MCP connection.

## Runtime architecture

The user's current ChatGPT or Codex model performs all writing and reasoning.

The MCP server does not call OpenAI or another language model. It exposes three read-only repository tools:

- search_writing_methods — retrieve the best-matching full method records from the 40-concept registry;
- get_writing_methods — retrieve full methods by id;
- get_writing_reference — retrieve a deeper canonical reference document.

For substantive work, the skill retrieves only the guidance it needs, then the host model performs the frame → semantic model → thought movement → information order → compose → audit → one repair workflow itself.

The skill tells the host model to send a short abstract task description to method search rather than forwarding the user's full draft or voice samples to the MCP.

## Build a package

The production MCP endpoint is:

https://writing-assistant-mcp.up.railway.app/mcp

Build the package with:

WRITING_ASSISTANT_MCP_URL=https://writing-assistant-mcp.up.railway.app/mcp npm run writing-assistant-plugin:package

The ZIP is written to products/writing-assistant-plugin/dist/.

The packager regenerates the fallback editorial reference from the canonical semantic-composition, editorial, coherence, and argument-method files. Do not hand-edit the generated reference in dist.

## Test before public review

1. Run npm run check.
2. Verify GET /health reports the MCP as ready without any model credential.
3. Connect the public MCP server and run tools/list.
4. Call search_writing_methods with a non-sensitive editorial problem description and verify it returns canonical method records.
5. Run the positive and negative review cases in the manifest.
6. Verify /.well-known/openai-apps-challenge when the submission portal gives you a domain token.
7. In the submission portal, scan tools and confirm every tool advertises readOnlyHint true, destructiveHint false, and openWorldHint false.

The server has no custom UI.
