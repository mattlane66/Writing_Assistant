#!/usr/bin/env node
'use strict';
const http = require('node:http');
const { handleHttp } = require('./http-handler');
function createServer() { return http.createServer(handleHttp); }
if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, host, () => process.stderr.write(`[writing-diagnostic] Listening on http://${host}:${port}/mcp\n`));
}
module.exports = { createServer };
