#!/usr/bin/env node
/** Protected-base impact selection. Working/inferred never equals approved. */
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const trusted=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const excluded=new Set([".git","node_modules","dist","build",".next","coverage","vendor",".venv"]);
const protectedPath=/^(planning\/|product-intent\/|\.github\/workflows\/|\.github\/CODEOWNERS$)/;
const sourcePath=/^(src\/|server\/|products\/|vite\.config\.ts$|package(?:-lock)?\.json$)/;
const docsPath=/^(README\.md$|docs\/|knowledge\/|\.gitignore$)/;
const names={semantic:"run-pilot.mjs",api_ui:"verify-app.mjs",browser:"browser-journeys.mjs"};
function inventory(root,sub="",into=new Map()){
  for(const e of readdirSync(join(root,sub),{withFileTypes:true})){
    if(excluded.has(e.name)||e.isSymbolicLink())continue;
    const path=sub?sub+"/"+e.name:e.name;
    if(e.isDirectory())inventory(root,path,into);
    else if(e.isFile())into.set(path,createHash("sha256").update(readFileSync(join(root,path))).digest("hex"));
  }return into;
}
export function changes(a,b){
 const old=inventory(a),head=inventory(b);
 return [...new Set([...old.keys(),...head.keys()])].filter(p=>old.get(p)!==head.get(p)).sort();
}
function matches(path,pattern){
 if(pattern.endsWith("/**"))return path.startsWith(pattern.slice(0,-3)+"/");
 if(pattern.includes("*")){
  const escaped=pattern.split("*").map(s=>s.replace(/\W/g,"\\$&")).join(".*");
  return new RegExp("^"+escaped+"$").test(path);
 }
 return path===pattern;
}
export function plan(model,registry,paths){
 if(model?.schema_version!==1||!Array.isArray(model.records)||!Array.isArray(model.bindings))throw Error("Invalid trusted product-intent model");
 if(registry?.schema_version!==1||!Array.isArray(registry.scenarios))throw Error("Invalid trusted scenarios");
 const recordIndex=new Map(model.records.map(r=>[r.id,r]));
 const index=new Map(registry.scenarios.map(s=>[s.id,s]));
 const selected=new Map(),groups=new Set(),unmapped=[],protectedChanges=[],neutral=[];
 for(const path of paths){
  if(protectedPath.test(path))protectedChanges.push(path);
  const bindings=model.bindings.filter(b=>b.paths.some(p=>matches(path,p)));
  if(!bindings.length){
   if(sourcePath.test(path)||(!protectedPath.test(path)&&!docsPath.test(path)))unmapped.push(path);
   else if(docsPath.test(path))neutral.push(path);
  }
  for(const binding of bindings){
   const record=recordIndex.get(binding.intent_id);
   if(!record||!record.verification?.length)throw Error("Unverified trusted binding: "+binding.intent_id);
   const entry=selected.get(record.id)||{id:record.id,authority:record.status,
    confidence:binding.confidence,paths:[],scenarios:[]};
   if(binding.confidence!=="confirmed")entry.confidence="inferred";
   entry.paths.push(path);
   for(const id of record.verification){
    const scenario=index.get(id);
    if(!scenario||!names[scenario.runner])throw Error("Missing trusted scenario "+id);
    groups.add(scenario.runner);
    if(!entry.scenarios.includes(id))entry.scenarios.push(id);
   }
   selected.set(record.id,entry);
  }
 }
 const approved=[...selected.values()].every(s=>s.authority==="accepted"&&s.confidence==="confirmed");
 return {status:protectedChanges.length||unmapped.length||!approved?"REVIEW":"CHECK",
  changed_paths:paths,affected:[...selected.values()],groups:[...groups].sort(),
  scenario_ids:[...new Set([...selected.values()].flatMap(x=>x.scenarios))].sort(),
  unmodeled_source:unmapped,protected_changes:protectedChanges,neutral};
}
export function decide(impact,results,{strict=false}={}){
 const verdict=results.some(x=>!x.pass)?"DRIFT":
  impact.status==="REVIEW"?"REVIEW":
  impact.groups.length||!impact.changed_paths.length?"PASS":"REVIEW";
 return {verdict,impact,checks:results,requires_owner_review:verdict==="REVIEW",
         should_fail:verdict==="DRIFT"||(strict&&verdict==="REVIEW")};
}
function run(group,root){
 const script=resolve(trusted,"product-intent",names[group]);
 const args=group==="semantic"?[script,"--source-root",root,"--verify-only"]:[script,"--source-root",root];
 const proc=spawnSync(process.execPath,args,{encoding:"utf8",timeout:120000,
  env:{...process.env,OPENAI_API_KEY:"",NODE_ENV:"test"}});
 return {group,pass:proc.status===0,code:proc.status,stdout:(proc.stdout||"").slice(-5000),
  stderr:(proc.stderr||"").slice(-2200),error:proc.error?.message||null};
}
function main(){
 const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
 const candidate=resolve(option("--candidate-root")||trusted);
 const base=resolve(option("--base-root")||trusted);
 const model=JSON.parse(readFileSync(resolve(base,"planning/product-intent.json"),"utf8"));
 const registry=JSON.parse(readFileSync(resolve(base,"product-intent/scenarios.json"),"utf8"));
 const impact=plan(model,registry,changes(base,candidate));
 const results=impact.groups.map(g=>run(g,candidate));
 const outcome=decide(impact,results,{strict:args.includes("--strict")});
 console.log(JSON.stringify(outcome,null,2));
 if(outcome.should_fail)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){console.error(e.stack||e);process.exitCode=2;}
}
