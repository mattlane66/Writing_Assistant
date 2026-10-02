'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { VERSION, SUPPORTED_VERSIONS, handleRequest, errorResponse } = require('./core');
const MAX_BODY = 2_000_000;
function send(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function allowedOrigins(req) {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (process.env.WIDGET_ORIGIN) origins.push(process.env.WIDGET_ORIGIN);
  for (const key of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']) if (process.env[key]) origins.push(`https://${process.env[key]}`);
  if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.localAddress)) {
    origins.push(`http://127.0.0.1:${req.socket.localPort}`, `http://localhost:${req.socket.localPort}`, `http://[::1]:${req.socket.localPort}`);
  }
  return origins;
}
function checkHeaders(message, req) {
  const headerVersion = req.headers['mcp-protocol-version'];
  const bodyVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const modern = headerVersion === '2026-07-28' || bodyVersion === '2026-07-28';
  const id = message && Object.hasOwn(message, 'id') ? message.id : null;
  if (headerVersion && !SUPPORTED_VERSIONS.includes(headerVersion)) return errorResponse(id, -32022, 'Unsupported protocol version.', { supported: SUPPORTED_VERSIONS });
  if (headerVersion && bodyVersion && headerVersion !== bodyVersion) return errorResponse(id, -32020, 'MCP-Protocol-Version does not match the body.');
  if (modern && Object.hasOwn(message, 'id')) {
    if (!headerVersion || !bodyVersion || !req.headers['mcp-method']) return errorResponse(id, -32020, 'Modern requests require matching MCP-Protocol-Version, Mcp-Method, and body protocol metadata.');
    const name = message.method === 'tools/call' ? message.params?.name : message.method === 'resources/read' ? message.params?.uri : undefined;
    if (name !== undefined && req.headers['mcp-name'] !== name) return errorResponse(id, -32020, 'Mcp-Name does not match the tool or resource name.');
  }
  if (req.headers['mcp-method'] && req.headers['mcp-method'] !== message?.method) return errorResponse(id, -32020, 'Mcp-Method does not match the body.');
  return null;
}
function handleHttp(req, res) {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    send(res, 200, { ok: true, service: 'writing-diagnostic', version: VERSION }); return;
  }
  if (req.method === 'GET' && (pathname === '/.well-known/openai-apps-challenge' || pathname === '/api/openai-apps-challenge')) {
    const token = process.env.OPENAI_APPS_CHALLENGE;
    if (!token || /[\r\n]/.test(token)) { send(res, 404, { error: 'Challenge not configured.' }); return; }
    res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(token); return;
  }
  if (pathname !== '/mcp' && pathname !== '/api/mcp') {
    const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/preview.html': ['preview.html', 'text/html; charset=utf-8'], '/sample-diagnostic.json': ['sample-diagnostic.json', 'application/json'], '/diagnostic-widget.html': ['diagnostic-widget.html', 'text/html; charset=utf-8'], '/assets/icon.svg': ['assets/icon.svg', 'image/svg+xml'] };
    if (req.method === 'GET' && Object.hasOwn(files, pathname)) {
      const [name, type] = files[pathname];
      const file = path.join(__dirname, '..', 'public', name);
      if (fs.existsSync(file)) {
        res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-cache' }); res.end(fs.readFileSync(file)); return;
      }
    }
    send(res, 404, { error: 'Not found.' }); return;
  }
  const origin = req.headers.origin;
  if (origin && !allowedOrigins(req).includes(origin)) { send(res, 403, { error: 'Origin is not allowed.' }); return; }
  const cors = origin ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name' } : {};
  if (req.method === 'OPTIONS') { send(res, 204, undefined, cors); return; }
  if (req.method !== 'POST') { send(res, 405, { error: 'Only POST is supported.' }, { ...cors, allow: 'POST, OPTIONS' }); return; }
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { send(res, 415, { error: 'Content-Type must be application/json.' }, cors); return; }
  const accept = req.headers.accept || '*/*';
  if (!accept.includes('application/json') && !accept.includes('*/*')) { send(res, 406, { error: 'Accept must allow application/json.' }, cors); return; }
  let finished = false;
  const dispatch = raw => {
    if (finished) return;
    finished = true;
    let message;
    try {
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY) { send(res, 413, { error: 'Request too large.' }, cors); return; }
      message = JSON.parse(raw);
    } catch (_) { send(res, 400, errorResponse(null, -32700, 'Invalid JSON.'), cors); return; }
    if (message && typeof message === 'object' && !Array.isArray(message)) {
      const error = checkHeaders(message, req);
      if (error) { send(res, 400, error, cors); return; }
    }
    const response = handleRequest(message, { protocolVersion: req.headers['mcp-protocol-version'] });
    send(res, response ? (response.error?.code === -32600 ? 400 : 200) : 202, response || undefined, cors);
  };
  // Serverless hosts may already have parsed the request body.
  if (req.body !== undefined) { dispatch(typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)); return; }
  const chunks = []; let size = 0;
  req.on('data', chunk => {
    if (finished) return;
    size += chunk.length;
    if (size > MAX_BODY) { finished = true; send(res, 413, { error: 'Request too large.' }, cors); return; }
    chunks.push(chunk);
  });
  req.on('end', () => dispatch(Buffer.concat(chunks).toString('utf8')));
  req.on('error', () => { finished = true; send(res, 400, { error: 'Could not read request.' }, cors); });
}
module.exports = { handleHttp, MAX_BODY };
