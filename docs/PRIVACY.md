# Writing Assistant privacy policy

_Last updated: October 7, 2026_

Writing Assistant is a writing and editing plugin operated by Matthew Lane.

## Summary

Writing Assistant uses the ChatGPT or Codex model the user is already using for drafting, editing, critique, and reasoning. Its Railway-hosted MCP server does not call another language model and does not maintain a user account database.

The MCP retrieves public Writing Assistant methods and references. When the optional interactive diagnostic is used, it also receives the exact passage and the host model's already-reasoned findings so it can validate marked spans and render the diagnostic.

## Categories of data processed

Writing Assistant may process the following categories of data when they are needed for a requested feature:

1. **Retrieval inputs.** A short description of the editorial problem for `search_writing_methods`, canonical method ids for `get_writing_methods`, or a canonical reference id for `get_writing_reference`.
2. **Diagnostic content.** If the optional `render_writing_diagnostic` tool is used, the exact passage being inspected, the host model's findings, canonical method ids, and the authorized editing mode.
3. **Technical and operational data.** Railway may process ordinary service data such as IP or network metadata, request timing, deployment information, and error information needed to operate and secure the service.

Writing Assistant does not ask the MCP for payment-card data, government identifiers, authentication secrets, passwords, API keys, or protected health information. Do not submit those categories of data to the MCP.

## Purposes of processing

Writing Assistant processes data only to:

- select and return the relevant public Writing Assistant methods or reference material;
- validate exact quoted spans and render the optional interactive diagnostic;
- return the writer's selected diagnostic decisions to the existing ChatGPT or Codex conversation; and
- operate, secure, troubleshoot, and maintain the MCP service.

Writing Assistant does not use submitted writing for advertising, sale, data brokerage, or model training by the plugin operator.

## Who receives the data

- **OpenAI / the ChatGPT or Codex host** processes the user's conversation under the user's OpenAI product settings. This is the model context in which Writing Assistant is invoked.
- **Railway** hosts the Writing Assistant MCP service and processes the MCP requests and ordinary infrastructure data necessary to deliver the service.
- **Matthew Lane, the plugin operator,** may access Railway operational logs when necessary to diagnose or secure the service. The application is not designed to log user passage content to stdout or stderr.

The MCP tools return public repository guidance and do not upload user drafts to a separate OpenAI vector store or create a second developer-side model request.

## Retention

Writing Assistant does not intentionally persist MCP tool arguments, diagnostic passages, findings, or returned repository guidance in an application database. Request content is processed to fulfill the request and is not intentionally retained by the application after the response is complete.

Railway may retain application, deployment, and operational logs according to the Railway plan in use. Railway currently documents application/deployment log retention as 3 days on Free, 7 days on Trial and Hobby, 30 days on Pro, and up to 90 days on Enterprise. Railway controls that infrastructure retention.

The user's ChatGPT or Codex conversation is retained according to the user's OpenAI account and product settings, independently of the Writing Assistant MCP.

## User choices and controls

Users can:

- avoid the optional interactive diagnostic if they do not want the exact passage transmitted to the MCP;
- keep sensitive material out of retrieval descriptions, which need only an abstract description of the writing problem;
- stop using or uninstall the plugin at any time through ChatGPT; and
- contact the operator with privacy questions or requests through the support page.

Because Writing Assistant does not maintain a user-content database, the operator generally does not have a stored copy of a diagnostic passage to retrieve or delete after the request completes.

## No sale or advertising use

Writing Assistant does not sell user drafts or personal data and does not use submitted writing for advertising.

## Service providers and their policies

Railway privacy policy: https://railway.com/legal/privacy

Railway log-retention documentation: https://docs.railway.com/observability/logs

OpenAI handles the user's ChatGPT or Codex conversation under the policies and controls applicable to the OpenAI product the user is using.

## Contact

For privacy questions or requests, use the support page:

https://writing-assistant-mcp.up.railway.app/support.html

## Changes

This policy can be updated as the service changes. Material changes will be reflected in this document and its revision history.
