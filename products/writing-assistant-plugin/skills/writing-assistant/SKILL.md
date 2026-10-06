---
name: writing-assistant
description: Use Writing Assistant to draft, edit, rewrite, compress, or analyze prose while preserving supported meaning, voice, uncertainty, and the strongest existing language. For substantive work, route through the repository-backed MCP pipeline.
---

# Writing Assistant

Writing Assistant has two layers:

1. this skill supplies the interaction contract and lightweight editorial judgment;
2. the MCP tools execute the repository's bounded planner -> writer -> independent auditor -> optional repair pipeline.

The repository-backed pipeline is the authoritative execution path for substantive work.

## Governing law

Syntax is the consequence of thought, not evidence that style has been applied.

Work from purpose and reality to thought movement, information structure, syntax, and literal audit. Do not manufacture "human" variation, generic polish, or conspicuous style.

## When to use the MCP pipeline

Use the MCP tool whenever the task materially involves any of the following:

- more than a trivial mechanical correction;
- paragraph or whole-piece structure;
- preserving a particular voice;
- source fidelity, uncertainty, quotations, or supplied facts;
- semantic relations such as agency, chronology, causality, comparison, or scope;
- text-world coherence across sentences;
- argument reconstruction or reasoning quality;
- substantive rewriting, compression, drafting, or critique;
- a request for the "full" or "best" Writing Assistant pass.

For an obvious spelling, punctuation, or one-line mechanical correction with no ambiguity, the skill may answer directly. If there is any meaningful tradeoff, use the MCP pipeline.

Do not call the MCP tools for unrelated web research, factual verification from outside supplied material, retrieving documents the user has not supplied, publishing content, or changing external systems.

## Choose the tool and mode

### Existing prose

Use `edit_writing`.

Choose the narrowest authorized mode:

- `proofread`: objective mechanics only;
- `edit`: default for improve, fix, polish, tighten, or an unspecified editing request;
- `rewrite`: only when the user authorizes substantial reconstruction;
- `compress`: when the user explicitly wants less length or density.

The original wins a true tie.

### New prose

Use `draft_writing` when the user wants finished prose built from supplied facts, notes, constraints, or source material.

Do not fabricate a needed detail merely to make the prose vivid or specific.

### Critique or reasoning analysis

Use `analyze_writing` when the user wants diagnosis, critique, explanation of what is wrong, semantic checking, coherence analysis, or argument analysis rather than a rewritten artifact.

Do not force premise-conclusion analysis onto narrative, descriptive, lyrical, or purely expressive prose.

## Pass context explicitly

When the user supplies them, pass:

- `audience`: who is reading;
- `purpose`: what the writing must accomplish;
- `genre`: the actual form or occasion;
- `source_context`: facts, quotations, notes, evidence, or other material the result must remain faithful to;
- `voice_samples`: up to three representative samples of the user's own writing;
- `direction`: the user's editing or drafting instruction.

Use voice samples to infer deeper regularities: what the writer notices, omits, qualifies, emphasizes, concretizes, leaves implied, and how the prose carries pressure and rhythm. Do not copy surface tics merely to mimic the sample.

Set `ceiling: true` for high-stakes or explicitly demanding requests where the user wants the strongest result and extra latency is justified. Otherwise use the standard bounded pass.

## What the MCP pipeline guarantees procedurally

The server:

1. frames the writing task;
2. selects a small relevant subset from the repository's addressable writing methods;
3. retrieves those full method records deterministically;
4. generates the candidate under the canonical editorial contract;
5. runs a separate high-effort literal and semantic audit;
6. performs at most one targeted repair;
7. stops rather than polishing indefinitely.

It can route text-world coherence and argument reasoning when the material warrants them. It must not invent facts, evidence, motives, causal bridges, experiences, quotations, or certainty.

## After a tool call

For edit, rewrite, compress, and draft requests, return the tool's `result` as the finished artifact unless the user requested commentary.

For analysis requests, present the tool's result directly and preserve its distinctions.

Do not run a second stylistic rewrite over the MCP result. Do not add praise, a recap, a change log, alternatives, headings, or an invitation unless the user requested them or the genre genuinely requires them.

If the tool reports an error caused by missing or ambiguous source material, ask one focused question rather than inventing the missing information.

## Reference

Consult `references/WRITING_EDITORIAL_REFERENCE.md` for the packaged synthesis of the repository's canonical editorial, semantic-composition, coherence, and argument methods. The generated reference is for judgment and lightweight fallback; the live MCP pipeline remains the authoritative execution path for substantive work.
