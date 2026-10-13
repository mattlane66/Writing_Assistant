import { beforeAll, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildReliabilityPlan, emptyReliabilityEvidence } from "../evals/reliability-service.mjs";
import { importWorkspace, sourceAuditBatch } from "../evals/review-workbench.mjs";
import { reviewFixture } from "./review-workbench-fixture.mjs";
import { ResponseReview } from "../src/review/ResponseReview";
import { SourceReview } from "../src/review/SourceReview";
import { BlindReview } from "../src/review/BlindReview";
import { CoverageReview } from "../src/review/CoverageReview";
import { ReviewerFields } from "../src/review/ReviewerFields";
import { ObservationCapture } from "../src/review/ObservationCapture";
import { SessionClearConfirmation } from "../src/review/ReviewApp";
import { emptyHostObservations, appendHostObservation } from "../evals/host-observations.mjs";
import type { Bootstrap, Evidence, HostObservationPacket, Plan, Report } from "../src/review/types";
let plan: Plan;
const reviewer = { id: "matthew-lane", independent: false, human_attested: false };
beforeAll(async () => { plan = await buildReliabilityPlan(); });
describe("review interface rendering safeguards", () => {
  it("never prechecks human identity or independence", () => {
    const html = renderToStaticMarkup(createElement(ReviewerFields, { value: reviewer, onChange: () => {} }));
    expect(html).toContain("matthew-lane"); expect(html).not.toContain("checked="); expect(html).toContain("not authenticated identity");
  });
  it("requires imported observations rather than displaying invented responses", () => {
    const html = renderToStaticMarkup(createElement(ResponseReview, { evidence: emptyReliabilityEvidence(plan) as Evidence, reviewer, busy: false, submit: async () => {} }));
    expect(html).toContain("No observed responses yet"); expect(html).toContain("No responses or passing judgments are generated");
  });
  it("renders every criterion with no preselected passing outcome", () => {
    const html = renderToStaticMarkup(createElement(ResponseReview, { evidence: reviewFixture(plan) as Evidence, reviewer, busy: false, submit: async () => {} }));
    expect((html.match(/Choose a judgment/g) ?? []).length).toBe(4);
    expect(html).not.toMatch(/value="pass" selected/); expect(html).toContain("disabled="); expect(html).toContain("Development case — excluded");
  });
  it("escapes imported prose rather than running embedded HTML", () => {
    const e = reviewFixture(plan) as Evidence; e.responses[0].output = "<script>PRIVATE_SENTINEL</script>";
    const html = renderToStaticMarkup(createElement(ResponseReview, { evidence: e, reviewer, busy: false, submit: async () => {} }));
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>PRIVATE_SENTINEL");
  });
  it("starts source audits as not independently reviewed and not agreed", () => {
    const e = emptyReliabilityEvidence(plan) as Evidence;
    const data = { plan, batch: sourceAuditBatch(plan), catalog: { cards: [], methods: [] } } as unknown as Bootstrap;
    const html = renderToStaticMarkup(createElement(SourceReview, { data, evidence: e, reviewer, busy: false, submit: async () => {} }));
    expect(html).toContain("Not independently reviewed"); expect(html).not.toMatch(/value="agreed" selected/); expect(html).toContain("Open your lawful local source separately");
  });
  it("does not present an empty validation ledger as mastery", () => {
    const report = importWorkspace(emptyReliabilityEvidence(plan), plan).report as Report;
    const html = renderToStaticMarkup(createElement(CoverageReview, { plan, report }));
    expect(html).toContain("Not yet verified"); expect(html).toContain("0/2 cases"); expect(html).toContain("not a claim that every book idea");
  });
  it("does not reveal assignments or invent anonymous outputs", () => {
    const html = renderToStaticMarkup(createElement(BlindReview, { packet: null, reviewer, busy: false, locked: false, submit: async () => {} }));
    expect(html).toContain("No anonymous packet loaded"); expect(html).toContain("Keep its condition key separate");
  });
  it("starts capture with no default host, status, attestation, invented response or grade", () => {
    const html = renderToStaticMarkup(createElement(ObservationCapture, { evidence: emptyReliabilityEvidence(plan) as Evidence,
      packet: emptyHostObservations(plan) as HostObservationPacket, busy: false, submit: async () => true }));
    expect(html).toContain("No observations captured"); expect(html).toContain("Save ungraded observation");
    expect(html).not.toContain("checked="); expect(html).toContain("disabled=");
    expect(html).toContain("Unknown versions and missing tool results stay unknown");
  });
  it("renders missing metadata and copied tool text safely without certifying judgment", () => {
    const e = emptyReliabilityEvidence(plan);
    const packet = appendHostObservation(emptyHostObservations(plan), { id: "capture-one", case_id: null, host: "chatgpt-chat",
      capture_origin: "synthetic-ui-fixture", result_kind: "platform-error", observed_at: null, actual_prompt: "<script>copied()</script>",
      output: null, visible_error: "An error", raw_tool_evidence: null, notes: null, faithful_capture_attested: true,
      metadata: { model_label: null, model_version: null, plugin_id: null, plugin_version: null, server_revision: null } }, plan, e);
    const html = renderToStaticMarkup(createElement(ObservationCapture, { evidence: e as Evidence, packet: packet as HostObservationPacket, busy: false, submit: async () => true }));
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>copied()");
    expect(html).toContain("No answer captured"); expect(html).toContain("Tool results not captured");
    expect(html).toContain("Synthetic fixture"); expect(html).toContain("does not authenticate the observer");
  });
  it("requires an in-page confirmation to clear captured text without deleting exports", () => {
    const html = renderToStaticMarkup(createElement(SessionClearConfirmation, { busy: false, cancel: () => {}, confirm: () => {} }));
    expect(html).toContain("Clear session confirmation"); expect(html).toContain("Keep session");
    expect(html).toContain("Confirm clear session"); expect(html).toContain("Previously downloaded files will not be deleted");
  });
  it("disables both clearing actions while a request is pending", () => {
    const html = renderToStaticMarkup(createElement(SessionClearConfirmation, { busy: true, cancel: () => {}, confirm: () => {} }));
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });
});
