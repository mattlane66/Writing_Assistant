import { readFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Inventory only: do not import a compared checkout, read secrets, call a
// provider, infer installed-host behavior, or write an acceptance record.
export const INVENTORY_FILES = Object.freeze([
  "package.json", "knowledge/CONCEPT_REGISTRY.json", "knowledge/SOURCE_CARDS.json",
  "knowledge/SOURCE_REVIEW.json", "knowledge/SOURCE_MANIFEST.json",
  "knowledge/SYSTEM_PROMPT.md", "knowledge/RELIABILITY_WORKFLOW.md",
  "server/agent-pipeline.mjs", "server/mcp.mjs", "server/editorial-retrieval.mjs",
  "server/semantic-plan.mjs", "server/audit-contract.mjs", "server/document-state.mjs",
  "server/local-source-retrieval.mjs", "server/providers/gemini.mjs",
  "src/lib/projectMemory.ts", "src/components/FeedbackCapture.tsx",
  "products/writing-assistant-plugin/plugin.json",
  "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md",
  "evals/reliability-service.mjs", "evals/blinded-comparison.mjs",
  "server/writing-diagnostic.mjs",
]);
const MAX_FILE_BYTES = 4_000_000;
const digest = value => createHash("sha256").update(value).digest("hex");
const version = value => typeof value === "string" && /^\d+\.\d+(?:\.\d+)?$/.test(value) ? value : null;

async function safeSource(root, relative) {
  try {
    // Reject symlinked path components, not merely a symlinked leaf. Nothing
    // outside the explicitly selected checkout is followed through a link.
    let current = root;
    for (const component of relative.split("/")) {
      current = resolve(current, component);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) return { status: "symlink-not-read" };
    }
    const stat = await lstat(current);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return { status: "unsupported-file" };
    const text = await readFile(current, "utf8");
    if (Buffer.byteLength(text) > MAX_FILE_BYTES) return { status: "unsupported-file" };
    return { status: "read", text, sha256: digest(text) };
  } catch { return { status: "unavailable" }; }
}

function json(sources, path) {
  try { return JSON.parse(sources[path]?.text ?? ""); }
  catch { return null; }
}

function records(value, key) {
  const list = value?.[key];
  if (!Array.isArray(list) || list.length > 10_000 || list.some(r => !r || typeof r.id !== "string")
    || new Set(list.map(r => r.id)).size !== list.length) return null;
  return new Map(list.map(r => [r.id, digest(JSON.stringify(r))]));
}

function pageCounts(ledger, manifest) {
  if (!Array.isArray(manifest?.sources) || !manifest.sources.length || !Array.isArray(ledger?.reviews)) return null;
  const known = new Map();
  for (const s of manifest.sources) {
    if (known.has(s.id) || !Number.isInteger(s.pdf_pages) || s.pdf_pages < 1) return null;
    known.set(s.id, { maximum: s.pdf_pages, text: new Set(), visual: new Set() });
  }
  for (const [entries, field] of [[ledger.reviews, "text"], [ledger.visual_dispositions ?? [], "visual"]]) {
    if (!Array.isArray(entries)) return null;
    for (const entry of entries) {
      const target = known.get(entry.source_id);
      if (!target || !Array.isArray(entry.pages)) return null;
      for (const range of entry.pages) {
        if (!Number.isInteger(range.start) || !Number.isInteger(range.end)
          || range.start < 1 || range.end < range.start || range.end > target.maximum) return null;
        for (let p = range.start; p <= range.end; p++) {
          if (target.text.has(p) || target.visual.has(p)) return null;
          target[field].add(p);
        }
      }
    }
  }
  const totals = [...known.values()].reduce((n, s) => ({ total: n.total + s.maximum,
    text_reviewed: n.text_reviewed + s.text.size, visual_dispositions: n.visual_dispositions + s.visual.size }),
  { total: 0, text_reviewed: 0, visual_dispositions: 0 });
  return { ...totals, unresolved: totals.total - totals.text_reviewed - totals.visual_dispositions,
    validation: "page-accounting-only-not-idea-mastery" };
}

const WITNESSES = Object.freeze([
  ["repository-mcp", "server/mcp.mjs", "getWritingAssistantTools"],
  ["shared-semantic-record", "server/semantic-plan.mjs", "validateSemanticState"],
  ["mandatory-semantic-reviews", "server/agent-pipeline.mjs", "validateSemanticReviews"],
  ["missed-method-recovery", "server/agent-pipeline.mjs", "missedConceptIds"],
  ["post-repair-verification", "server/agent-pipeline.mjs", "pipeline_verification_failed"],
  ["short-candidate-comparison", "server/semantic-plan.mjs", "validateCandidateComparison"],
  ["document-scaffold", "server/document-state.mjs", "buildDocumentState"],
  ["author-approved-project-context", "src/lib/projectMemory.ts", "activeRequestProjectContext"],
  ["local-feedback", "src/components/FeedbackCapture.tsx", "FeedbackCapture"],
  ["local-pdf-search", "server/local-source-retrieval.mjs", "export"],
  ["gemini-adapter", "server/providers/gemini.mjs", "export"],
  ["request-coverage-guidance", "knowledge/RELIABILITY_WORKFLOW.md", "purpose"],
  ["independent-evidence-service", "evals/reliability-service.mjs", "assessReliabilityEvidence"],
  ["blinded-comparison-service", "evals/blinded-comparison.mjs", "assessBlindComparison"],
  ["integrated-diagnostic", "server/writing-diagnostic.mjs", "buildWritingAssistantDiagnostic"],
]);

