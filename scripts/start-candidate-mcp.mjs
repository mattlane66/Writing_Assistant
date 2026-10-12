import { createApp } from "../server/app.mjs";
// Local test surface deliberately disables the optional paid-provider API even
// if a credential is inherited. MCP operations make no model calls.
const server = createApp({ enableRevisionApi: false }).listen(8792, "127.0.0.1", () => {
  console.log("Local candidate MCP: http://127.0.0.1:8792/mcp (provider revision API disabled)");
});
server.on("error", () => { console.error("The local candidate port is unavailable; no alternate host was opened."); process.exitCode = 1; });
