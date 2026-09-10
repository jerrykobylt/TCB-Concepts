/**
 * Tri-Cities Board Concepts bar.
 *
 * Every concept site includes this one line at the end of <body>:
 *
 *   <script src="/tcb-bar.js" data-concept="PoCo Pirates" defer></script>
 *
 * It prepends a slim, sticky Tri-Cities Board bar above the concept's own
 * header, naming the concept and giving visitors a way back to the showcase
 * and straight to the inquiry form. Any sticky header the concept already
 * has is pushed down by the bar's height so nothing hides underneath it.
 */
(function () {
  var me = document.currentScript;
  var concept = (me && me.getAttribute('data-concept')) || 'Concept';
  var HOME = '/';
  var ASK = '/#request';

  var css = [
    '.tcb-bar{position:sticky;top:0;z-index:2147483000;background:#111827;color:#fff;',
      'font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;line-height:1;',
      'border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 1px 0 rgba(74,222,128,.35)}',
    '.tcb-bar *{box-sizing:border-box}',
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
    '.tcb-bar .lnk{padding:8px 10px;border-radius:7px;color:#D1D5DB;font-weight:500;white-space:nowrap}',
    '.tcb-bar .lnk:hover{color:#fff;background:rgba(255,255,255,.09)}',
    '.tcb-bar .ask{display:inline-flex;align-items:center;gap:7px;background:#16A34A;color:#fff;font-family:Outfit,Inter,system-ui,sans-serif;font-weight:600;font-size:13.5px;padding:9px 14px;border-radius:8px;white-space:nowrap;transition:background .15s}',
    '.tcb-bar .ask:hover{background:#15803D}',
    '.tcb-bar .ask svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.tcb-bar a:focus-visible{outline:2px solid #38BDF8;outline-offset:2px;border-radius:6px}',
    '@media (max-width:760px){.tcb-bar .in{height:46px;padding:0 12px;gap:10px}.tcb-bar .which{display:none}.tcb-bar .sep{display:none}.tcb-bar .lnk{display:none}}',
    '@media (max-width:400px){.tcb-bar .wm b{font-size:12.5px}.tcb-bar .ask{padding:8px 11px;font-size:13px}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

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
        '<a class="lnk" href="' + HOME + '#work">All concepts</a>' +
        '<a class="ask" href="' + ASK + '">Ask us to build yours' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
        '</a>' +
      '</span>' +
    '</div>';
  bar.querySelector('.name').textContent = concept;

  var pushed = [];
  var baseScrollPad = null;

  // Push any sticky/fixed top-anchored header down by the bar's exact height.
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

    // Keep in-page anchors from landing under the two stacked headers.
    if (baseScrollPad === null) baseScrollPad = parseInt(getComputedStyle(document.documentElement).scrollPaddingTop, 10) || 0;
    document.documentElement.style.scrollPaddingTop = (baseScrollPad + h) + 'px';
  }

  function mount() {
    document.body.insertBefore(bar, document.body.firstChild);
    offset();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(offset);
    window.addEventListener('load', offset);
    window.addEventListener('resize', offset);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
