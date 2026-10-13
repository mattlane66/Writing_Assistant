import express from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReliabilityPlan, emptyReliabilityEvidence } from "../evals/reliability-service.mjs";
import { importWorkspace, appendHumanReview, appendSourceAudit, validateBlindPacket, lockBlindRatings, sourceAuditBatch } from "../evals/review-workbench.mjs";
import { loadConceptRegistry } from "./concept-registry.mjs";
import { loadSourceCards } from "./source-cards.mjs";
import { emptyHostObservations, validateHostObservations, appendHostObservation } from "../evals/host-observations.mjs";

export function createReviewWorkbench({ origin = "http://127.0.0.1:8791", buildDirectory = new URL("../.review-dist/", import.meta.url),
  planProvider = buildReliabilityPlan, catalogProvider = async () => {
    const registry = await loadConceptRegistry(); return { methods: registry.concepts, cards: (await loadSourceCards({ registry })).cards };
  } } = {}) {
  const url = new URL(origin);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/" || url.search || url.username || url.password) throw new TypeError("The review workbench must use a loopback-only origin.");
  const app = express(); app.disable("x-powered-by"); const token = randomBytes(32).toString("hex");
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
    if (req.headers.host !== url.host || (req.headers.origin && req.headers.origin !== url.origin)
      || req.headers["sec-fetch-site"] === "cross-site") return res.status(403).json({ error: "This private review surface accepts same-origin loopback requests only." });
    if (req.method !== "GET") {
      const provided = req.get("x-review-token") ?? "";
      if (!/^[a-f0-9]{64}$/.test(provided) || !timingSafeEqual(Buffer.from(provided), Buffer.from(token))) return res.status(403).json({ error: "Reload the local review page before submitting evidence." });
    }
    next();
  });
  app.use(express.json({ limit: "16mb", strict: true }));
  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.get("/api/review/bootstrap", async (_req, res, next) => {
    try { const [plan, catalog] = await Promise.all([planProvider(), catalogProvider()]);
      const workspace = emptyReliabilityEvidence(plan);
      res.json({ token, plan, catalog, workspace, observations: emptyHostObservations(plan), report: importWorkspace(workspace, plan).report, batch: sourceAuditBatch(plan), provider_calls: 0 });
    } catch { next(new Error("Review knowledge is unavailable.")); }
  });
  app.post("/api/review/:operation", async (req, res, next) => {
    try {
      const body = req.body;
      const fields = { import: ["evidence"], review: ["evidence", "review"], "source-audit": ["evidence", "audit"],
        "blind-import": ["packet"], "blind-lock": ["packet", "ratings"],
        "observations-import": ["observations"], observe: ["observations", "observation", "evidence"] }[req.params.operation];
      if (!fields || !body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).length !== fields.length || !fields.every(f => Object.hasOwn(body, f))) throw new TypeError("Unsupported review request.");
      if (req.params.operation === "blind-import") return res.json({ packet: validateBlindPacket(body.packet) });
      if (req.params.operation === "blind-lock") return res.json({ ratings: lockBlindRatings(body.packet, body.ratings) });
      const plan = await planProvider();
      if (req.params.operation === "observations-import") return res.json({ observations: validateHostObservations(body.observations, plan) });
      if (req.params.operation === "observe") return res.json({ observations: appendHostObservation(body.observations, body.observation, plan, body.evidence) });
      const result = req.params.operation === "import" ? importWorkspace(body.evidence, plan)
        : req.params.operation === "review" ? appendHumanReview(body.evidence, body.review, plan)
        : appendSourceAudit(body.evidence, body.audit, plan);
      res.json(result);
    } catch { next(new TypeError("Review data invalid, stale, incomplete or already locked. No private text is included in this error.")); }
  });
  // Evidence is never saved, logged, cached, uploaded onward or retained as
  // application state. The browser owns the session and explicit exports.
  const root = buildDirectory instanceof URL ? fileURLToPath(buildDirectory) : resolve(buildDirectory);
  app.use(express.static(root, { index: "review.html", dotfiles: "deny", fallthrough: true }));
  app.use((_req, res) => res.status(404).json({ error: "Review route not found." }));
  app.use((error, _req, res, next) => {
    void next; // Express recognizes error handlers by their four-argument arity.
    res.status(error.type === "entity.too.large" ? 413 : error instanceof TypeError || error.status === 400 ? 400 : 503)
      .json({ error: "The local review request could not be completed. Check its format, fingerprint, completeness and locked records; private input is not echoed." });
  });
  return app;
}
