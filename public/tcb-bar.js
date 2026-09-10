/**
 * Tri-Cities Board Concepts bar and feedback poll.
 *
 * Every concept site includes this one line at the end of <body>:
 *
 *   <script src="/tcb-bar.js"
 *           data-concept="PoCo Pirates"
 *           data-slug="poco-pirates"
 *           data-current="https://www.pocominorhockey.com"
 *           defer></script>
 *
 * It prepends a slim, sticky Tri-Cities Board bar above the concept's own
 * header (naming the concept, linking to the existing site, back to the
 * showcase, and straight to the inquiry form), and adds a slide-out poll in
 * the bottom right that asks what the visitor likes or does not like, then
 * how the concept compares to the existing site. Answers go to /api/poll
 * and are tied to the project by slug.
 */
(function () {
  var me = document.currentScript;
  var concept = (me && me.getAttribute('data-concept')) || 'Concept';
  var slug = (me && me.getAttribute('data-slug')) || '';
  var current = (me && me.getAttribute('data-current')) || '';
  var HOME = '/';
  var ASK = '/#request';

  var css = [
    /* ---- bar ---- */
    '.tcb-bar{position:sticky;top:0;z-index:2147483000;background:#111827;color:#fff;',
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;line-height:1;',
      'border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 1px 0 rgba(74,222,128,.35)}',
    '.tcb-bar *,.tcb-poll *{box-sizing:border-box}',
    '.tcb-bar .in{max-width:1368px;margin:0 auto;padding:0 20px;height:48px;display:flex;align-items:center;gap:14px}',
    '.tcb-bar a{color:inherit;text-decoration:none}',
    '.tcb-bar .brand{display:flex;align-items:center;gap:9px;min-width:0;flex:0 1 auto}',
    '.tcb-bar .brand svg{width:26px;height:26px;flex:0 0 auto;display:block}',
    '.tcb-bar .wm{display:flex;flex-direction:column;line-height:1.05;white-space:nowrap}',
    '.tcb-bar .wm b{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:700;font-size:13.5px;letter-spacing:-.01em}',
    '.tcb-bar .wm i{font-style:normal;font-size:8.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#4ADE80;margin-top:3px}',
    '.tcb-bar .sep{width:1px;height:22px;background:rgba(255,255,255,.14);flex:0 0 auto}',
    '.tcb-bar .which{display:flex;align-items:center;gap:8px;color:#9CA3AF;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tcb-bar .which .tag{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#4ADE80;border:1px solid rgba(74,222,128,.35);border-radius:999px;padding:4px 8px;flex:0 0 auto}',
    '.tcb-bar .which .name{color:#E5E7EB;font-weight:500;overflow:hidden;text-overflow:ellipsis}',
    '.tcb-bar .acts{margin-left:auto;display:flex;align-items:center;gap:6px;flex:0 0 auto}',
    '.tcb-bar .lnk{padding:8px 10px;border-radius:7px;color:#D1D5DB;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}',
    '.tcb-bar .lnk:hover{color:#fff;background:rgba(255,255,255,.09)}',
    '.tcb-bar .lnk svg{width:12px;height:12px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.8}',
    '.tcb-bar .ask{display:inline-flex;align-items:center;gap:7px;background:#16A34A;color:#fff;font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:13.5px;padding:9px 14px;border-radius:8px;white-space:nowrap;transition:background .15s}',
    '.tcb-bar .ask:hover{background:#15803D}',
    '.tcb-bar .ask svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.tcb-bar a:focus-visible,.tcb-poll button:focus-visible,.tcb-poll textarea:focus-visible{outline:2px solid #38BDF8;outline-offset:2px;border-radius:6px}',
    '@media (max-width:760px){.tcb-bar .in{height:46px;padding:0 12px;gap:10px}.tcb-bar .which{display:none}.tcb-bar .sep{display:none}.tcb-bar .lnk.all{display:none}.tcb-bar .lnk.cur span{display:none}}',
    '@media (max-width:400px){.tcb-bar .wm b{font-size:12.5px}.tcb-bar .ask{padding:8px 11px;font-size:13px}}',

    /* ---- poll ---- */
    '.tcb-poll{position:fixed;right:18px;bottom:18px;z-index:2147482999;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.45;color:#111827}',
    '.tcb-poll .tab{display:inline-flex;align-items:center;gap:8px;background:#111827;color:#fff;border:0;cursor:pointer;font:inherit;font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:13.5px;padding:11px 15px;border-radius:999px;box-shadow:0 8px 24px rgba(17,24,39,.32);transition:transform .15s,background .15s}',
    '.tcb-poll .tab:hover{background:#1F2937;transform:translateY(-1px)}',
    '.tcb-poll .tab .dot{width:8px;height:8px;border-radius:50%;background:#4ADE80;box-shadow:0 0 0 3px rgba(74,222,128,.25)}',
    '.tcb-poll .panel{position:absolute;right:0;bottom:0;width:340px;max-width:calc(100vw - 36px);background:#fff;border:1px solid #E5E7EB;border-radius:16px;box-shadow:0 18px 50px rgba(17,24,39,.28);overflow:hidden;',
      'opacity:0;transform:translateY(14px) scale(.98);pointer-events:none;transition:opacity .18s,transform .18s}',
    '.tcb-poll.open .panel{opacity:1;transform:none;pointer-events:auto}',
    '.tcb-poll.open .tab{opacity:0;pointer-events:none}',
    '.tcb-poll .ph{background:#111827;color:#fff;padding:14px 16px 13px;display:flex;align-items:flex-start;gap:10px}',
    '.tcb-poll .ph .ey{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#4ADE80;font-weight:600;margin-bottom:4px}',
    '.tcb-poll .ph b{font-family:Outfit,Inter,system-ui,sans-serif;font-size:15.5px;font-weight:700;display:block;line-height:1.2}',
    '.tcb-poll .x{margin-left:auto;background:none;border:0;color:#9CA3AF;cursor:pointer;font-size:20px;line-height:1;padding:0 2px}',
    '.tcb-poll .x:hover{color:#fff}',
    '.tcb-poll .pb{padding:14px 16px 16px}',
    '.tcb-poll .q{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:14.5px;margin:0 0 8px;color:#111827}',
    '.tcb-poll .hint{color:#6B7280;font-size:12.5px;margin:0 0 10px}',
    '.tcb-poll textarea{width:100%;min-height:96px;resize:vertical;font:inherit;font-size:14px;color:#111827;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;line-height:1.5}',
    '.tcb-poll textarea:focus{outline:none;border-color:#16A34A;background:#fff}',
    '.tcb-poll .row{display:flex;gap:8px;margin-top:12px;align-items:center}',
    '.tcb-poll .btn{font:inherit;font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:14px;border:0;cursor:pointer;background:#16A34A;color:#fff;padding:10px 16px;border-radius:9px;display:inline-flex;align-items:center;gap:7px}',
    '.tcb-poll .btn:hover{background:#15803D}',
    '.tcb-poll .btn[disabled]{opacity:.55;cursor:default}',
    '.tcb-poll .skip{margin-left:auto;background:none;border:0;color:#6B7280;cursor:pointer;font:inherit;font-size:13px;padding:6px 4px}',
    '.tcb-poll .skip:hover{color:#111827;text-decoration:underline}',
    '.tcb-poll .steps{display:flex;gap:5px;margin-bottom:12px}',
    '.tcb-poll .steps i{height:4px;flex:1;border-radius:2px;background:#E5E7EB}',
    '.tcb-poll .steps i.on{background:#16A34A}',
    '.tcb-poll .opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.tcb-poll .opt{font:inherit;cursor:pointer;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:11px;padding:12px 10px;text-align:left;display:flex;flex-direction:column;gap:3px;transition:border-color .12s,background .12s}',
    '.tcb-poll .opt b{font-family:Outfit,Inter,system-ui,sans-serif;font-size:14.5px;font-weight:700;color:#111827}',
    '.tcb-poll .opt span{font-size:12px;color:#6B7280;line-height:1.3}',
    '.tcb-poll .opt:hover{border-color:#9CA3AF;background:#fff}',
    '.tcb-poll .opt.worse:hover{border-color:#DC2626}.tcb-poll .opt.same:hover{border-color:#6B7280}.tcb-poll .opt.better:hover{border-color:#16A34A}.tcb-poll .opt.remarkable:hover{border-color:#F59E0B}',
    '.tcb-poll .opt.worse b{color:#B91C1C}.tcb-poll .opt.better b{color:#15803D}.tcb-poll .opt.remarkable b{color:#B45309}',
    '.tcb-poll .done{text-align:center;padding:8px 0 4px}',
    '.tcb-poll .done .tick{width:44px;height:44px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}',
    '.tcb-poll .done .tick svg{width:22px;height:22px;stroke:#16A34A;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.tcb-poll .done b{font-family:Outfit,Inter,system-ui,sans-serif;font-size:16px;display:block;margin-bottom:6px}',
    '.tcb-poll .done p{color:#6B7280;font-size:13.5px;margin:0}',
    '.tcb-poll .done a{color:#16A34A;font-weight:600;text-decoration:none}',
    '.tcb-poll .err{color:#B91C1C;font-size:12.5px;margin-top:8px}',
    '.tcb-poll .hp{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}',
    '@media (max-width:480px){.tcb-poll{right:12px;bottom:12px}.tcb-poll .panel{width:calc(100vw - 24px)}}',
    '@media (prefers-reduced-motion:reduce){.tcb-poll .panel,.tcb-poll .tab{transition:none}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------- bar */
  var ext = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/></svg>';
  var bar = document.createElement('div');
  bar.className = 'tcb-bar';
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Tri-Cities Board Concepts');
  bar.innerHTML =
    '<div class="in">' +
      '<a class="brand" href="' + HOME + '" aria-label="Tri-Cities Board Concepts home">' +
        '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
          '<path d="M4 30L12 14L17 22L22 12L30 26L36 18L40 30" stroke="#4ADE80" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="M4.5 26L8 19L11.5 26" fill="#22C55E" opacity=".9"/>' +
          '<path d="M2 34C8 31 14 35 20 32C26 29 32 33 40 31" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" opacity=".8"/>' +
        '</svg>' +
        '<span class="wm"><b>Tri-Cities Board</b><i>Concepts</i></span>' +
      '</a>' +
      '<span class="sep" aria-hidden="true"></span>' +
      '<span class="which"><span class="tag">Concept</span><span class="name"></span></span>' +
      '<span class="acts">' +
        (current ? '<a class="lnk cur" href="' + current.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener"><span>Existing site</span>' + ext + '</a>' : '') +
        '<a class="lnk all" href="' + HOME + '#work">All concepts</a>' +
        '<a class="ask" href="' + ASK + '">Ask us to build yours' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</a>' +
      '</span>' +
    '</div>';
  bar.querySelector('.name').textContent = concept;

  var pushed = [];
  var baseScrollPad = null;

  function offset() {
    var h = Math.ceil(bar.getBoundingClientRect().height);
    if (!pushed.length) {
      var candidates = document.querySelectorAll('header, nav, [class*="head"], [class*="nav"], [class*="strip"], [class*="bar"]');
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (el === bar || bar.contains(el)) continue;
        var cs = getComputedStyle(el);
        if ((cs.position === 'sticky' || cs.position === 'fixed') && parseInt(cs.top, 10) === 0) pushed.push(el);
      }
    }
    for (var j = 0; j < pushed.length; j++) pushed[j].style.top = h + 'px';
    if (baseScrollPad === null) baseScrollPad = parseInt(getComputedStyle(document.documentElement).scrollPaddingTop, 10) || 0;
    document.documentElement.style.scrollPaddingTop = (baseScrollPad + h) + 'px';
  }

  /* --------------------------------------------------------------- poll */
  var KEY = 'tcb-poll-' + slug;
  var poll = null;

  function buildPoll() {
    if (!slug) return;
    poll = document.createElement('div');
    poll.className = 'tcb-poll';
    poll.innerHTML =
      '<button class="tab" type="button" aria-haspopup="dialog"><span class="dot" aria-hidden="true"></span>Rate this concept</button>' +
      '<div class="panel" role="dialog" aria-label="Rate this concept">' +
        '<div class="ph"><div><div class="ey">Tri-Cities Board Concepts</div><b>What do you think of this concept?</b></div>' +
          '<button class="x" type="button" aria-label="Close">&times;</button></div>' +
        '<div class="pb">' +
          '<div class="steps"><i class="on"></i><i></i></div>' +
          '<div class="hp" aria-hidden="true"><label>Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="s1">' +
            '<p class="q">What do you like, or not like, about it?</p>' +
            '<p class="hint">Be blunt. This goes straight to the people building it.</p>' +
            '<textarea placeholder="The schedule on the front page is great. The purple is a bit much. Where do I find the coaches?"></textarea>' +
            '<div class="row"><button class="btn next" type="button">Next <span aria-hidden="true">&rarr;</span></button><button class="skip" type="button">Skip this</button></div>' +
          '</div>' +
          '<div class="s2" hidden>' +
            '<p class="q">Compared with the existing site, this is&hellip;</p>' +
            '<div class="opts">' +
              '<button class="opt worse" type="button" data-r="worse"><b>Worse</b><span>The current site is better</span></button>' +
              '<button class="opt same" type="button" data-r="same"><b>Same</b><span>Not much difference</span></button>' +
              '<button class="opt better" type="button" data-r="better"><b>Better</b><span>A clear step up</span></button>' +
              '<button class="opt remarkable" type="button" data-r="remarkable"><b>Remarkable</b><span>Ship it</span></button>' +
            '</div>' +
            '<div class="err" hidden></div>' +
          '</div>' +
          '<div class="s3 done" hidden>' +
            '<div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>' +
            '<b>Thanks. That helps.</b>' +
            '<p>Your answer is with the Tri-Cities Board team.' + (current ? ' <a href="' + current.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">See the existing site</a>.' : '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    var tab = poll.querySelector('.tab'), x = poll.querySelector('.x');
    var s1 = poll.querySelector('.s1'), s2 = poll.querySelector('.s2'), s3 = poll.querySelector('.s3');
    var steps = poll.querySelectorAll('.steps i');
    var ta = poll.querySelector('textarea');
    var err = poll.querySelector('.err');
    var answered = false;
    try { answered = localStorage.getItem(KEY) === '1'; } catch (e) {}

    function open() {
      poll.classList.add('open');
      if (answered) { show(3); return; }
      setTimeout(function () { ta.focus(); }, 200);
    }
    function close() { poll.classList.remove('open'); }
    function show(n) {
      s1.hidden = n !== 1; s2.hidden = n !== 2; s3.hidden = n !== 3;
      steps[0].classList.toggle('on', n >= 1); steps[1].classList.toggle('on', n >= 2);
      poll.querySelector('.steps').hidden = n === 3;
    }

    tab.addEventListener('click', open);
    x.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && poll.classList.contains('open')) close(); });
    poll.querySelector('.next').addEventListener('click', function () { show(2); });
    poll.querySelector('.skip').addEventListener('click', function () { ta.value = ''; show(2); });

    poll.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () {
        var all = poll.querySelectorAll('.opt'); all.forEach(function (o) { o.disabled = true; });
        err.hidden = true;
        fetch('/api/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: slug, rating: b.dataset.r, feedback: ta.value.trim(),
            page: location.pathname, company: poll.querySelector('[name=company]').value
          })
        }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function (d) {
            if (!d.ok) throw new Error('nope');
            answered = true;
            try { localStorage.setItem(KEY, '1'); } catch (e) {}
            show(3);
          })
          .catch(function () {
            all.forEach(function (o) { o.disabled = false; });
            err.textContent = 'That did not save. Try once more, or tell us at outreach@tricitiesboard.org.';
            err.hidden = false;
          });
      });
    });

    document.body.appendChild(poll);
    // Nudge: open the tab once after the visitor has had a real look.
    if (!answered) {
      var nudged = false;
      function nudge() {
        if (nudged) return;
        if (window.scrollY > Math.max(600, document.documentElement.scrollHeight * 0.35)) {
          nudged = true; tab.style.transform = 'translateY(-3px)';
          setTimeout(function () { tab.style.transform = ''; }, 500);
        }
      }
      window.addEventListener('scroll', nudge, { passive: true });
    }
  }

  function mount() {
    document.body.insertBefore(bar, document.body.firstChild);
    offset();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(offset);
    window.addEventListener('load', offset);
    window.addEventListener('resize', offset);
    buildPoll();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
