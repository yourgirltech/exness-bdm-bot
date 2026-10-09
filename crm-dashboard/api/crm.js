// Server-side proxy: keeps the n8n URL and dashboard key out of the browser.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.N8N_CRM_URL;
  const key = process.env.DASHBOARD_KEY;
  if (!url || !key) {
    return res.status(200).json({ ok: false, source: 'unconfigured' });
  }
  try {
    const upstream = await fetch(url, {
      headers: { 'x-dashboard-key': key, 'ngrok-skip-browser-warning': '1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return res.status(200).json({ ok: false, source: 'upstream_' + upstream.status });
    }
    const data = await upstream.json();
    return res.status(200).json({ ...data, source: 'live' });
  } catch (err) {
    return res.status(200).json({ ok: false, source: 'offline' });
  }
}
