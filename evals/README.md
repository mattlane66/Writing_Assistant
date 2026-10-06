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


## Cross-cutting writing regressions

`writing.cases.json` tests behavior that spans multiple registry concepts. The suite deliberately includes three kinds of cases:

1. **bad -> repair** — a real meaning, logic, grounding, or syntax defect must be fixed;
2. **good -> leave alone** — a plain or unusual construction is already doing its job; and
3. **over-edited -> restore** — a plausible "improvement" adds scaffolding, genericness, imitation, or explanation and should be rejected.

Use these cases when comparing a baseline model with the Writing Assistant. Score both outputs for fidelity, reasoning, supported specificity, literal integrity, implication, structure, voice preservation, intervention discipline, and cross-output sameness. The goal is not simply to make one output sound polished; it is to avoid producing the same invisible editor across unrelated tasks.
