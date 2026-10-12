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
import type { Bootstrap, Evidence, Plan, Report } from "../src/review/types";
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
});
