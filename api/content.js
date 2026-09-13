/**
 * GET /api/content
 *
 * The front page's editable copy and images, written by the admin's Page
 * settings into site/content.json in the concepts bucket. Keys match the
 * data-cms attributes on the page. Always answers with an object, so a page
 * that cannot reach this simply keeps the copy it shipped with.
 */

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Short at the edge, revalidated by the browser: an edit should show up on
  // the next load, not the next deploy.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const base = env('SUPABASE_URL');
  if (!base) return res.status(200).send('{}');

  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/storage/v1/object/public/concepts/site/content.json`);
    if (!r.ok) return res.status(200).send('{}');
    const text = await r.text();
    const data = JSON.parse(text); // never hand the page something that is not JSON
    if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(200).send('{}');
    return res.status(200).send(JSON.stringify(data));
  } catch {
    return res.status(200).send('{}');
  }
};
