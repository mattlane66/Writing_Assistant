# Book-informed MCP extension

Current plugin: 0.46.0 adds evidence-first criticism and mode-aware diagnostic handoff. Subsequent server-side source work brings the corpus to 148 original cards and 637 tracked text-reviewed pages. Eighteen inspected covers, blanks and illustrated context are reported separately, leaving 705 first-pass disposition gaps out of 1,360 pages. Zinsser, Klinkenborg and Orwell now have complete first-pass page accounting, not independent idea or judgment validation; see `KLINKENBORG_IDEA_AUDIT.md` and `ZINSSER_IDEA_AUDIT.md`. King's craft and context passes cover 114 additional text pages and sixteen conditional application cards; see KING_IDEA_AUDIT.md. The 0.45.0 implementation history below records the original extension's earlier counts. See `PLUGIN_JUDGMENT_ACCEPTANCE.md` for source-review, target-host, quality and usability evidence gates. No universal semantic guarantee is offered.

Implementation base: public repository commit `621df9f24a84277302a87dc308b795c3be3b7a70`. Existing Builder plugin identity: `plugin_asdk_app_6ac68c67f8048191a43cec7a2ec2799c`. The linked saved draft's review/publication state was not verified. This is an additive source implementation, not authorization to deploy or replace it.

## Delivered foundations

The four existing tools and interactive decision handoff remain intact. Four new read-only, no-auth tools expose the previously local original corpus and bounded checking code:

| Tool | Input boundary | Output / limit |
| --- | --- | --- |
| `search_writing_examples` | Abstract query ≤1,200 characters; ≤8 known concept IDs | Up to 8 full original cards within a 14,000-character card budget; exceptions, counterexamples and alternatives preserved; skipped requested concepts visible |
| `get_writing_examples` | 1–8 unique known card IDs | Exact full cards; rejects packets >50,000 characters; no arbitrary files |
| `get_writing_coverage` | No arguments | Seven identities/caveats, page-review ranges and gaps, forty stable methods, 96 card mappings, corpus fingerprint |
| `check_writing_revision` | Original and candidate each ≤12,000 characters; one authorized mode; explicit text-processing authorization | Literal meaning/world review, supported exact calculations, coverage/omission metadata, zero provider calls; no semantic certificate |

The semantic candidate ranking is local corpus-derived TF-IDF/LSA, not pretrained semantic understanding. All returned examples are original illustrative prose, not quotations from the books or external factual evidence. Source identities and caveats are preserved, including the Bookey file's incomplete secondary status. The existing manifesto, semantic-composition, example-derived repertoire, coherence and argument references remain available.

Data is loaded from deployment-local allowlisted files. Corpus/manifest/ledger validation fails closed on identity, locator, caveat or page-accounting drift. The validated corpus is cached for the running process; deploy/restart to load changed source. Inputs are bounded and unknown fields rejected. Text errors do not echo supplied passages. The checker is stateless and does not intentionally persist inputs or outputs; infrastructure processing/log retention remains governed by the hosting setup, not guaranteed away by the code.

The authorization boolean is not authentication or proof of consent. The skill requires actual user authorization before the host sets it. The server cannot verify a human's intent from a model-supplied flag. Private book retrieval would require a separately designed authenticated access layer; it is not enabled here.

The Docker build context explicitly excludes the private book/extracted-text directory and local vector-store receipts. The runtime image adds a public corpus/ledger validation gate; the actual Docker image build has not been run locally in this implementation, so container execution remains a deployment check.

## Honest coverage and quality limits

The ledger reports 189 tracked model-reviewed pages out of 1,360, leaving 1,171. These are imported existing review records, not newly reviewed pages in this implementation. Extraction is not substantive review. Source cards span all seven sources and forty methods, but those mappings do not establish complete idea coverage.

No source PDFs, full extracted text, keys, vector-store receipts, or private local indexes are copied into this extension or the plugin ZIP. The 96 original cards and paraphrased review ledger are server-side public knowledge; the ZIP contains the updated skill and generated canonical fallback, not the entire example bank. If the MCP is unavailable, the host must not claim it executed checks or accessed those cards.

Literal checks can miss errors or surface benign differences. Every review signal needs contextual judgment; a formal calculation has only its stated exact-template scope. Analysis/draft modes do not enforce source restatement. There is no new independent reasoning model, mandatory multi-model pipeline, general semantic proof, or evidence of superiority over another model/custom GPT.

## Verification and remaining work

Run `npm run check`. The added offline MCP evaluation exercises 24 original authored application/restraint queries without oracle concept IDs; target retrieval and complete exception transport are acceptance gates. Existing meaning/world tests and new MCP privacy/bounds/provenance tests run without real provider requests. These measurements are development regressions, not held-out recall or human prose ratings.

Local verification on October 7, 2026: `npm run check` passed, including 142 app/server tests, 76 Diagnostic tests, lint, concept contracts, TypeScript, production build, structural plugin packaging, and 24/24 authored MCP retrieval fixtures with their exceptions retained. The independent Diagnostic product reports its own public-submission gates still pending; its software checks passing does not assert that product or this extension is published.

The verified public-knowledge fingerprint is `6611c8b70690e5c1ff14cd3b0432038dcb87765346601cbb9d6918e87922650a`; the retrieval fixture fingerprint is `8272b138b51eb28fbe46114b98adab79eedccd8ff107e85660f4ce13c10f1020`. Neither is a hash of deployed plugin state or private PDF content. See [the extension host runbook](BOOK_INFORMED_HOST_TESTS.md) for explicit, unrun acceptance tests.

Further work toward comprehensive embodiment remains:

1. Review the remaining book pages locally in bounded, source-located batches, create original practice examples with exceptions and multiple defensible revisions, and update review records only after substantive inspection. Preserve source disagreements and do not inflate completeness from extraction.
2. Expand independent recognition/application/restraint benchmarks and run genuine blinded host-model comparisons. In particular, test missed methods, overconfident criticism, voice preservation, genre differences, fidelity, and successful no-change decisions.
3. Verify new-tool use and the existing diagnostic round-trip in the intended ChatGPT/Codex host. The server cannot force a host model to call a tool; missed invocation is a testable failure, not solved by metadata alone.
4. Design any private full-book retrieval separately with authentication, user-controlled storage, access checks, bounded excerpts and source reuse constraints. No upload of the PDFs is authorized or performed by this change.

## Rollout without replacing the baseline blindly

Candidate plugin version is 0.45.0; MCP version is 2.2.0. Identity, endpoint, branding, three starter prompts, eight deep-reference routes, existing tools and renderer are preserved. Publisher is Matthew Lane, commerce false, country targeting unrestricted as explicitly confirmed. The privacy page and skill now describe the opt-in checker; these are local source changes until deployed.

Before deployment, review the changes and hosting costs. With authorization, deploy through the existing Railway process and check all eight tools and source/corpus fingerprints. Then rescan the existing Builder MCP and resolve tool findings. Upload the complete 0.45.0 ZIP to the same plugin when authorized; the newer instructions are not activated just by committing source or deploying tools. Do not change the existing MCP URL or create a second plugin identity.

The existing generated review video is a presentation, not execution evidence for old or new behavior. Real-session tests/recording, saved-version scans, publisher attestations and any required review/publication remain separate gates. The initial plugin may already be available, but that status is not established by the linked URL alone. No deployment, upload, review cancellation, legal attestation, submission, publication or paid call occurs as part of source implementation.
