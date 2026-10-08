# Product Intent pilot: Writing Assistant

This is the first real-product evaluation of the [Planning Skills product-intent layer](https://github.com/mattlane66/planning-skills-for-agents-and-humans/tree/main/product-intent).

The rules in [pilot-contract.json](./pilot-contract.json) are **working inferred intent**, drawn from the product's pre-existing tests. They have **not** been promoted to product-owner-approved intent. The pilot does not use an API, generate text, or ask a language model to judge its own work.

## Evidence

The runner evaluates real, unmodified `server/meaning-contract.mjs` and `server/text-world.mjs` behavior using four pre-existing behavioral expectations: qualification-preservation review, exact source-span grounding, contradictory quantities and an equivalent-units control.

On the initial pilot (PR #27), **4/4 baseline scenarios passed; 4/4 deliberately injected regressions were detected; 0/1 harmless-change controls triggered an alarm.** This is a small, seeded mutation score, not a claimed population false-positive rate.

Run calibration against disposable module copies:

```sh
node product-intent/run-pilot.mjs
```

Run only approved examples against the current checkout (no injected mutations):

```sh
node product-intent/run-pilot.mjs --verify-only --source-root .
```

The protected-base workflow (`.github/workflows/product-intent-protected.yml`) checks out the exact base revision into `trusted/`, the candidate revision into `candidate/`, and runs **the base branch's checker and contract** against **the candidate's production code**. An agent cannot make its own behavioral change appear safe merely by editing the checker or expectations in the candidate branch. The candidate module is executed in a disposable environment on an isolated CI runner with read-only permissions and no workflow secrets; this is **not a full security sandbox**. The workflow's source and contract can still be changed by a separately authorized change to the base branch.

## Scope and limitations

- Only two JS modules and four scenarios are covered; other code and flows can regress undetected.
- A passing run means those scenarios hold, not that the whole product is semantically equivalent.
- The lexical code-to-intent mapping and PlanningPackage compiler have **not** been installed in this product repository. This pilot validates the behavior-verification wedge first.
- The mutation calibrator intentionally uses exact source transformations. It runs separately from the protected candidate check so benign source refactors don't fail because a mutation anchor moved.
- For a production blocking gate, configure the repository ruleset to require **Product Intent (trusted baseline)** and require approval for edits to `product-intent/**` and its workflow. Merely committing a workflow file does not enable branch protection.

Next: create an owner-reviewed baseline in PlanningPackage, instrument bindings and broaden coverage to the React UI, server API and agent orchestration. Measure seeded regressions per behavior class and false positives across meaningful safe refactors, not only the single harmless-change control.
