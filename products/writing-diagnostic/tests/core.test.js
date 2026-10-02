'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiagnostic, callTool, getTools, frameworkPayload, readResource, UI_URI, handleRequest, discoverResult } = require('../server/core');
const { validate } = require('../server/validation');
const span = patch => ({ id: 'criterion', quote: 'better', status: 'pressure', primitives: ['Distinction'], diagnosis: 'The comparison needs a criterion.', question: 'Better by which measure?', think_first: 'Name the criterion.', ...(patch || {}) });
const input = patch => ({ passage: 'A better candidate.', findings: [span()], ...(patch || {}) });
test('canonical taxonomy has 18 primitives and matches the packaged reference', () => {
  const fs = require('node:fs');
  const names = frameworkPayload().primitives.map(x => x.name);
  const doc = fs.readFileSync(require('node:path').join(__dirname, '../skills/writing-diagnostic/references/primitives.md'), 'utf8');
  assert.equal(names.length, 18);
  assert.deepEqual(names, [...doc.matchAll(/^### (.+)$/gm)].map(x => x[1]));
});
test('quote offsets preserve original whitespace and punctuation', () => {
  const data = buildDiagnostic(input({ passage: '  A better candidate.\n' }));
  assert.equal(data.passage, '  A better candidate.\n');
  assert.equal(data.findings[0].start, 4);
  assert.equal(data.findings[0].end, 10);
});
test('repeated quotes point to the requested occurrence', () => {
  const d = buildDiagnostic(input({ passage: 'better, then better', findings: [span({ id: 'first' }), span({ id: 'second', occurrence: 2 })] }));
  assert.deepEqual(d.findings.map(f => f.start), [0, 13]);
});
test('Unicode offsets use JavaScript string coordinates', () => assert.equal(buildDiagnostic(input({ passage: '😀 better' })).findings[0].start, 3));
test('zero findings remains a valid supplied diagnostic', () => assert.equal(buildDiagnostic(input({ findings: [] })).summary.total, 0));
test('whole checks derive their scope without an input scope field', () => {
  const f = span(); delete f.quote;
  const d = buildDiagnostic(input({ findings: [], whole_passage_checks: [f] }));
  assert.equal(d.whole_passage_checks[0].scope, 'whole'); assert.equal(d.summary.pressure, 1);
});
test('counts include all verdicts across spans and whole checks', () => {
  const whole = span({ id: 'whole', status: 'pass' }); delete whole.quote;
  const d = buildDiagnostic(input({ passage: 'better best', findings: [span({ status: 'violation' }), span({ id: 'second', quote: 'best' })], whole_passage_checks: [whole] }));
  assert.deepEqual(d.summary, { total: 3, violation: 1, pressure: 1, pass: 1 });
});
const invalid = [
  ['missing findings', { passage: 'Rain.' }, /findings.*required/],
  ['null findings', input({ findings: null }), /array/],
  ['wrong occurrence type', input({ findings: [span({ occurrence: '2' })] }), /integer/],
  ['zero occurrence', input({ findings: [span({ occurrence: 0 })] }), /at least/],
  ['unknown primitive', input({ findings: [span({ primitives: ['Voice'] })] }), /one of/],
  ['prototype primitive', input({ findings: [span({ primitives: ['constructor'] })] }), /one of/],
  ['duplicate primitives', input({ findings: [span({ primitives: ['Distinction', 'Distinction'] })] }), /duplicate/],
  ['unsupported verdict', input({ findings: [span({ status: 'unsure' })] }), /one of/],
  ['blank diagnosis', input({ findings: [span({ diagnosis: '   ' })] }), /blank/],
  ['missing required id', input({ findings: [{ ...span(), id: undefined }] }), /string/],
  ['unlocated quote', input({ findings: [span({ quote: 'missing' })] }), /not found/],
  ['overlapping spans', input({ findings: [span(), span({ id: 'overlap', quote: 'better candidate' })] }), /Overlapping/],
  ['duplicate span ids', input({ passage: 'better better', findings: [span(), span({ occurrence: 2 })] }), /Duplicate finding/],
  ['quote field on a whole check', input({ whole_passage_checks: [{ ...span(), quote: undefined }] }), /not an allowed/],
  ['invalid extra field', input({ scope: 'whole' }), /not an allowed/],
  ['missing suggestion rationale', input({ findings: [span({ suggestions: [{ label: 'Name it', text: 'Name the criterion.' }] })] }), /why.*required/],
  ['too many suggestions', input({ findings: [span({ suggestions: Array.from({ length: 9 }, () => ({ label: 'Name it', text: 'Name it.', why: 'Makes the criterion explicit.' })) })] }), /at most 8/],
  ['empty passage', input({ passage: ' ' }), /blank/],
  ['overlong passage', input({ passage: 'x'.repeat(50001), findings: [] }), /50000/],
  ['finding limit', input({ passage: 'better '.repeat(81), findings: Array.from({ length: 81 }, (_, i) => span({ id: 'f-'+i, occurrence: i+1 })) }), /at most 80/],
  ['whole check limit', input({ findings: [], whole_passage_checks: Array.from({ length: 21 }, (_, i) => { const f = span({ id: 'whole-'+i }); delete f.quote; return f; }) }), /at most 20/]
];
for (const [name, value, message] of invalid) test(`rejects ${name}`, () => assert.throws(() => buildDiagnostic(value), message));
test('rejects duplicate ids between real span and whole findings', () => { const f = span(); delete f.quote; assert.throws(() => buildDiagnostic(input({ whole_passage_checks: [f] })), /Duplicate finding/); });
test('tool errors do not carry a false clean diagnostic', () => { const r = callTool('render_writing_diagnostic', { passage: 'Rain.' }); assert.equal(r.isError, true); assert.equal(r.structuredContent, undefined); });
test('successful tool outputs satisfy their declared output schemas', () => {
  for (const t of getTools()) validate(t.outputSchema, callTool(t.name, t.name === 'get_writing_framework' ? {} : input()).structuredContent);
});
test('tool annotations and authentication declaration match bounded read-only rendering', () => {
  for (const t of getTools()) { assert.deepEqual(t.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true }); assert.equal(t.securitySchemes[0].type, 'noauth'); }
});
test('UI resource declares a narrow policy and uses a new cache URI', () => { const r = readResource(UI_URI).contents[0]; assert.match(UI_URI, /v1\.1\.0/); assert.deepEqual(r._meta.ui.csp, { connectDomains: [], resourceDomains: [] }); assert.equal(r.mimeType, 'text/html;profile=mcp-app'); });
test('UI domain is configurable and must be an HTTPS origin', () => {
  const prior = process.env.WIDGET_ORIGIN;
  try { process.env.WIDGET_ORIGIN = 'https://widgets.example.org'; assert.equal(readResource(UI_URI).contents[0]._meta.ui.domain, 'https://widgets.example.org'); process.env.WIDGET_ORIGIN = 'http://localhost/path'; assert.throws(() => readResource(UI_URI), /HTTPS origin/); }
  finally { if (prior === undefined) delete process.env.WIDGET_ORIGIN; else process.env.WIDGET_ORIGIN = prior; }
});
test('modern discovery uses the required fields', () => { const d = discoverResult(); assert.equal(d.resultType, 'complete'); assert.ok(d.supportedVersions.includes('2026-07-28')); assert.equal(d.cacheScope, 'public'); assert.equal(d._meta['io.modelcontextprotocol/serverInfo'].version, '1.1.0'); });
test('modern calls carry server identity and result type', () => { const r = handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }); assert.equal(r.result.resultType, 'complete'); assert.equal(r.result.ttlMs, 3600000); });
test('unsupported protocol versions are not blindly echoed', () => { const r = handleRequest({ jsonrpc: '2.0', id: 1, method: 'ping', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2099-01-01' } } }); assert.equal(r.error.code, -32022); assert.ok(r.error.data.supported.includes('2026-07-28')); });
test('invalid JSON-RPC envelopes receive invalid-request errors', () => { for (const input of [null, [], {}, { jsonrpc: '1.0', id: 1, method: 'ping' }]) assert.equal(handleRequest(input).error.code, -32600); });
test('legacy initialization rejects malformed client information and capabilities', () => {
  const valid = { protocolVersion: '2025-11-25', clientInfo: { name: 'test', version: '1' }, capabilities: {} };
  for (const patch of [{ clientInfo: true }, { clientInfo: {} }, { capabilities: true }, { capabilities: [] }]) assert.equal(handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { ...valid, ...patch } }).error.code, -32602);
});
test('unknown notifications do not receive a response', () => assert.equal(handleRequest({ jsonrpc: '2.0', method: 'notifications/cancelled' }), null));
test('unknown tools and methods have useful protocol errors', () => { assert.equal(handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'not_a_tool', arguments: {} } }).error.code, -32602); assert.equal(handleRequest({ jsonrpc: '2.0', id: 1, method: 'not_a_method' }).error.code, -32601); });
