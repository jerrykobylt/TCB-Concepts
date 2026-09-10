/**
 * POST /api/request — concept request form handler.
 *
 * Mirrors the tricitiesboard.org email conventions (lib/email.js there):
 * every automated send goes From noreply@ so the product never impersonates
 * a person, and Reply-To points at the human inbox that owns the reply.
 *
 * Env (set in Vercel, copied from the tri-cities-board project):
 *   TCB_RESEND_KEY          (or RESEND_API_KEY)
 *   EMAIL_FROM              e.g. "Tri-Cities Board <noreply@tricitiesboard.org>"
 *   EMAIL_REPLY_TO_ADMIN    admin@tricitiesboard.org
 *   EMAIL_REPLY_TO_OUTREACH outreach@tricitiesboard.org
 */

const FROM_DEFAULT = 'Tri-Cities Board <noreply@tricitiesboard.org>';
const ADMIN_DEFAULT = 'admin@tricitiesboard.org';
const OUTREACH_DEFAULT = 'outreach@tricitiesboard.org';
const SITE = 'https://tcb-concepts.vercel.app';

/**
 * Read an env var, ignoring the "[SENSITIVE]" placeholder that `vercel env
 * pull` writes for values it is not allowed to read. A variable copied from
 * that output would otherwise override a perfectly good default with junk.
 */
function env(name) {
  const v = process.env[name];
  if (!v || v.trim() === '' || v.trim() === '[SENSITIVE]') return undefined;
  return v.trim();
}

/** The Resend key lives under TCB_RESEND_KEY on this project; RESEND_API_KEY is the main site's name. */
function resendKey() {
  return env('TCB_RESEND_KEY') || env('RESEND_API_KEY');
}

const KINDS = new Set([
  'Non-profit, club or team',
  'Local business',
  'Artist, musician or maker',
  'School or community group',
  'Something else',
]);
const TRACKS = new Set(['Collaboration', 'Paid work', 'Not sure yet']);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function validate(body) {
  const f = {
    org: clean(body.org, 160),
    kind: clean(body.kind, 60),
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    site: clean(body.site, 300),
    problem: clean(body.problem, 4000),
    track: clean(body.track, 40),
  };
  const errors = {};
  if (!f.org) errors.org = 'We need to know who this is for.';
  if (!KINDS.has(f.kind)) errors.kind = 'Pick the closest one.';
  if (!f.name) errors.name = 'Who are we replying to?';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) errors.email = 'That address does not look right.';
  if (f.site && !/^https?:\/\/.+\..+/i.test(f.site)) errors.site = 'Include the full address, starting with https://';
  if (f.problem.length < 15) errors.problem = 'A little more detail, please.';
  if (!TRACKS.has(f.track)) errors.track = 'Pick one. Not sure yet is a fine answer.';
  return { fields: f, errors, ok: Object.keys(errors).length === 0 };
}

async function sendViaResend({ to, from, subject, html, text, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || `Resend error ${res.status}` };
  return { ok: true, id: data?.id || null };
}

function internalEmail(f, meta) {
  const rows = [
    ['Organization', f.org],
    ['Type', f.kind],
    ['Contact', f.name],
    ['Email', f.email],
    ['Current website', f.site || 'none'],
    ['Which door', f.track],
  ];
  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nWhat is not working right now:\n${f.problem}\n\n` +
    `--\nSent from ${SITE} at ${meta.when}. Reply to this email to answer ${f.name} directly.`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F9FAFB;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden">
  <div style="background:#111827;padding:18px 24px;color:#fff">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#4ADE80;font-weight:600">Concepts request</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(f.org)}</div>
  </div>
  <div style="padding:20px 24px">
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="padding:7px 0;color:#6B7280;width:150px;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;vertical-align:top">${k === 'Email' ? `<a href="mailto:${esc(v)}" style="color:#16A34A">${esc(v)}</a>` : k === 'Current website' && v !== 'none' ? `<a href="${esc(v)}" style="color:#16A34A">${esc(v)}</a>` : esc(v)}</td></tr>`).join('')}
    </table>
    <div style="margin-top:18px;padding-top:16px;border-top:1px solid #E5E7EB">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6B7280;font-weight:600;margin-bottom:8px">What is not working right now</div>
      <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(f.problem)}</div>
    </div>
  </div>
  <div style="padding:14px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
    Sent from <a href="${SITE}" style="color:#6B7280">${SITE.replace('https://', '')}</a> at ${esc(meta.when)}. Reply to this email to answer ${esc(f.name)} directly.
  </div>
</div></body></html>`;

  return { subject: `Tri-Cities Board Concepts: request from ${f.org}`, text, html };
}

function confirmationEmail(f) {
  const first = f.name.split(/\s+/)[0] || f.name;
  const text =
`Hi ${first},

We got your request for ${f.org}. A real person on the Tri-Cities Board team reads every one of these, usually within a week.

If it is a fit, we will come back with questions and start building. If it is not, we will tell you that plainly and quickly, and we will say why.

