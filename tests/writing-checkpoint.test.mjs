import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { DIMENSIONS, hash, validateWritingWorkflow } from "../server/writing-workflow.mjs";
import { manageWritingDocument } from "../server/writing-document.mjs";
import { renderWritingCheckpoint, CHECKPOINT_SCHEMAS, WRITING_CHECKPOINT_UI_URI, readWritingCheckpointResource } from "../server/writing-checkpoint.mjs";
import { getWritingAssistantTools, callWritingAssistantTool, handleWritingAssistantMcp } from "../server/mcp.mjs";
import { loadConceptRegistry } from "../server/concept-registry.mjs";
const original = "The door was found open. Nobody knows who opened it.";
const checkpoint = (kind, r, extra = {}) => renderWritingCheckpoint({ kind, text_processing_authorized: true, export_authorized: true, state: r.state, expected_state_sha256: r.state_sha256, ...extra });
let doc, workflow, html;
beforeAll(async()=>{
  doc=await manageWritingDocument({ request:{operation:"create",id:"checkpoint-fixture",text:original,text_processing_authorized:true} });
  workflow=await validateWritingWorkflow({ request:{operation:"start",text_processing_authorized:true,abstract_query:"preserve justified passive and unknown actor",method_ids:["passive-voice"],frame:{
    id:"checkpoint-fixture",original,direction:"Discuss, do not rewrite.",mode:"craft-analysis",purpose:"Inspect continuity.",reader:"General reader.",genre:"Nonfiction.",invention_permission:"forbidden",invention_boundary:"No invented actor.",scope:"whole-passage",project_context:null,
    dimensions:DIMENSIONS.map(domain=>({domain,disposition:"checked",reason:"Software fixture, not semantic proof."})),
    entries:[{id:"door",kind:"claim",status:"asserted",statement:"Unknown opener.",evidence:[{source:"original",start:0,end:original.length,quote:original}]}] } } });
  html=await readFile(new URL("../products/writing-assistant-plugin/ui/checkpoint.html",import.meta.url),"utf8");
},20000);
describe("original checkpoint software controls, not editorial grades",()=>{
  it("copies the checkpoint UI and verifies runtime assets in the deployment image",async()=>{
    const docker=await readFile(new URL("../Dockerfile",import.meta.url),"utf8");
    expect(docker).toContain("COPY --from=build /app/products/writing-assistant-plugin/ui ./products/writing-assistant-plugin/ui");
    expect(docker).toContain("await readWritingCheckpointResource(WRITING_CHECKPOINT_UI_URI)");
    expect(docker).toContain("await workflowKnowledgeFingerprint()");
  });
  it("keeps recognition/execution obligations paired under stable concept IDs",async()=>{
    const suite=JSON.parse(await readFile(new URL("../evals/checkpoint-development.cases.json",import.meta.url),"utf8")),registry=await loadConceptRegistry();
    expect(suite).toMatchObject({origin:"authored-development",quality_evidence:false});expect(suite.cases).toHaveLength(6);
    for(const id of new Set(suite.cases.flatMap(c=>c.concept_ids))){expect(registry.concepts.some(c=>c.id===id)).toBe(true);expect(new Set(suite.cases.filter(c=>c.concept_ids.includes(id)).map(c=>c.axis))).toEqual(new Set(["recognition","execution"]))}
  });
  it("preserves exact document state with a private non-certified snapshot",async()=>{
    const r=await checkpoint("document",doc);expect(r.checkpoint.state).toEqual(doc.state);expect(r.checkpoint.state_sha256).toBe(doc.state_sha256);
    expect(r).toMatchObject({export_authorized:true,model_calls:0,semantic_certification:false,authenticated_history:false,durable_storage:false});
    expect(r.summary).toMatchObject({recorded_reviews:0,total_sections:1,context_enabled_in_snapshot:false});
  });
  it("preserves a framed workflow and discloses its missing final audit",async()=>{
    const r=await checkpoint("workflow",workflow);expect(r.checkpoint.state).toEqual(workflow.state);expect(r.summary.limitations).toContain("No final audit is recorded in this snapshot.");expect(r.checkpoint.resume_policy).toBe("discussion-only-new-edit-permission-required");
  });
  it.each([{export_authorized:false},{text_processing_authorized:false},{unexpected:"PRIVATE_SENTINEL"},{kind:"dispatch"}])("rejects absent permission and extra dispatch data %j",async change=>{
    const r=await callWritingAssistantTool("render_writing_checkpoint",{kind:"document",text_processing_authorized:true,export_authorized:true,state:doc.state,expected_state_sha256:doc.state_sha256,...change});
    expect(r.isError).toBe(true);expect(JSON.stringify(r)).not.toContain("PRIVATE_SENTINEL");
  });
  it("rejects altered content, recomputed stale knowledge and the wrong kind",async()=>{
    const altered=structuredClone(doc);altered.state.text+=" changed";await expect(checkpoint("document",altered)).rejects.toThrow();
    altered.state.text_sha256=hash(altered.state.text);altered.state_sha256=hash(altered.state);await expect(checkpoint("document",altered)).rejects.toThrow();
    const stale=structuredClone(doc);stale.state.knowledge_sha256="0".repeat(64);stale.state_sha256=hash(stale.state);await expect(checkpoint("document",stale)).rejects.toThrow();
    await expect(checkpoint("workflow",doc)).rejects.toThrow();
  });
  it("rejects rehashed invalid workflow evidence rather than certifying it",async()=>{
    const r=structuredClone(workflow);r.state.frame.entries[0].evidence[0].quote="Invented";r.state.request_sha256=hash(r.state.frame);r.state_sha256=hash(r.state);
    await expect(checkpoint("workflow",r)).rejects.toThrow();
  });
  it("can show all 24 sections without marking them reviewed",async()=>{
    const r=await manageWritingDocument({request:{operation:"create",id:"maximum-fixture",text_processing_authorized:true,text:"a".repeat(96000)}});
    const view=await checkpoint("document",r);expect(view.summary).toMatchObject({text_characters:96000,total_sections:24,recorded_reviews:0});expect(view.checkpoint.state.text).toHaveLength(96000);
  });
  it("does not turn checkpoint display into context approval or restoration",async()=>{
    const context={version:1,title:"Fixture",facts:"Opener unknown.",terminology:"",voice_samples:"",decisions:"",open_questions:"",author_approved:true};
    const approved=await manageWritingDocument({request:{operation:"approve-context",text_processing_authorized:true,state:doc.state,expected_state_sha256:doc.state_sha256,context,enabled:true}});
    const view=await checkpoint("document",approved);expect(view.checkpoint.state.context_enabled).toBe(true);
    const restored=await manageWritingDocument({request:{operation:"restore",text_processing_authorized:true,portable:view.checkpoint.state,expected_state_sha256:view.checkpoint.state_sha256}});
    expect(restored.state.context_enabled).toBe(false);expect(restored.state.text).toBe(original);
  });
  it("declares one readonly render operation and a narrow resource policy",async()=>{
    const tool=getWritingAssistantTools().find(t=>t.name==="render_writing_checkpoint");expect(tool.inputSchema.type).toBe("object");expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.inputSchema.properties.operation).toBeUndefined();expect(tool._meta.ui.resourceUri).toBe(WRITING_CHECKPOINT_UI_URI);
    expect(tool.annotations).toMatchObject({readOnlyHint:true,destructiveHint:false,openWorldHint:false});
    const r=await readWritingCheckpointResource(WRITING_CHECKPOINT_UI_URI);expect(r.contents[0]._meta.ui.csp).toEqual({connectDomains:[],resourceDomains:[]});
    expect(html).not.toMatch(/localStorage|indexedDB|setWidgetState|innerHTML|fetch\(/);
    for(const schema of Object.values(CHECKPOINT_SCHEMAS)){expect(schema.type).toBe("object");const walk=v=>{if(!v||typeof v!=="object")return;if(v.$ref)expect(schema.$defs[v.$ref.split("/").at(-1)]).toBeTruthy();Object.values(v).forEach(walk)};walk(schema);}
  });
  it("discovers both resources and renders checkpoint data over MCP",async()=>{
    const r=await handleWritingAssistantMcp({jsonrpc:"2.0",id:1,method:"resources/list"});expect(r.result.resources.map(x=>x.uri)).toContain(WRITING_CHECKPOINT_UI_URI);
    const call=await callWritingAssistantTool("render_writing_checkpoint",{kind:"document",text_processing_authorized:true,export_authorized:true,state:doc.state,expected_state_sha256:doc.state_sha256});expect(call.isError).not.toBe(true);expect(call.structuredContent.checkpoint.state.text).toBe(original);
  });
});
async function ui(payload,{message=true,legacy=false,fail=false}={}){
  // Small DOM/host simulation, like the existing diagnostic regressions. This
  // executes the real inline script but is not browser layout/host acceptance.
  class Element {
    constructor(){this.events={};this.children=[];this.textContent="";this.value="";this.hidden=false;this.disabled=false;this.checked=false;}
    addEventListener(type,fn){(this.events[type]??=[]).push(fn)}
    dispatchEvent(event){for(const fn of this.events[event.type]??[])fn(event)}
    click(){if(!this.disabled)this.dispatchEvent({type:"click"})}
    replaceChildren(...items){this.children=items}
    append(item){this.children.push(item)}
    remove(){}
    focus(){this.focused=true}
    select(){this.selected=true}
  }
  const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()])),listeners={},timers=new Set(),requests=[];
  const document={getElementById:id=>nodes.get(id),querySelector:s=>nodes.get(s.slice(1)),querySelectorAll:()=>[],createElement:()=>new Element(),body:new Element()};
  const w={document,parent:{},Event:class{constructor(type){this.type=type}},MessageEvent:class{constructor(type,value){this.type=type;Object.assign(this,value)}},
    addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn)},dispatchEvent:event=>{for(const fn of listeners[event.type]??[])fn(event)}};
  if(legacy)w.openai={sendFollowUpMessage:async p=>{requests.push({method:"legacy",params:p});if(fail)throw Error("Rejected")}};
  w.parent.postMessage=m=>{requests.push(m);if(m.id!==undefined)queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent("message",{source:w.parent,data:{jsonrpc:"2.0",id:m.id,...(m.method==="ui/message"&&fail?{error:{message:"Rejected"}}:{result:m.method==="ui/initialize"?{hostCapabilities:message?{message:{}}:{}}:{}})}})))};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window:w,document,crypto:webcrypto,TextEncoder,
    setTimeout:(fn,ms)=>{const id=setTimeout(fn,ms);timers.add(id);return id},clearTimeout:id=>{clearTimeout(id);timers.delete(id)}});
  const receive=async value=>{w.dispatchEvent(new w.MessageEvent("message",{source:w.parent,data:{jsonrpc:"2.0",method:"ui/notifications/tool-result",params:{structuredContent:value}}}));await new Promise(r=>setTimeout(r,35))};
  await receive(payload);return{w,requests,receive,close:()=>{for(const id of timers)clearTimeout(id)}};
}
describe("checkpoint UI software bridge controls",()=>{
  it("requires confirmation, then sends the full record for discussion only",async()=>{
    const p=await checkpoint("document",doc),u=await ui(p);try{
      expect(u.w.document.querySelector("#snapshot").hidden).toBe(false);const button=u.w.document.querySelector("#send");expect(button.disabled).toBe(true);
      const checkbox=u.w.document.querySelector("#confirm");checkbox.checked=true;checkbox.dispatchEvent(new u.w.Event("change"));button.click();await new Promise(r=>setTimeout(r,15));
      const m=u.requests.find(x=>x.method==="ui/message");expect(m.params.content[0].text).toContain(JSON.stringify(p.checkpoint));expect(m.params.content[0].text).toContain("but NO editing");expect(u.w.document.querySelector("#status").textContent).toMatch(/discussion only/);expect(button.disabled).toBe(true);
    }finally{u.close()}
  });
  it("clears previous confirmation and selections on a fresh result",async()=>{
    const p=await checkpoint("document",doc),u=await ui(p);try{u.w.document.querySelector("#confirm").checked=true;await u.receive(p);expect(u.w.document.querySelector("#confirm").checked).toBe(false);expect(u.w.document.querySelector("#send").disabled).toBe(true)}finally{u.close()}
  });
  it("rejects tampered incoming snapshots and never interprets text as HTML",async()=>{
    const p=await checkpoint("document",doc),u=await ui(p);try{const bad=structuredClone(p);bad.checkpoint.state.text="<img src=x onerror=alert(1)>";await u.receive(bad);expect(u.w.document.querySelector("#snapshot").hidden).toBe(true);expect(u.w.document.querySelector("#status").textContent).toMatch(/hashes/);expect(u.w.document.querySelectorAll("img")).toHaveLength(0)}finally{u.close()}
  });
  it("ignores messages from other windows",async()=>{
    const p=await checkpoint("document",doc),u=await ui(p);try{u.w.dispatchEvent(new u.w.MessageEvent("message",{source:{},data:{jsonrpc:"2.0",method:"ui/notifications/tool-result",params:{isError:true}}}));expect(u.w.document.querySelector("#snapshot").hidden).toBe(false)}finally{u.close()}
  });
  it("keeps JSON available but disables handoff when the host cannot send",async()=>{
    const u=await ui(await checkpoint("document",doc),{message:false});try{expect(u.w.document.querySelector("#checkpoint-json").value).toContain(doc.state_sha256);u.w.document.querySelector("#confirm").checked=true;u.w.document.querySelector("#confirm").dispatchEvent(new u.w.Event("change"));expect(u.w.document.querySelector("#send").disabled).toBe(true)}finally{u.close()}
  });
  it("supports the existing legacy message bridge without escalating permission",async()=>{
    const u=await ui(await checkpoint("document",doc),{message:false,legacy:true});try{const cb=u.w.document.querySelector("#confirm");cb.checked=true;cb.dispatchEvent(new u.w.Event("change"));u.w.document.querySelector("#send").click();await new Promise(r=>setTimeout(r,15));expect(u.requests.find(x=>x.method==="legacy").params.prompt).toContain("NO editing")}finally{u.close()}
  });
  it("discloses rejected handoff and disables duplicate retry",async()=>{
    const u=await ui(await checkpoint("document",doc),{fail:true});try{const cb=u.w.document.querySelector("#confirm");cb.checked=true;cb.dispatchEvent(new u.w.Event("change"));u.w.document.querySelector("#send").click();await new Promise(r=>setTimeout(r,15));expect(u.w.document.querySelector("#status").textContent).toMatch(/not confirmed/);expect(u.w.document.querySelector("#send").disabled).toBe(true)}finally{u.close()}
  });
});
