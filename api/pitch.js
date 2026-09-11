/**
 * POST /api/pitch   { slug, mode: "pitch" | "plan" }
 *
 * Writes with OpenAI (key in OPEN_AI_ANALYZER) from everything we hold on a
 * project: the original request, internal notes, the six plan sections,
 * and visitor poll feedback.
 *
 *   mode "pitch"  returns a proposal in the Tri-Cities Board voice, ready
 *                 to send, as markdown.
 *   mode "plan"   returns draft text for any plan section that is empty,
 *                 leaving written sections alone.
 *
 * Caller must be a signed-in admin: the request carries the user's Supabase
 * access token, and every read happens as that user, so row-level security
 * does the gatekeeping. Nothing is written here; the admin reviews and saves.
 */

function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

const SECTIONS = [
  ['current_stack', 'Where the site is today', 'what it runs on today and what is wrong with it, as concrete observations'],
  ['replacing_with', 'What we are building', 'what we are building and what it runs on, feature by feature'],
  ['owner_wins', 'How this makes their life easier', 'what gets easier for the owner and the volunteers, day to day'],
  ['process', 'How we work together', 'the steps from concept to handover, numbered'],
  ['account_options', 'Their options', 'collaboration with no invoice, optional managed service at $74.99 a month, or paid work quoted per project, applied to this organization'],
  ['board_commitments', 'What we expect on Tri-Cities Board', 'the specific listings, events, volunteer roles and coverage we expect them to keep current on the Board'],
];

const VOICE = `You write for Tri-Cities Board, a free community platform for Port Coquitlam, Port Moody, Coquitlam and Anmore in British Columbia. Concepts is its initiative that rebuilds websites for local organizations, usually as a collaboration with no invoice, sometimes as paid work, only when it fits.

Voice rules, follow them exactly:
- Plain, direct, local. Short declarative sentences. Confident, never salesy.
- Specific over general: name the actual problems seen on their site and the actual things being built.
- No hype words (transform, elevate, seamless, cutting-edge, empower, unlock, journey).
- No exclamation marks. No emoji. No headings in ALL CAPS.
- Canadian spelling.
- Say "we" for Tri-Cities Board and name the organization directly.
- Never invent facts, prices, dates, names or features that are not in the material. If something is unknown, leave it out rather than guess.`;

async function sbFetch(base, key, token, path, init) {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init && init.headers) },
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