What you sent us:

Organization: ${f.org}
Type: ${f.kind}
Current website: ${f.site || 'none'}
Which door: ${f.track}

What is not working right now:
${f.problem}

Reply to this email if you want to add anything.

Tri-Cities Board
The community hub for Port Coquitlam, Port Moody and Coquitlam
https://www.tricitiesboard.org`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F9FAFB;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden">
  <div style="background:#111827;padding:18px 24px;color:#fff">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#4ADE80;font-weight:600">Tri-Cities Board</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">We got your request.</div>
  </div>
  <div style="padding:22px 24px;font-size:15px;line-height:1.6">
    <p style="margin:0 0 14px">Hi ${esc(first)},</p>
    <p style="margin:0 0 14px">We got your request for <b>${esc(f.org)}</b>. A real person on the Tri-Cities Board team reads every one of these, usually within a week.</p>
    <p style="margin:0 0 14px">If it is a fit, we will come back with questions and start building. If it is not, we will tell you that plainly and quickly, and we will say why.</p>
    <div style="margin:20px 0;padding:16px 18px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;font-size:14px">
      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6B7280;font-weight:600;margin-bottom:10px">What you sent us</div>
      <div><span style="color:#6B7280">Organization:</span> ${esc(f.org)}</div>
      <div><span style="color:#6B7280">Type:</span> ${esc(f.kind)}</div>
      <div><span style="color:#6B7280">Current website:</span> ${esc(f.site || 'none')}</div>
      <div><span style="color:#6B7280">Which door:</span> ${esc(f.track)}</div>
      <div style="margin-top:10px;white-space:pre-wrap">${esc(f.problem)}</div>
    </div>
    <p style="margin:0">Reply to this email if you want to add anything.</p>
  </div>
  <div style="padding:14px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280;line-height:1.5">
    Tri-Cities Board · The community hub for Port Coquitlam, Port Moody and Coquitlam<br>
    <a href="https://www.tricitiesboard.org" style="color:#6B7280">tricitiesboard.org</a>
  </div>
</div></body></html>`;

  return { subject: `Tri-Cities Board Concepts: we got your request, ${f.org}`, text, html };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  // Honeypot: real users never see this field. Bots that fill it get a quiet 200.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const { fields, errors, ok } = validate(body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  if (!resendKey()) {
    return res.status(503).json({ ok: false, reason: 'not_configured' });
  }

  const from = env('EMAIL_FROM') || FROM_DEFAULT;
  const admin = env('EMAIL_REPLY_TO_ADMIN') || ADMIN_DEFAULT;
  const outreach = env('EMAIL_REPLY_TO_OUTREACH') || OUTREACH_DEFAULT;
  const when = new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver', dateStyle: 'medium', timeStyle: 'short' }) + ' PT';

  // Archive first, so a mail outage never loses a request.
  const row = await archiveRequest(fields);

  const internal = internalEmail(fields, { when });
  const notify = await sendViaResend({
    to: [outreach, admin],
    from,
    replyTo: `${fields.name} <${fields.email}>`,
    ...internal,
  });

  if (!notify.ok) {
    console.error('[concepts] notify failed:', notify.error);
    // The row is safe in the archive; tell the client so it can fall back.
    return res.status(502).json({ ok: false, reason: 'send_failed', archived: row.ok });
  }

  // Confirmation to the requester. Best-effort: a failure here should not
  // hide a request that already reached the team.
  const confirm = confirmationEmail(fields);
  const ack = await sendViaResend({
    to: fields.email,
    from,
    replyTo: outreach,
    ...confirm,
  });
  if (!ack.ok) console.error('[concepts] confirmation failed:', ack.error);

  if (row.ok) noteDelivery(notify.id, ack.ok);

  return res.status(200).json({ ok: true, id: notify.id, confirmed: ack.ok, archived: row.ok });
};

/* ------------------------------------------------------------------------ */
/* Archive: Supabase REST with the publishable key. RLS allows insert only. */
/* ------------------------------------------------------------------------ */

function supabase() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function archiveRequest(f) {
  const sb = supabase();
  if (!sb) {
    console.error('[concepts] archive skipped: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not set');
    return { ok: false };
  }
  try {
    const res = await fetch(`${sb.url}/rest/v1/requests`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        org: f.org, kind: f.kind, name: f.name, email: f.email,
        site: f.site || null, problem: f.problem, track: f.track,
      }),
    });
    if (!res.ok) {
      console.error('[concepts] archive failed:', res.status, await res.text().catch(() => ''));
      return { ok: false };
    }
    // return=minimal: the insert-only policy has no SELECT, so no row comes back.
    return { ok: true, id: null };
  } catch (err) {
    console.error('[concepts] archive error:', err && err.message);
    return { ok: false };
  }
}

// The publishable key may insert but never update, so delivery details are
// logged rather than written back. The archive holds the request itself.
function noteDelivery(resendId, confirmed) {
  console.log('[concepts] archived; resend', resendId, 'confirmed', confirmed);
}
