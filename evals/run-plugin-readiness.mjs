import { assessPluginReadiness } from "./plugin-readiness.mjs";
if (process.argv.slice(2).some(arg => arg !== "--require-complete")) throw new Error("Only --require-complete is supported; no provider or live options.");
const result = await assessPluginReadiness();
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--require-complete") && !result.public_launch_verified) process.exitCode = 1;
