# Writing Assistant privacy policy

_Last updated: October 7, 2026_

Writing Assistant is a writing and editing plugin operated by Matthew Lane.

## How the plugin works

The Writing Assistant plugin uses the current ChatGPT or Codex model to perform drafting, editing, critique, and reasoning.

The Writing Assistant MCP server does not call OpenAI or another language model. It retrieves public Writing Assistant repository guidance and can optionally validate and render an interactive diagnostic prepared by the host model.

## Data processed by the MCP server

The three retrieval tools accept repository-selection inputs:

- a short description of the editorial problem for `search_writing_methods`;
- canonical method ids for `get_writing_methods`;
- a canonical reference id for `get_writing_reference`.

The plugin skill instructs the host model not to send a full private draft, source material, or voice sample to those retrieval tools merely to select methods.

The optional `render_writing_diagnostic` tool is different. When the user requests or materially benefits from the interactive diagnostic, the host model sends the exact passage plus already-reasoned findings to the Railway-hosted MCP service so the server can validate quoted spans and render the passage. The renderer does not independently analyze the prose and does not make a second model request.

## Storage and logging

The MCP application does not intentionally persist tool arguments or returned repository guidance in its own application database.

Railway can process ordinary network and operational data needed to deliver and secure the MCP service, such as request timing, network metadata, and error information.

The MCP tools return public repository content and do not upload user drafts to an OpenAI vector store.

## ChatGPT and Codex processing

The user's conversation and final writing are processed by the ChatGPT or Codex model the user is already using. That processing is part of the OpenAI product context in which the user invoked the plugin; the Writing Assistant MCP does not create a second model request on the developer's OpenAI API account.

## No sale of personal data

Writing Assistant does not sell user drafts or personal data and does not use submitted writing for advertising.

## Your choices

Do not include sensitive material in an MCP retrieval description when a short abstract description will identify the relevant writing method. If you use the interactive diagnostic, the passage shown in that diagnostic is transmitted to the MCP service for validation and display.

For privacy questions or requests, use the support page:

https://writing-assistant-mcp.up.railway.app/support.html

## Changes

This policy can be updated as the service changes. Material changes will be reflected in this document and its revision history.
