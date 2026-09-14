# Inlet Rowing Club markup probe

Purpose: capture the live concept page so another session can read it, and identify
what in the club's markup sits on top of the Tri-Cities Board bar.

**Outcome: the live capture could not be performed. Every route to
`www.tcbconcepts.org` is refused by this session's egress policy.** No HTML, no CSS
and no screenshot were saved. What follows is (1) the exact fetch record, and
(2) what the repository alone establishes about the bug — which turns out to
answer the question without the live page.

---

## 1. Fetch record

| # | Target | Tool | Status | Bytes |
|---|--------|------|--------|-------|
| 1 | `https://www.tcbconcepts.org/concepts/inlet-rowing-club` | `curl -sSL` | **000 — no HTTP response** | 0 |
| 2 | `https://www.tcbconcepts.org/concepts/inlet-rowing-club` | `WebFetch` | **blocked, no HTTP response** | 0 |
| 3 | same-origin stylesheets | — | **not attempted** (needs the HTML from #1 to discover the `<link>` hrefs) | — |
| 4 | Chromium + Playwright against the live URL | — | **not attempted** (see below) | — |

### Exact errors

Fetch #1, `curl`:

```
curl: (56) CONNECT tunnel failed, response 403
status=000 size=0 url=https://www.tcbconcepts.org/concepts/inlet-rowing-club
```

The session's agent proxy recorded the reason for that CONNECT:

```json
{
  "ts": "2026-09-14T01:24:41.458Z",
  "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "www.tcbconcepts.org:443"
}
```

Fetch #2, `WebFetch`:

```json
{"error_type":"EGRESS_BLOCKED","domain":"www.tcbconcepts.org",
 "message":"Access to www.tcbconcepts.org is blocked by the network egress proxy."}
```

### Why #3 and #4 were not attempted

- **#3** depends on #1. The stylesheet hrefs are discovered by parsing the page's
  `<link rel=stylesheet>` tags; with no HTML there is nothing to resolve. They are
  same-origin on the blocked host in any case.
- **#4** Chromium is present (`/opt/pw-browsers/chromium-1194/`) and would launch
  fine, but it reaches the network through the same egress gateway that returned
  the 403 above — the block is on the destination host, not on any one client.
  `/root/.ccr/README.md` is explicit that a 403/407 is an organization policy
  denial and that it must be reported rather than retried or routed around:
  *"Do not retry or route around it — report the blocked host."* Two tools already
  confirmed the same denial with the same reason, so a third attempt was not made.

### To unblock

`www.tcbconcepts.org` needs to be added to the allowed destinations for this
environment's network policy (Claude Code on the web → environment settings;
see https://code.claude.com/docs/en/claude-code-on-the-web). Once allowed, steps
1–4 of this probe run unchanged.

The page body itself lives in Supabase Storage and is served through
`/api/concept`. Reading it directly from Supabase was not possible either: the
`supabase` MCP server in this session is unauthenticated, and this session cannot
run the OAuth flow.

---

## 2. What the repository establishes

The live page could not be read, but the answer to *"something in the club's markup
is sitting on top of the bar"* is already recorded in this repo, and it is more
specific than a live capture would have been.

### The element

Named in the HEAD commit message (`742a517`) and again in a code comment at
`public/tcb-bar.js:200-206`:

> The Inlet Rowing Club's **logo lock is a plain `div`**, so it stayed pinned to
> the top of the window and sat on top of the bar.

So the top-left logo element is a `div` with no `header`/`nav` tag and no
`head`/`nav`/`strip`/`bar` substring in its class — pinned to the top of the
window with `position: fixed` or `sticky` and `top: 0`.

The exact class name and the rule that sets `top` are in the club's own markup in
Supabase Storage and are **not** in this repo, so they remain unconfirmed. That is
the one gap a successful capture would close.

### Why it sits on top — and the state of the fix

This matters most, and it is a deployment fact rather than a CSS one:

```
HEAD        742a5177cf64c587dcebdb06568261e223cd6a33   ← contains the fix
origin/main 141731c81c58b1d26d6d32d36313d607d021739b
git branch -r --contains HEAD  →  (no output)
```

**The fix is not on `origin/main`, so it is not deployed.** The live page is
serving the *old* `tcb-bar.js`, whose `offset()` reads (from
`git show origin/main:public/tcb-bar.js`, lines 200-214):

```js
function offset() {
  var h = Math.ceil(bar.getBoundingClientRect().height);
  if (!pushed.length) {
    var candidates = document.querySelectorAll(
      'header, nav, [class*="head"], [class*="nav"], [class*="strip"], [class*="bar"]');
    ...
      if ((cs.position === 'sticky' || cs.position === 'fixed') && parseInt(cs.top, 10) === 0)
        pushed.push(el);
  }
  for (var j = 0; j < pushed.length; j++) pushed[j].style.top = h + 'px';
  ...
}
```

Two reasons a plain `div` logo lock escapes it:

1. **It guesses by name.** The selector only ever considers `header`, `nav`, and
   classes containing `head`/`nav`/`strip`/`bar`. A `div` named for a logo matches
   none of them, so it is never pushed down and keeps `top: 0` — directly under the
   bar, which is `position: sticky; top: 0; z-index: 2147483000`.
2. **It runs once, at mount.** `if (!pushed.length)` means the scan never re-runs,
   so anything the club's own script pins after mount is never found.

The local HEAD version replaces both: it measures every element instead
(`pinned()`, `public/tcb-bar.js:207-226`) and re-scans on a timer, on load, on
fonts-ready, on first scroll and on resize.

**So the first thing to check is whether deploying HEAD simply fixes this.** It
very likely does.

---

## 3. If HEAD is deployed and the logo still overlaps

Four gaps in the new `pinned()` that could still let an element sit on the bar.
These are read off the code, not observed on the live page — treat them as
candidates to check, in this order:

1. **A tall element is skipped as "a sheet"** — `public/tcb-bar.js:218`:
   ```js
   if (!box.width || box.height > window.innerHeight * 0.8) continue;
   ```
   A **full-height fixed side rail** carrying the logo at its top is taller than
   0.8 × viewport, so it is left alone and its logo stays over the bar. This is the
   most likely survivor, and worth special attention given a right-sidebar layout
   is in flight on another branch.

2. **An element that pins only after a scroll threshold** — the re-scan on scroll is
   one-shot (`public/tcb-bar.js:478`):
   ```js
   window.addEventListener('scroll', function once() {
     window.removeEventListener('scroll', once); offset(); }, { passive: true });
   ```
   That fires on the first scroll event, at a few pixels of travel — *before* a
   typical "shrink and pin the logo after 200px" class is added. After that there is
   no further scan, so such a logo is never pushed down.

3. **Shadow DOM / iframes are not scanned** — `pinned()` walks
   `document.body.getElementsByTagName('*')` only. A logo lock inside a web
   component is invisible to it.

4. **`top: auto` on a sticky element** — `parseFloat('auto')` is `NaN` and line 216
   skips it. Harmless for sticky (no vertical stick without a `top`), but worth
   ruling out. Note this is *not* a problem for `position: fixed`, where
   `getComputedStyle().top` resolves to a used pixel value.

One more thing to rule out, a different symptom with the same look: if the club's
CSS puts `overflow-x: hidden` (or a `transform`) on `html`/`body`, the **bar's own**
`position: sticky` can break and the bar scrolls away — which reads as "the club's
markup is on top" but is the bar failing, not the logo winning.

---

## 4. Files in `probe/`

Only this file. `inlet-rowing-club.html`, `css/` and `top.png` were deliberately
**not** created rather than filled with placeholder or reconstructed content — a
stand-in page here would be indistinguishable from a real capture to the session
that reads this next, which is exactly the failure this probe exists to avoid.
