/**
 * GET /api/logo?slug=<slug>
 *
 * The organization's own logo, pulled out of its concept page so cards on the
 * landing page get a mark without anyone uploading one. Concepts are dropped
 * in as finished HTML, and every one of them puts the org's logo as the first
 * image in its header, so that is what we read.
 *
 * Two shapes turn up in practice: the logo inlined as a data URI (PoCo
 * Pirates) or pointed at the organization's own CDN (PoCo Saints). Both are
 * served back from this origin so the card never depends on a third party's
 * CORS or referrer rules, and both are cached hard at the edge.
 *
 * Anything unexpected is a 404 with a short cache, and the card falls back to
 * the lettering it has always had.
 */

const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ico: 'image/x-icon',
};
const MAX_BYTES = 3 * 1024 * 1024;

function miss(res, why) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(404).send(why);
}

function privateHost(h) {
  return /^(localhost|\[?::1\]?|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(h);
}

/* The logo is the first image in the page header; fall back to the first image
   anywhere, which is the same element on every concept built so far. */
function findLogo(html) {
  const head = html.search(/<header[\s>]/i);
  const body = head > -1 ? html.slice(head, head + 4000) : '';
  for (const chunk of [body, html]) {
    const m = chunk.match(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i);
    if (m) return m[1];
  }
  return null;
}

module.exports = async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').trim();
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(400).send('bad slug');

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return miss(res, 'no host');
  const proto = /^localhost|^127\./.test(host) ? 'http' : 'https';
  const page = `${proto}://${host}/concepts/${slug}`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const up = await fetch(page, { signal: ctl.signal, headers: { 'User-Agent': 'TCBConcepts/1.0' } });
    if (!up.ok) return miss(res, 'no concept');
    const html = await up.text();

    const src = findLogo(html);
    if (!src) return miss(res, 'no logo in page');

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    // Inlined logo: decode and serve it directly.
    const data = src.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
    if (data) {
      const buf = Buffer.from(data[2], 'base64');
      if (!buf.length || buf.length > MAX_BYTES) return miss(res, 'bad inline logo');
      res.setHeader('Content-Type', data[1]);
      return res.status(200).send(buf);
    }

    // Otherwise resolve it against the concept and fetch it through this origin.
    let target;
    try { target = new URL(src, page + '/'); } catch { return miss(res, 'bad logo url'); }
    if (!/^https?:$/.test(target.protocol)) return miss(res, 'bad logo protocol');
    if (privateHost(target.hostname)) return miss(res, 'private host');

    const img = await fetch(target.href, { signal: ctl.signal, headers: { 'User-Agent': 'TCBConcepts/1.0' } });
    if (!img.ok) return miss(res, 'logo unreachable');
    const buf = Buffer.from(await img.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) return miss(res, 'logo too big');

    const ext = (target.pathname.split('.').pop() || '').toLowerCase();
    const type = TYPES[ext] || img.headers.get('content-type') || 'application/octet-stream';
    if (!/^image\//.test(type)) return miss(res, 'not an image');
    res.setHeader('Content-Type', type);
    return res.status(200).send(buf);
  } catch (e) {
    return miss(res, 'logo lookup failed');
  } finally { clearTimeout(timer); }
};
