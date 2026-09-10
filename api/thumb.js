/**
 * GET /api/thumb?url=https://example.org
 *
 * Screenshot thumbnail of a public site for the admin. Fetched server-side
 * from the screenshot service (which refuses browser referrers) and cached
 * at the edge for a day, so each site is captured about once daily.
 */
function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

module.exports = async function handler(req, res) {
  let url = String((req.query && req.query.url) || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  let t;
  try { t = new URL(url); if (!/^https?:$/.test(t.protocol)) throw 0; } catch { return res.status(400).send('bad url'); }
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(t.hostname)) return res.status(400).send('public sites only');

  const w = Math.min(1600, Math.max(300, parseInt(req.query.w, 10) || 900));
  const h = Math.min(1200, Math.max(200, parseInt(req.query.h, 10) || 600));
  const src = `https://image.thum.io/get/width/${w}/crop/${h}/noanimate/${t.href}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const up = await fetch(src, { signal: ctl.signal, headers: { 'User-Agent': 'TCBConcepts/1.0' } });
    if (!up.ok) return res.status(502).send('screenshot unavailable');
    const buf = Buffer.from(await up.arrayBuffer());
    res.setHeader('Content-Type', up.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(504).send('screenshot timed out');
  } finally { clearTimeout(timer); }
};