async function openai(apiKey, messages) {
  const models = [env('OPENAI_MODEL') || 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  let lastErr = 'no model';
  for (const model of models) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.4, messages }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.choices && data.choices[0]) return { ok: true, model, text: data.choices[0].message.content || '' };
    lastErr = (data.error && data.error.message) || `OpenAI ${r.status}`;
    if (!/model|not found|does not exist|access/i.test(lastErr)) break;
  }
  return { ok: false, error: lastErr };
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

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const slug = String((body && body.slug) || '').trim();
  const mode = (body && body.mode) === 'plan' ? 'plan' : 'pitch';
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(400).json({ ok: false, error: 'bad slug' });

  // Is this an admin? Ask the database as the caller.
  const who = await sbFetch(base, key, token, '/rest/v1/rpc/is_admin', { method: 'POST', body: '{}' });
  if (!who.ok || who.data !== true) return res.status(403).json({ ok: false, error: 'not an admin' });

  // Everything we know about the project, read as the caller.
  const proj = await sbFetch(base, key, token, `/rest/v1/projects?slug=eq.${encodeURIComponent(slug)}&select=*,project_plans(*),requests!requests_project_fk(org,kind,name,email,site,problem,track,notes,created_at)&limit=1`);
  if (!proj.ok || !Array.isArray(proj.data) || !proj.data[0]) return res.status(404).json({ ok: false, error: 'project not found' });
  const p = proj.data[0];
  const plan = (Array.isArray(p.project_plans) ? p.project_plans[0] : p.project_plans) || {};
  const reqs = Array.isArray(p.requests) ? p.requests : [];
  const fb = await sbFetch(base, key, token, `/rest/v1/concept_feedback?project_slug=eq.${encodeURIComponent(slug)}&select=rating,feedback,created_at&order=created_at.desc&limit=100`);
  const feedback = fb.ok && Array.isArray(fb.data) ? fb.data : [];
  // The newest site intelligence scan. This is what lets the pitch argue from
  // what their site actually does rather than in generalities.
  const sc = await sbFetch(base, key, token, `/rest/v1/site_scans?project_slug=eq.${encodeURIComponent(slug)}&select=host,url,report,signals,model,created_at&order=created_at.desc&limit=1`);
  const scan = sc.ok && Array.isArray(sc.data) ? sc.data[0] : null;

  // Material for the model.
  const lines = [];
  lines.push(`# Project: ${p.name}`);
  lines.push(`Organization: ${p.org_name}${p.org_type ? ' (' + p.org_type + ')' : ''}`);
  lines.push(`Status: ${p.status}; track: ${p.track || 'undecided'}`);
  if (p.current_url) lines.push(`Current website: ${p.current_url}`);
  if (p.concept_url) lines.push(`Concept URL: ${p.concept_url}`);
  if (p.contact_name || p.contact_email) lines.push(`Contact: ${[p.contact_name, p.contact_email].filter(Boolean).join(' ')}`);
  if (p.summary) lines.push(`\nSummary:\n${p.summary}`);
  for (const r of reqs) {
    lines.push(`\n## What they told us in their request (${r.created_at ? r.created_at.slice(0, 10) : ''})`);
    lines.push(`From ${r.name} <${r.email}>, ${r.kind}, chose: ${r.track}${r.site ? ', site ' + r.site : ''}`);
    lines.push(`What is not working: ${r.problem}`);
    if (r.notes) lines.push(`Our internal notes: ${r.notes}`);
  }
  if (scan) {
    const rep = scan.report || {}, sig = scan.signals || {}, sco = rep.scores || {};
    lines.push(`\n## Site intelligence scan of ${scan.host} (${scan.created_at ? scan.created_at.slice(0, 10) : ''})`);
    if (rep.summary) lines.push(`Summary: ${rep.summary}`);
    const scoreBits = Object.entries(sco).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    if (scoreBits.length) lines.push(`Scores — ${scoreBits.join('; ')}`);
    if (Array.isArray(rep.stack) && rep.stack.length) {
      lines.push(`Running on: ${rep.stack.map(t => t.name + (t.role ? ' (' + t.role + ')' : '')).join(', ')}`);
    }
    const measured = [];
    if (sig.responseMs) measured.push(`${sig.responseMs} ms to first byte`);
    if (sig.htmlBytes) measured.push(`${Math.round(sig.htmlBytes / 1024)} KB of HTML`);
    measured.push(sig.viewportMeta ? 'has a mobile viewport' : 'NO mobile viewport');
    measured.push(sig.https ? 'HTTPS' : 'NO HTTPS');
    if (sig.largestNav) measured.push(`${sig.largestNav} links in its biggest menu`);
    if (sig.pdfLinks) measured.push(`${sig.pdfLinks} PDF links`);
    if (sig.imagesMissingAlt) measured.push(`${sig.imagesMissingAlt} images with no alt text`);
    if (!sig.metaDescription) measured.push('no meta description');
    if (sig.sitemap && sig.sitemap.present) measured.push(`sitemap with ${sig.sitemap.urls} URLs`);
    lines.push(`Measured: ${measured.join(', ')}.`);
    if (Array.isArray(rep.findings) && rep.findings.length) {
      lines.push('Priority findings, worst first:');
      rep.findings.slice(0, 8).forEach(f => lines.push(`- ${f.title}${f.impact ? ' [' + f.impact + ' impact]' : ''}: ${f.detail || ''}`));
    }
    if (Array.isArray(rep.preserve) && rep.preserve.length) lines.push(`Must keep working: ${rep.preserve.join(', ')}.`);
    if (rep.approach) lines.push(`Suggested build approach: ${rep.approach}`);
    if (Array.isArray(rep.pitch_angles) && rep.pitch_angles.length) {
      lines.push('Angles the scan suggested:');
      rep.pitch_angles.forEach(a => lines.push(`- ${a}`));
    }
  }
  lines.push('\n## Plan sections as written so far');
  for (const [k, title] of SECTIONS) lines.push(`\n### ${title}\n${plan[k] ? plan[k] : '(empty)'}`);
  if (feedback.length) {
    const counts = {};
    feedback.forEach(f => { counts[f.rating] = (counts[f.rating] || 0) + 1; });
    lines.push(`\n## Visitor poll on the concept (${feedback.length} responses)`);
    lines.push('Ratings compared with the existing site: ' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
    feedback.filter(f => f.feedback).slice(0, 40).forEach(f => lines.push(`- (${f.rating}) ${f.feedback}`));
  }
  const material = lines.join('\n');

  let messages;
  if (mode === 'plan') {
    const empty = SECTIONS.filter(([k]) => !plan[k]);
    if (!empty.length) return res.status(200).json({ ok: true, mode, sections: {}, note: 'Every section already has text.' });
    messages = [
      { role: 'system', content: VOICE + `\n\nYou are drafting the internal project plan. Write only the sections requested, as markdown with short bullets. Return strictly JSON: an object whose keys are the section keys given and whose values are the markdown text. No prose outside the JSON.` },
      { role: 'user', content: `Material:\n\n${material}\n\nWrite these sections:\n` + empty.map(([k, title, hint]) => `- ${k}: "${title}" — ${hint}`).join('\n') },
    ];
  } else {
    messages = [
      { role: 'system', content: VOICE + `\n\nYou are writing the proposal we hand to the organization. Structure, in this order, using these exact headings as markdown level-2 headings:
1. A one-line title: "${p.org_name} — Website Proposal", then a single-sentence subtitle that says what we are proposing.
2. "Where the site is today" — if the material carries a site intelligence scan, argue from its actual measurements and named platform rather than in generalities, and quote a couple of the concrete numbers. Never invent a number that is not in the material.
3. "What we are proposing to build" (numbered sub-parts if there are distinct pieces)
4. "What changes for you" (how it makes their life easier)
5. "How this works" (the steps, numbered)
6. "What it costs you" (collaboration first, managed service as an optional add-on after handover, paid work last)
7. "What we ask in return" (their commitments on Tri-Cities Board)
8. If there is visitor poll feedback, "What people said about the concept" with the tally and two or three short quotes.
9. A closing line signed "Tri-Cities Board · tricitiesboard.org".
Length: 500 to 900 words. Bullets where the source used bullets.
Write for the organization, not for us: no internal notes, no hedging about what the scan could not see.` },
      { role: 'user', content: `Material:\n\n${material}` },
    ];
  }

  const out = await openai(apiKey, messages);
  if (!out.ok) return res.status(502).json({ ok: false, error: out.error });

  if (mode === 'plan') {
    let sections = {};
    try {
      const txt = out.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      sections = JSON.parse(txt);
    } catch { return res.status(502).json({ ok: false, error: 'The model did not return usable sections. Try again.' }); }
    const allowed = new Set(SECTIONS.map(([k]) => k));
    Object.keys(sections).forEach(k => { if (!allowed.has(k) || plan[k]) delete sections[k]; });
    return res.status(200).json({ ok: true, mode, model: out.model, sections });
  }
  return res.status(200).json({ ok: true, mode, model: out.model, pitch: out.text.trim(),
    scan: scan ? { host: scan.host, created_at: scan.created_at } : null });
};
