/**
 * POST /api/scan   { url, slug? }
 *
 * AI Site Intelligence. Reads a prospect's public website, measures what can
 * be measured without a browser (platform signatures, structure, weight,
 * basic SEO and accessibility signals), then asks OpenAI to write the report
 * in the Board's voice. The row is saved to site_scans as the caller.
 *
 * Caller must be a signed-in admin (Supabase access token in Authorization).
 */

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

const UA = 'Mozilla/5.0 (compatible; TCBConceptsScan/1.0; +https://www.tcbconcepts.org)';
const MAX_BYTES = 2_500_000;

async function fetchText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 15000);
  const started = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }, redirect: 'follow', signal: ctl.signal });
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: r.ok, status: r.status, url: r.url, headers: Object.fromEntries(r.headers.entries()), bytes: buf.length, text: buf.subarray(0, MAX_BYTES).toString('utf8'), ms: Date.now() - started };
  } finally { clearTimeout(t); }
}

const SIGNATURES = [
  ['WordPress', 'CMS', /wp-content\/|wp-includes\/|<meta name="generator" content="WordPress/i],
  ['Wix', 'Website builder', /static\.wixstatic\.com|wix\.com\/|X-Wix-/i],
  ['Squarespace', 'Website builder', /squarespace\.com|static1\.squarespace|Squarespace/i],
  ['Shopify', 'E-commerce', /cdn\.shopify\.com|Shopify\.theme/i],
  ['Webflow', 'Website builder', /webflow\.com|data-wf-page/i],
  ['Weebly', 'Website builder', /weebly\.com|weeblycloud/i],
  ['GoDaddy Website Builder', 'Website builder', /godaddy|wsimg\.com/i],
  ['Joomla', 'CMS', /\/media\/jui\/|content="Joomla/i],
  ['Drupal', 'CMS', /drupal-settings-json|\/sites\/default\/files/i],
  ['TeamSnap', 'Sports management', /teamsnap/i],
  ['SportsEngine', 'Sports management', /sportsengine|sportngin/i],
  ['RAMP Interactive', 'Sports management', /rampinteractive|rampregistrations/i],
  ['GOALLINE', 'Sports management', /goalline\.ca/i],
  ['LeagueApps', 'Sports management', /leagueapps/i],
  ['Duda', 'Website builder', /duda\.co|dudamobile|window\.dmAPI/i],
  ['Google Sites', 'Website builder', /sites\.google\.com|googleusercontent\.com\/sites/i],
  ['Next.js', 'Framework', /__NEXT_DATA__|\/_next\//i],
  ['React', 'Framework', /data-reactroot|react-dom|__reactContainer/i],
  ['Vue', 'Framework', /data-v-[a-f0-9]{8}|vue\.runtime|__vue__/i],
  ['Angular', 'Framework', /ng-version=|ng-app/i],
  ['jQuery', 'JavaScript library', /jquery[-.\d]*\.min\.js|jquery\.js/i],
  ['Bootstrap', 'CSS framework', /bootstrap[-.\d]*\.min\.css|bootstrap\.css/i],
  ['Tailwind CSS', 'CSS framework', /tailwindcss|class="[^"]*\b(?:sm|md|lg):[a-z-]+/i],
  ['Elementor', 'Page builder', /elementor/i],
  ['Divi', 'Page builder', /et_pb_|themes\/Divi\//i],
  ['Google Analytics', 'Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i],
  ['Google Tag Manager', 'Tag manager', /googletagmanager\.com\/gtm/i],
  ['Meta Pixel', 'Analytics', /connect\.facebook\.net|fbq\(/i],
  ['Cloudflare', 'CDN / proxy', /cloudflare|cf-ray/i],
  ['Google Fonts', 'Fonts', /fonts\.googleapis\.com/i],
  ['Font Awesome', 'Icons', /font-awesome|fontawesome/i],
  ['reCAPTCHA', 'Anti-spam', /recaptcha/i],
  ['Mailchimp', 'Email marketing', /mailchimp|list-manage\.com/i],
  ['Stripe', 'Payments', /js\.stripe\.com/i],
  ['PayPal', 'Payments', /paypal\.com/i],
  ['YouTube embeds', 'Media', /youtube\.com\/embed|youtu\.be/i],
  ['Facebook embeds', 'Media', /facebook\.com\/plugins/i],
  ['Instagram embeds', 'Media', /instagram\.com\/embed|instagram\.com\/p\//i],
];

function measure(html, res, base) {
  const h = html;
  const lower = h.toLowerCase();
  const count = (re) => (h.match(re) || []).length;
  const title = (h.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ''])[1].trim();
  const metaDesc = (h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || h.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [, ''])[1].trim();
  const generator = (h.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i) || [, ''])[1].trim();
  const imgs = h.match(/<img\b[^>]*>/gi) || [];
  const imgsNoAlt = imgs.filter(t => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;
  const links = h.match(/<a\b[^>]*href=["']([^"'#]+)["']/gi) || [];
  let internal = 0, external = 0, pdf = 0, mailto = 0, tel = 0;
  const host = new URL(base).host.replace(/^www\./, '');
  const social = new Set();
  links.forEach(t => {
    const href = (t.match(/href=["']([^"']+)["']/i) || [, ''])[1];
    if (/^mailto:/i.test(href)) { mailto++; return; }
    if (/^tel:/i.test(href)) { tel++; return; }
    if (/\.pdf(\?|$)/i.test(href)) pdf++;
    try {
      const u = new URL(href, base);
      if (u.host.replace(/^www\./, '') === host) internal++; else external++;
      const m = u.host.match(/(facebook|instagram|twitter|x\.com|youtube|tiktok|linkedin)/i);
      if (m) social.add(m[1].toLowerCase().replace('x.com', 'x'));
    } catch {}
  });
  const stack = SIGNATURES.filter(([, , re]) => re.test(h) || re.test(JSON.stringify(res.headers))).map(([name, role]) => ({ name, role }));
  if (generator && !stack.some(s => new RegExp(s.name, 'i').test(generator))) stack.unshift({ name: generator, role: 'Generator (declared)' });
  const text = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
  const navItems = (h.match(/<nav\b[\s\S]*?<\/nav>/gi) || []).map(n => (n.match(/<a\b/gi) || []).length);
  return {
    finalUrl: res.url, status: res.status, responseMs: res.ms, htmlBytes: res.bytes, https: /^https:/i.test(res.url),
    server: res.headers['server'] || null, poweredBy: res.headers['x-powered-by'] || null, lastModified: res.headers['last-modified'] || null,
    title, titleLength: title.length, metaDescription: metaDesc ? metaDesc.slice(0, 200) : null, generator: generator || null,
    viewportMeta: /<meta[^>]+name=["']viewport["']/i.test(h),
    canonical: /<link[^>]+rel=["']canonical["']/i.test(h),
    openGraph: /<meta[^>]+property=["']og:/i.test(h),
    structuredData: /application\/ld\+json/i.test(h),
    favicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(h),
    lang: (h.match(/<html[^>]+lang=["']([^"']+)["']/i) || [, null])[1],
    h1Count: count(/<h1\b/gi), h2Count: count(/<h2\b/gi),
    imageCount: imgs.length, imagesMissingAlt: imgsNoAlt,
    linkCount: links.length, internalLinks: internal, externalLinks: external, pdfLinks: pdf, mailtoLinks: mailto, telLinks: tel,
    navLinkCounts: navItems, largestNav: navItems.length ? Math.max.apply(null, navItems) : 0,
    formCount: count(/<form\b/gi), iframeCount: count(/<iframe\b/gi), scriptCount: count(/<script\b/gi), stylesheetCount: count(/<link[^>]+rel=["']stylesheet["']/gi),
    inlineStyleAttrs: count(/\sstyle=["']/gi), tables: count(/<table\b/gi), flashOrJava: /\.swf|<applet/i.test(lower),
    socialLinks: Array.from(social), hasSearch: /type=["']search["']|placeholder=["'][^"']*search/i.test(h),
    copyrightYear: (h.match(/(?:©|&copy;|copyright)\s*(\d{4})/i) || [, null])[1],
    stack, textSample: text.slice(0, 3500), wordCount: text.split(' ').length,
  };
}

async function openai(apiKey, messages) {
  const models = [env('OPENAI_MODEL') || 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  let lastErr = 'no model';
  for (const model of models) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.3, response_format: { type: 'json_object' }, messages }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.choices && data.choices[0]) return { ok: true, model, text: data.choices[0].message.content || '{}' };
    lastErr = (data.error && data.error.message) || `OpenAI ${r.status}`;
    if (!/model|not found|does not exist|access|response_format/i.test(lastErr)) break;
  }
  return { ok: false, error: lastErr };
}

async function sbFetch(base, key, token, path, init) {
  const r = await fetch(`${base}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init && init.headers) } });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'POST only' }); }

  const base = (env('SUPABASE_URL') || '').replace(/\/$/, '');
  const key = env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY');
  const apiKey = env('OPEN_AI_ANALYZER') || env('OPENAI_API_KEY');
  if (!base || !key) return res.status(503).json({ ok: false, reason: 'not_configured' });
  if (!apiKey) return res.status(503).json({ ok: false, reason: 'no_openai_key' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ ok: false, error: 'sign in' });

  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  let url = String((body && body.url) || '').trim();
  const slug = String((body && body.slug) || '').trim() || null;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  let target;
  try { target = new URL(url); if (!/^https?:$/.test(target.protocol)) throw 0; } catch { return res.status(400).json({ ok: false, error: 'Enter a full website address.' }); }
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(target.hostname)) return res.status(400).json({ ok: false, error: 'Public websites only.' });
  if (slug && !/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(400).json({ ok: false, error: 'bad slug' });

  const who = await sbFetch(base, key, token, '/rest/v1/rpc/is_admin', { method: 'POST', body: '{}' });
  if (!who.ok || who.data !== true) return res.status(403).json({ ok: false, error: 'not an admin' });

  // 1. Read the site.
  let page;
  try { page = await fetchText(target.href, 15000); }
  catch (e) { return res.status(502).json({ ok: false, error: 'Could not reach that site: ' + (e && e.name === 'AbortError' ? 'timed out' : (e && e.message) || 'unknown error') }); }
  if (!page.ok) return res.status(502).json({ ok: false, error: `The site answered ${page.status}.` });
  const signals = measure(page.text, page, target.href);

  // Cheap extras: robots and sitemap, best effort.
  try {
    const rb = await fetchText(new URL('/robots.txt', page.url).href, 6000);
    signals.robots = rb.ok ? { present: true, disallowAll: /disallow:\s*\/\s*$/im.test(rb.text), sitemapDeclared: /sitemap:/i.test(rb.text) } : { present: false };
  } catch { signals.robots = { present: false }; }
  try {
    const sm = await fetchText(new URL('/sitemap.xml', page.url).href, 6000);
    signals.sitemap = sm.ok && /<urlset|<sitemapindex/i.test(sm.text) ? { present: true, urls: (sm.text.match(/<loc>/gi) || []).length } : { present: false };
  } catch { signals.sitemap = { present: false }; }

  // 2. Ask for the report.
  const { textSample, ...facts } = signals;
  const messages = [
    { role: 'system', content: `You write for Tri-Cities Board Concepts, which rebuilds websites for local organizations in Port Coquitlam, Port Moody, Coquitlam and Anmore. Plain, direct, specific. Short sentences. No hype words. Canadian spelling. Never invent facts: everything you say must follow from the measurements or the page text provided. If a measurement is missing, do not guess.

Return strictly JSON with this shape:
{
 "summary": "3 to 5 sentences: what the site runs on, what it is for, what is wrong with it, what a rebuild should preserve.",
 "scores": { "modernization_need": "Low|Medium|High", "migration_complexity": "Low|Medium|High", "content_volume": "Small|Medium|Large", "mobile_readiness": "Poor|Fair|Good" },
 "stack": [ { "name": "", "role": "", "confidence": 0-100, "evidence": "one short phrase" } ],
 "findings": [ { "title": "", "detail": "one or two sentences", "impact": "High|Medium|Low", "area": "Registration|Navigation|Content|Performance|Accessibility|SEO|Trust|Mobile|Other" } ],
 "preserve": [ "things the rebuild must keep working, e.g. the registration system" ],
 "approach": "2 to 4 sentences on how we would rebuild it.",
 "pitch_angles": [ "3 short lines we could open a pitch with" ]
}
Findings: 4 to 8, ordered by impact. Stack: include every detected item with a confidence; drop generic ones (Google Fonts) unless relevant.` },
    { role: 'user', content: `Site: ${target.href}\n\nMeasurements (JSON):\n${JSON.stringify(facts, null, 1)}\n\nVisible text from the home page (trimmed):\n${textSample}` },
  ];
  const out = await openai(apiKey, messages);
  if (!out.ok) return res.status(502).json({ ok: false, error: out.error });
  let report = {};
  try { report = JSON.parse(out.text); } catch { return res.status(502).json({ ok: false, error: 'The model returned something unreadable. Try again.' }); }

  // 3. Save as the caller.
  const row = { url: target.href, host: target.hostname.replace(/^www\./, ''), project_slug: slug, signals, report, model: out.model };
  const saved = await sbFetch(base, key, token, '/rest/v1/site_scans', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  const id = saved.ok && Array.isArray(saved.data) && saved.data[0] ? saved.data[0].id : null;
  if (!saved.ok) console.error('[concepts] scan save failed', saved.status, JSON.stringify(saved.data));

  return res.status(200).json({ ok: true, id, created_at: new Date().toISOString(), ...row, saved: saved.ok });
};
