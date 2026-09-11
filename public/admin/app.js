/* Tri-Cities Board Concepts admin. All data is live from Supabase; row-level
   security does the gatekeeping, this file only draws and saves. */
(function () {
  var C = window.TCB_ADMIN;
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var PLAN_KEYS = ['current_stack','replacing_with','owner_wins','process','account_options','board_commitments'];
  var TRACK_MAP = { 'Collaboration': 'collaboration', 'Paid work': 'paid', 'Not sure yet': 'undecided' };
  var STAGE = { prospect: ['grey','Prospect'], concept: ['sky','Concept'], building: ['amber','Building'], live: ['','Live'], handed_over: ['','Handed over'], managed: ['','Managed'], declined: ['red','Declined'] };
  var TRACK = { collaboration: ['','Collaboration'], managed: ['sky','Managed service'], paid: ['amber','Paid work'], undecided: ['grey','Undecided'] };
  var REQ = { new: ['sky','New'], reviewing: ['amber','Reviewing'], accepted: ['','Accepted'], declined: ['red','Declined'], spam: ['red','Spam'] };
  var BUCKET = 'concepts';
  var state = { user: null, requests: [], projects: [], feedback: [], scans: [], admins: [], proj: null, req: null, reqStatus: '', pf: 'all', ptrack: '', q: '', pq: '' };

  /* ---------- helpers ---------- */
  function toast(m, ms) { var t = $('toast'); $('toastMsg').textContent = m; t.hidden = false; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); t.hidden = true; }, ms || 2400); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(ts) { return ts ? new Date(ts).toLocaleString('en-CA', { timeZone: 'America/Vancouver', dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function ago(ts) { if (!ts) return ''; var m = (Date.now() - new Date(ts)) / 6e4; if (m < 60) return Math.max(1, Math.floor(m)) + 'm ago'; var h = m / 60; if (h < 24) return Math.floor(h) + 'h ago'; var d = h / 24; if (d < 30) return Math.floor(d) + 'd ago'; return Math.floor(d / 30) + 'mo ago'; }
  function slugify(s) { return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  function md(s) { return s ? marked.parse(s, { breaks: true }) : '<p class="muted">Nothing written yet.</p>'; }
  function thumb(url) { return url ? '/api/thumb?url=' + encodeURIComponent(url) : ''; }
  function host(u) { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u || ''; } }
  function initials(s) { return String(s || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function status(cls, label) { return '<span class="status ' + esc(cls) + '">' + esc(label) + '</span>'; }
  function stageTag(s) { var m = STAGE[s] || ['grey', s]; return status(m[0], m[1]); }
  function trackTag(t) { var m = TRACK[t] || TRACK_MAP[t] && TRACK[TRACK_MAP[t]] || ['grey', t]; return status(m[0], m[1]); }
  function reqTag(s) { var m = REQ[s] || ['grey', s]; return status(m[0], m[1]); }
  function logo(p, cls) {
    var url = p.concept_url || p.current_url;
    return '<span class="project-logo ' + (cls || '') + '"' + (p.card_bg ? ' style="background:' + esc(p.card_bg) + ';color:' + esc(p.card_fg || '#fff') + '"' : '') + '>' + (url ? '<img src="' + esc(thumb(url)) + '" alt="" loading="lazy" onerror="this.remove()">' : '') + esc(initials(p.name)) + '</span>';
  }
  function shot(p, id) {
    var url = p.concept_url || p.current_url;
    return '<div class="shot"' + (id ? ' id="' + id + '"' : '') + (p.card_bg ? ' style="background:' + esc(p.card_bg) + ';color:' + esc(p.card_fg || '#fff') + '"' : '') + '><span style="position:relative;z-index:0">' + esc(p.org_name || p.name || '') + '</span>' + (url ? '<img src="' + esc(thumb(url)) + '" alt="" onerror="this.remove()">' : '') + (p.concept_url ? '<span class="tag-lbl">concept</span>' : (p.current_url ? '<span class="tag-lbl">their site</span>' : '')) + '</div>';
  }
  function tallyHTML(rows) { var c = { worse: 0, same: 0, better: 0, remarkable: 0 }; rows.forEach(function (x) { if (c[x.rating] != null) c[x.rating]++; }); return Object.keys(c).map(function (k) { return '<div class="t ' + k + '"><b>' + c[k] + '</b><span>' + k + '</span></div>'; }).join(''); }
  async function bearer() { var s = await sb.auth.getSession(); return s.data.session && s.data.session.access_token; }

  /* ---------- daily sign-in image ---------- */
  (function () {
    var days = [['1506905925346-21bda4d32df4','Local is the whole advantage.'],['1501785888041-af3ef285b470','Three cities, five communities, one board.'],['1441974231531-c6227db76b6e','We build first and talk after.'],['1470071459604-3b5ec3a7fe05','Real pages, not slide decks.'],['1447752875215-b2761acb3c5d','Come see what your neighbours are up to.'],['1433086966358-54859d0ed716','We would rather collaborate than invoice.'],['1500530855697-b586d89ba3ee','Free to browse, free to join, and built here.'],['1469474968028-56623f02e42e','We made anonymity expensive.'],['1426604966848-d7adac402bff','Put it in one place and keep it independent.'],['1454496522488-7a8e488e8606','A national platform cannot check a Coquitlam licence.'],['1418065460487-3e41a6c84dc5','Send attention back to the people who make things happen here.'],['1519681393784-d120267933ba','We choose the projects, and we say no often.'],['1464822759023-fed622ff2c3b','One independent site covering three cities.'],['1483728642387-6c3bdd6c93e5','It is a trade, not a favour.']];
    var now = new Date(), day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5), pick = days[day % days.length];
    $('loginImg').src = 'https://images.unsplash.com/photo-' + pick[0] + '?auto=format&fit=crop&w=1200&h=1400&q=70';
    $('loginQuote').textContent = pick[1];
    var h = now.getHours(); $('greeting').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();

  /* ---------- auth ---------- */
  function msg(id, text, bad) { $(id).innerHTML = text ? '<div class="msg' + (bad ? ' err' : '') + '">' + esc(text) + '</div>' : ''; }
  $$('.pw .eye').forEach(function (b) { b.addEventListener('click', function () { var i = $(b.dataset.for), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-pressed', show ? 'true' : 'false'); i.focus(); }); });
  $('signin').addEventListener('click', async function () {
    var email = $('email').value.trim(), pw = $('password').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg('authmsg', 'That address does not look right.', true); return; }
    if (!pw) { msg('authmsg', 'Enter your password.', true); return; }
    this.disabled = true; msg('authmsg', '');
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    this.disabled = false;
    if (r.error) msg('authmsg', /invalid/i.test(r.error.message) ? 'Wrong email or password.' : r.error.message, true);
  });
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('signin').click(); });
  $('email').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('password').focus(); });
  $('savepw').addEventListener('click', async function () {
    var a = $('pw1').value, b = $('pw2').value;
    if (a.length < 10) { msg('setpwmsg', 'Make it at least 10 characters.', true); return; }
    if (a !== b) { msg('setpwmsg', 'Those do not match.', true); return; }
    this.disabled = true;
    var r = await sb.auth.updateUser({ password: a, data: { password_set: true } });
    this.disabled = false;
    if (r.error) { msg('setpwmsg', r.error.message, true); return; }
    state.user = r.data.user; enter();
  });
  function out() { sb.auth.signOut().then(function () { location.reload(); }); }
  $('signout').addEventListener('click', out); $('signout2').addEventListener('click', out);
  var entered = false;
  sb.auth.onAuthStateChange(function (ev, session) { if (ev === 'SIGNED_IN' && !entered) boot(session); if (ev === 'SIGNED_OUT') gate('auth'); });
  async function boot(session) {
    state.user = session ? session.user : null;
    if (!state.user) { gate('auth'); return; }
    var r = await sb.rpc('is_admin');
    if (!r.data) { $('deniedEmail').textContent = state.user.email; gate('denied'); return; }
    if (!(state.user.user_metadata && state.user.user_metadata.password_set)) { $('setpwEmail').textContent = state.user.email; gate('setpw'); return; }
    enter();
  }
  function gate(which) { entered = false; $('gate').hidden = false; $('app').hidden = true; ['auth','setpw','denied'].forEach(function (k) { $(k).hidden = k !== which; }); }
  async function enter() {
    entered = true;
    $('whoEmail').textContent = state.user.email; $('avatar').textContent = initials(state.user.email.split('@')[0].replace(/[._-]/g, ' '));
    $('gate').hidden = true; $('app').hidden = false;
    await Promise.all([loadRequests(), loadProjects(), loadFeedback(), loadScans(), loadAdmins()]);
    renderAll(); go('overview');
  }

  /* ---------- navigation ---------- */
  var TITLES = { overview: 'Overview', projects: 'Projects', project: 'Project', ai: 'AI Site Intel', requests: 'Requests', feedback: 'Feedback', settings: 'Settings' };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-view-target]'); if (b) { e.preventDefault(); go(b.dataset.viewTarget); return; }
    var n = e.target.closest('[data-new-project]'); if (n) { openProject(blank()); return; }
    var p = e.target.closest('[data-proj]'); if (p) { e.preventDefault(); var pr = state.projects.find(function (x) { return x.id === p.dataset.proj; }); if (pr) { closeDrawer(); openProject(pr, p.dataset.pane); } return; }
    var r = e.target.closest('[data-req]'); if (r) { e.preventDefault(); var rq = state.requests.find(function (x) { return x.id === r.dataset.req; }); if (rq) openRequest(rq); return; }
    var s = e.target.closest('[data-scan]'); if (s) { e.preventDefault(); var sc = state.scans.find(function (x) { return x.id === s.dataset.scan; }); if (sc) { go('ai'); renderReport(sc); } return; }
  });
  function go(v) {
    $$('.view').forEach(function (s) { s.hidden = s.dataset.view !== v; });
    $$('.nav-item[data-view-target]').forEach(function (l) { l.classList.toggle('active', l.dataset.viewTarget === v || (v === 'project' && l.dataset.viewTarget === 'projects')); });
    $('breadcrumb-current').textContent = v === 'project' && state.proj ? (state.proj.name || 'New project') : (TITLES[v] || v);
    closeNav(); window.scrollTo(0, 0);
    if (v === 'ai') { fillScanProjects(); renderRecentScans(); }
  }
  function openNav() { $('sidebar').classList.add('open'); $('sidebar-backdrop').hidden = false; document.body.classList.add('nav-open'); $('menu-button').setAttribute('aria-expanded', 'true'); }
  function closeNav() { $('sidebar').classList.remove('open'); $('sidebar-backdrop').hidden = true; document.body.classList.remove('nav-open'); $('menu-button').setAttribute('aria-expanded', 'false'); }
  $('menu-button').addEventListener('click', function () { $('sidebar').classList.contains('open') ? closeNav() : openNav(); });
  $('sidebar-backdrop').addEventListener('click', closeNav);
  $('topNew').addEventListener('click', function () { openProject(blank()); });
  $('global-search').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); renderProjects(); renderRequests(); });
  document.addEventListener('keydown', function (e) { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $('global-search').focus(); } if (e.key === 'Escape') closeDrawer(); });

  /* ---------- data ---------- */
  async function loadRequests() { var r = await sb.from('requests').select('*').order('created_at', { ascending: false }).limit(500); if (!r.error) state.requests = r.data || []; }
  async function loadProjects() { var r = await sb.from('projects').select('*, project_plans(*)').order('updated_at', { ascending: false }); if (r.error) return; state.projects = (r.data || []).map(function (p) { p.plan = (Array.isArray(p.project_plans) ? p.project_plans[0] : p.project_plans) || {}; delete p.project_plans; return p; }); }
  async function loadFeedback() { var r = await sb.from('concept_feedback').select('*').order('created_at', { ascending: false }).limit(1000); if (!r.error) state.feedback = r.data || []; }
  async function loadScans() { var r = await sb.from('site_scans').select('id,created_at,url,host,project_slug,report,model,signals').order('created_at', { ascending: false }).limit(100); if (!r.error) state.scans = r.data || []; }
  async function loadAdmins() { var r = await sb.from('admins').select('*').order('added_at'); if (!r.error) state.admins = r.data || []; }
  function renderAll() { renderOverview(); renderProjects(); renderRequests(); renderFeedback(); renderSettings(); }
  function blank() { return { id: null, name: '', slug: '', org_name: '', org_type: '', status: 'prospect', track: 'undecided', current_url: '', concept_url: '', contact_name: '', contact_email: '', summary: '', tags: [], listed: true, sort: 100, plan: {} }; }

  /* ---------- overview ---------- */
  function renderOverview() {
    var newReqs = state.requests.filter(function (x) { return x.status === 'new'; });
    var flight = state.projects.filter(function (p) { return ['prospect','concept','building'].indexOf(p.status) > -1; });
    var live = state.projects.filter(function (p) { return ['live','handed_over','managed'].indexOf(p.status) > -1; });
    var week = state.feedback.filter(function (f) { return Date.now() - new Date(f.created_at) < 7 * 864e5; });
    $('cProjects').textContent = state.projects.length; $('cRequests').textContent = newReqs.length; $('cFeedback').textContent = state.feedback.length;
    $('overviewSub').textContent = flight.length + ' concept' + (flight.length === 1 ? '' : 's') + ' in flight, ' + newReqs.length + ' request' + (newReqs.length === 1 ? '' : 's') + ' unanswered, ' + week.length + ' poll answer' + (week.length === 1 ? '' : 's') + ' this week.';
    function metric(icon, cls, val, label, trend) { return '<article class="metric-card"><div class="metric-top"><span class="metric-icon ' + cls + '"><svg class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><use href="#i-' + icon + '"/></svg></span><span class="trend neutral">' + esc(trend) + '</span></div><div class="metric-value">' + val + '</div><div class="metric-label">' + label + '</div></article>'; }
    $('metrics').innerHTML =
      metric('folder', '', flight.length, 'Concepts in flight', flight.map(function (p) { return p.name; }).slice(0, 2).join(', ') || 'none') +
      metric('inbox', 'sky', newReqs.length, 'New build requests', state.requests.length + ' total') +
      metric('note', 'violet', state.feedback.length, 'Poll responses', week.length + ' this week') +
      metric('shield', 'amber', live.length, 'Launched or managed', state.scans.length + ' site scan' + (state.scans.length === 1 ? '' : 's'));

    var q = [];
    newReqs.forEach(function (x) { var d = Math.floor((Date.now() - new Date(x.created_at)) / 864e5); q.push({ icon: 'inbox', cls: d >= 5 ? 'red' : 'sky', t: 'Request from ' + x.org, s: x.name + ' · ' + x.kind + ' · chose ' + x.track, when: ago(x.created_at), attr: 'data-req="' + x.id + '"' }); });
    state.projects.forEach(function (p) {
      var d = Math.floor((Date.now() - new Date(p.updated_at)) / 864e5);
      if (!p.pitch && ['concept','building'].indexOf(p.status) > -1) q.push({ icon: 'file', cls: '', t: p.name + ' has no pitch yet', s: 'Write it with AI, then send it', when: 'Open', attr: 'data-proj="' + p.id + '" data-pane="pitch"' });
      if (!state.scans.some(function (s) { return s.project_slug === p.slug; }) && p.current_url && p.status !== 'declined') q.push({ icon: 'spark', cls: 'sky', t: p.name + ': their site has not been scanned', s: host(p.current_url), when: 'Scan', attr: 'data-proj="' + p.id + '" data-pane="scans"' });
      var empty = PLAN_KEYS.filter(function (k) { return !p.plan[k]; }).length;
      if (empty && p.status !== 'declined') q.push({ icon: 'note', cls: '', t: p.name + ': ' + empty + ' plan section' + (empty > 1 ? 's' : '') + ' empty', s: 'Draft them with AI in one click', when: 'Open', attr: 'data-proj="' + p.id + '" data-pane="plan"' });
      if (d >= 10 && ['prospect','concept','building'].indexOf(p.status) > -1) q.push({ icon: 'clock', cls: 'red', t: p.name + ' has not moved in ' + d + ' days', s: 'Stage: ' + (STAGE[p.status] || [,''])[1], when: d + 'd', attr: 'data-proj="' + p.id + '"' });
    });
    var wk = week.filter(function (f) { return f.feedback; });
    if (wk.length) q.push({ icon: 'note', cls: '', t: wk.length + ' new comment' + (wk.length > 1 ? 's' : '') + ' on concepts this week', s: wk[0].feedback.slice(0, 90), when: ago(wk[0].created_at), attr: 'data-view-target="feedback"' });
    $('attention').innerHTML = q.length ? q.map(function (it) { return '<button class="attention-item" type="button" ' + it.attr + '><span class="attention-icon ' + it.cls + '"><svg class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><use href="#i-' + it.icon + '"/></svg></span><span class="attention-copy"><strong>' + esc(it.t) + '</strong><span>' + esc(it.s) + '</span></span><time>' + esc(it.when) + '</time></button>'; }).join('') : '<div class="empty-state" style="padding:26px"><h3>Nothing waiting</h3><p>Go build something.</p></div>';

    $('overviewProjects').innerHTML = state.projects.length ? state.projects.slice(0, 5).map(function (p) {
      var filled = PLAN_KEYS.filter(function (k) { return p.plan[k]; }).length, pct = Math.round((filled / 6) * 70 + (p.pitch ? 20 : 0) + (p.concept_url ? 10 : 0));
      return '<button class="project-row" type="button" data-proj="' + p.id + '"><span class="project-identity">' + logo(p) + '<span><strong>' + esc(p.name) + '</strong><small>' + esc(host(p.current_url) || p.org_name) + '</small></span></span><div><span class="cell-label">Track</span><span class="cell-value">' + esc((TRACK[p.track] || [,'—'])[1]) + '</span></div><div>' + stageTag(p.status) + '</div><div class="progress-mini"><span>' + pct + '% ready</span><span class="progress-track"><i class="progress-fill" style="--progress:' + pct + '%"></i></span></div><span class="row-arrow"><svg class="icon" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-chevron"/></svg></span></button>';
    }).join('') : '<div class="empty-state" style="padding:26px"><h3>No projects yet</h3><p>Create one, or convert a request.</p></div>';
    var lf = state.feedback.filter(function (f) { return f.feedback; }).slice(0, 4);
    $('overviewFeedback').innerHTML = lf.length ? lf.map(function (f) { return '<div class="fb ' + esc(f.rating) + '"><div class="m">' + esc(f.rating) + ' · ' + esc(f.project_slug) + ' · ' + esc(ago(f.created_at)) + '</div><p>' + esc(f.feedback) + '</p></div>'; }).join('') : '<div class="empty-state"><h3>No comments yet</h3><p>Ratings appear on the Feedback page.</p></div>';
    $('quickUrl').value = $('quickUrl').value || (state.projects[0] && state.projects[0].current_url) || '';
  }
  $('quickScan').addEventListener('click', function () { var u = $('quickUrl').value.trim(); go('ai'); if (u) { $('scanUrl').value = u; $('scanForm').requestSubmit(); } else $('scanUrl').focus(); });

  /* ---------- projects ---------- */
  $('projFilters').addEventListener('click', function (e) { var b = e.target.closest('.filter-tab'); if (!b) return; state.pf = b.dataset.pf; $$('#projFilters .filter-tab').forEach(function (x) { x.classList.toggle('active', x === b); }); renderProjects(); });
  $('projTrack').addEventListener('change', function () { state.ptrack = this.value; renderProjects(); });
  $('projSearch').addEventListener('input', function () { state.pq = this.value.trim().toLowerCase(); renderProjects(); });
  function renderProjects() {
    var q = state.pq || state.q;
    var rows = state.projects.filter(function (p) {
      if (state.pf === 'active' && ['prospect','concept','building'].indexOf(p.status) < 0) return false;
      if (state.pf === 'live' && ['live','handed_over'].indexOf(p.status) < 0) return false;
      if (state.pf === 'managed' && p.status !== 'managed') return false;
      if (state.pf === 'declined' && p.status !== 'declined') return false;
      if (state.ptrack && p.track !== state.ptrack) return false;
      if (q && (p.name + ' ' + p.org_name + ' ' + (p.current_url || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    $('projCount').textContent = 'Showing ' + rows.length + ' of ' + state.projects.length + ' project' + (state.projects.length === 1 ? '' : 's');
    $('projRows').innerHTML = rows.length ? rows.map(function (p) {
      var filled = PLAN_KEYS.filter(function (k) { return p.plan[k]; }).length;
      var fb = state.feedback.filter(function (f) { return f.project_slug === p.slug; }).length;
      return '<tr data-proj="' + p.id + '" style="cursor:pointer"><td><span class="name-cell">' + logo(p) + '<span><strong>' + esc(p.name) + '</strong><small>' + esc(host(p.current_url) || p.org_name) + (p.listed === false ? ' · hidden from site' : '') + '</small></span></span></td><td>' + trackTag(p.track) + '</td><td>' + stageTag(p.status) + '</td><td>' + filled + '/6' + (p.pitch ? ' · pitch' : '') + '</td><td>' + fb + '</td><td>' + esc(ago(p.updated_at)) + '</td><td><button class="table-action" type="button" data-proj="' + p.id + '" aria-label="Open"><svg class="icon" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-chevron"/></svg></button></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty-state"><h3>Nothing matches</h3><p>Change the filter or create a project.</p></div></td></tr>';
  }

  /* ---------- project page ---------- */
  $$('#ptabs button').forEach(function (b) { b.addEventListener('click', function () { showPane(b.dataset.pane); }); });
  function showPane(k) { $$('#ptabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.pane === k); }); $$('.pane').forEach(function (p) { p.classList.toggle('active', p.dataset.pane === k); }); }
  $$('.sec .tg').forEach(function (b) { b.addEventListener('click', function () { var sec = b.closest('.sec'), ta = sec.querySelector('textarea'), pv = sec.querySelector('.rich'); if (pv.hidden) { pv.innerHTML = md(ta.value); pv.hidden = false; ta.hidden = true; b.textContent = 'Edit'; } else { pv.hidden = true; ta.hidden = false; b.textContent = 'Preview'; } }); });
  function resetPreviews() { $$('.sec').forEach(function (sec) { sec.querySelector('.rich').hidden = true; sec.querySelector('textarea').hidden = false; sec.querySelector('.tg').textContent = 'Preview'; }); }

  function openProject(p, pane) {
    state.proj = p; go('project'); showPane(pane || 'overview'); resetPreviews();
    $('pdTitle').textContent = p.id ? p.name : 'New project';
    $('pdOrg').textContent = p.org_name ? p.org_name + (p.org_type ? ' · ' + p.org_type : '') : 'Fill in the basics and save.';
    $('pdTags').innerHTML = p.id ? stageTag(p.status) + trackTag(p.track) + status(p.listed === false ? 'grey' : '', p.listed === false ? 'Hidden from site' : 'On the site') : '';
    $('pdSummary').textContent = p.summary || '';
    $('pdLinks').innerHTML = (p.current_url ? '<a class="btn btn-secondary btn-small" href="' + esc(p.current_url) + '" target="_blank" rel="noopener">Their site <svg class="icon" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-external"/></svg></a>' : '') + (p.concept_url ? '<a class="btn btn-secondary btn-small" href="' + esc(p.concept_url) + '" target="_blank" rel="noopener">Concept <svg class="icon" fill="none" stroke="currentColor" stroke-width="2"><use href="#i-external"/></svg></a>' : '');
    $('pThumb').outerHTML = shot(p, 'pThumb');
    $('pName').value = p.name || ''; $('pSlug').value = p.slug || ''; $('pSlug').dataset.touched = p.id ? '1' : '';
    $('pOrg').value = p.org_name || ''; $('pType').value = p.org_type || '';
    $('pStatus').value = p.status || 'prospect'; $('pTrack').value = p.track || 'undecided'; $('pSort').value = p.sort == null ? '' : p.sort;
    $('pContact').value = p.contact_name || ''; $('pEmail').value = p.contact_email || '';
    $('pCurrent').value = p.current_url || ''; $('pConcept').value = p.concept_url || ''; $('pSummary').value = p.summary || '';
    $('pListed').checked = p.listed !== false; $('pLabel').value = p.card_label || ''; $('pBg').value = p.card_bg || ''; $('pFg').value = p.card_fg || ''; $('pTags').value = (p.tags || []).join(', ');
    PLAN_KEYS.forEach(function (k) { document.querySelector('.sec[data-key="' + k + '"] textarea').value = (p.plan && p.plan[k]) || ''; });
    $('pPitch').value = p.pitch || ''; $('pitchMeta').textContent = p.pitch_updated_at ? 'updated ' + fmt(p.pitch_updated_at) : 'markdown';
    $('aiMsg').textContent = '';
    $('pdPlan').hidden = !p.id; $('pdPlan').href = '/admin/plan?slug=' + encodeURIComponent(p.slug || '');
    $('pdPitch').hidden = !p.id; $('pdPitch').href = '/admin/plan?slug=' + encodeURIComponent(p.slug || '') + '&doc=pitch';
    $('pDelete').hidden = !p.id; $('aiScan').hidden = !p.current_url;
    state.pending = []; state.pageLive = false; state.inBucket = false;
    if (p.id) { loadFiles(p.slug); renderProjectFeedback(p.slug); renderProjectScans(p.slug); }
    else { renderPage(); $('fbTally').innerHTML = ''; $('fbList').innerHTML = '<p class="muted">No responses yet.</p>'; $('fbOpen').hidden = true; $('projScans').innerHTML = '<p class="muted">Publish the concept page first.</p>'; }
    gateAI();
    var req = p.request_id ? state.requests.find(function (r) { return r.id === p.request_id; }) : null;
    $('pReq').innerHTML = req ? '<div class="quote">' + esc(req.problem) + '</div><p class="muted">' + esc(req.name) + ' · ' + esc(req.email) + ' · ' + esc(fmt(req.created_at)) + (req.notes ? '<br><br><b>Notes:</b> ' + esc(req.notes) : '') + '</p><button class="btn btn-secondary btn-small" type="button" style="margin-top:10px" data-req="' + req.id + '">Open request</button>' : '<p class="muted">Not created from a request.</p>';
    if (!p.id) $('pName').focus();
  }
  $('pName').addEventListener('input', function () { if (!$('pSlug').dataset.touched) $('pSlug').value = slugify(this.value); renderPage(); });
  $('pSlug').addEventListener('input', function () { this.dataset.touched = '1'; renderPage(); });

  /* Save writes the fields and any staged files. Publish does that and puts
     the concept on the site: card shown, stage moved on, concept URL filled. */
  async function persist(pub) {
    var p = state.proj; if (!p) return;
    var btn = pub ? $('pPublish') : $('pSave');
    var row = { name: $('pName').value.trim(), slug: slugify($('pSlug').value.trim() || $('pName').value), org_name: $('pOrg').value.trim() || $('pName').value.trim(), org_type: $('pType').value.trim() || null, status: $('pStatus').value, track: $('pTrack').value, sort: parseInt($('pSort').value, 10) || 100, contact_name: $('pContact').value.trim() || null, contact_email: $('pEmail').value.trim() || null, current_url: $('pCurrent').value.trim() || null, concept_url: $('pConcept').value.trim() || null, summary: $('pSummary').value.trim() || null, listed: $('pListed').checked, card_label: $('pLabel').value.trim() || null, card_bg: $('pBg').value.trim() || null, card_fg: $('pFg').value.trim() || null, tags: $('pTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean) };
    if (!row.name) { toast('Give it a name first'); showPane('overview'); $('pName').focus(); return; }
    if (!row.slug) { toast('Give it a slug first'); showPane('overview'); $('pSlug').focus(); return; }

    var staged = state.pending || [];
    if (pub) {
      var hasPage = staged.some(function (f) { return f._rel === 'index.html'; }) || state.pageLive;
      if (!hasPage) { toast('Drop the concept\'s HTML file in first', 4000); showPane('overview'); return; }
      row.listed = true;
      if (row.status === 'prospect') row.status = 'concept';
      row.concept_url = C.site + '/concepts/' + row.slug;
    }

    var newPitch = $('pPitch').value.trim() || null;
    if (newPitch !== (p.pitch || null)) { row.pitch = newPitch; row.pitch_updated_at = newPitch ? new Date().toISOString() : null; }
    var plan = {}; PLAN_KEYS.forEach(function (k) { plan[k] = document.querySelector('.sec[data-key="' + k + '"] textarea').value.trim() || null; });

    btn.disabled = true;
    var r = p.id ? await sb.from('projects').update(row).eq('id', p.id).select().single() : await sb.from('projects').insert(row).select().single();
    if (r.error) { btn.disabled = false; toast('Save failed: ' + r.error.message, 5000); return; }
    plan.project_id = r.data.id;
    var r2 = await sb.from('project_plans').upsert(plan, { onConflict: 'project_id' });
    if (r2.error) { btn.disabled = false; toast('Plan save failed: ' + r2.error.message, 5000); return; }

    // Upload after the row exists, so a failed upload never loses the project.
    var up = staged.length ? await pushPending(r.data.slug) : { done: 0, failed: 0 };
    btn.disabled = false;

    var pane = ($$('#ptabs button.active')[0] || { dataset: {} }).dataset.pane;
    var leftover = state.pending || [];
    await loadProjects(); renderAll();
    openProject(state.projects.find(function (x) { return x.id === r.data.id; }), pane);
    if (leftover.length) { state.pending = leftover; renderPage(); }

    if (up.failed) toast(up.failed + ' file' + (up.failed === 1 ? '' : 's') + ' failed to upload. The project is saved.', 6000);
    else if (pub) toast('Published. Live at ' + C.site + '/concepts/' + r.data.slug, 6000);
    else toast(up.done ? 'Saved and ' + up.done + ' file' + (up.done === 1 ? '' : 's') + ' uploaded.' : 'Saved.');
  }
  $('pSave').addEventListener('click', function () { persist(false); });
  $('pPublish').addEventListener('click', function () { persist(true); });

  $('pDelete').addEventListener('click', async function () {
    var p = state.proj; if (!p || !p.id) return;
    if (!confirm('Delete "' + p.name + '" and its plan? Requests are kept.')) return;
    var r = await sb.from('projects').delete().eq('id', p.id);
    if (r.error) { toast('Delete failed: ' + r.error.message, 4000); return; }
    await Promise.all([loadProjects(), loadRequests(), loadFeedback(), loadScans()]); renderAll(); go('projects'); toast('Deleted.');
  });

  /* ---------- the concept page ----------
     Dropped files are held here, not uploaded on the spot, so the slug can
     still change without orphaning a folder in the bucket under the old one.
     Save writes them; Publish writes them and puts the concept on the site. */
  var live = [];
  // Storage listing can lag an upload we just made, and the AI gate reads it.
  // Remember the slugs we have put a page under so publishing unlocks at once.
  var published = {};

  async function loadFiles(slug) {
    $('fileList').innerHTML = '<p class="muted">Loading…</p>'; live = [];
    async function walk(prefix) { var r = await sb.storage.from(BUCKET).list(prefix, { limit: 500 }); if (r.error) return; for (var i = 0; i < r.data.length; i++) { var e = r.data[i], path = prefix + '/' + e.name; if (e.id) live.push({ path: path, size: (e.metadata && e.metadata.size) || 0 }); else await walk(path); } }
    await walk(slug);
    // A concept can also be a page committed under public/concepts/<slug>/,
    // which Vercel serves ahead of the bucket and which never shows up in a
    // bucket listing. An existing concept URL counts as a published page too,
    // or the AI would sit locked on a concept that is plainly live.
    state.inBucket = live.some(function (f) { return f.path === slug + '/index.html'; });
    state.pageLive = published[slug] || state.inBucket || !!(state.proj && state.proj.concept_url);
    if (state.pageLive && !$('pConcept').value.trim()) $('pConcept').value = C.site + '/concepts/' + slug;
    renderPage(); gateAI();
  }

  function renderPage() {
    var p = state.proj || {}, slug = (p.id && p.slug) || slugify($('pSlug').value.trim() || $('pName').value);
    var pend = state.pending || [];
    var rows = live.map(function (f) { return { rel: f.path.slice(f.path.indexOf('/') + 1), kb: f.size ? Math.round(f.size / 1024) : 0, path: f.path }; })
      .concat(pend.map(function (f) { return { rel: f._rel, kb: Math.round(f.size / 1024), staged: true }; }));

    $('fileList').innerHTML = rows.length
      ? '<table class="data-table files">' + rows.map(function (f) {
          return '<tr' + (f.staged ? ' class="staged"' : '') + '><td><span class="mono">' + esc(f.rel) + '</span>' +
            (f.rel === 'index.html' ? ' ' + status('', 'page') : '') +
            (f.staged ? ' ' + status('amber', 'not published yet') : '') +
            '</td><td class="mono">' + (f.kb ? f.kb + ' KB' : '') + '</td><td>' +
            (f.staged ? '<button class="rm" type="button" data-drop="' + esc(f.rel) + '">Discard</button>'
                      : '<button class="rm" type="button" data-path="' + esc(f.path) + '">Remove</button>') +
            '</td></tr>';
        }).join('') + '</table>'
      : '<p class="muted">' + (state.pageLive ? 'Live, but not from the bucket. This page is committed at public/concepts/' + esc(slug) + '/ and Vercel serves that ahead of anything dropped here.'
          : p.id ? 'Nothing in the bucket for this slug yet.' : 'No page yet. Drop the HTML in above.') + '</p>';

    var url = slug ? C.site + '/concepts/' + slug : '';
    $('filesUrl').textContent = url;
    $('pageTag').innerHTML = state.pageLive ? status('', 'live') : pend.length ? status('amber', 'ready to publish') : status('grey', 'no page');
    var shadowed = state.pageLive && !state.inBucket && p.id;
    $('publishNote').textContent = pend.length
      ? pend.length + ' file' + (pend.length === 1 ? '' : 's') + ' waiting. Publish uploads them, shows the card on tcbconcepts.org and moves the stage on.'
        + (shadowed ? ' The committed page at public/concepts/' + slug + '/ has to go before this one shows.' : '')
      : state.pageLive ? 'Live. Publishing again re-checks the card and the stage.'
      : 'Drop an HTML file in to publish a page.';
    $('pPublish').disabled = !pend.length && !state.pageLive;
  }

  $('fileList').addEventListener('click', async function (e) {
    var b = e.target.closest('.rm'); if (!b) return;
    if (b.dataset.drop) { state.pending = state.pending.filter(function (f) { return f._rel !== b.dataset.drop; }); renderPage(); return; }
    if (!confirm('Remove ' + b.dataset.path.split('/').slice(1).join('/') + ' from the site?')) return;
    var r = await sb.storage.from(BUCKET).remove([b.dataset.path]);
    if (r.error) { toast(r.error.message, 4000); return; }
    loadFiles(state.proj.slug);
  });

  // Plan and pitch are written from the published page, so they wait for it.
  function gateAI() {
    var locked = !state.pageLive;
    ['aiPlan', 'aiScan'].forEach(function (id) { $(id).disabled = locked; });
    $('aiLock').hidden = !locked;
  }
  function guessType(n) { var e = (n.split('.').pop() || '').toLowerCase(); return { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', pdf: 'application/pdf', mp4: 'video/mp4', txt: 'text/plain' }[e] || 'application/octet-stream'; }
  /* Hold dropped files until Save or Publish. A lone HTML file becomes the
     page whatever it is called, so "drop the HTML in" is the whole job. */
  function stage(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return f.size > 0; });
    if (!list.length) return;
    list.forEach(function (f) {
      var rel = f._rel || f.webkitRelativePath || f.name;
      if (!f._rel && f.webkitRelativePath && rel.indexOf('/') > -1) rel = rel.split('/').slice(1).join('/');
      f._rel = rel;
    });
    var htmls = list.filter(function (f) { return /\.html?$/i.test(f._rel); });
    if (list.length === 1 && htmls.length === 1) list[0]._rel = 'index.html';
    else if (htmls.length === 1 && !htmls.some(function (f) { return f._rel === 'index.html'; }) && htmls[0]._rel.indexOf('/') < 0) htmls[0]._rel = 'index.html';

    state.pending = (state.pending || []).filter(function (o) { return !list.some(function (f) { return f._rel === o._rel; }); }).concat(list);
    var named = list.map(function (f) { return f._rel; });
    $('dropMsg').textContent = named.length > 3
      ? named.length + ' files ready: ' + named.slice(0, 3).join(', ') + '…'
      : 'Ready: ' + named.join(', ');
    if (!$('pName').value.trim() && htmls.length) {
      var t = null;
      htmls[0].text().then(function (txt) { t = (txt.match(/<title>([^<]*)<\/title>/i) || [])[1]; if (t && !$('pName').value.trim()) { $('pName').value = t.trim().split(/\s[—–|-]\s/)[0]; $('pName').dispatchEvent(new Event('input')); } });
    }
    renderPage();
  }

  async function pushPending(slug) {
    var list = state.pending || []; if (!list.length) return { done: 0, failed: 0 };
    var m = $('dropMsg'), done = 0, failed = 0;
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      m.textContent = 'Uploading ' + (i + 1) + ' of ' + list.length + ': ' + f._rel;
      var r = await sb.storage.from(BUCKET).upload(slug + '/' + f._rel, f, { upsert: true, contentType: guessType(f._rel), cacheControl: '60' });
      if (r.error) { failed++; toast(f._rel + ': ' + r.error.message, 5000); }
      else { done++; if (f._rel === 'index.html') published[slug] = true; }
    }
    m.textContent = done + ' uploaded' + (failed ? ', ' + failed + ' failed' : '') + '.';
    if (!failed) state.pending = [];
    return { done: done, failed: failed };
  }
  $('pickFiles').addEventListener('click', function (e) { e.preventDefault(); $('fileIn').click(); });
  $('pickDir').addEventListener('click', function (e) { e.preventDefault(); $('dirIn').click(); });
  $('fileIn').addEventListener('change', function () { stage(this.files); this.value = ''; });
  $('dirIn').addEventListener('change', function () { stage(this.files); this.value = ''; });
  (function () {
    var d = $('drop');
    ['dragenter','dragover'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add('over'); }); });
    ['dragleave','drop'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove('over'); }); });
    d.addEventListener('drop', async function (e) {
      var items = e.dataTransfer.items;
      if (items && items.length && items[0].webkitGetAsEntry) {
        var out = [];
        async function read(entry, prefix) { if (entry.isFile) { var file = await new Promise(function (res, rej) { entry.file(res, rej); }); file._rel = prefix + entry.name; out.push(file); } else if (entry.isDirectory) { var reader = entry.createReader(), batch; do { batch = await new Promise(function (res, rej) { reader.readEntries(res, rej); }); for (var i = 0; i < batch.length; i++) await read(batch[i], prefix + entry.name + '/'); } while (batch.length); } }
        var entries = []; for (var i = 0; i < items.length; i++) { var en = items[i].webkitGetAsEntry(); if (en) entries.push(en); }
        var single = entries.length === 1 && entries[0].isDirectory;
        for (var j = 0; j < entries.length; j++) await read(entries[j], '');
        if (single) out.forEach(function (f) { f._rel = f._rel.split('/').slice(1).join('/'); });
        stage(out);
      } else stage(e.dataTransfer.files);
    });
  })();

  /* ---------- AI: pitch and plan ---------- */
  async function callAI(mode) {
    var p = state.proj; if (!p || !p.id) { toast('Save the project first'); return null; }
    var token = await bearer(); if (!token) { toast('Sign in again'); return null; }
    var r = await fetch('/api/pitch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ slug: p.slug, mode: mode }) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.ok) { toast(d.error || d.reason || 'AI request failed', 6000); return null; }
    return d;
  }
  $('aiPlan').addEventListener('click', async function () {
    var empty = PLAN_KEYS.filter(function (k) { return !document.querySelector('.sec[data-key="' + k + '"] textarea').value.trim(); });
    if (!empty.length) { toast('Every plan section already has text'); return; }
    this.disabled = true; $('aiMsg').textContent = 'Drafting ' + empty.length + ' section' + (empty.length > 1 ? 's' : '') + '…';
    var d = await callAI('plan'); this.disabled = false;
    if (!d) { $('aiMsg').textContent = ''; return; }
    var n = 0; Object.keys(d.sections || {}).forEach(function (k) { var ta = document.querySelector('.sec[data-key="' + k + '"] textarea'); if (ta && !ta.value.trim()) { ta.value = d.sections[k]; n++; } });
    showPane('plan'); $('aiMsg').textContent = n ? n + ' drafted. Read, then Save.' : (d.note || 'Nothing to fill.');
  });
  $('aiScan').addEventListener('click', function () { var p = state.proj; if (!p || !p.current_url) return; go('ai'); $('scanUrl').value = p.current_url; fillScanProjects(); $('scanProject').value = p.slug; $('scanForm').requestSubmit(); });

  /* ---------- AI: site scans ---------- */
  function fillScanProjects() { var sel = $('scanProject'), cur = sel.value; sel.innerHTML = '<option value="">Unattached</option>' + state.projects.map(function (p) { return '<option value="' + esc(p.slug) + '">' + esc(p.name) + '</option>'; }).join(''); sel.value = cur; }
  $('scanProject').addEventListener('change', function () { var p = state.projects.find(function (x) { return x.slug === $('scanProject').value; }); if (p && p.current_url && !$('scanUrl').value) $('scanUrl').value = p.current_url; });
  var STEPS = [['Reading the site', 'Fetching the home page and measuring what is there…', 14], ['Checking robots and sitemap', 'How much of the site is public, and how it is organised…', 30], ['Identifying the platform', 'Matching signatures for builders, CMSs and sports systems…', 46], ['Writing the brief', 'The model is turning measurements into findings…', 64], ['Writing the pitch', 'Turning the findings into the proposal we hand over…', 86]];
  // The pitch the last scan produced, held so the report can show it.
  var lastPitch = null;
  $('scanForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var url = $('scanUrl').value.trim(); if (!url) return;
    var token = await bearer(); if (!token) { toast('Sign in again'); return; }
    $('scanGo').disabled = true; $('scanEmpty').hidden = true; $('scanReport').hidden = true; $('scanProgress').hidden = false;
    var i = 0, tick = setInterval(function () { if (i < STEPS.length) { $('scanTitle').textContent = STEPS[i][0]; $('scanCopy').textContent = STEPS[i][1]; $('scanFill').style.width = STEPS[i][2] + '%'; i++; } }, 6000); $('scanTitle').textContent = STEPS[0][0]; $('scanCopy').textContent = STEPS[0][1]; $('scanFill').style.width = '12%';
    var r = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ url: url, slug: $('scanProject').value || null }) });
    var d = await r.json().catch(function () { return {}; });
    clearInterval(tick); $('scanGo').disabled = false; $('scanProgress').hidden = true;
    if (!r.ok || !d.ok) { $('scanEmpty').hidden = false; toast(d.error || d.reason || 'Scan failed', 7000); return; }
    var slug = $('scanProject').value;
    lastPitch = null;

    // Site intel and the pitch are one job now: the proposal is argued from
    // what the scan actually measured, so it follows straight on.
    if (slug && $('scanPitch').checked) {
      $('scanProgress').hidden = false;
      $('scanTitle').textContent = STEPS[4][0]; $('scanCopy').textContent = STEPS[4][1]; $('scanFill').style.width = '86%';
      var pr = await fetch('/api/pitch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ slug: slug, mode: 'pitch' }) });
      var pd = await pr.json().catch(function () { return {}; });
      $('scanProgress').hidden = true;
      if (!pr.ok || !pd.ok) toast('Scan saved, but the pitch failed: ' + (pd.error || pd.reason || 'unknown'), 7000);
      else {
        var had = state.projects.find(function (x) { return x.slug === slug; });
        lastPitch = { slug: slug, text: pd.pitch, model: pd.model, saved: false };
        // Only write over a pitch that is not there yet; an existing one is
        // someone's edited copy, so replacing it stays a deliberate click.
        if (had && !had.pitch) {
          var up = await sb.from('projects').update({ pitch: pd.pitch, pitch_updated_at: new Date().toISOString() }).eq('slug', slug);
          if (!up.error) { lastPitch.saved = true; await loadProjects(); }
        }
      }
    }

    await loadScans(); renderRecentScans(); renderOverview();
    renderReport(state.scans.find(function (s) { return s.id === d.id; }) || d);
    toast(lastPitch ? (lastPitch.saved ? 'Scan and pitch saved.' : 'Scan saved. Pitch ready to review.') : 'Scan saved.');
  });
  function renderRecentScans() {
    $('recentScans').innerHTML = state.scans.length ? state.scans.slice(0, 8).map(function (s) { var p = state.projects.find(function (x) { return x.slug === s.project_slug; }); return '<button class="recent-scan" type="button" data-scan="' + s.id + '" style="width:100%;text-align:left;background:none;border:0;cursor:pointer">' + (p ? logo(p) : '<span class="project-logo grey">' + esc(initials(s.host)) + '</span>') + '<div><strong>' + esc(s.host) + '</strong><small>' + esc(ago(s.created_at)) + (p ? ' · ' + esc(p.name) : '') + '</small></div>' + status('', 'Ready') + '</button>'; }).join('') : '<p class="muted">No scans yet.</p>';
  }
  function scoreClass(v) { return /high|poor|large/i.test(v) ? 'warn' : /low|good|small/i.test(v) ? 'good' : ''; }
  /* The proposal written from this scan. Fresh from the run that just
     finished, or the project's saved one when an older report is reopened. */
  function pitchSection(s, p) {
    var fresh = lastPitch && p && lastPitch.slug === p.slug ? lastPitch : null;
    var text = fresh ? fresh.text : (p && p.pitch) || '';
    if (!p) return '<section class="report-section"><div class="report-section-head"><div><h3>Sales pitch</h3><p>Attach this scan to a project and the pitch is written from these findings.</p></div></div></section>';
    if (!text) return '<section class="report-section"><div class="report-section-head"><div><h3>Sales pitch</h3><p>Not written yet. Re-run the scan for ' + esc(p.name) + ' with the pitch box ticked.</p></div></div></section>';
    var note = fresh
      ? (fresh.saved ? 'Written from this scan and saved to the project.' : 'Written from this scan. Not saved yet — the project already has a pitch.')
      : 'The pitch saved on this project' + (p.pitch_updated_at ? ', ' + esc(fmt(p.pitch_updated_at)) : '') + '.';
    return '<section class="report-section"><div class="report-section-head"><div><h3>Sales pitch</h3><p>' + note + '</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (fresh && !fresh.saved ? '<button class="btn btn-primary btn-small" type="button" id="pitchSave">Replace the saved pitch</button>' : '') +
        '<button class="btn btn-secondary btn-small" type="button" data-proj="' + p.id + '" data-pane="pitch">Open in the project</button>' +
      '</div></div>' +
      '<div class="report-pitch">' + md(text) + '</div></section>';
  }
  function renderReport(s) {
    var rep = s.report || {}, sig = s.signals || {}, p = state.projects.find(function (x) { return x.slug === s.project_slug; });
    var sc = rep.scores || {};
    var iconFor = function (role) { return /cms|builder|generator/i.test(role) ? 'globe' : /framework|library|javascript|css/i.test(role) ? 'code' : /cdn|proxy|anti|security/i.test(role) ? 'shield' : /analytics|tag|pixel/i.test(role) ? 'trend' : /sports|management|payments|e-commerce/i.test(role) ? 'building' : 'file'; };
    $('scanReport').innerHTML =
      '<div class="report-cover"><div class="report-cover-top"><div><span class="ai-kicker"><svg class="icon" fill="none" stroke="currentColor" stroke-width="1.7"><use href="#i-spark"/></svg>Site intelligence report</span><h2>' + esc(p ? p.name + ' · Existing site' : s.host) + '</h2><p>' + esc(s.host) + ' · ' + esc(fmt(s.created_at)) + (s.model ? ' · ' + esc(s.model) : '') + '</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">' + (p ? '<button class="btn btn-secondary btn-small" type="button" data-proj="' + p.id + '" data-pane="scans">Open project</button>' : '<button class="btn btn-secondary btn-small" type="button" id="scanMakeProject">Create project from this</button>') + '<button class="btn btn-primary btn-small" type="button" id="scanToPlan" ' + (p ? '' : 'hidden') + '>Use as "Where the site is today"</button></div></div>' +
      '<div class="report-score-grid"><div class="report-score"><small>Modernization need</small><strong class="' + scoreClass(sc.modernization_need) + '">' + esc(sc.modernization_need || '—') + '</strong></div><div class="report-score"><small>Migration complexity</small><strong class="' + scoreClass(sc.migration_complexity) + '">' + esc(sc.migration_complexity || '—') + '</strong></div><div class="report-score"><small>Content volume</small><strong>' + esc(sc.content_volume || '—') + '</strong></div><div class="report-score"><small>Mobile readiness</small><strong class="' + scoreClass(sc.mobile_readiness) + '">' + esc(sc.mobile_readiness || '—') + '</strong></div></div></div>' +
      '<div class="report-body">' +
        '<section class="report-section"><div class="report-section-head"><div><h3>Executive summary</h3><p>' + esc(rep.summary || '') + '</p></div></div></section>' +
        '<section class="report-section"><div class="report-section-head"><div><h3>Detected technology</h3><p>What the home page and headers give away.</p></div></div><div class="tech-grid">' + ((rep.stack || []).length ? rep.stack.map(function (t) { return '<div class="tech-card"><span class="tech-icon"><svg class="icon" fill="none" stroke="currentColor" stroke-width="1.8"><use href="#i-' + iconFor(t.role || '') + '"/></svg></span><div><strong>' + esc(t.name) + '</strong><span>' + esc(t.role || '') + (t.evidence ? ' · ' + esc(t.evidence) : '') + '</span></div><span class="confidence">' + esc(t.confidence != null ? t.confidence + '%' : '') + '</span></div>'; }).join('') : '<p class="muted">Nothing recognisable. Custom build or heavily obscured.</p>') + '</div></section>' +
        '<section class="report-section"><div class="report-section-head"><div><h3>Measurements</h3><p>Straight from the page, no interpretation.</p></div></div><div class="signals">' +
          sigCard('Response', (sig.responseMs || 0) + ' ms', sig.responseMs > 2500 ? 'bad' : sig.responseMs < 800 ? 'good' : '') + sigCard('Page weight', Math.round((sig.htmlBytes || 0) / 1024) + ' KB HTML', sig.htmlBytes > 600000 ? 'bad' : '') + sigCard('Mobile viewport', sig.viewportMeta ? 'Yes' : 'Missing', sig.viewportMeta ? 'good' : 'bad') + sigCard('HTTPS', sig.https ? 'Yes' : 'No', sig.https ? 'good' : 'bad') +
          sigCard('Links in nav', sig.largestNav || 0, sig.largestNav > 25 ? 'bad' : '') + sigCard('Images', (sig.imageCount || 0) + ' · ' + (sig.imagesMissingAlt || 0) + ' no alt', sig.imagesMissingAlt > 3 ? 'bad' : '') + sigCard('PDF links', sig.pdfLinks || 0, sig.pdfLinks > 5 ? 'bad' : '') + sigCard('Scripts', sig.scriptCount || 0, sig.scriptCount > 25 ? 'bad' : '') +
          sigCard('Meta description', sig.metaDescription ? 'Yes' : 'Missing', sig.metaDescription ? 'good' : 'bad') + sigCard('Open Graph', sig.openGraph ? 'Yes' : 'No', sig.openGraph ? 'good' : '') + sigCard('Sitemap', sig.sitemap && sig.sitemap.present ? (sig.sitemap.urls + ' URLs') : 'None', sig.sitemap && sig.sitemap.present ? 'good' : '') + sigCard('Social links', (sig.socialLinks || []).join(', ') || 'none', '') +
        '</div></section>' +
        '<section class="report-section"><div class="report-section-head"><div><h3>Priority findings</h3><p>Ordered by impact.</p></div></div><div class="finding-list">' + (rep.findings || []).map(function (f, i) { return '<div class="finding"><span class="finding-number">' + String(i + 1).padStart(2, '0') + '</span><span><strong>' + esc(f.title) + '</strong><p>' + esc(f.detail) + (f.area ? ' <em style="color:var(--muted)">· ' + esc(f.area) + '</em>' : '') + '</p></span><span class="impact-badge ' + (/high/i.test(f.impact) ? 'high' : '') + '">' + esc(f.impact || '') + '</span></div>'; }).join('') + '</div></section>' +
        ((rep.preserve || []).length ? '<section class="report-section"><div class="report-section-head"><div><h3>Must keep working</h3><p>' + rep.preserve.map(esc).join(' · ') + '</p></div></div></section>' : '') +
        '<section class="report-section"><div class="report-section-head"><div><h3>Suggested build approach</h3><p>' + esc(rep.approach || '') + '</p></div></div></section>' +
        ((rep.pitch_angles || []).length ? '<section class="report-section"><div class="report-section-head"><div><h3>Pitch angles</h3></div></div>' + rep.pitch_angles.map(function (a, i) { return '<div class="angle"><span>' + (i + 1) + '</span><span>' + esc(a) + '</span></div>'; }).join('') + '</section>' : '') +
        pitchSection(s, p) +
      '</div>';
    $('scanReport').hidden = false; $('scanEmpty').hidden = true;
    var pSave = $('pitchSave');
    if (pSave) pSave.addEventListener('click', async function () {
      if (!lastPitch || !confirm('Replace the saved pitch for this project? The current one is lost.')) return;
      this.disabled = true;
      var up = await sb.from('projects').update({ pitch: lastPitch.text, pitch_updated_at: new Date().toISOString() }).eq('slug', lastPitch.slug);
      this.disabled = false;
      if (up.error) { toast('Could not save: ' + up.error.message, 5000); return; }
      lastPitch.saved = true; await loadProjects(); renderAll(); renderReport(s); toast('Pitch saved to the project.');
    });
    var toPlan = $('scanToPlan'); if (toPlan && p) toPlan.addEventListener('click', async function () {
      var text = reportToMarkdown(s);
      var cur = p.plan.current_stack;
      if (cur && !confirm('This project already has "Where the site is today" written. Replace it with the scan?')) return;
      var r = await sb.from('project_plans').upsert({ project_id: p.id, current_stack: text }, { onConflict: 'project_id' });
      if (r.error) { toast(r.error.message, 5000); return; }
      if (!p.current_url) await sb.from('projects').update({ current_url: s.url }).eq('id', p.id);
      await loadProjects(); renderAll(); toast('Written into the plan.'); openProject(state.projects.find(function (x) { return x.id === p.id; }), 'plan');
    });
    var mk = $('scanMakeProject'); if (mk) mk.addEventListener('click', async function () {
      var name = s.host.replace(/\.(com|ca|org|net)$/i, '').replace(/[-.]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var ins = { slug: slugify(s.host.replace(/\.(com|ca|org|net)$/i, '')), name: name, org_name: name, status: 'prospect', track: 'undecided', current_url: s.url, listed: false, summary: (rep.summary || '').slice(0, 280) };
      var r = await sb.from('projects').insert(ins).select().single();
      if (r.error && /duplicate|unique/i.test(r.error.message)) { ins.slug += '-' + Math.random().toString(36).slice(2, 6); r = await sb.from('projects').insert(ins).select().single(); }
      if (r.error) { toast(r.error.message, 5000); return; }
      await sb.from('project_plans').insert({ project_id: r.data.id, current_stack: reportToMarkdown(s) });
      await sb.from('site_scans').update({ project_slug: ins.slug }).eq('id', s.id);
      await Promise.all([loadProjects(), loadScans()]); renderAll(); openProject(state.projects.find(function (x) { return x.id === r.data.id; }), 'plan'); toast('Project created from the scan.');
    });
  }
  function sigCard(label, val, cls) { return '<div class="signal"><small>' + esc(label) + '</small><strong class="' + cls + '">' + esc(val) + '</strong></div>'; }
  function reportToMarkdown(s) {
    var r = s.report || {}, sig = s.signals || {};
    var lines = [];
    if (r.summary) lines.push(r.summary, '');
    if ((r.stack || []).length) lines.push('**Runs on:** ' + r.stack.map(function (t) { return t.name; }).join(', '), '');
    (r.findings || []).forEach(function (f) { lines.push('- **' + f.title + '** ' + f.detail); });
    var facts = [];
    if (sig.largestNav > 25) facts.push('The main menu carries ' + sig.largestNav + ' links.');
    if (!sig.viewportMeta) facts.push('No mobile viewport, so phones get the desktop layout.');
    if (sig.imagesMissingAlt > 3) facts.push(sig.imagesMissingAlt + ' images have no alt text.');
    if (sig.pdfLinks > 5) facts.push(sig.pdfLinks + ' links go to PDFs.');
    if (sig.responseMs > 2500) facts.push('The home page took ' + (sig.responseMs / 1000).toFixed(1) + ' seconds to answer.');
    if (facts.length) { lines.push(''); facts.forEach(function (f) { lines.push('- ' + f); }); }
    if ((r.preserve || []).length) lines.push('', '**Must keep working:** ' + r.preserve.join('; ') + '.');
    return lines.join('\n');
  }
  function renderProjectScans(slug) {
    var rows = state.scans.filter(function (s) { return s.project_slug === slug; });
    $('projScans').innerHTML = rows.length ? rows.map(function (s) { var rep = s.report || {}; return '<article class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>' + esc(s.host) + '</h2><p>' + esc(fmt(s.created_at)) + '</p></div><button class="btn btn-secondary btn-small" type="button" data-scan="' + s.id + '">Open report</button></div><div class="card-body"><p style="margin:0 0 10px;font-size:.9rem">' + esc(rep.summary || '') + '</p>' + ((rep.findings || []).slice(0, 3).map(function (f) { return '<div class="fb"><div class="m">' + esc(f.impact || '') + ' impact</div><p><b>' + esc(f.title) + '</b> ' + esc(f.detail) + '</p></div>'; }).join('')) + '</div></article>'; }).join('') : '<article class="card"><div class="card-body"><div class="empty-state"><h3>No scans yet</h3><p>Use "Scan their current site" in the AI panel.</p></div></div></article>';
  }

  /* ---------- project feedback ---------- */
  function renderProjectFeedback(slug) {
    var rows = state.feedback.filter(function (f) { return f.project_slug === slug; });
    // Point straight at the slideout these answers come from: #rate opens it.
    $('fbOpen').href = C.site + '/concepts/' + slug + '#rate';
    $('fbOpen').hidden = !slug;
    $('fbTally').innerHTML = tallyHTML(rows);
    var wt = rows.filter(function (x) { return x.feedback; });
    $('fbList').innerHTML = rows.length === 0 ? '<p class="muted">No responses yet.</p>' : (wt.length ? wt.map(function (x) { return '<div class="fb ' + esc(x.rating) + '"><div class="m">' + esc(x.rating) + ' · ' + esc(fmt(x.created_at)) + '</div><p>' + esc(x.feedback) + '</p></div>'; }).join('') : '<p class="muted">' + rows.length + ' rating' + (rows.length === 1 ? '' : 's') + ', no written comments yet.</p>');
  }

  /* ---------- requests ---------- */
  $('reqChips').addEventListener('click', function (e) { var b = e.target.closest('.filter-tab'); if (!b) return; state.reqStatus = b.dataset.status; $$('#reqChips .filter-tab').forEach(function (x) { x.classList.toggle('active', x === b); }); renderRequests(); });
  function fit(x) {
    var text = (x.org + ' ' + x.problem + ' ' + (x.site || '')).toLowerCase();
    var local = /coquitlam|port moody|anmore|belcarra|tri-cit|poco|pomo/.test(text);
    var f = [
      ['Serves the Tri-Cities', local ? 'Yes' : 'Unclear', local ? 20 : 8],
      ['Chose a door', x.track !== 'Not sure yet' ? x.track : 'Undecided', x.track === 'Collaboration' ? 20 : x.track === 'Paid work' ? 16 : 10],
      ['Told us what is broken', x.problem.length > 120 ? 'In detail' : 'Briefly', x.problem.length > 120 ? 20 : 12],
      ['Has a site to replace', x.site ? 'Yes' : 'None given', x.site ? 20 : 14],
      ['Reachable person', /@/.test(x.email) ? 'Yes' : 'No', 20],
    ];
    var score = f.reduce(function (a, b) { return a + b[2]; }, 0);
    return { factors: f, score: score, label: score >= 85 ? 'Strong fit' : score >= 65 ? 'Worth a look' : 'Weak fit', cls: score >= 85 ? '' : score >= 65 ? 'amber' : 'grey' };
  }
  function renderRequests() {
    var rows = state.requests.filter(function (x) { return (!state.reqStatus || x.status === state.reqStatus) && (!state.q || (x.org + ' ' + x.name + ' ' + x.email + ' ' + x.problem).toLowerCase().indexOf(state.q) > -1); });
    $('reqCount').textContent = 'Showing ' + rows.length + ' of ' + state.requests.length;
    $('reqRows').innerHTML = rows.length ? rows.map(function (x) { var f = fit(x); return '<tr data-req="' + x.id + '" style="cursor:pointer"><td><span class="name-cell"><span class="project-logo ' + (x.status === 'new' ? 'sky' : 'grey') + '">' + esc(initials(x.org)) + '</span><span><strong>' + esc(x.org) + '</strong><small>' + esc(x.name) + ' · ' + esc(x.kind) + '</small></span></span></td><td>' + trackTag(x.track) + '</td><td style="max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(x.problem) + '">' + esc(x.problem) + '</td><td><strong style="color:var(--green-dark)">' + f.score + '%</strong></td><td>' + esc(ago(x.created_at)) + '</td><td>' + reqTag(x.status) + '</td></tr>'; }).join('') : '<tr><td colspan="6"><div class="empty-state"><h3>Nothing here</h3><p>Requests from the Ask form land here.</p></div></td></tr>';
  }
  function renderSummary(x) {
    var f = fit(x), p = x.project_id ? state.projects.find(function (pp) { return pp.id === x.project_id; }) : null;
    $('reqSummary').innerHTML = '<div class="card-head"><div><h2>Request fit</h2><p>' + esc(x.org) + '</p></div>' + status(f.cls, f.label) + '</div><div class="card-body"><div class="fit-ring" style="--score:' + f.score + '"><span><strong>' + f.score + '</strong><small>Fit score</small></span></div><div class="fit-factors">' + f.factors.map(function (r) { return '<div class="fit-factor"><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>'; }).join('') + '</div><div class="summary-divider"></div><p class="summary-note">' + esc(x.problem.length > 220 ? x.problem.slice(0, 217) + '…' : x.problem) + '</p><div style="display:grid;gap:8px;margin-top:17px"><button class="btn btn-primary" type="button" data-req="' + x.id + '">Open request</button>' + (p ? '<button class="btn btn-secondary" type="button" data-proj="' + p.id + '">Open project</button>' : '') + (x.site ? '<button class="btn btn-secondary" type="button" data-scan-url="' + esc(x.site) + '">Research their website</button>' : '') + '</div></div>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-scan-url]'); if (!b) return; go('ai'); $('scanUrl').value = b.dataset.scanUrl; $('scanForm').requestSubmit(); });
  $('reqRows').addEventListener('mouseover', function (e) { var tr = e.target.closest('tr[data-req]'); if (tr && tr.dataset.req !== $('reqSummary').dataset.id) { $('reqSummary').dataset.id = tr.dataset.req; renderSummary(state.requests.find(function (x) { return x.id === tr.dataset.req; })); } });
  function openRequest(x) {
    state.req = x; renderSummary(x); $('reqSummary').dataset.id = x.id;
    $('rdOrg').textContent = x.org; $('rdK').textContent = x.kind + ' · received ' + fmt(x.created_at);
    $('rdMeta').innerHTML = reqTag(x.status) + trackTag(x.track);
    $('rdContact').innerHTML = esc(x.name) + ' · <a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>';
    $('rdSite').innerHTML = x.site ? '<a href="' + esc(x.site) + '" target="_blank" rel="noopener">' + esc(x.site) + '</a>' : '<span class="muted">none given</span>';
    var p = x.project_id ? state.projects.find(function (pp) { return pp.id === x.project_id; }) : null;
    $('rdProject').innerHTML = p ? '<a href="#" data-proj="' + p.id + '">' + esc(p.name) + '</a>' : '<span class="muted">not yet</span>';
    $('rdProblem').textContent = x.problem; $('rdStatus').value = x.status; $('rdNotes').value = x.notes || '';
    $('rdReply').href = 'mailto:' + encodeURIComponent(x.email) + '?subject=' + encodeURIComponent('Tri-Cities Board Concepts: ' + x.org);
    $('rdMakeProject').disabled = !!p; $('rdMakeProject').textContent = p ? 'Project exists' : 'Create project';
    $('drawer').hidden = false; $('drawerBackdrop').hidden = false;
  }
  function closeDrawer() { $('drawer').hidden = true; $('drawerBackdrop').hidden = true; }
  $('rdClose').addEventListener('click', closeDrawer); $('drawerBackdrop').addEventListener('click', closeDrawer);
  $('rdSave').addEventListener('click', async function () {
    if (!state.req) return;
    var r = await sb.from('requests').update({ status: $('rdStatus').value, notes: $('rdNotes').value.trim() || null }).eq('id', state.req.id).select().single();
    if (r.error) { toast('Save failed: ' + r.error.message, 4000); return; }
    Object.assign(state.req, r.data); renderAll(); openRequest(state.req); toast('Saved.');
  });
  $('rdMakeProject').addEventListener('click', async function () {
    var x = state.req; if (!x) return;
    var ins = { slug: slugify(x.org), name: x.org, org_name: x.org, org_type: x.kind, status: 'prospect', track: TRACK_MAP[x.track] || 'undecided', current_url: x.site || null, contact_name: x.name, contact_email: x.email, request_id: x.id, summary: x.problem.length > 280 ? x.problem.slice(0, 277) + '…' : x.problem, listed: false };
    var r = await sb.from('projects').insert(ins).select().single();
    if (r.error && /duplicate|unique/i.test(r.error.message)) { ins.slug += '-' + Math.random().toString(36).slice(2, 6); r = await sb.from('projects').insert(ins).select().single(); }
    if (r.error) { toast('Could not create project: ' + r.error.message, 4000); return; }
    await sb.from('project_plans').insert({ project_id: r.data.id });
    await sb.from('requests').update({ project_id: r.data.id, status: x.status === 'new' ? 'reviewing' : x.status }).eq('id', x.id);
    await Promise.all([loadRequests(), loadProjects()]); renderAll(); closeDrawer();
    openProject(state.projects.find(function (p) { return p.id === r.data.id; })); toast('Project created. Hidden from the site until you tick "Show on the landing page".', 4500);
  });

  /* ---------- feedback ---------- */
  function renderFeedback() {
    $('allTally').innerHTML = tallyHTML(state.feedback);
    $('fbCount').textContent = state.feedback.length + ' response' + (state.feedback.length === 1 ? '' : 's');
    $('fbRows').innerHTML = state.feedback.length ? state.feedback.map(function (f) { var p = state.projects.find(function (pp) { return pp.slug === f.project_slug; }); var cls = { worse: 'red', same: 'grey', better: '', remarkable: 'amber' }[f.rating] || 'grey'; return '<tr' + (p ? ' data-proj="' + p.id + '" data-pane="feedback" style="cursor:pointer"' : '') + '><td>' + esc(fmt(f.created_at)) + '</td><td><strong>' + esc(p ? p.name : f.project_slug) + '</strong></td><td>' + status(cls, f.rating) + '</td><td style="white-space:pre-wrap">' + (f.feedback ? esc(f.feedback) : '<span class="muted">rating only</span>') + '</td></tr>'; }).join('') : '<tr><td colspan="4"><div class="empty-state"><h3>No responses yet</h3><p>Answers from the poll on each concept page land here.</p></div></td></tr>';
  }

  /* ---------- settings ---------- */
  function renderSettings() { $('adminList').innerHTML = state.admins.length ? state.admins.map(function (a) { return '<div class="fit-factor"><span>' + esc(a.email) + '</span><strong>' + esc(new Date(a.added_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })) + '</strong></div>'; }).join('') + '<p class="muted" style="margin-top:12px">Add or remove addresses in the Supabase table <span class="mono">admins</span>.</p>' : '<p class="muted">Could not read the admin list.</p>'; }

  /* ---------- start ---------- */
  // Layout preview without a session: window.__tcbPreview({projects:[…],requests:[…],feedback:[…],scans:[…]}).
  // Draws the shell with the rows given; it cannot read or write anything, RLS still applies.
  window.__tcbPreview = function (data) { state.user = { email: 'preview@tricitiesboard.org' }; Object.assign(state, data || {}); entered = true; $('whoEmail').textContent = 'preview'; $('gate').hidden = true; $('app').hidden = false; renderAll(); go('overview'); return { openProject: openProject, openRequest: openRequest, renderReport: renderReport, go: go }; };
  sb.auth.getSession().then(function (r) { boot(r.data.session); });
})();
