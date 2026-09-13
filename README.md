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

## Editing the front page

The copy and images on `public/index.html` are editable from the admin, under
**Page settings**, without a deploy. Every element carrying `data-cms="<key>"`
(or `data-cms-src` on an image) becomes a field there: the admin reads the live
page to build the form, so marking up a new bit of the page is one attribute
here and nothing at all in the admin.

Overrides are saved as `site/content.json` in the `concepts` bucket, served by
`/api/content`, and applied by a small inline script at the end of the page's
head. A field left empty keeps whatever the HTML ships with, so the page always
stands on its own if the bucket or the API is unreachable. Editors get plain
text with `**bold**` as the only markup, escaped on the way in. Uploaded images
land in `site/img/` in the same bucket and are served through
`/concepts/site/img/...`, which is why the slug `site` is reserved.

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
- Scanning a prospect's site goes through four rungs, stopping at the first that
  answers: identified crawler, then browser-like headers, then a Supabase edge
  function (`tcb-fetch`) because some bot management refuses Vercel's addresses
  while answering the same request from elsewhere, then Firecrawl. Only the last
  costs anything, and it is skipped entirely unless `FIRECRAWL_API_KEY` is set
  in the Vercel project. `FIRECRAWL_API_URL` can point at a self-hosted one. The
  scan records which rung answered in `signals.fetchedAs`.
- No build step and no framework. Concepts are plain HTML so they stay portable and can
  be handed to a client as-is.
- Vercel Web Analytics is wired with a plain script tag: `/_vercel/insights/script.js` on
  the landing page, and injected by `tcb-bar.js` on every concept page, since concepts are
  dropped in as finished HTML and would not carry it themselves. Vercel serves that path
  from its edge once Web Analytics is on for the project; turn it off and the path 404s
  and nothing is recorded.
- The `@vercel/analytics` package is deliberately **not** a dependency. It exists so that
  framework apps, which cannot hand-edit their HTML, get that same tag written for them at
  render time. This site writes the tag itself, so the package has nothing to do: it never
  runs in the browser, and adding it only puts a `package.json` in the way that implies a
  build this repo does not have and makes every deploy install something nothing imports.
