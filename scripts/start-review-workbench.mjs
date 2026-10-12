import { createReviewWorkbench } from "../server/review-workbench.mjs";
const port = Number(process.env.WRITING_REVIEW_PORT || 8791);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("Choose an unprivileged local review port.");
const origin = `http://127.0.0.1:${port}`;
const server = createReviewWorkbench({ origin }).listen(port, "127.0.0.1", () => console.log(`Private writing-review workbench: ${origin}/review.html — no provider calls or server persistence.`));
server.on("error", () => { console.error("The local review port is unavailable; no private input is logged."); process.exitCode = 1; });
