'use strict';
// Run the actual inline widget script against a small DOM/host simulation.
// These are interaction/bridge regressions, not browser layout or visual tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildDiagnostic } = require('../server/core');
const html = fs.readFileSync(path.join(__dirname,'../public/diagnostic-widget.html'),'utf8');
const sample = buildDiagnostic(JSON.parse(fs.readFileSync(path.join(__dirname,'../public/sample-diagnostic.json'))));
class Element {
  constructor(){this.children=[];this.dataset={};this.attributes={};this.events={};this.className='';this._text='';this.disabled=false;this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className=(this.className+' '+c).trim()},remove:c=>{this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' ')},toggle:(c,force)=>{const on=force===undefined?!this.classList.contains(c):force;on?this.classList.add(c):this.classList.remove(c);return on}}}
  set textContent(value){this._text=String(value);this.children=[]}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
  append(...nodes){this.children.push(...nodes)}
  appendChild(node){this.children.push(node);return node}
  setAttribute(key,value){this.attributes[key]=String(value)}
  getAttribute(key){return this.attributes[key]}
  addEventListener(type,fn){(this.events[type]||=[]).push(fn)}
  click(){if(!this.disabled)(this.events.click||[]).forEach(fn=>fn({target:this}))}
  querySelectorAll(selector){const c=selector.slice(1),out=[];const walk=x=>{for(const child of x.children){if(child.classList?.contains(c))out.push(child);walk(child)}};walk(this);return out}
  getBoundingClientRect(){return {height:700}}
}
function boot(legacy){
  const nodes=new Map();for(const match of html.matchAll(/id="([^"]+)"/g))nodes.set(match[1],new Element());
  for(const match of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g)){const m=match[0].match(/class="([^"]*)"/);if(m)nodes.get(match[1]).className=m[1]}
  const status=['all','violation','pressure','pass'].map(name=>{const el=new Element();el.dataset.status=name;return el});
  const family=['all','seeing','truth','reasoning','sentence','piece','honesty'].map(name=>{const el=new Element();el.dataset.family=name;return el});
  const listeners={},messages=[];const parent={postMessage:message=>messages.push(message)};
  const document={querySelector:selector=>nodes.get(selector.slice(1)),querySelectorAll:selector=>selector==='[data-status]'?status:selector==='[data-family]'?family:[],createElement:()=>new Element(),createTextNode:text=>{const e=new Element();e.textContent=text;return e},documentElement:{dataset:{}}};
  const window={parent,addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn)},...(legacy?{openai:{toolOutput:legacy}}:{})};
  const context=vm.createContext({window,document,setTimeout:()=>1,clearTimeout:()=>{},ResizeObserver:class{observe(){}}});
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script,context);
  return {nodes,status,family,messages,parent,deliver:(params,source=parent)=>(listeners.message||[]).forEach(fn=>fn({source,data:params}))};
}
function toolResult(env,data=sample){env.deliver({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:data}})}
test('widget initializes with the required Apps protocol version',async()=>{const env=boot();const request=env.messages.find(x=>x.method==='ui/initialize');assert.equal(request.params.protocolVersion,'2026-01-26');env.deliver({jsonrpc:'2.0',id:request.id,result:{hostContext:{theme:'dark'}}});await Promise.resolve();assert.ok(env.messages.some(x=>x.method==='ui/notifications/initialized'));});
test('legacy toolOutput loads the structured data directly',()=>{const env=boot(sample);assert.equal(env.nodes.get('passage').textContent,sample.passage);assert.match(env.nodes.get('summary').textContent,/1 violations/);});
test('standard host result preserves the passage and exposes the suggestion bank',()=>{const env=boot();toolResult(env);assert.equal(env.nodes.get('passage').textContent,sample.passage);env.nodes.get('passage').querySelectorAll('.mark')[0].click();assert.equal(env.nodes.get('diagnosis').textContent,sample.findings[0].diagnosis);assert.equal(env.nodes.get('options').children.length,2);});
test('individual primitive filter selects a finding and opens its repair path',()=>{const env=boot();toolResult(env);env.nodes.get('primitive-filters').children.find(x=>x.dataset.primitive==='Agency').click();assert.equal(env.nodes.get('diagnosis').textContent,sample.findings[1].diagnosis);assert.equal(env.nodes.get('repair').classList.contains('hidden'),false);});
test('status filters clear a selection that no longer matches',()=>{const env=boot();toolResult(env);env.nodes.get('passage').querySelectorAll('.mark')[0].click();env.status.find(x=>x.dataset.status==='pass').click();assert.equal(env.nodes.get('judgment').classList.contains('hidden'),true);assert.equal(env.nodes.get('passage').querySelectorAll('.mark')[0].disabled,true);});
test('suggestion rationale toggles with an accessible expanded state',()=>{const env=boot();toolResult(env);env.nodes.get('passage').querySelectorAll('.mark')[0].click();const option=env.nodes.get('options').children[0];assert.equal(option.getAttribute('aria-expanded'),'false');option.click();assert.equal(option.getAttribute('aria-expanded'),'true');option.click();assert.equal(option.getAttribute('aria-expanded'),'false');});
test('Keep it records a visible choice without modifying the passage',()=>{const env=boot();toolResult(env);env.nodes.get('passage').querySelectorAll('.mark')[1].click();env.nodes.get('keep').click();assert.equal(env.nodes.get('keep').getAttribute('aria-pressed'),'true');assert.match(env.nodes.get('foot').textContent,/marked to keep/);assert.equal(env.nodes.get('passage').textContent,sample.passage);});
test('whole-passage check selects its own diagnosis',()=>{const env=boot();toolResult(env);env.nodes.get('whole-list').children[0].click();assert.equal(env.nodes.get('quote').textContent,'Whole passage');assert.equal(env.nodes.get('diagnosis').textContent,sample.whole_passage_checks[0].diagnosis);});
test('messages from another window are ignored',()=>{const env=boot();env.deliver({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:sample}},{});assert.equal(env.nodes.get('passage').textContent,'');});
test('invalid incoming offsets produce a visible recovery message',()=>{const env=boot();const bad=JSON.parse(JSON.stringify(sample));bad.findings[0].end=50000;toolResult(env,bad);assert.match(env.nodes.get('connection-status').textContent,/fresh diagnostic/);});
test('fresh results reset filters and support a clean diagnostic',()=>{const env=boot();toolResult(env);env.status.find(x=>x.dataset.status==='violation').click();toolResult(env,buildDiagnostic({passage:'Rain hit the window.',findings:[]}));assert.equal(env.status[0].getAttribute('aria-pressed'),'true');assert.equal(env.nodes.get('judgment-empty').textContent,'No findings in this diagnostic.');});
