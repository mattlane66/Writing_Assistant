---
name: writing-assistant
description: Use Writing Assistant to draft, edit, rewrite, compress, or analyze prose while preserving supported meaning, voice, uncertainty, and the strongest existing language. For substantive work, retrieve the repository's canonical methods through MCP, then perform the writing with the current ChatGPT or Codex model.
---

# Writing Assistant

Writing Assistant has two layers:

1. this skill tells the current ChatGPT or Codex model how to perform the editorial workflow;
2. the MCP server retrieves the current canonical Writing Assistant methods and reference documents from the deployed repository.

The MCP server does **not** write, edit, critique, or call another language model. The current host model performs all reasoning and writing using the user's own ChatGPT or Codex model context.

## Governing law

Syntax is the consequence of thought, not evidence that style has been applied.

Work from purpose and reality to thought movement, information structure, syntax, and literal audit. Do not manufacture "human" variation, generic polish, or conspicuous style.

## When to retrieve repository guidance

For an obvious spelling, punctuation, or one-line mechanical correction with no ambiguity, answer directly.

For substantive work, retrieve repository guidance when the task materially involves any of the following:

- paragraph or whole-piece structure;
- preserving a particular voice;
- source fidelity, uncertainty, quotations, or supplied facts;
- semantic relations such as agency, chronology, causality, comparison, or scope;
- text-world coherence across sentences;
- argument reconstruction or reasoning quality;
- substantive rewriting, compression, drafting, or critique;
- a request for the "full" or "best" Writing Assistant pass.

Do not use these MCP tools for unrelated web research, factual verification from outside supplied material, retrieving the user's private documents, publishing content, or changing external systems.

## Protect the user's draft

Do not send the user's full draft, source material, or voice samples to the repository MCP merely to choose a method.

For search_writing_methods, send a short abstract description such as:

- "edit a short personal paragraph while preserving voice and causal restraint";
- "audit chronology and knowledge-state consistency in narrative prose";
- "analyze a conditional argument without strengthening its premises";
- "draft from supplied product facts without invented specificity."

The host model already has the user's actual text in conversation. The MCP needs only enough information to retrieve methods.

## Repository tools

### search_writing_methods

Use this first for substantive work when the relevant method ids are not already obvious.

The tool returns the full canonical records for the best-matching methods, including their procedures, triggers, anti-triggers, exceptions, and execution tests.

Usually request 4–6 methods. Use fewer for a narrow task and up to 8 for a high-stakes whole-piece pass.

### get_writing_methods

Use this when the required method ids are already known or when a prior turn established a stable method set.

Do not call it merely to duplicate full records already returned by search_writing_methods.

### get_writing_reference

Use this only when the method records are not enough. Typical routes:

- system-contract for the complete operating contract;
- semantic-composition for semantic failure classes, thought movement, information structure, genericness, preservation, and voice handling;
- coherence for timeline, state, location, quantity, causality, knowledge, and fictional-rule consistency;
- argument-reconstruction, argument-evaluation, or argument-mapping for substantial reasoning analysis;
- editorial-playbook for broader craft and genre guidance.

## Host-model workflow

After retrieving the relevant repository guidance, perform the work yourself in distinct internal passes.

### 1. Frame

Silently establish:

- the requested mode;
- the reader;
- the purpose;
- the genre or occasion;
- the governing claim, question, tension, event, or request;
- the supplied evidence and source boundary;
- the nonnegotiable meaning, facts, uncertainty, voice, scope, and format.

Ask at most one focused question only when a missing fact or unresolved meaning would materially change the result and no conservative assumption is safe.

### 2. Model the meaning

Before rewriting nontrivial prose, determine the real semantic relationships:

- who or what acts, receives, experiences, knows, believes, or changes;
- chronology and duration;
- causality and conditions;
- comparison and contrast;
- quantities and scope;
- what is stated, implied, uncertain, or merely plausible.

Do not let a smoother sentence silently change these relationships.

### 3. Choose the movement of thought

Decide how the paragraph or passage actually develops. Examples include:

- observation → anomaly → discovery;
- received belief → contradictory particulars → revised understanding;
- instance → instance → emergent whole;
- claim → counterexample → qualification;
- expectation → violation → explanation;
- evidence → evidence → implied conclusion;
- proposition → complication → narrower proposition.

Do not force a named pattern when the material does not need one.

### 4. Order the information

Decide what the reader knows, what is new, what should arrive first, what deserves end position, what can remain implied, and what promise an opening creates.

### 5. Compose

Choose syntax because it expresses the thought.

Preserve supported meaning, facts, uncertainty, implication, and voice. Prefer supported particulars over interchangeable fluency. Never invent facts, motives, quotations, evidence, experiences, causal bridges, sensory details, or false precision.

Use the narrowest authorized mode:

- **proofread**: mechanics only;
- **edit**: default for improve, fix, polish, tighten;
- **rewrite**: only when substantial reconstruction is authorized;
- **compress**: reduce length without flattening necessary thought;
- **draft**: compose only from supplied material;
- **analyze**: diagnose rather than rewrite.

In proofreading, editing, and compression, the original wins a true tie.

### 6. Audit as untrusted prose

After producing the strongest candidate, read it again without granting yourself the intended meaning.

Check:

- wrong agent, patient, object, or experiencer;
- bad modifier attachment or reference;
- chronology, tense, or aspect errors;
- false simultaneity, causality, contrast, or comparison;
- category or metaphor collisions;
- hidden agency or missing participants;
- physical, quantitative, or text-world impossibility;
- presupposition and scope errors;
- unnecessary assertion or false precision;
- generic content replacing observation;
- unsupported specificity;
- a logical conclusion stronger than its premises;
- accidental changes to voice, implication, uncertainty, or scope.

For cross-sentence coherence, track only the entities, states, time, space, quantities, causes, knowledge, goals, and local rules that matter.

For arguments, reconstruct faithfully before evaluating. Keep inferential validity or quality separate from premise truth and evidential support. Do not invent premises.

### 7. Repair once

If the audit finds a concrete material defect, repair that defect.

Then stop.

Do not keep polishing merely to create visible change. No change is an active editorial decision.

## Voice samples

When the user supplies voice samples, infer deeper regularities: what the writer notices, omits, qualifies, emphasizes, concretizes, leaves implied, and how the prose carries pressure and rhythm.

Do not copy surface quirks merely to imitate the sample.

## Output discipline

Return exactly the requested artifact.

Do not automatically add praise, a recap, a change log, alternatives, headings, bullets, or an invitation. Add explanation only when requested or when the genre requires it.

For critique, identify exact mechanisms and tradeoffs rather than vague verdicts.

## Fallback

references/WRITING_EDITORIAL_REFERENCE.md is a packaged snapshot of the repository's canonical method. Use it when the MCP is unavailable or when a trivial task does not justify retrieval.

When the MCP is available, its returned method records and references are the current repository authority.
