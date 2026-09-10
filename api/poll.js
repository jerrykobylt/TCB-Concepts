/**
 * POST /api/poll — concept feedback from the slide-out poll on concept pages.
 *
 * Body: { slug, feedback, rating, page, company }
 * Writes one row to concept_feedback through the publishable key, which
 * row-level security limits to insert only.
 */

const RATINGS = new Set(['worse', 'same', 'better', 'remarkable']);

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  // Honeypot.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const slug = clean(body.slug, 80);
  const rating = clean(body.rating, 20).toLowerCase();
  const feedback = clean(body.feedback, 2000) || null;
  const page = clean(body.page, 300) || null;
  const ua = clean(req.headers['user-agent'] || '', 300) || null;

  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(400).json({ ok: false, error: 'bad slug' });
  if (!RATINGS.has(rating)) return res.status(400).json({ ok: false, error: 'bad rating' });

  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY');
  if (!url || !key) return res.status(503).json({ ok: false, reason: 'not_configured' });

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/concept_feedback`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ project_slug: slug, feedback, rating, page, user_agent: ua }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error('[concepts] poll insert failed:', r.status, txt);
      // A slug with no project row fails the foreign key; say so plainly.
      return res.status(r.status === 409 ? 404 : 502).json({ ok: false, reason: r.status === 409 ? 'unknown_project' : 'save_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[concepts] poll error:', err && err.message);
    return res.status(502).json({ ok: false, reason: 'save_failed' });
  }
};
