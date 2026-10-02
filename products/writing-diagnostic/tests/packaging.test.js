'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'diagnostic-package-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const product = path.join(temp, 'products', 'writing-diagnostic');
  fs.cpSync(root, product, { recursive: true, filter: source => !['dist','node_modules','.git','__pycache__'].includes(path.basename(source)) });
  const packageAt = output => spawnSync('python3', [path.join(product, 'scripts/package-plugin.py'), output], { encoding: 'utf8' });
  return { temp, product, packageAt };
}
test('ZIP is reproducible, includes hidden manifests, and excludes local state and sibling products', t => {
  const { temp, product, packageAt } = fixture(t);
  for (const [name, text] of [['.env.local','secret'],['node_modules/private.txt','dependency'],['dist/old.zip','old archive'],['debug.log','local log']]) {
    const file=path.join(product,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text);
  }
  fs.writeFileSync(path.join(temp,'assistant-only.txt'),'sibling product');
  const first=path.join(temp,'first.zip'),second=path.join(temp,'second.zip');
  for(const output of [first,second]){const r=packageAt(output);assert.equal(r.status,0,r.stderr);}
  assert.deepEqual(fs.readFileSync(first),fs.readFileSync(second));
  const inspect=spawnSync('python3',['-c','import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps(z.namelist())); assert z.testzip() is None',first],{encoding:'utf8'});
  assert.equal(inspect.status,0,inspect.stderr);
  const names=JSON.parse(inspect.stdout);
  assert.ok(names.includes('writing-diagnostic/.codex-plugin/plugin.json'));
  assert.ok(names.includes('writing-diagnostic/.mcp.json'));
  assert.ok(names.includes('writing-diagnostic/skills/writing-diagnostic/SKILL.md'));
  assert.ok(names.every(name=>name.startsWith('writing-diagnostic/')&&!/\.env|node_modules|dist\/|debug\.log|assistant-only/.test(name)));
});
test('packaging rejects symlinks without creating an archive', t => {
  const { temp, product, packageAt }=fixture(t);
  const outside=path.join(temp,'outside.txt');fs.writeFileSync(outside,'outside product');
  fs.symlinkSync(outside,path.join(product,'linked.txt'));
  const output=path.join(temp,'rejected.zip'),r=packageAt(output);
  assert.notEqual(r.status,0);assert.match(r.stderr,/symlink/);assert.equal(fs.existsSync(output),false);
});
test('packaging rejects a source missing its local MCP server', t => {
  const { temp, product, packageAt }=fixture(t);
  fs.unlinkSync(path.join(product,'server/stdio.js'));
  const output=path.join(temp,'missing.zip'),r=packageAt(output);
  assert.notEqual(r.status,0);assert.match(r.stderr,/Required product files.*server\/stdio\.js/);assert.equal(fs.existsSync(output),false);
});
