/**
 * GET /concepts/<slug>/<path>  (rewritten here by vercel.json)
 *
 * Serves a concept site straight out of the Supabase "concepts" bucket, so
 * dropping a folder into the bucket publishes it at /concepts/<slug>/ with
 * no deploy. Static concepts committed under public/concepts/ still win,
 * because Vercel checks the filesystem before rewrites.
 *
 * If the file is an HTML page and does not already include the Concepts
 * bar, the bar is injected before </body> with the slug attached, so the
 * poll and navigation work without editing the dropped files.
 */

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

const TYPES = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', pdf: 'application/pdf',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', xml: 'application/xml', webmanifest: 'application/manifest+json',
};

/* The prospect's existing site, read from the project row. Never fatal: if
   this is not configured or the lookup fails, the page still serves and the
   bar just omits the link, exactly as it did before. */
async function currentUrl(base, slug) {
  const key = env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY');
  if (!key) return '';
  const url = `${base.replace(/\/$/, '')}/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=current_url&limit=1`;
  try {
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return '';
    const rows = await r.json();
    const u = Array.isArray(rows) && rows[0] && rows[0].current_url;
    return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '';
  } catch { return ''; }
}

module.exports = async function handler(req, res) {
  const base = env('SUPABASE_URL');
  if (!base) return res.status(503).send('Storage not configured');

  // Path arrives as ?path=<slug>/<rest> from the rewrite.
  let p = String((req.query && req.query.path) || '').replace(/^\/+/, '');
  p = p.split('/').filter(Boolean).map(decodeURIComponent).join('/');
  if (!p || p.includes('..')) return res.status(404).send('Not found');

  const segs = p.split('/');
  const slug = segs[0];
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(404).send('Not found');

  // vercel.json strips trailing slashes, so /concepts/<slug> is the canonical
  // page URL. Serve index.html for it and for any extensionless path, and
  // inject a <base> so the page's relative assets still resolve under the slug.
  let injectBase = false;
  if (segs.length === 1) { p = `${slug}/index.html`; injectBase = true; }
  else if (!/\.[a-z0-9]+$/i.test(p)) { p = p.replace(/\/?$/, '/index.html'); injectBase = true; }

  const url = `${base.replace(/\/$/, '')}/storage/v1/object/public/concepts/${p.split('/').map(encodeURIComponent).join('/')}`;
  let up;
  try { up = await fetch(url); } catch { return res.status(502).send('Storage unreachable'); }
  if (up.status === 404 || up.status === 400) return res.status(404).send('Not found');
  if (!up.ok) return res.status(502).send('Storage error');

  const ext = (p.split('.').pop() || '').toLowerCase();
  const type = TYPES[ext] || up.headers.get('content-type') || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (ext === 'html' || ext === 'htm') {
    let html = await up.text();
    if (injectBase && !/<base\s/i.test(html)) {
      const dir = p.split('/').slice(0, -1).map(encodeURIComponent).join('/');
      const baseTag = `<base href="/concepts/${dir}/">`;
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + baseTag) : baseTag + html;
    }
    if (!/tcb-bar\.js/.test(html)) {
      const title = (html.match(/<title>([^<]*)<\/title>/i) || [, slug])[1].trim().split(/\s[—|–-]\s/)[0];
      // The bar only offers "View current website" when it is told where that
      // is, so hand it the project's current_url. A concept dropped in the
      // bucket with no project row simply does not get the link.
      const current = await currentUrl(base, slug);
      const tag = `<script src="/tcb-bar.js" data-concept="${escapeAttr(title)}" data-slug="${slug}"` +
        (current ? ` data-current="${escapeAttr(current)}"` : '') + ` defer></script>`;
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, tag + '\n</body>') : html + tag;
    }
    return res.status(200).send(html);
  }

  const buf = Buffer.from(await up.arrayBuffer());
  return res.status(200).send(buf);
};

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
