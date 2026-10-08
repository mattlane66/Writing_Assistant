#!/usr/bin/env node
/** Stateful Chromium journeys. Uses actual React code and intercepted (never live) API replies. */
import {createRequire} from "node:module";
import {resolve,dirname} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const home=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const opts=process.argv.slice(2), i=opts.indexOf("--source-root");
if(i>=0&&!opts[i+1])throw Error("Missing --source-root");
const root=i>=0?resolve(opts[i+1]):home,req=createRequire(resolve(root,"package.json"));
const browserReq=createRequire(resolve(process.env.PLAYWRIGHT_ROOT||root,"package.json"));
const {chromium}=browserReq("playwright"),{createServer}=req("vite");
const react=(await import(pathToFileURL(req.resolve("@vitejs/plugin-react")).href)).default;
async function main(){
 const vite=await createServer({root,configFile:false,plugins:[react()],logLevel:"error",
  server:{host:"127.0.0.1",port:0},appType:"spa"});
 let browser; const report=[];let observed;
 const test=async(id,fn)=>{try{await fn();report.push({id,pass:true});}
 catch(e){report.push({id,pass:false,error:String(e.message||e).slice(0,750)});}};
 try{
  await vite.listen();
  browser=await chromium.launch(process.env.CHROME_PATH?
   {executablePath:process.env.CHROME_PATH,headless:true,args:["--no-sandbox"]}:
   {channel:"chrome",headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage();page.setDefaultTimeout(7000);
  await page.coverage.startJSCoverage({resetOnNavigation:false});
  const button=page.locator(".revise-button"),field=page.locator("#draft-input");
  const url=vite.resolvedUrls.local[0];
  await test("SC-9",async()=>{
   await page.goto(url);await field.waitFor();
   if(!(await button.isDisabled()))throw Error("Blank draft was submittable");
   await field.fill("   ");if(!(await button.isDisabled()))throw Error("Whitespace was submittable");
   await field.fill("A sentence.");if(await button.isDisabled())throw Error("Full draft disabled");
   let calls=0;
   await page.route("**/api/revise",async route=>{
    calls++;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({result:"Revised prose.",meta:{}})});
   });
   await page.keyboard.press("Control+Enter");
   await page.locator(".revision-output").getByText("Revised prose.").waitFor();
   if(calls!==1)throw Error("Shortcut invoked "+calls+" calls");
   await page.unrouteAll();
  });
  await test("SC-10",async()=>{
   await field.fill("Draft survives reload.");
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem("writing-assistant:v1:draft")||"null")==="Draft survives reload.");
   await page.reload();
   if(await field.inputValue()!=="Draft survives reload.")throw Error("Draft disappeared");
   await page.locator(".clear-button").click();
   if(await field.inputValue()!==""||!(await button.isDisabled()))throw Error("Clear left draft/submission enabled");
  });
  await test("SC-11",async()=>{
   await field.fill("Test request.");
   let calls=0,release;
   const pending=new Promise(r=>{release=r;});
   await page.route("**/api/revise",async route=>{
    calls++;
    if(calls===1){
     await pending;
     await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Service unavailable"})});
    }else await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({result:"Success.",meta:{}})});
   });
   await button.click();await page.locator(".revision-state.loading-state").waitFor();
   if(!(await button.isDisabled()))throw Error("Loading submission enabled");
   release();
   await page.locator(".revision-state.error-state").waitFor();
   if(!(await page.getByRole("alert").getByText("Service unavailable").isVisible()))throw Error("Missing error notice");
   await button.click();await page.locator(".revision-output").getByText("Success.").waitFor();
   if(calls!==2)throw Error("Unexpected request count");
   await page.unrouteAll();
  });
  const v8=await page.coverage.stopJSCoverage();
  observed=[...new Set(v8.filter(v=>v.ranges.length>0 && v.url.includes("/src/"))
    .map(v=>new URL(v.url).pathname.replace(/^\//,"")))].sort();
 }finally{if(browser)await browser.close();await vite.close();}
 const failed=report.filter(r=>!r.pass).map(r=>r.id);
 console.log(JSON.stringify({kind:"ActualChromiumJourneys",results:report,passed:report.length-failed.length,failed,observed_source_modules:observed,
  limits:"Browser interaction with mock API responses; no hosted models or comprehensive equivalence."},null,2));
 if(failed.length||report.length!==3)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=2;});
