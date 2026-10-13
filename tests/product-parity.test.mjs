import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildParityReport, inspectSourceSurface, INVENTORY_FILES, main } from "../scripts/product-parity.mjs";
import { getWritingAssistantTools, MCP_SERVER_INFO } from "../server/mcp.mjs";
import { listReferenceIds } from "../server/editorial-retrieval.mjs";

const temporary = [];
afterEach(async () => { for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "writing-parity-test-")); temporary.push(root);
  const records = {
    "package.json": { version: "1.2.0" },
    "knowledge/CONCEPT_REGISTRY.json": { registry_version: "1.0.0", concepts: [{ id: "meaning", procedure: ["preserve"] }] },
    "knowledge/SOURCE_CARDS.json": { corpus_version: "2.20.0", cards: [{ id: "original-example", exceptions: ["not always"] }] },
    "knowledge/SOURCE_MANIFEST.json": { sources: [{ id: "guide", pdf_pages: 5 }] },
    "knowledge/SOURCE_REVIEW.json": { review_version: "1.19.0", reviews: [{ source_id: "guide", pages: [{ start: 1, end: 3 }] }], visual_dispositions: [{ source_id: "guide", pages: [{ start: 4, end: 5 }] }] },
    "server/agent-pipeline.mjs": 'export const PIPELINE_VERSION = "1.2"; throw new Error("must not execute compared source");',
    "products/writing-assistant-plugin/plugin.json": { version: "0.46.0" },
    "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md": "Public skill source.",
    ...overrides,
  };
  for (const [path, value] of Object.entries(records)) {
    const target = join(root, path); await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, typeof value === "string" ? value : JSON.stringify(value));
  }
  return root;
}

