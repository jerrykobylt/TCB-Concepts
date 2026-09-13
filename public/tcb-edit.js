/**
 * In-place editing for the front page, loaded only when the admin's Page
 * settings opens this page in a frame and says so. Nothing here writes
 * anything: every change is posted up to the admin, which holds the working
 * copy and saves it.
 */
(function () {
  var T = window.__tcb;
  if (!T || window.__tcbEditing) return;
  window.__tcbEditing = 1;

  function post(type, data) {
    var m = { tcb: type };
    if (data) Object.keys(data).forEach(function (k) { m[k] = data[k]; });
    try { parent.postMessage(m, location.origin); } catch (e) { /* not framed */ }
  }

  var css = document.createElement('style');
  css.textContent =
    '[data-cms],[data-cms-src]{cursor:text}' +
    '[data-cms-src]{cursor:pointer}' +
    '[data-cms]:hover,[data-cms-src]:hover{outline:2px dashed #22c55e;outline-offset:3px}' +
    '.tcb-on{outline:2px solid #16a34a!important;outline-offset:3px;background:rgba(34,197,94,.07)}' +
    '.tcb-flash{animation:tcbflash 1.1s ease}' +
    '.tcb-badge{position:fixed;z-index:2147483000;padding:6px 11px;border:0;border-radius:999px;background:#16a34a;color:#fff;font:700 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(11,18,32,.3)}' +
    '.tcb-badge:hover{background:#15803d}' +
    '@keyframes tcbflash{0%,100%{outline-color:transparent}30%{outline:3px solid #f59e0b;outline-offset:4px}}';
  document.head.appendChild(css);

  var editing = null;

  function stop() {
    if (!editing) return;
    var el = editing; editing = null;
    el.removeAttribute('contenteditable');
    el.classList.remove('tcb-on');
    var k = T.keyOf(el), v = T.read(el);
    if (!v) { T.set(k, ''); v = ''; }                 // emptied means "back to default"
    post('change', { key: k, value: v === T.D[k] ? '' : v });
  }

  function start(el) {
    stop();
    editing = el;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('tcb-on');
    el.focus();
    var r = document.createRange(); r.selectNodeContents(el);
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }

  // Everything is a link or a button on this page, so nothing may navigate.
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cms],[data-cms-src]');
    if (!el) {
      if (e.target.closest('a,button')) e.preventDefault();
      if (editing && !editing.contains(e.target)) stop();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (el === editing) return;
    var k = T.keyOf(el);
    post('pick', { key: k });
    if (el.hasAttribute('data-cms-src')) { stop(); post('image', { key: k }); return; }
    start(el);
  }, true);

  document.addEventListener('submit', function (e) { e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (!editing) return;
    if (e.key === 'Enter') { e.preventDefault(); stop(); }
    else if (e.key === 'Escape') { e.preventDefault(); var el = editing; editing = null; el.removeAttribute('contenteditable'); el.classList.remove('tcb-on'); post('cancel', { key: T.keyOf(el) }); }
  });
  // Typed text only: a pasted heading should not bring a stylesheet with it.
  document.addEventListener('paste', function (e) {
    if (!editing) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text'));
  });

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.tcb) return;
    var m = e.data;
    if (m.tcb === 'apply') { stop(); T.applyAll(m.values || {}); }
    else if (m.tcb === 'set') T.set(m.key, m.value);
    else if (m.tcb === 'show') {
      var el = document.querySelector('[data-cms="' + m.key + '"],[data-cms-src="' + m.key + '"]');
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('tcb-flash');
      void el.offsetWidth;
      el.classList.add('tcb-flash');
    }
  });

  /* A background image sits under the words on top of it, so it can never be
     clicked. Every editable image gets its own button instead, parked in its
     top-left corner and moved as the page scrolls. */
  var badges = [];
  function placeBadges() {
    badges.forEach(function (o) {
      var r = o.el.getBoundingClientRect();
      var on = r.width > 8 && r.height > 8 && r.bottom > 10 && r.top < window.innerHeight - 10;
      o.b.style.display = on ? 'block' : 'none';
      if (!on) return;
      o.b.style.top = Math.max(10, Math.min(r.top + 10, window.innerHeight - 40)) + 'px';
      o.b.style.left = Math.max(10, r.left + 10) + 'px';
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-cms-src]'), function (el) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcb-badge';
    b.textContent = 'Change image';
    b.addEventListener('click', function (ev) { ev.preventDefault(); post('image', { key: T.keyOf(el) }); });
    document.body.appendChild(b);
    badges.push({ el: el, b: b });
  });
  window.addEventListener('scroll', placeBadges, { passive: true });
  window.addEventListener('resize', placeBadges);
  window.addEventListener('load', placeBadges);
  placeBadges();

  post('fields', {
    fields: Array.prototype.map.call(T.nodes(), function (el) {
      var k = T.keyOf(el);
      return { key: k, def: T.D[k], img: el.hasAttribute('data-cms-src') };
    }),
  });
})();
