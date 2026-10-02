#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { getTools, readResource, UI_URI } = require('../server/core');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json')));
const compatibility = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json')));
const openai = manifest.extensions['com.openai'];
const ui = openai.interface;
const failures = [], pending = [];
const need = (condition, message) => { if (!condition) failures.push(message); };
function checkSyntax(directory) {
  for (const name of fs.readdirSync(directory)) {
    if (['.git', 'node_modules', 'dist', 'coverage', '__pycache__'].includes(name)) continue;
    const file = path.join(directory, name), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) { need(false, `Unexpected symlink: ${path.relative(root, file)}.`); continue; }
    if (stat.isDirectory()) { checkSyntax(file); continue; }
    if (name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      need(result.status === 0, `Invalid JavaScript syntax: ${path.relative(root, file)}.`);
    }
    if (name.endsWith('.html')) {
      for (const block of fs.readFileSync(file, 'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        try { new vm.Script(block[1], { filename: file }); } catch (_) { need(false, `Invalid inline JavaScript: ${path.relative(root, file)}.`); }
      }
    }
  }
}
checkSyntax(root);
need(manifest.version === require('../package.json').version && compatibility.version === manifest.version, 'Package versions disagree.');
need(JSON.stringify(compatibility.interface) === JSON.stringify(ui), 'Compatibility presentation differs from the root manifest.');
need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name), 'Invalid package name.');
need(!fs.existsSync(path.join(root, '.app.json')), 'Public-upload source must not include .app.json.');
for (const m of [manifest, compatibility]) need(m.apps == null && m.extensions?.['com.openai']?.apps == null, 'Public-upload source contains an apps binding.');
for (const [key, limit] of [['displayName',30],['shortDescription',30],['longDescription',4000],['developerName',80]]) need(typeof ui[key] === 'string' && ui[key].length > 0 && ui[key].length <= limit, `Invalid ${key}.`);
const prompts = Array.isArray(ui.defaultPrompt) ? ui.defaultPrompt : [ui.defaultPrompt];
need(prompts.length <= 3 && prompts.every(x => typeof x === 'string' && x.trim() && !/[\r\n]/.test(x) && x.length <= 128), 'Invalid starter prompts.');
need(new Set(prompts.map(x => x.trim().replace(/\s+/g,' '))).size === prompts.length, 'Duplicate starter prompts.');
for (const key of ['logo','composerIcon']) {
  const reference = ui[key];
  need(typeof reference === 'string' && reference.startsWith('./'), `Missing ${key} reference.`);
  if (typeof reference === 'string') {
    const file = path.resolve(root, reference);
    need(file.startsWith(root+path.sep) && fs.existsSync(file), `Missing or escaping ${key} asset.`);
    if (fs.existsSync(file)) { need(fs.statSync(file).size <= 5*1024*1024, 'Icon too large.'); const svg=fs.readFileSync(file,'utf8'); const box=svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/); need(box && Number(box[3])===Number(box[4]) && Number(box[3])>=48, 'Icon must have a square viewBox at least 48×48.'); }
  }
}
need(openai.review?.test_cases?.positive?.length === 5, 'Exactly five positive review cases are needed.');
need(openai.review?.test_cases?.negative?.length === 3, 'Exactly three negative review cases are needed.');
for (const entry of openai.review?.test_cases?.positive || []) for (const field of ['description','prompt','tools_triggered','expected_behavior']) need(typeof entry[field] === 'string' && entry[field].trim(), `Review case missing ${field}.`);
for (const entry of openai.review?.test_cases?.negative || []) for (const field of ['description','prompt']) need(typeof entry[field] === 'string' && entry[field].trim(), `Negative case missing ${field}.`);
for (const tool of getTools()) {
  need(tool.outputSchema?.type === 'object', `${tool.name} lacks outputSchema.`);
  for (const key of ['readOnlyHint','destructiveHint','openWorldHint']) need(typeof tool.annotations[key] === 'boolean', `${tool.name} lacks ${key}.`);
}
need(!!readResource(UI_URI).contents[0]._meta.ui.csp, 'Widget lacks CSP.');
const skill = fs.readFileSync(path.join(root, 'skills/writing-diagnostic/SKILL.md'), 'utf8');
need(/^---\nname: writing-diagnostic\ndescription: .+\n---/m.test(skill), 'Skill frontmatter is invalid.');
need(!skill.includes('set `scope` to `whole`'), 'Skill still instructs a forbidden input field.');
const mcp = JSON.parse(fs.readFileSync(path.join(root, 'mcp.json'))).mcpServers['writing-diagnostic'];
if (mcp.type !== 'streamable-http' || !mcp.url?.startsWith('https://')) pending.push('A live public HTTPS MCP endpoint must replace the local stdio configuration.');
if (!readResource(UI_URI).contents[0]._meta.ui.domain) pending.push('Set the deployed widget origin.');
for (const key of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL']) if (!ui[key]) pending.push(`Publish and verify ${key}.`);
if (!openai.review.demo_recording_url) pending.push('Record the actual installed-host walkthrough and provide its verified URL.');
if (!Object.hasOwn(openai.publication, 'countries')) pending.push('Confirm supported countries.');
pending.push('Run the cases in ChatGPT or Codex and complete portal identity/domain verification, required scans, and attestations.');
console.log(JSON.stringify({version:manifest.version,packageChecks:failures.length?'failed':'passed',readyToSubmit:false,failures,pending},null,2));
process.exitCode = failures.length ? 1 : 0;
