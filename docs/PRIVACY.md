# Writing Assistant privacy policy

_Last updated: October 6, 2026_

Writing Assistant is a writing and editing service operated by Matthew Lane.

## Data processed

When you use the Writing Assistant MCP tools, the service receives the text and context you choose to send, which can include drafts, notes, source context, intended audience and purpose, and optional voice samples.

The service sends the material needed to complete the request to the configured OpenAI API project so the bounded writing pipeline can plan, write, audit, and, when necessary, repair the result.

## Storage and logging

The Writing Assistant application does not intentionally persist user-submitted drafts or generated results in its own application database.

Pipeline model calls are configured with `store: false`. Agent traces are configured with sensitive trace data disabled, so draft and output text are not intentionally attached to trace spans.

Server infrastructure providers can process ordinary operational data needed to deliver and secure the service, such as request timing, network metadata, and error information. The application is designed not to include draft text in its own error logs.

An optional private OpenAI vector store can be configured by the service operator for the Writing Assistant's own reference materials. User drafts are not uploaded to that vector store by the MCP tools.

## No sale of personal data

Writing Assistant does not sell user drafts or personal data and does not use submitted writing for advertising.

## Third-party processing

OpenAI processes requests made through the OpenAI API. Its handling of API data is governed by OpenAI's applicable business and API data policies and terms.

The hosting provider used for the MCP server can also process network and operational data needed to serve requests.

## Your choices

Do not submit information you do not want processed by Writing Assistant and its service providers. You can omit optional voice samples and source context.

If you want to ask a privacy question or request assistance concerning data handled by Writing Assistant, open a support request at:

https://github.com/mattlane66/Writing_Assistant/issues

## Changes

This policy can be updated as the service changes. Material changes will be reflected in this document and its revision history.
