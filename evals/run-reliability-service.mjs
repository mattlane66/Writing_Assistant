import { readFile, mkdir, writeFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildReliabilityPlan, emptyReliabilityEvidence, assessReliabilityEvidence, ReliabilityEvidenceSchema } from "./reliability-service.mjs";
import { prepareBlindComparison, assessBlindComparison } from "./blinded-comparison.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), command = args.shift() ?? "report", options = new Map();
const allowed = { plan: [], template: [], schema: [], report: ["evidence", "require-complete"],
  "blind-packet": ["input", "packets-out", "key-out"], comparison: ["key", "ratings"] };
if (!allowed[command]) throw new Error("Use plan, template, schema, report, blind-packet or comparison. No provider/live options.");
for (let i = 0; i < args.length; i++) {
  const name = args[i].replace(/^--/, "");
  if (!args[i].startsWith("--") || !allowed[command].includes(name) || options.has(name)) throw new Error("Unknown or duplicate reliability option.");
  if (name === "require-complete") options.set(name, true);
  else { if (!args[i+1] || args[i+1].startsWith("--")) throw new Error("Missing local input/output path."); options.set(name, args[++i]); }
}
async function input(name) {
  if (!options.get(name)) throw new Error("Required local evidence file is missing.");
  const content = await readFile(path.resolve(options.get(name)), "utf8");
  if (Buffer.byteLength(content) > 16_000_000) throw new Error("Evidence file exceeds the 16 MB bound; split into scoped runs.");
  try { return JSON.parse(content); } catch { throw new Error("Local evidence is not valid JSON; private content is not echoed."); }
}
// Generated review artifacts may contain test passages. Restrict them to the ignored
// local results directory, refuse symlink escape and never overwrite existing files.
async function outputPath(name) {
  if (!options.get(name)) throw new Error("Both private packet and key output paths are required.");
  const file = path.resolve(options.get(name)), base = path.join(root, "evals/results");
  if (path.dirname(file) !== base) throw new Error("Generated private outputs must be directly inside evals/results/.");
  await mkdir(base, { recursive: true });
  if ((await lstat(base)).isSymbolicLink() || await realpath(base) !== base) throw new Error("Private results directory cannot escape through a symlink.");
  return file;
}
try {
  const plan = await buildReliabilityPlan(); let result;
  if (command === "plan") result = plan;
  if (command === "template") result = emptyReliabilityEvidence(plan);
  if (command === "schema") result = z.toJSONSchema(ReliabilityEvidenceSchema);
  if (command === "report") {
    result = assessReliabilityEvidence(options.has("evidence") ? await input("evidence") : emptyReliabilityEvidence(plan), plan);
    if (options.has("require-complete") && result.gates.some(g => ["unverified", "incomplete"].includes(g.status))) process.exitCode = 1;
  }
  if (command === "blind-packet") {
    const packetsPath = await outputPath("packets-out"), keyPath = await outputPath("key-out");
    if (packetsPath === keyPath) throw new Error("Packet and private condition key must have different paths.");
    const { packets, key } = prepareBlindComparison(await input("input"), plan);
    await writeFile(keyPath, JSON.stringify(key, null, 2), { flag: "wx", mode: 0o600 });
    await writeFile(packetsPath, JSON.stringify(packets, null, 2), { flag: "wx", mode: 0o600 });
    result = { status: "packets-prepared-not-rated", cases: packets.cases.length, provider_calls: 0,
      instruction: "Give only the packets to the independent reviewer. Keep the separate condition key private until ratings are locked." };
  }
  if (command === "comparison") result = assessBlindComparison(await input("key"), await input("ratings"), plan);
  console.log(JSON.stringify(result, null, 2));
} catch {
  // Avoid leaking private prose or file contents through diagnostics.
  console.error("Reliability operation failed. Check local schema, fingerprint, chronology, complete rubrics and separate ignored output paths. No model or network calls were made.");
  process.exitCode = 1;
}