describe("product parity inventory", () => {
  it("reads only the fixed source inventory, never secret/PDF/receipt paths", () => {
    expect(INVENTORY_FILES.every(p => !/\.env|\.pdf$|private|results|receipt/i.test(p))).toBe(true);
    expect(new Set(INVENTORY_FILES).size).toBe(INVENTORY_FILES.length);
  });
  it("counts separate page dispositions without calling them mastery", async () => {
    const s = (await inspectSourceSurface(await fixture())).summary;
    expect(s).toMatchObject({ application_version: "1.2.0", plugin_source_version: "0.46.0", pipeline_version: "1.2", method_count: 1, card_count: 1,
      page_accounting: { total: 5, text_reviewed: 3, visual_dispositions: 2, unresolved: 0, validation: "page-accounting-only-not-idea-mastery" } });
  });
  it("detects different corpora despite equal application versions and stable IDs", async () => {
    const primary = await fixture();
    const local = await fixture({ "knowledge/SOURCE_CARDS.json": { corpus_version: "2.4.0", cards: [{ id: "original-example", exceptions: ["different restraint"] }, { id: "local-only" }] } });
    const r = await buildParityReport({ publicRoot: primary, localRoot: local });
    expect(r.comparison).toMatchObject({ same_application_version: true, corpus_files_match: false,
      cards: { shared: 1, local_only: 1, public_only: 0, changed_shared: 1 } });
  });
  it("compares complete method records, not just IDs or names", async () => {
    const primary = await fixture();
    const local = await fixture({ "knowledge/CONCEPT_REGISTRY.json": { concepts: [{ id: "meaning", procedure: ["silently different"] }] } });
    expect((await buildParityReport({ publicRoot: primary, localRoot: local })).comparison.methods.changed_shared).toBe(1);
  });
  it("never emits compared prose, private paths or source-module bodies", async () => {
    const root = await fixture({ "knowledge/SOURCE_CARDS.json": { corpus_version: "2.20.0", cards: [{ id: "example", body: "PRIVATE_EXAMPLE_SENTINEL" }] } });
    await writeFile(join(root, ".env.local"), "PRIVATE_KEY_SENTINEL");
    const output = JSON.stringify(await buildParityReport({ publicRoot: root }));
    expect(output).not.toMatch(/PRIVATE_EXAMPLE_SENTINEL|PRIVATE_KEY_SENTINEL|must not execute|writing-parity-test-/);
  });
  it("keeps missing local, deployment and installation observations unknown", async () => {
    const r = await buildParityReport({ publicRoot: await fixture() });
    expect(r.local_prototype).toBeNull(); expect(r.comparison).toBeNull();
    expect(r.session_cache.target_host_installation_verified).toBe(false);
    expect(r.deployment).toEqual({ status: "not-observed", installation_verified: false });
    expect(r.provider_calls).toBe(0); expect(r.semantic_guarantee).toBe(false);
  });
  it("does not turn a matching cache file into active Chat/Work installation proof", async () => {
    const root = await fixture(); const skill = join(root, "products/writing-assistant-plugin/skills/writing-assistant/SKILL.md");
    const r = await buildParityReport({ publicRoot: root, sessionSkill: skill });
    expect(r.session_cache.matches_public_skill_source).toBe(true);
    expect(r.session_cache.target_host_installation_verified).toBe(false);
  });
  it("labels code witnesses as unverified rather than claiming live capability", async () => {
    const root = await fixture({ "server/semantic-plan.mjs": "// validateSemanticState marker; not an implementation" });
    const s = (await inspectSourceSurface(root)).summary;
    expect(s.capabilities.find(c => c.id === "shared-semantic-record")).toMatchObject({ status: "code-witness-found", runtime_verified: false });
  });
  it("rejects duplicate record IDs as unavailable rather than counting them", async () => {
    const root = await fixture({ "knowledge/SOURCE_CARDS.json": { cards: [{ id: "same" }, { id: "same" }] } });
    expect((await inspectSourceSurface(root)).summary.card_count).toBeNull();
  });
  it("does not report absent corpora as matching", async () => {
    const a = await fixture(); const b = await fixture();
    await rm(join(a, "knowledge/SOURCE_CARDS.json")); await rm(join(b, "knowledge/SOURCE_CARDS.json"));
    expect((await buildParityReport({ publicRoot: a, localRoot: b })).comparison.corpus_files_match).toBe(false);
  });
  it("does not echo invalid JSON or unsafe version values", async () => {
    const root = await fixture({ "package.json": { version: "PRIVATE_VALUE" }, "knowledge/SOURCE_CARDS.json": "PRIVATE_BAD_JSON" });
    const r = await buildParityReport({ publicRoot: root });
    expect(r.public_source.application_version).toBeNull(); expect(r.public_source.card_count).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE_VALUE|PRIVATE_BAD_JSON/);
  });
  it("does not count overlapping text and visual pages", async () => {
    const root = await fixture({ "knowledge/SOURCE_REVIEW.json": { reviews: [{ source_id: "guide", pages: [{ start: 1, end: 3 }] }], visual_dispositions: [{ source_id: "guide", pages: [{ start: 3, end: 5 }] }] } });
    expect((await inspectSourceSurface(root)).summary.page_accounting).toBeNull();
  });
  it("refuses symlinked source files and ancestor directories", async () => {
    const root = await fixture(); const elsewhere = await fixture();
    await symlink(join(elsewhere, "package.json"), join(root, "server/mcp.mjs"));
    await symlink(join(elsewhere, "knowledge"), join(root, "src"));
    const s = (await inspectSourceSurface(root)).summary;
    expect(s.files.find(f => f.path === "server/mcp.mjs").status).toBe("symlink-not-read");
    expect(s.files.find(f => f.path === "src/lib/projectMemory.ts").status).toBe("symlink-not-read");
  });
  it.each([["--live"], ["--write", "anything"], ["--local-root"], ["--local-root", "x", "--local-root", "y"], ["--provider", "openai"]])("rejects unsupported execution/write options %j", async args => {
    await expect(main(args)).rejects.toThrow("Supported options");
  });
  it("refuses to treat a selected credential file as a skill snapshot", async () => {
    await expect(buildParityReport({ publicRoot: await fixture(), sessionSkill: "/not-read/.env.local" })).rejects.toThrow("SKILL.md");
  });
  it("matches the real public inventory without claiming software scores are quality scores", async () => {
    const r = await main([]);
    expect(r.public_source).toMatchObject({ application_version: "1.2.0", plugin_source_version: "0.48.0", pipeline_version: "1.2", method_count: 40, card_count: 203,
      page_accounting: { total: 1360, text_reviewed: 1310, visual_dispositions: 50, unresolved: 0 } });
    expect(r.public_source.capabilities.every(c => c.runtime_verified === false)).toBe(true);
  });
  it("keeps the dated manifest's public-source claims in parity without promoting host observations", async () => {
    const recorded = JSON.parse(await readFile(new URL("../docs/PRODUCT_RELEASE_MANIFEST.json", import.meta.url), "utf8"));
    const current = (await main([])).public_source;
    expect(recorded.public_source).toMatchObject({ application_version: current.application_version,
      optional_api_pipeline_version: current.pipeline_version, plugin_package_source_version: current.plugin_source_version,
      mcp_server_version: MCP_SERVER_INFO.version, registry_version: current.registry_version,
      corpus_version: current.corpus_version, review_version: current.review_version, method_count: current.method_count,
      card_count: current.card_count, tool_count: getWritingAssistantTools().length, reference_count: listReferenceIds().length,
      skill_source_sha256: current.files.find(f => f.path.endsWith("/SKILL.md")).sha256 });
    expect(recorded.installed_chat).toMatchObject({
      status: "actual-original-case-completed-with-disclosed-packaged-fallback-mcp-unavailable",
      version: "0.48.0", actual_tool_results_observed: false, independent_grade: null,
    });
    expect(recorded.installed_work).toMatchObject({
      status: "direct-fallback-answer-visible-after-initial-failure-with-persistent-cloudflare-challenge",
      version: "0.48.0", actual_tool_results_observed: false, independent_grade: null,
    });
    expect(recorded.private_web_copy).toMatchObject({
      plugin_id: recorded.installed_chat.plugin_id,
      app_dependency_readback_verified: true,
      app_dependency_detail_control: "disabled-no-description",
      full_chat_work_workflow_verified: false,
      original_cases_attempted_per_host: 1, remaining_cases_per_host: 13,
      identity_presentation_audience_and_original_pdfs_preserved: true,
      new_plugin_or_server_created: false,
    });
    expect(recorded.installed_work.plugin_id).toBe(recorded.installed_chat.plugin_id);
    expect(recorded.live_coverage_observation.target_chat_work_execution_verified).toBe(false);
    expect(recorded.semantic_guarantee).toBe(false);
  });
});
