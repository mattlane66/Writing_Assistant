#!/usr/bin/env node
/** Ownership readiness audit. An approval file is NOT proof of GitHub review. */
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
export function audit(model,review,canonicalRequirements){
 const records=model.records||[],bindings=model.bindings||[];
 const unresolved=records.filter(r=>r.status!=="accepted" || !r.approved_by || !r.approved_at)
    .map(r=>r.id);
 const unconfirmed=bindings.filter(b=>b.confidence!=="confirmed"||!(b.evidence||[]).length)
    .map(b=>b.intent_id);
 const requirements=canonicalRequirements.split("\n")
  .filter(l=>/^\|\s*R[0-9]+\s*\|/.test(l))
  .filter(l=>!/\|\s*Accepted\s*\|\s*$/.test(l)).map(l=>l.split("|")[1].trim());
 const missingReview=!review||review.status!=="approved"||
   review.reviewer!=="mattlane66"||!review.head_commit||
   !review.reviewed_at||!review.model_sha256;
 return {ready_for_governed_enforcement:!unresolved.length&&!unconfirmed.length&&!requirements.length&&!missingReview,
  unresolved_intent:unresolved,unconfirmed_bindings:unconfirmed,unaccepted_requirements:requirements,
  human_review_attestation_missing:missingReview,
  disclaimer:"Approval JSON can be edited. Only an independently enforced GitHub code-owner review/ruleset establishes authorization."};
}
function main(){
 const modelPath=resolve(root,"planning/product-intent.json");
 const model=JSON.parse(readFileSync(modelPath,"utf8"));
 const reviewPath=resolve(root,"planning/owner-approval.json");
 const review=existsSync(reviewPath)?JSON.parse(readFileSync(reviewPath,"utf8")):null;
 const report=audit(model,review,readFileSync(resolve(root,"planning/02-shaping.md"),"utf8"));
 if(review&&review.model_sha256){
  const actual=createHash("sha256").update(readFileSync(modelPath)).digest("hex");
  if(actual!==review.model_sha256)report.ready_for_governed_enforcement=false;
  report.approval_fingerprint_matches=actual===review.model_sha256;
 }
 console.log(JSON.stringify(report,null,2));
 if(process.argv.includes("--strict")&&!report.ready_for_governed_enforcement)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){console.error(e);process.exitCode=2;}
}
