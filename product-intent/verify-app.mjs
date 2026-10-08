#!/usr/bin/env node
/**
 * Deterministic API/UI Product Intent checks against an independently supplied
 * application checkout. This runner and its expectations must come from the
 * protected base revision when gating candidate pull requests.
 *
 * No OpenAI calls: credentials are explicitly disabled and the API pipeline
 * is replaced with an exception if it is ever reached.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const trustedRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argIndex = process.argv.indexOf("--source-root");
if (argIndex !== -1 && !process.argv[argIndex + 1]) {
  throw new Error("--source-root requires a directory");
}
const root = argIndex === -1 ? trustedRoot : resolve(process.argv[argIndex + 1]);
const requireFromCandidate = createRequire(resolve(root, "package.json"));
const scenarios = {};
const check = (id, pass, detail = "") => {
  scenarios[id] = {pass: Boolean(pass), detail};
};

async function apiChecks() {
  const saved = {
    key:process.env.OPENAI_API_KEY,mode:process.env.NODE_ENV,
    vector:process.env.OPENAI_VECTOR_STORE_ID
  };
  process.env.OPENAI_API_KEY="";
  process.env.NODE_ENV="test";
  delete process.env.OPENAI_VECTOR_STORE_ID;
  let server;
  try {
    const {createApp} = await import(pathToFileURL(resolve(root,"server/app.mjs")).href);
    const app=createApp({pipelineRunner:async () => {
      throw new Error("INVARIANT: a hosted agent pipeline ran during keyless product intent checks");
    }});
    server=await new Promise((res,rej)=>{
      const instance=app.listen(0,"127.0.0.1",()=>res(instance));
      instance.on("error",rej);
    });
    const base="http://127.0.0.1:"+server.address().port;
    async function post(body) {
      const r=await fetch(base+"/api/revise",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(body),signal:AbortSignal.timeout(5000)
      });
      return {status:r.status,headers:r.headers,body:await r.json()};
    }
    const missing=await post({mode:"edit"});
    const badMode=await post({draft:"A valid draft.",mode:"invent"});
    const tooLong=await post({draft:"a".repeat(30001),mode:"edit",ceiling:false});
    const keyless=await post({draft:"A valid draft.",mode:"edit",ceiling:false});
    const statusResponse=await fetch(base+"/api/status",{signal:AbortSignal.timeout(5000)});
    const status=await statusResponse.json();
    check("SC-5",missing.status===400&&badMode.status===400&&tooLong.status===400&&
          [missing,badMode,tooLong].every(r=>r.headers.get("cache-control")==="no-store"),
          "invalid, unsupported and over-limit requests must reject before pipeline");
    check("SC-6",keyless.status===503&&
          /OpenAI is not configured/i.test(keyless.body.error||"")&&
          statusResponse.status===200&&status.revisionApiReady===false,
          "without credentials a valid request is unavailable, not a hosted run");
  } finally {
    if(server)await new Promise(res=>server.close(res));
    if(saved.key===undefined)delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY=saved.key;
    if(saved.mode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=saved.mode;
    if(saved.vector===undefined)delete process.env.OPENAI_VECTOR_STORE_ID;
    else process.env.OPENAI_VECTOR_STORE_ID=saved.vector;
  }
}

async function uiChecks() {
  // Load actual TSX via Vite's SSR transform, but disable candidate vite.config.
  // No browser, no user data, and no Playwright/network dependencies.
  const {createServer}=requireFromCandidate("vite");
  const React=requireFromCandidate("react");
  const {renderToStaticMarkup}=requireFromCandidate("react-dom/server");
  const vite=await createServer({
    configFile:false,root,server:{middlewareMode:true},
    appType:"custom",esbuild:{jsx:"automatic"}
  });
  try {
    const {RevisionActions}=await vite.ssrLoadModule("/src/components/RevisionActions.tsx");
    const {EditorWorkspace}=await vite.ssrLoadModule("/src/components/EditorWorkspace.tsx");
    const noop=()=>{};
    const renderActions=(opts)=>renderToStaticMarkup(React.createElement(RevisionActions,{
      ceiling:true,onCeilingChange:noop,loading:false,disabled:false,...opts
    }));
    const blocked=renderActions({disabled:true});
    const enabled=renderActions({disabled:false});
    const loadingAction=renderActions({loading:true,disabled:true});
    const button=(html)=>html.match(/<button\b[^>]*class="revise-button"[^>]*>/)?.[0] || "";
    check("SC-7",/\bdisabled(?:=| |>)/.test(button(blocked))&&
          !/\bdisabled(?:=| |>)/.test(button(enabled))&&
          loadingAction.includes("Revising")&&
          loadingAction.includes('aria-checked="true"'),
          "actual RevisionActions renders disabled, enabled and loading correctly");
    const renderWorkspace=(revision,draft="A draft.")=>
      renderToStaticMarkup(React.createElement(EditorWorkspace,{
        draft,onDraftChange:noop,onClear:noop,revision
      }));
    const base={result:"",error:null};
    const waiting=renderWorkspace({status:"loading",...base});
    const error=renderWorkspace({status:"error",result:"",error:"Network unavailable"});
    const success=renderWorkspace({status:"success",result:"Revised prose.",error:null});
    check("SC-8",waiting.includes("Revising your draft")&&
          waiting.includes('aria-busy="true"')&&
          error.includes('role="alert"')&&error.includes("Network unavailable")&&
          success.includes("Revised prose.")&&
          success.includes("revision-output"),
          "actual editor renders loading, error and successful revision states");
  } finally {await vite.close();}
}

async function main() {
  let error=null;
  try {
    await apiChecks();
    await uiChecks();
  } catch(e) {
    error=String(e.stack||e);
  }
  const results=Object.entries(scenarios).map(([id,data])=>({id,...data}));
  const failures=results.filter(x=>!x.pass).map(x=>x.id);
  const missing=["SC-5","SC-6","SC-7","SC-8"].filter(id=>!(id in scenarios));
  const report={
    kind:"ProtectedProductIntentApiUi",
    source_root:root,
    checked_scenarios:results.length,
    passed_scenarios:results.filter(x=>x.pass).length,
    failures,missing,error,
    source_of_expectations:"trusted runner, not candidate source",
    limitations:"Server API and SSR-rendered React states only. No browser clicks, real LLM calls or complete semantic equivalence."
  };
  console.log(JSON.stringify(report,null,2));
  if(error||missing.length||failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
