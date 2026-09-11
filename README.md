# TCB Concepts

Staging and showcase site for **Tri-Cities Board**. Each concept is a complete, working
website built for a specific organization, business or partner, published behind its own
URL so it can be shared and clicked through before any commitment is made.

Live: https://tcb-concepts.vercel.app

## Concepts

| Concept | Path | Status |
| --- | --- | --- |
| PoCo Pirates (Port Coquitlam Minor Hockey) | `/concepts/poco-pirates/` | Ready |
| Tri-Cities Chamber of Commerce | — | Drafting |
| Fountainhead Network | — | Drafting |

## Structure

```
public/
  index.html                     TCB Concepts landing page (lists every concept)
  tcb-logo.png                   Tri-Cities Board mark
  concepts/
    poco-pirates/index.html      Self-contained concept page
vercel.json                      Static build config, noindex headers
```

Every concept lives in its own folder under `public/concepts/<slug>/` and is a
self-contained page carrying the prospect's own branding. Concept pages are
intentionally standalone so nothing in the shared landing page can alter how a
prospect sees their own site.

## Adding a concept

1. Create `public/concepts/<slug>/index.html`.
2. Add a card for it to the grid in `public/index.html`.
3. Commit and push. Vercel deploys `main` automatically.

## Local preview

```
npx serve public
```

## Deploying

Pushes to `main` deploy through the Vercel project `tcb-concepts`. To deploy manually:

```
vercel --prod
```

## Notes

- The whole site is served with `X-Robots-Tag: noindex, nofollow`. These are private
  sales concepts, not pages that should turn up in search results next to a prospect's
  real website.
- No build step and no framework. Concepts are plain HTML so they stay portable and can
  be handed to a client as-is.
- Vercel Web Analytics is wired with a plain script tag: `/_vercel/insights/script.js` on
  the landing page, and injected by `tcb-bar.js` on every concept page, since concepts are
  dropped in as finished HTML and would not carry it themselves. It has to be enabled on
  the Vercel project or that path 404s. `@vercel/analytics` is in `package.json` for
  reference, but nothing imports it — with no bundler its `inject()` would only add the
  same tag. There is still nothing to install or build to deploy this repo.