export async function inspectSourceSurface(root) {
  const resolvedRoot = resolve(root);
  if (!(await lstat(resolvedRoot)).isDirectory() || (await lstat(resolvedRoot)).isSymbolicLink()) {
    throw new TypeError("Select an ordinary checkout directory.");
  }
  const sources = Object.fromEntries(await Promise.all(INVENTORY_FILES.map(async p => [p, await safeSource(resolvedRoot, p)])));
  const registry = json(sources, "knowledge/CONCEPT_REGISTRY.json");
  const corpus = json(sources, "knowledge/SOURCE_CARDS.json");
  const ledger = json(sources, "knowledge/SOURCE_REVIEW.json");
  const methods = records(registry, "concepts"); const cards = records(corpus, "cards");
  const files = INVENTORY_FILES.map(path => ({ path, status: sources[path].status, ...(sources[path].sha256 ? { sha256: sources[path].sha256 } : {}) }));
  const summary = {
    application_version: version(json(sources, "package.json")?.version),
    plugin_source_version: version(json(sources, "products/writing-assistant-plugin/plugin.json")?.version),
    pipeline_version: version(/export const PIPELINE_VERSION = "([\d.]+)"/.exec(sources["server/agent-pipeline.mjs"].text ?? "")?.[1]),
    registry_version: version(registry?.registry_version), corpus_version: version(corpus?.corpus_version),
    review_version: version(ledger?.review_version), method_count: methods?.size ?? null, card_count: cards?.size ?? null,
    page_accounting: pageCounts(ledger, json(sources, "knowledge/SOURCE_MANIFEST.json")),
    source_fingerprint: digest(JSON.stringify(files)), files,
    capabilities: WITNESSES.map(([id, path, marker]) => ({ id, path,
      status: sources[path]?.status === "read" ? sources[path].text.includes(marker) ? "code-witness-found" : "marker-not-found" : "source-unavailable",
      runtime_verified: false })),
  };
  return { summary, methods, cards };
}

function compareRecords(a, b) {
  if (!a || !b) return { status: "unavailable" };
  const shared = [...a.keys()].filter(id => b.has(id));
  return { status: "compared", shared: shared.length, public_only: a.size - shared.length,
    local_only: b.size - shared.length, changed_shared: shared.filter(id => a.get(id) !== b.get(id)).length };
}

export async function buildParityReport({ publicRoot, localRoot, sessionSkill } = {}) {
  const primary = await inspectSourceSurface(publicRoot);
  const local = localRoot ? await inspectSourceSurface(localRoot) : null;
  let session = { status: "not-observed", target_host_installation_verified: false };
  if (sessionSkill) {
    if (basename(sessionSkill) !== "SKILL.md") throw new TypeError("Only a selected SKILL.md cache snapshot can be compared.");
    const s = await safeSource(resolve(sessionSkill, ".."), "SKILL.md");
    session = { status: s.status, ...(s.sha256 ? { sha256: s.sha256 } : {}),
      matches_public_skill_source: s.status === "read" ? s.sha256 === primary.summary.files.find(f => f.path.endsWith("/SKILL.md"))?.sha256 : null,
      scope: "selected-session-cache-file-not-chat-or-work-installation-proof", target_host_installation_verified: false };
  }
  return { schema_version: 1, scope: "read-only-source-inventory-not-runtime-or-editorial-certification",
    public_source: primary.summary, local_prototype: local?.summary ?? null,
    comparison: local ? { same_application_version: primary.summary.application_version !== null && primary.summary.application_version === local.summary.application_version,
      methods: compareRecords(primary.methods, local.methods), cards: compareRecords(primary.cards, local.cards),
      corpus_files_match: Boolean(primary.summary.files.find(f => f.path === "knowledge/SOURCE_CARDS.json")?.sha256)
        && primary.summary.files.find(f => f.path === "knowledge/SOURCE_CARDS.json")?.sha256 === local.summary.files.find(f => f.path === "knowledge/SOURCE_CARDS.json")?.sha256 } : null,
    session_cache: session, deployment: { status: "not-observed", installation_verified: false },
    provider_calls: 0, semantic_guarantee: false,
    caveat: "Hashes and source markers locate compatibility work. They do not establish invocation, semantic quality, independent review, safe execution or installed Chat/Work behavior. No compared source module is executed; no credentials, PDFs, private receipts or prose are emitted." };
}

export async function main(args) {
  const options = {}; const allowed = new Map([["--local-root", "localRoot"], ["--session-skill", "sessionSkill"]]);
  for (let i = 0; i < args.length; i++) {
    const key = allowed.get(args[i]);
    if (!key || options[key] || !args[i + 1] || args[i + 1].startsWith("--")) throw new TypeError("Supported options: --local-root DIRECTORY and --session-skill SKILL.md; no live/provider/write options.");
    options[key] = args[++i];
  }
  return buildParityReport({ publicRoot: fileURLToPath(new URL("../", import.meta.url)), ...options });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(r => console.log(JSON.stringify(r, null, 2))).catch(() => {
    console.error("Product inventory failed. Check the selected source directories and supported options; private content is not echoed.");
    process.exitCode = 1;
  });
}
