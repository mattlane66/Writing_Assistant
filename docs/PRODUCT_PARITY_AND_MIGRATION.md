# Product parity and migration — approved first cycle

## Result

The split product is now explicitly mapped and reproducibly inspectable. The public plugin has newer knowledge; the local prototype has richer execution contracts. They must not be described as one identical released system.

This completes TG1's source-inventory and migration-design result, not the migrations themselves. No provider calls, changes to installed skills, public deployment or private draft retention occurred.

See [the dated release manifest](PRODUCT_RELEASE_MANIFEST.json) and [the approved execution cycle](PRODUCT_COMPLETION_EXECUTION_PLAN.md). Both preserve the distinction between observations and unverified host behavior.

## Measured source differences on 2026-10-11

| Dimension | Public plugin checkout | Advanced local prototype |
|---|---|---|
| Application label | 1.2.0 | 1.2.0 |
| Optional API-backed pipeline | 1.2 | 4.0 |
| Plugin source package | 0.46.0 | Not present in the inspected local files |
| MCP server | 2.3.0; eight tools; nine reference routes | Public MCP source not present |
| Registry | 1.0.0; forty methods | 1.0.0; the same forty serialized method records |
| Example corpus | 2.20.0; 203 cards | 2.4.0; 96 cards |
| Review ledger | 1.19.0; 1,310 text pages + fifty visual dispositions | 1.3.0; 189 text pages, older incomplete ledger |
| Remaining supplied-page dispositions | Zero | 1,171 in this older ledger, not the current public review status |

All 96 local card IDs exist in the public bank. The public bank adds 107 card IDs. Twenty-two shared serialized card records differ; this is not a claim of twenty-two newly discovered ideas or semantic differences. The currently inspected concept registry records match exactly. The schema, corpus, source manifest and review ledger must still be validated together before either runtime changes its knowledge input.

The connected live coverage tool reported baseline revision `76acb7e26ba71f615e2f17625aca6d1b3987fb1a`, corpus 2.20.0 and 203 cards, matching the public knowledge inventory. The current working tree also has this cycle's new operator script/tests/docs; those changes are not deployed by this observation.

The selected session-cache skill snapshot is version 0.43.0 and its hash differs from the public 0.46.0 skill source. This locates an instruction-snapshot difference. It does not establish which bundle is activated in ChatGPT Chat or Work.

## Capability witnesses and migration decisions

These are source witnesses plus manual code inspection, not observed runtime or editorial-quality passes.

| Capability | Public plugin today | Local prototype | Recommended migration boundary |
|---|---|---|---|
| Core craft, scene and argument methods | Retrieved and applied by host | Selected and used by API pipeline | Keep one canonical forty-method registry. |
| Original examples and source caveats | Newer 203-card public bank | Older 96-card bank | Public corpus/ledger is the candidate knowledge authority; port only with schema/provenance validation. |
| Shared source-linked semantic record | Host instructions, no dedicated record validator | `semantic-plan.mjs` | Extract a provider-independent bounded validator; do not mistake pointer validity for truth. |
| Complete semantic-entry audit | Host-guided | Required typed reviews in pipeline 4.0 | Preserve asserted/inferred/unknown distinctions and review completeness, with honest semantic limits. |
| Missed-method recovery | Focused retrieval guidance | Auditor can recover selected missed methods | Add bounded gap-recovery contract, not an exhaustive-recall claim. |
| Repair verification | Host-guided final audit | Final verification can withhold unresolved repair | Reuse explicit outcome and stopping contracts rather than transplanting provider calls. |
| Short candidate comparison | Host can provide alternatives when useful | Two short trials, original eligible to win | Reuse constraints and original-wins-tie policy; evaluate benefit before adding routine latency. |
| Long-document scaffold | Coherence guidance and bounded checks | Section/entity/chronology/quantity/rule scaffold | Port structured contracts after host-control choice; expose omitted sections and invalidate edited evidence. |
| Approved project context | Conversation context only; no dedicated durable project service | Browser-local explicit save/enable/delete | Begin with explicit portable context. Browser/widget state is not reliable cross-device durable storage. |
| Feedback | No dedicated capture service in public plugin | Consented browser-local capture and regression bridge | Keep raw feedback private; add review interface without automatic rule promotion. |
| Local primary-PDF search | Not exposed by public MCP | Local-only index/search | Keep local. Do not add source PDFs or extracted text to public tools. |
| Gemini adapter/free-only controls | Not the plugin execution path | Separate configured API path | Keep optional development capability; never a plugin fallback. |
| Interactive diagnostic | Shared integrated renderer | Older separate web-editor surface | Preserve one renderer; test actual Chat/Work handoff. |
| Independent evidence/blind comparison | Current reliability workbench foundations | Older model-eval/comparison tools | Prefer the current independence contract; preserve historic cohorts as historical evidence, not current scores. |

## Proposed migrations, in order

1. Preserve the public baseline and local dirty working files. Do not reset, overwrite, or wholesale merge either checkout.
2. Bind release identity to separate application, pipeline, MCP, plugin-snapshot, registry, corpus and review versions. Keep deployment and installation observations separate.
3. Prove the actual Chat/Work interaction and allowed workflow controls. Do not assume that MCP can force all host replies through our tool sequence.
4. If the host-first architecture is selected, extract provider-independent semantic/evidence/outcome contracts from the local implementation into a small reviewed seam. Update relevant prompts, fixtures and README together. Keep provider calls out of the public MCP path.
5. Reconcile the shared schema against the public 203-card corpus and review ledger; run knowledge/provenance checks and both development retrieval suites. Keep public source caveats and stable IDs. Preserve local-only behavioral fixtures that remain meaningful; do not replace independent quality evidence with fixture counts.
6. Integrate the diagnostic decision/change-review contract with the chosen workflow; make discussion versus application explicit and reject stale choices.
7. Port document/context and operator feedback/review capabilities in separately selected slices. No new remote persistence without an approved privacy/authentication/retention boundary.
8. Build a package or expose skill-import discovery only under the existing release workflow. Deployment, scan/import snapshot, activation and fresh-host observation are separate steps. No installed-cache files are edited directly.

## Reproduce without secrets or model calls

From this public checkout:

```sh
npm run product:parity
npm run product:parity -- --local-root /absolute/path/to/the/local-prototype
npm run product:parity -- --local-root /absolute/path/to/the/local-prototype --session-skill /absolute/path/to/selected/skills/writing-assistant/SKILL.md
```

The inspector reads a fixed public-source allowlist and outputs versions, counts, file hashes and source witnesses. It does not import the compared runtime, enumerate the home directory, read `.env`/PDF/private receipts, emit source prose, call models, or mark host installation observed. Source markers can occur in comments: they are leads for manual inspection, not semantic implementation proof. Invalid/missing inputs remain unavailable rather than becoming zeros or passes.

Tests cover mismatched corpora under equal app labels, changed records under stable IDs, code-only witnesses, malformed data, page overlaps, explicit unknown installation/deployment, symlink refusal, protected output and rejected live/write/provider options.

## Acceptance and unresolved work

TG1 exit evidence: inventory command, dated version/capability manifest, exact record comparison, preserved dirty prototype, source-level migration design, cache discrepancy and explicit host-install gaps.

Still unresolved: actual activated package versions in Chat/Work; the observed choices-to-revision journey; supported host-control mechanisms; independent source/judgment review; actual improvements from local pipeline mechanisms. These remain TG2/TG3/TG4 and later evidence gates, not completed by this record.
