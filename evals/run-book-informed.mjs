import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { callWritingAssistantTool } from "../server/mcp.mjs";

// These are authored development fixtures, not held-out tests or prose ratings.
if (process.argv.length > 2) throw new Error("This evaluation is offline and accepts no provider/live options.");
const raw = await readFile(new URL("./retrieval-regression-cases.json", import.meta.url), "utf8");
const suite = JSON.parse(raw);
assert.equal(suite.exposure, "authored-development-not-unseen");
let hits = 0;
const cases = [];
for (const item of suite.cases) {
  const result = await callWritingAssistantTool("search_writing_examples", { query: item.query, limit: 8 });
  assert(!result.isError, item.id);
  const packet = result.structuredContent;
  const card = packet.cards.find(card => card.id === item.target_card_id);
  const retained = Boolean(card?.exceptions.some(text => text.includes(item.exception_anchor)));
  if (card && retained) hits++;
  cases.push({ id: item.id, targetRetrieved: Boolean(card), exceptionRetained: retained });
}
const c = await callWritingAssistantTool("get_writing_coverage", {});
assert(!c.isError);
assert.equal(c.structuredContent.card_count, 132);
assert.equal(c.structuredContent.method_count, 40);
assert.equal(c.structuredContent.tracked_model_reviewed_pages, 523);
assert.equal(c.structuredContent.unreviewed_pages, 837);
console.log(JSON.stringify({ scope: "Offline MCP retrieval and exception transport only; not host execution, semantic recall, or prose quality.", hits, total: cases.length,
  fixture_sha256: createHash("sha256").update(raw).digest("hex"), corpus_sha256: c.structuredContent.corpus_sha256, cases }, null, 2));
assert.equal(hits, cases.length, "MCP retrieval regression: a target or authoritative exception was missed.");
