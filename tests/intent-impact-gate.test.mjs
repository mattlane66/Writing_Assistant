import {describe,it,expect} from "vitest";
import {plan,decide} from "../product-intent/impact-gate.mjs";
const model={schema_version:1,records:[
{id:"INV-1",status:"working",verification:["SC-1"]},
{id:"INV-2",status:"accepted",verification:["SC-5"]}],
bindings:[
{intent_id:"INV-1",paths:["server/meaning-contract.mjs"],confidence:"inferred"},
{intent_id:"INV-2",paths:["server/app.mjs"],confidence:"confirmed"}]};
const registry={schema_version:1,scenarios:[
{id:"SC-1",runner:"semantic"},{id:"SC-5",runner:"api_ui"}]};
describe("intent impact selection",()=>{
 it("selects semantic checks while preserving review status",()=>{
  const p=plan(model,registry,["server/meaning-contract.mjs"]);
  expect(p.groups).toEqual(["semantic"]);
  expect(p.scenario_ids).toEqual(["SC-1"]);
  expect(decide(p,[{pass:true}]).verdict).toBe("REVIEW");
 });
 it("selects API checks for accepted confirmed binding",()=>{
  const p=plan(model,registry,["server/app.mjs"]);
  expect(p.groups).toEqual(["api_ui"]);
  expect(decide(p,[{pass:true}]).verdict).toBe("PASS");
 });
 it("flags unbound source and altered intent",()=>{
  expect(plan(model,registry,["server/new.mjs"]).unmodeled_source).toEqual(["server/new.mjs"]);
  expect(plan(model,registry,["planning/product-intent.json"]).protected_changes).toEqual(["planning/product-intent.json"]);
 });
 it("never accepts a demonstrated regression",()=>{
  const p=plan(model,registry,["server/meaning-contract.mjs"]);
  expect(decide(p,[{pass:false}]).verdict).toBe("DRIFT");
 });
 it("refuses missing baseline scenarios",()=>{
  expect(()=>plan(model,{schema_version:1,scenarios:[]},["server/app.mjs"])).toThrow(/Missing trusted scenario/);
 });
});
