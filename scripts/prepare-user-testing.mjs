import { readFile, mkdir, lstat, realpath, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { buildReliabilityPlan, emptyReliabilityEvidence, validateReliabilityEvidence, digest } from "../evals/reliability-service.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function prepareUserTesting({ now = new Date().toISOString() } = {}) {
  const plan = await buildReliabilityPlan();
  const suite = JSON.parse(await readFile(new URL("../evals/workflow-development.cases.json", import.meta.url), "utf8"));
  if (suite.origin !== "authored-development" || suite.quality_evidence !== false) throw new TypeError("Public authored cases cannot become independent held-out evidence.");
  const cases = suite.cases.map(c => ({ ...c, prompt: c.id === "workflow-no-text-consent" ? c.prompt
    : `Use Writing Assistant. I authorize sending this test's exact text to its workflow, document, diagnostic and bounded checker operations when useful; retrieval queries must stay abstract.\n\n${c.prompt}` }));
  const evidence = emptyReliabilityEvidence(plan);
  evidence.cases = cases.map(c => {
    const idea = plan.ideas.find(i => i.method_ids.includes(c.method_id));
    if (!idea) throw new TypeError("Unknown method mapping.");
    return { id: c.id, family_id: `${c.id}-family`, prompt: c.prompt, oracle: c.oracle,
      prompt_sha256: digest(c.prompt), oracle_sha256: digest(c.oracle), task_class: "substantive", editing_mode: c.mode,
      origin: "authored-development", author_ids: ["codex-model"], preregistered_at: now, genre: "mixed-development",
      length_band: "passage", scenario: c.kind === "adversarial" ? "adversarial" : "single-method", required_method_ids: [c.method_id], forbidden_method_ids: [],
      obligations: plan.axes.map(axis => ({ idea_id: idea.id, axis, expectation: `Development check only. ${c.oracle}` })) };
  });
  validateReliabilityEvidence(evidence, plan);
  return { evidence, prompts: { schema_version: 1, validation_fingerprint: plan.validation_fingerprint, preregistered_at: now,
    caveat: "Public development pilot, not unseen comparative quality evidence. Only prompts belong in the evaluated host; keep oracles/reviews separate.",
    cases: cases.map(({ id, prompt }) => ({ id, prompt })) } };
}
export async function writeUserTestingPacket() {
  if (process.argv.slice(2).length) throw new TypeError("No provider, network, arbitrary path or override options are accepted.");
  const packet = await prepareUserTesting(), base = path.join(root, "evals/results");
  await mkdir(base, { recursive: true, mode: 0o700 });
  if ((await lstat(base)).isSymbolicLink() || await realpath(base) !== base) throw new TypeError("Private packet directory cannot escape through a link.");
  const id = randomBytes(8).toString("hex"), names = [`user-testing-${id}-workspace.json`, `user-testing-${id}-prompts.json`];
  for (const [i, value] of [packet.evidence, packet.prompts].entries()) await writeFile(path.join(base, names[i]), JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
  return { status: "prepared-not-run", cases: packet.evidence.cases.length, responses: 0, human_reviews: 0,
    files: names.map(name => `evals/results/${name}`), provider_calls: 0,
    instruction: "Keep the workspace/oracles out of evaluated host context. Import it in the private review workbench only. Paste one prompt at a time from the prompts file into the matching activated host." };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await writeUserTestingPacket(), null, 2)); }
  catch { console.error("Testing packet preparation failed; no private input or oracle is echoed."); process.exitCode = 1; }
}
