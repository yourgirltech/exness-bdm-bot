// Local dev server for the CRM dashboard: serves the static page and proxies
// /api/crm straight to the local n8n webhook (no tunnel needed).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const N8N_CRM_URL = process.env.N8N_CRM_URL || 'http://localhost:5678/webhook/exness-crm';
const DASHBOARD_KEY = process.env.DASHBOARD_KEY;
if (!DASHBOARD_KEY) {
  console.error('DASHBOARD_KEY is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/crm') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const upstream = await fetch(N8N_CRM_URL, { headers: { 'x-dashboard-key': DASHBOARD_KEY }, signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) return res.end(JSON.stringify({ ok: false, source: 'upstream_' + upstream.status }));
      const data = await upstream.json();
      return res.end(JSON.stringify({ ...data, source: 'live' }));
    } catch {
      return res.end(JSON.stringify({ ok: false, source: 'offline' }));
    }
  }
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
  if (!file.startsWith(ROOT) || file.includes(join(ROOT, 'api'))) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`CRM dashboard running at http://localhost:${PORT}`));
