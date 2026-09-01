const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8787";

const statusResponse = await fetch(`${baseUrl}/api/status`);
if (!statusResponse.ok) throw new Error(`Status check failed with ${statusResponse.status}.`);
const status = await statusResponse.json();
if (!status.ready) throw new Error("The API is not ready. Check the local environment configuration.");

const revisionResponse = await fetch(`${baseUrl}/api/revise`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    mode: "edit",
    ceiling: false,
    direction: "Make the claim precise without changing its facts.",
    draft: "The library program was really very successful and it helped a lot of people in the community.",
  }),
});

const body = await revisionResponse.json();
if (!revisionResponse.ok) throw new Error(body.error ?? `Revision failed with ${revisionResponse.status}.`);
if (typeof body.result !== "string" || body.result.trim().length < 10) {
  throw new Error("Revision response did not contain usable text.");
}
if (body.meta?.pipeline?.version !== "1.0") {
  throw new Error("Revision response did not include bounded pipeline metadata.");
}
if (!Array.isArray(body.meta.pipeline.selectedConcepts)) {
  throw new Error("Revision response did not report its selected writing methods.");
}

console.log(
  `Live smoke test passed (${body.meta?.model ?? "configured model"}, methods=${body.meta.pipeline.selectedConcepts.length}, audit=${body.meta.pipeline.auditDisposition}, grounded=${Boolean(body.meta?.grounded)}).`,
);
