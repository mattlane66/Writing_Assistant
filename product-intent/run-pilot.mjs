#!/usr/bin/env node
/**
 * Real-code pilot of an intent regression guard. No network/API calls.
 * All mutations run against disposable copies, never working-tree source.
 * Source tests are independently maintained in /tests; this is a separate
 * check of selected behavior and its sensitivity to injected regressions.
 */
import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const trustedRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRootIndex = process.argv.indexOf("--source-root");
if (sourceRootIndex >= 0 && !process.argv[sourceRootIndex + 1]) {
  throw new Error("--source-root needs a directory");
}
const root = sourceRootIndex >= 0 ? resolve(process.argv[sourceRootIndex + 1]) : trustedRoot;
const verificationOnly = process.argv.includes("--verify-only");
const sourceA = "server/meaning-contract.mjs";
const sourceB = "server/text-world.mjs";

function fail(message) { throw new Error(message); }
function inspectGrounding(value, source, depth = 0) {
  if (!value || typeof value !== "object" || depth > 18) return true;
  if ("start" in value && "end" in value && "text" in value) {
    if (!Number.isInteger(value.start) || !Number.isInteger(value.end) ||
        value.end <= value.start || source.slice(value.start, value.end) !== value.text) return false;
  }
  return Object.values(value).every(child => inspectGrounding(child, source, depth + 1));
}
async function assess(directory) {
  const base = pathToFileURL(resolve(directory, sourceA)).href;
  const world = pathToFileURL(resolve(directory, sourceB)).href;
  const { buildMeaningContract, compareMeaningContract } = await import(base);
  const { buildTextWorld } = await import(world);
  const original = "The program may improve sleep.";
  const review = compareMeaningContract(buildMeaningContract(original), "The program improves sleep.");
  const groundingInput = "Café 🐦 may have 4 crates.";
  const contract = buildMeaningContract(groundingInput);
  const contradiction = buildTextWorld("The crate weighs 1 kg. The crate weighs 500 g.");
  const equivalent = buildTextWorld("The crate weighs 1 kg. The crate weighs 1000 g.");
  return {
    "SC-1": review.candidates.some(c => c.kind === "modality-changed-or-not-recovered" && c.status === "requires-review"),
    "SC-2": inspectGrounding(contract, groundingInput) && contract.clauses.length > 0,
    "SC-3": contradiction.potentialConflicts.some(c => c.kind === "quantity-disagreement"),
    "SC-4": !equivalent.potentialConflicts.some(c => c.kind === "quantity-disagreement")
  };
}
function once(source, search, replacement) {
  const index = source.indexOf(search);
  if (index < 0 || source.indexOf(search, index + search.length) >= 0)
    fail("Mutation target missing or not unique: " + search.slice(0, 80));
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}
const mutations = [
  { id:"M-1", file:sourceA, scenario:"SC-1",
    apply:s => once(s, 'const enabled = !["analyze", "draft"].includes(mode);', "const enabled = false;") },
  { id:"M-2", file:sourceA, scenario:"SC-2",
    apply:s => once(s, "text: text.slice(start, end)", "text: text.slice(start + 1, end)") },
  { id:"M-3", file:sourceB, scenario:"SC-3",
    apply:s => once(s, 'add("quantity-disagreement",', 'add("amount-disagreement",') },
  { id:"M-4", file:sourceA, scenario:"SC-1",
    apply:s => once(s, "if (match.anchors.some((other) => other.kind === anchor.kind && other.canonical === anchor.canonical)) return true;",
      "if (true) return true;") }
];
async function tempCheckout(contents, altered) {
  const dir = await mkdtemp(join(tmpdir(), "writing-intent-pilot-"));
  await mkdir(resolve(dir, "server"), {recursive:true});
  for (const [path, content] of Object.entries(contents))
    await writeFile(resolve(dir,path), path === altered?.file ? altered.apply(content) : content, "utf8");
  return dir;
}
async function main() {
  const manifest = JSON.parse(await readFile(resolve(trustedRoot,"product-intent/pilot-contract.json"),"utf8"));
  const expected = new Set(manifest.scenarios.map(s => s.id));
  if (manifest.mutation_catalog.length !== mutations.length || !mutations.every(m => expected.has(m.scenario)))
    fail("Scenario / mutation manifest mismatch");
  const source = {
    [sourceA]: await readFile(resolve(root,sourceA),"utf8"),
    [sourceB]: await readFile(resolve(root,sourceB),"utf8")
  };
  let dir = await tempCheckout(source);
  let baseline;
  try {baseline=await assess(dir);}finally{await rm(dir,{recursive:true,force:true});}
  const baselineFailures=Object.entries(baseline).filter(([,pass])=>!pass).map(([id])=>id);
  const observations=[];
  for(const mutation of verificationOnly ? [] : mutations){
    dir=await tempCheckout(source,mutation);
    try{
      const cases=await assess(dir);
      observations.push({
        id:mutation.id, targeted_scenario:mutation.scenario,
        killed:cases[mutation.scenario] === false,
        scenario_results:cases
      });
    }catch(error){
      observations.push({id:mutation.id,targeted_scenario:mutation.scenario,killed:false,
        runtime_error:String(error),interpretation:"A crash is not counted as demonstrated semantic detection."});
    }finally{await rm(dir,{recursive:true,force:true});}
  }
  // Harmless refactor control: a trailing source comment changes no behavior.
  dir = verificationOnly ? null : await tempCheckout({...source,[sourceA]:source[sourceA]+"\n// Harmless source-only refactor control\n"});
  let control;
  if (!verificationOnly) {
    try { control=await assess(dir); }finally{await rm(dir,{recursive:true,force:true});}
  } else {
    control = baseline;
  }
  const falseAlarms=Object.values(control).filter(pass=>!pass).length;
  const killed=observations.filter(o=>o.killed).length;
  const report={
    kind:"RealProductIntentPilot",
    product:manifest.product,
    baseline_revision:manifest.baseline_commit,
    pilot_authority:"working; not human-ratified",
    scenarios_total:Object.keys(baseline).length,
    scenarios_passed:Object.values(baseline).filter(Boolean).length,
    baseline_failures:baselineFailures,
    mode:verificationOnly ? "candidate-verification" : "calibration",
    checked_source_root:root,
    mutation_score: verificationOnly ? {skipped:true} : {killed,total:mutations.length},
    benign_control:{passed:falseAlarms===0,false_alarms:falseAlarms},
    observations,
    caveat:"A bounded seeded-regression pilot for pre-existing Writing Assistant behavior, not a general semantic-drift guarantee."
  };
  console.log(JSON.stringify(report,null,2));
  if (baselineFailures.length || (!verificationOnly && (killed !== mutations.length || falseAlarms))) process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=2;});
