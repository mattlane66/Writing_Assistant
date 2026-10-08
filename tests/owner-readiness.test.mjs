import {describe,it,expect} from "vitest";
import {audit} from "../product-intent/owner-readiness.mjs";
describe("product owner ratification checks",()=>{
 it("never treats inferred intent or bindings as approved",()=>{
  const r=audit({records:[{id:"INV-1",status:"working"}],bindings:[
    {intent_id:"INV-1",confidence:"inferred"}]},null,
    "| R1 | Existing state | Observed | Working |");
  expect(r.ready_for_governed_enforcement).toBe(false);
  expect(r.unresolved_intent).toEqual(["INV-1"]);
  expect(r.unconfirmed_bindings).toEqual(["INV-1"]);
  expect(r.unaccepted_requirements).toEqual(["R1"]);
 });
 it("requires separate human acceptance metadata",()=>{
  const m={records:[{id:"INV-1",status:"accepted",approved_by:"mattlane66",approved_at:"2026-10-08"}],
    bindings:[{intent_id:"INV-1",confidence:"confirmed",evidence:["runtime & review"]}]};
  expect(audit(m,null,"| R1 | Behavior | Must have | Accepted |").ready_for_governed_enforcement).toBe(false);
 });
});
