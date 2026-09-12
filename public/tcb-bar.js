/**
 * Tri-Cities Board Concepts bar and feedback poll.
 *
 * Every concept site includes this one line at the end of <body>:
 *
 *   <script src="/tcb-bar.js"
 *           data-concept="PoCo Pirates"
 *           data-slug="poco-pirates"
 *           data-current="https://www.pocominorhockey.com"   (optional)
 *           defer></script>
 *
 * It prepends a slim, sticky Tri-Cities Board bar above the concept's own
 * header (naming the concept, linking to the existing site, back to the
 * showcase, and straight to the inquiry form), and adds a poll that slides
 * out from the right edge, collapsed to a small arrow cue, asking what the
 * visitor likes or does not like, then how the concept compares to the
 * existing site. Answers go to /api/poll and are tied to the project by slug.
 *
 * The poll lives on a rail whose top and bottom are measured from the
 * concept's own sticky header and any fixed bottom navigation, so neither the
 * cue nor the open panel ever sits on top of the site's own controls.
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
    '.tcb-bar .in{max-width:1368px;margin:0 auto;padding:0 24px;height:48px;display:flex;align-items:center;gap:14px}',
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
    '.tcb-bar a:focus-visible,.tcb-poll a:focus-visible,.tcb-poll button:focus-visible,.tcb-poll textarea:focus-visible{outline:2px solid #38BDF8;outline-offset:2px;border-radius:6px}',
    '@media (max-width:760px){.tcb-bar .in{height:46px;padding:0 12px;gap:10px}.tcb-bar .which{display:none}.tcb-bar .sep{display:none}.tcb-bar .lnk.all{display:none}.tcb-bar .lnk.cur span{display:none}}',
    '@media (max-width:400px){.tcb-bar .wm b{font-size:12.5px}.tcb-bar .ask{padding:8px 11px;font-size:13px}}',

    /* ---- poll: slides out from the right edge ---- */
    /* A zero-width rail pinned to the right edge. JS sets its top and bottom to
       the space the concept's own sticky header and fixed bottom nav leave over,
       so the cue and the open panel both stay clear of them. */
    /* Above the TCB bar (2147483000): full screen means the whole screen, and
       the bar would otherwise paint over the panel header and swallow the
       close button. In drawer mode the rail starts below the bar anyway. */
    '.tcb-poll{position:fixed;right:0;top:10px;bottom:10px;width:0;z-index:2147483001;pointer-events:none;',
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.45;color:#111827}',
    '.tcb-poll .tab,.tcb-poll .panel{pointer-events:auto}',
    '.tcb-poll [hidden]{display:none!important}',
    /* The widget is injected into whatever CSS a prospect's own site carries, so
       generic class names collide. PoCo's own .skip is an off-screen
       skip-to-content link, which dragged our "Skip this" button 9999px out of
       view. Neutralise positioning leaks; rules below re-declare what they need. */
    '.tcb-poll .panel *{position:static;left:auto;right:auto;top:auto;bottom:auto;float:none;max-width:none}',

    /* collapsed cue */
    '.tcb-poll .tab{position:absolute;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:9px;',
      'background:#111827;color:#fff;border:1px solid rgba(255,255,255,.18);border-right:0;cursor:pointer;font:inherit;',
      'font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:11.5px;',
      'letter-spacing:.1em;text-transform:uppercase;padding:15px 8px 14px;border-radius:12px 0 0 12px;box-shadow:-5px 0 20px rgba(17,24,39,.3);',
      'transition:transform .18s,background .15s,opacity .18s}',
    '.tcb-poll .tab:hover{background:#1F2937;transform:translateY(-50%) translateX(-4px)}',
    '.tcb-poll .tab .vt{writing-mode:vertical-rl;text-orientation:mixed}',
    '.tcb-poll .tab .arw{width:13px;height:13px;stroke:currentColor;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}',
    '.tcb-poll .tab .dot{width:7px;height:7px;border-radius:50%;background:#4ADE80;box-shadow:0 0 0 3px rgba(74,222,128,.22);flex:0 0 auto}',
    '@keyframes tcb-cue{0%,100%{transform:translateY(-50%)}35%{transform:translateY(-50%) translateX(-9px)}70%{transform:translateY(-50%) translateX(-2px)}}',
    '.tcb-poll .tab.cue{animation:tcb-cue .65s ease}',

    /* panel */
    '.tcb-poll .panel{position:absolute;right:0;top:50%;width:312px;max-width:calc(100vw - 56px);',
      'height:100%;max-height:min(100%,600px);display:flex;flex-direction:column;',
      'background:#fff;border:1px solid #E5E7EB;border-right:0;border-radius:16px 0 0 16px;box-shadow:-14px 0 46px rgba(17,24,39,.26);overflow:hidden;',
      'transform:translate(100%,-50%);opacity:0;visibility:hidden;pointer-events:none;',
      'transition:transform .26s cubic-bezier(.22,.7,.1,1),opacity .2s,visibility .26s}',
    '.tcb-poll.open .panel{transform:translate(0,-50%);opacity:1;visibility:visible;pointer-events:auto}',
    '.tcb-poll.open .tab{transform:translateY(-50%) translateX(100%);opacity:0;pointer-events:none}',
    '.tcb-poll .ph{background:#111827;color:#fff;padding:14px 16px 13px;display:flex;align-items:flex-start;gap:10px;flex:0 0 auto}',
    '.tcb-poll .ph .ey{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#4ADE80;font-weight:600;margin-bottom:4px}',
    '.tcb-poll .ph b{font-family:Outfit,Inter,system-ui,sans-serif;font-size:15.5px;font-weight:700;display:block;line-height:1.2}',
    '.tcb-poll .x{margin-left:auto;background:none;border:0;color:#9CA3AF;cursor:pointer;font-size:20px;line-height:1;padding:0 2px;flex:0 0 auto}',
    '.tcb-poll .x:hover{color:#fff}',
    '.tcb-poll .pb{padding:14px 16px 16px;flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch}',
    '.tcb-poll .s1,.tcb-poll .s2{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
    '.tcb-poll .s3{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center}',
    '.tcb-poll .q{font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:14.5px;margin:0 0 8px;color:#111827}',
    '.tcb-poll .hint{color:#6B7280;font-size:12.5px;margin:0 0 10px}',
    '.tcb-poll textarea{width:100%;flex:1 1 auto;min-height:130px;resize:none;font:inherit;font-size:14px;color:#111827;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:10px;padding:10px 12px;line-height:1.5}',
    '.tcb-poll textarea:focus{outline:none;border-color:#16A34A;background:#fff}',
    '.tcb-poll .row{display:flex;gap:8px;margin-top:12px;align-items:center;flex:0 0 auto}',
    '.tcb-poll .btn{font:inherit;font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:14px;border:0;cursor:pointer;background:#16A34A;color:#fff;padding:10px 16px;border-radius:9px;display:inline-flex;align-items:center;gap:7px}',
    '.tcb-poll .btn:hover{background:#15803D}',
    '.tcb-poll .btn[disabled]{opacity:.55;cursor:default}',
    '.tcb-poll .skip{margin-left:auto;background:none;border:0;color:#6B7280;cursor:pointer;font:inherit;font-size:13px;padding:6px 4px}',
    '.tcb-poll .skip:hover{color:#111827;text-decoration:underline}',
    '.tcb-poll .steps{display:flex;gap:5px;margin-bottom:12px;flex:0 0 auto}',
    '.tcb-poll .steps i{height:4px;flex:1;border-radius:2px;background:#E5E7EB}',
    '.tcb-poll .steps i.on{background:#16A34A}',
    /* You cannot answer the comparison question without looking, so offer the
       existing site in a new tab right where it is asked. */
    '.tcb-poll .peek{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;flex:0 0 auto;margin:0 0 12px;max-width:100%;',
      'font-family:Outfit,Inter,system-ui,sans-serif;font-size:13px;font-weight:600;color:#111827;text-decoration:none;',
      'background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:9px;padding:9px 12px;transition:border-color .12s,background .12s}',
    '.tcb-poll .peek:hover{border-color:#9CA3AF;background:#fff;color:#111827}',
    '.tcb-poll .peek .pk{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tcb-poll .peek svg{width:12px;height:12px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.7;flex:0 0 auto}',
    '.tcb-poll .opts{display:grid;grid-template-columns:1fr;grid-auto-rows:minmax(62px,1fr);gap:8px;flex:1 1 auto;min-height:0}',
    '.tcb-poll .opt{font:inherit;cursor:pointer;background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:11px;padding:12px 13px;text-align:left;display:flex;flex-direction:column;justify-content:center;gap:3px;transition:border-color .12s,background .12s}',
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
    '.tcb-poll .err{color:#B91C1C;font-size:12.5px;margin-top:8px;flex:0 0 auto}',
    '.tcb-poll .hp{position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px;height:1px;overflow:hidden}',
    '@media (max-width:560px){.tcb-poll .tab .vt{display:none}.tcb-poll .tab{gap:7px;padding:12px 9px;border-radius:11px 0 0 11px}}',
    /* On a phone the drawer becomes a dedicated full-screen feedback view:
       it takes the whole viewport instead of sharing it with the site. */
    '@media (max-width:640px){',
      '.tcb-poll .panel{position:fixed;inset:0;width:auto;max-width:none;height:auto;max-height:none;',
        'border:0;border-radius:0;box-shadow:none;transform:translateX(100%)}',
      '.tcb-poll.open .panel{transform:translateX(0)}',
      '.tcb-poll .ph{padding:15px 16px;align-items:center}',
      '.tcb-poll .ph b{font-size:17px}',
      '.tcb-poll .x{width:44px;height:44px;font-size:27px;display:flex;align-items:center;justify-content:center;margin:-6px -8px -6px auto}',
      '.tcb-poll .pb{padding:16px 18px 20px}',
      '.tcb-poll .q{font-size:16px}',
      '.tcb-poll .hint{font-size:13.5px}',
      /* 16px keeps iOS from zooming the page when the field takes focus */
      '.tcb-poll textarea{font-size:16px;min-height:150px}',
      '.tcb-poll .peek{font-size:14px;padding:12px 15px;margin-bottom:14px}',
      '.tcb-poll .opts{grid-auto-rows:minmax(96px,auto);align-content:start;gap:10px}',
      '.tcb-poll .btn{font-size:15.5px;padding:13px 20px}',
      '.tcb-poll .skip{font-size:14px;padding:10px 6px}',
      '.tcb-poll .done b{font-size:18px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.tcb-poll .panel,.tcb-poll .tab{transition:none}.tcb-poll .tab.cue{animation:none}}'
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
        (current ? '<a class="lnk cur" href="' + current.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener"><span>View current website</span>' + ext + '</a>' : '') +
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

  /* The rail only gets the room the site is not already using: the sticky
     header stack at the top, and any fixed full-width bottom navigation at the
     foot (concepts often show one on phones only). Measured rather than
     assumed, so the poll never lands on top of the site's own controls. */
  var GAP = 10;
  var footers = null;
  var fitting = false;
  var railTop = -1, railBot = -1;

  function railFit() {
    if (!poll) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;

    var head = Math.ceil(bar.getBoundingClientRect().height);
    var stack = 0;
    for (var i = 0; i < pushed.length; i++) {
      stack = Math.max(stack, Math.ceil(pushed[i].getBoundingClientRect().height));
    }

    if (!footers) {
      footers = [];
      var kids = document.body.children;
      for (var j = 0; j < kids.length; j++) {
        var el = kids[j];
        if (el === poll || el === bar || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (getComputedStyle(el).position === 'fixed') footers.push(el);
      }
    }
    var foot = 0;
    for (var k = 0; k < footers.length; k++) {
      var r = footers[k].getBoundingClientRect();
      if (!r.height || !r.width) continue;                    // hidden at this width
      if (r.bottom < vh - 2 || r.width < vw * 0.6) continue;  // not a bottom bar
      foot = Math.max(foot, Math.ceil(vh - r.top));
    }

    var t = Math.round(Math.min(head + stack + GAP, vh * 0.4));
    var b = Math.round(Math.min(foot + GAP, vh * 0.45));
    if (t !== railTop) { railTop = t; poll.style.top = t + 'px'; }
    if (b !== railBot) { railBot = b; poll.style.bottom = b + 'px'; }
  }

  function railFitSoon() {
    if (fitting) return;
    fitting = true;
    requestAnimationFrame(function () { fitting = false; railFit(); });
  }

  function railReset() { footers = null; railTop = railBot = -1; railFit(); }

  /* Full screen on a phone, a drawer above that. When it takes the whole
     screen the page behind it should not scroll under the finger; on desktop
     it must stay scrollable, since the point is to review the site with the
     panel open. */
  var FULL = '(max-width:640px)';
  var heldOverflow = null;

  function fullScreen() {
    return !!(window.matchMedia && window.matchMedia(FULL).matches);
  }
  function holdPage() {
    if (heldOverflow !== null || !fullScreen()) return;
    heldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  function releasePage() {
    if (heldOverflow === null) return;
    document.body.style.overflow = heldOverflow;
    heldOverflow = null;
  }

  function buildPoll() {
    if (!slug) return;
    poll = document.createElement('div');
    poll.className = 'tcb-poll';
    poll.innerHTML =
      '<button class="tab" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Rate this concept">' +
        '<svg class="arw" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' +
        '<span class="vt">Rate this concept</span>' +
        '<span class="dot" aria-hidden="true"></span>' +
      '</button>' +
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
            (current ? '<a class="peek" href="' + current.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' +
              '<span class="pk"></span>' + ext + '</a>' : '') +
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

    // Name the destination rather than saying "the existing site" twice over.
    var pk = poll.querySelector('.pk');
    if (pk) {
      pk.textContent = 'Open ' + current.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
    }

    var tab = poll.querySelector('.tab'), x = poll.querySelector('.x');
    var s1 = poll.querySelector('.s1'), s2 = poll.querySelector('.s2'), s3 = poll.querySelector('.s3');
    var steps = poll.querySelectorAll('.steps i');
    var ta = poll.querySelector('textarea');
    var err = poll.querySelector('.err');
    var answered = false;
    try { answered = localStorage.getItem(KEY) === '1'; } catch (e) {}

    function open() {
      railFit();
      holdPage();
      poll.classList.add('open');
      tab.setAttribute('aria-expanded', 'true');
      if (answered) { show(3); return; }
      setTimeout(function () { ta.focus({ preventScroll: true }); }, 240);
    }
    function close(toCue) {
      releasePage();
      poll.classList.remove('open');
      tab.setAttribute('aria-expanded', 'false');
      if (toCue) tab.focus();
    }
    function show(n) {
      s1.hidden = n !== 1; s2.hidden = n !== 2; s3.hidden = n !== 3;
      steps[0].classList.toggle('on', n >= 1); steps[1].classList.toggle('on', n >= 2);
      poll.querySelector('.steps').hidden = n === 3;
    }

    tab.addEventListener('click', open);
    x.addEventListener('click', function () { close(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && poll.classList.contains('open')) close(true);
    });
    // Collapse again on any click out in the page, so the drawer never sits
    // over content the visitor is trying to reach.
    document.addEventListener('click', function (e) {
      if (poll.classList.contains('open') && !poll.contains(e.target)) close();
    });
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
    railFit();

    // Deep link. /concepts/<slug>#rate opens the slideout on arrival, so the
    // admin's Feedback tab can point at the thing answers actually come from.
    if (location.hash === '#rate' || /(^|[?&])rate=1(&|$)/.test(location.search)) {
      setTimeout(open, 400);
    }
    // Nudge: twitch the cue out from the edge once the visitor has had a real look.
    if (!answered) {
      var nudged = false;
      function nudge() {
        if (nudged) return;
        if (window.scrollY > Math.max(600, document.documentElement.scrollHeight * 0.35)) {
          nudged = true; tab.classList.add('cue');
          setTimeout(function () { tab.classList.remove('cue'); }, 700);
        }
      }
      window.addEventListener('scroll', nudge, { passive: true });
    }
  }

  /* Vercel Web Analytics. Concept pages are dropped in as finished HTML and
     served either from the repo or the bucket, so none of them carry the tag
     themselves; the bar is the one thing they all load. Skipped if the page
     already has it, so a concept that ships its own is not counted twice. */
  function analytics() {
    if (window.vaq || document.querySelector('script[src*="/_vercel/insights/"]')) return;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
  }

  function mount() {
    analytics();
    document.body.insertBefore(bar, document.body.firstChild);
    offset();
    buildPoll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(both);
    window.addEventListener('load', both);
    window.addEventListener('resize', function () { offset(); railReset(); sync(); });
    window.addEventListener('orientationchange', function () { offset(); railReset(); sync(); });
    // Bottom bars that only appear part way down the page are common, so
    // re-measure as the visitor scrolls.
    window.addEventListener('scroll', railFitSoon, { passive: true });
  }

  function both() { offset(); railFit(); }

  // Held page scroll belongs to full screen only, and only while open.
  function sync() {
    if (!poll) return;
    if (!fullScreen() || !poll.classList.contains('open')) releasePage();
    else holdPage();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
