import { assessPluginReadiness } from "./plugin-readiness.mjs";
import { readFile } from "node:fs/promises";
const args = process.argv.slice(2); let evidence, comparisonKey, comparisonRatings;
const allowed = new Set();
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (allowed.has(arg)) throw new Error("Duplicate readiness option.");
  allowed.add(arg);
  if (arg === "--require-complete") continue;
  if (!["--evidence", "--comparison-key", "--comparison-ratings"].includes(arg) || !args[i+1] || args[i+1].startsWith("--")) throw new Error("Only local evidence/comparison paths and --require-complete are supported; no provider/live options.");
  const raw = await readFile(args[++i], "utf8");
  if (Buffer.byteLength(raw) > 16_000_000) throw new Error("Local evidence exceeds the 16 MB bound.");
  try {
    const parsed = JSON.parse(raw);
    if (arg === "--evidence") evidence = parsed;
    if (arg === "--comparison-key") comparisonKey = parsed;
    if (arg === "--comparison-ratings") comparisonRatings = parsed;
  } catch { throw new Error("Local evidence JSON invalid; private content is not echoed."); }
}
if (Boolean(comparisonKey) !== Boolean(comparisonRatings)) throw new Error("Both comparison key and locked ratings are required.");
const result = await assessPluginReadiness({ evidence, comparison: comparisonKey ? { key: comparisonKey, ratings: comparisonRatings } : undefined });
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--require-complete") && !result.public_launch_verified) process.exitCode = 1;
