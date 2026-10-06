import { pathToFileURL } from "node:url";

import app from "./app.mjs";

const DEFAULT_PORT = 8787;

export function startServer(
  port = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT,
  host = process.env.HOST || "0.0.0.0",
) {
  const server = app.listen(port, host, () => {
    console.log(`Writing Assistant listening on http://${host}:${port} (MCP: /mcp)`);
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
