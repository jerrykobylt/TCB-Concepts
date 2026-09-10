/**
 * GET /api/listings
 *
 * What the landing page shows under "The work". Merges two sources:
 *   1. projects rows that are listed (narrow public columns, via RLS), and
 *   2. folders in the "concepts" storage bucket that have no project row yet,
 *      so a concept dropped into the bucket appears at once with a plain card.
 */

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

function humanize(slug) {
  return slug.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  const base = env('SUPABASE_URL');
  const key = env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY');
  if (!base || !key) return res.status(503).json({ ok: false, reason: 'not_configured' });
  const url = base.replace(/\/$/, '');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const [rowsRes, foldersRes] = await Promise.all([
    fetch(`${url}/rest/v1/projects?select=slug,name,org_name,org_type,status,summary,concept_url,current_url,tags,card_label,card_bg,card_fg,sort,updated_at&order=sort.asc,updated_at.desc`, { headers }).catch(() => null),
    fetch(`${url}/storage/v1/object/list/concepts`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 200, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    }).catch(() => null),
  ]);

  const rows = rowsRes && rowsRes.ok ? await rowsRes.json().catch(() => []) : [];
  const entries = foldersRes && foldersRes.ok ? await foldersRes.json().catch(() => []) : [];
  // Folders come back as entries with no id; files at the root have one.
  const folders = entries.filter(e => e && !e.id && /^[a-z0-9-]+$/.test(e.name)).map(e => e.name);

  const bySlug = new Map(rows.map(r => [r.slug, r]));
  const items = rows.map(r => ({
    slug: r.slug,
    name: r.name,
    org: r.org_name,
    kind: r.org_type || '',
    status: r.status,
    summary: r.summary || '',
    tags: r.tags || [],
    label: r.card_label || '',
    bg: r.card_bg || '',
    fg: r.card_fg || '',
    url: r.concept_url || (folders.includes(r.slug) ? `/concepts/${r.slug}/` : null),
    current: r.current_url || null,
    live: !!(r.concept_url || folders.includes(r.slug)),
  }));

  for (const f of folders) {
    if (bySlug.has(f)) continue;
    items.push({
      slug: f, name: humanize(f), org: humanize(f), kind: '', status: 'concept', summary: '',
      tags: [], label: 'New concept', bg: '', fg: '', url: `/concepts/${f}/`, current: null, live: true,
    });
  }

  return res.status(200).json({ ok: true, items });
};
