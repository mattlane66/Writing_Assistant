import { pathToFileURL } from "node:url";

import app from "./app.mjs";

const DEFAULT_PORT = 8787;

export function startServer(port = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT) {
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`Writing Assistant API listening on http://127.0.0.1:${port}`);
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
