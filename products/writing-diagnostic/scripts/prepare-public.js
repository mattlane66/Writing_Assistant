#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
function https(value, field, originOnly=false) {
  if (typeof value!=='string'||!value.trim()) throw Error(`${field} must be supplied.`);
  const url=new URL(value);
  const reserved=['example.com','example.org','example.net'];
  if(url.protocol!=='https:'||url.username||url.password||['localhost','127.0.0.1','[::1]'].includes(url.hostname)||reserved.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))||url.hostname.endsWith('.example')||url.hostname.endsWith('.localhost'))throw Error(`${field} must be a real public HTTPS URL.`);
  if(originOnly&&(url.pathname!=='/'||url.search||url.hash))throw Error(`${field} must be an origin without a path or query.`);
  return url.href;
}
async function main(){
  if(!process.argv[2])throw Error('Usage: node scripts/prepare-public.js /absolute/path/to/completed-settings.json');
  const settings=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  for(const key of ['mcpURL','widgetOrigin','websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL','demoRecordingURL'])settings[key]=https(settings[key],key,key==='widgetOrigin');
  if(settings.countries!=='all'&&(!Array.isArray(settings.countries)||!settings.countries.length||settings.countries.some(x=>typeof x!=='string'||!(/^[A-Z]{2}$/).test(x))))throw Error('countries must be "all" or a nonempty list of uppercase country codes.');
  const probe={jsonrpc:'2.0',id:'public-package-check',method:'tools/list',params:{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}}}};
  const response=await fetch(settings.mcpURL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/list'},body:JSON.stringify(probe),signal:AbortSignal.timeout(15000)});
  const payload=await response.json();
  if(!response.ok||payload.error||!payload.result?.tools?.some(x=>x.name==='render_writing_diagnostic'))throw Error('The MCP endpoint did not return the required tool.');
  for(const key of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL','demoRecordingURL']){const r=await fetch(settings[key],{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`${key} is inaccessible (${r.status}).`);await r.body?.cancel();}
  // Status checks cannot establish policy coverage or video playback. Review those separately.
  const file=path.join(root,'plugin.json'),manifest=JSON.parse(fs.readFileSync(file));
  const op=manifest.extensions['com.openai'];
  for(const key of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL'])op.interface[key]=settings[key];
  op.review.demo_recording_url=settings.demoRecordingURL;
  op.publication.countries=settings.countries==='all'?[]:settings.countries;
  const portable={$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'writing-diagnostic':{type:'streamable-http',url:settings.mcpURL}}};
  const compat=JSON.parse(fs.readFileSync(path.join(root,'.codex-plugin/plugin.json')));compat.interface=op.interface;compat.extensions={ 'com.openai':{ review:op.review,publication:op.publication } };
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(root,'mcp.json'),JSON.stringify(portable,null,2)+'\n');
  fs.writeFileSync(path.join(root,'.mcp.json'),JSON.stringify({mcpServers:{'writing-diagnostic':{url:settings.mcpURL}}},null,2)+'\n');
  fs.writeFileSync(path.join(root,'.codex-plugin/plugin.json'),JSON.stringify(compat,null,2)+'\n');
  console.log('Public fields configured. Set WIDGET_ORIGIN to '+new URL(settings.widgetOrigin).origin+' on the deployed server. Verify page content and video playback, run the installed-host cases, and complete portal verification/scans before submission.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
