#!/usr/bin/env node
/** Seed realistic browser behavior bugs in disposable copies; count crashes separately. */
import {cp,mkdtemp,readFile,writeFile,symlink,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const runner=resolve(root,"product-intent/browser-journeys.mjs");
const mutants=[
{id:"M-5",path:"src/App.tsx",before:"const canSubmit = Boolean(draft.trim()) && !loading;",after:"const canSubmit = true;",target:"SC-9"},
{id:"M-6",path:"src/hooks/usePersistentState.ts",before:"window.localStorage.setItem(key, JSON.stringify(value));",after:"window.localStorage.removeItem(key);",target:"SC-10"},
{id:"M-7",path:"src/App.tsx",before:'setDraft("");',after:'setDraft("still present");',target:"SC-10"},
{id:"M-8",path:"src/hooks/useRevision.ts",before:'setState({ status: "loading", result: "", error: null });',after:'setState({ status: "idle", result: "", error: null });',target:"SC-11"}
];
const safe=[
{id:"B-1",path:"src/App.tsx",suffix:"\n// No-op commentary on the draft policy.\n"},
{id:"B-2",path:"src/hooks/useRevision.ts",suffix:"\n// This line only documents the existing states.\n"}
];
async function copyAndMutate(m){
 const dir=await mkdtemp(join(tmpdir(),"browser-intent-eval-"));
 for(const name of ["src","index.html","package.json","public"]){
  try{await cp(join(root,name),join(dir,name),{recursive:true});}
  catch(e){if(e.code!=="ENOENT")throw e;}
 }
 await symlink(join(root,"node_modules"),join(dir,"node_modules"),"dir");
 const file=join(dir,m.path);
 let source=await readFile(file,"utf8");
 if(m.before){
  if(source.split(m.before).length!==2)throw Error("Missing/ambiguous mutation anchor "+m.id);
  source=source.replace(m.before,m.after);
 }else source+=m.suffix;
 await writeFile(file,source,"utf8");
 return dir;
}
function evaluate(dir){
 const p=spawnSync(process.execPath,[runner,"--source-root",dir],
  {encoding:"utf8",timeout:120000,env:{...process.env,OPENAI_API_KEY:"",NODE_ENV:"test"}});
 try{
  const report=JSON.parse(p.stdout);
  return {exit:p.status,failed:report.failed||[],error:p.error?.message||null};
 }catch{
  return {exit:p.status,failed:["UNPARSEABLE_OR_CRASHED"],
   error:(p.stderr||p.stdout||"").slice(-700)};
 }
}
async function main(){
 const rows=[];
 for(const item of [...mutants,...safe]){
  let dir;
  try{
   dir=await copyAndMutate(item);
   const output=evaluate(dir);
   rows.push({id:item.id,expected_target:item.target||null,
    detected:item.target?output.failed.includes(item.target):null,
    false_alarm:item.target?null:output.exit!==0,...output});
  }finally{if(dir)await rm(dir,{recursive:true,force:true});}
 }
 const killed=rows.filter(x=>x.expected_target&&x.detected).length;
 const falseAlarms=rows.filter(x=>!x.expected_target&&x.false_alarm).length;
 const result={mutation_detection:{count:killed,total:mutants.length},
  harmless_refactor_controls:{false_alarms:falseAlarms,total:safe.length},rows,
  caveat:"Seeded mutations + two comment-only controls, not an estimated population detection rate."};
 console.log(JSON.stringify(result,null,2));
 if(killed!==mutants.length||falseAlarms)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=2;});
