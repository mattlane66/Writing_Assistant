# Concept evaluations

The concept evals test two different abilities:

- **Recognition:** the planner selects every method required by a request and avoids clearly irrelevant methods.
- **Execution:** the pipeline's final writing satisfies concept-specific behavioral rubrics without triggering their failure signals.

`concept-recognition.cases.json` and `concept-execution.cases.json` jointly cover every stable ID in `knowledge/CONCEPT_REGISTRY.json`. The paired cases share the same request so a live run can evaluate routing and application together.

Validate schemas, pairings, IDs, bounds, and full registry coverage without calling OpenAI:

```bash
npm run eval:concepts
```

Exercise the real Agents SDK pipeline and an independent structured-output grader:

```bash
npm run eval:concepts:live
```

Use `--limit=N` or `CONCEPT_EVAL_LIMIT=N` for a smaller live sample. Live results are written to the ignored local path `evals/results/latest.json`; they may contain evaluated drafts and outputs and must not be committed. Every pipeline and grader request uses `store: false`, and traces retain structure while excluding sensitive inputs and outputs.
