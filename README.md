# MyZine

A client-only Vue 3 app for making and reading personal zines. There is no server: all data stays in the browser.

## Storage (Rule #1: client-side only)

| What | Where | Code |
|---|---|---|
| Zines, pages, images (as Blobs) | **IndexedDB** database `myzine` (stores: `zines`, `pages`, `images`) | `src/db/idb.js`, `src/db/zines.js` |
| Preferences: theme, reader font size, last opened zine | **localStorage** key `myzine:settings` | `src/composables/settings.js` |

- On startup the app calls `navigator.storage.persist()` to ask the browser not to evict data.
- Because data lives in only one browser, use **Export backup / Import backup** on the home page to move or save it (JSON with images embedded).

## Configuration

Site-specific settings live in a local `.env` file (not committed). Copy
`.env.example` to `.env` and set:

| Variable | Used for |
|---|---|
| `VITE_SITE_URL` | Public URL without trailing slash, e.g. `https://example.com`. Used for canonical URLs, `hreflang` links, link previews and `sitemap.xml`. Without it, the app uses its current address and the build skips pre-rendering and the sitemap. |

## Run

```sh
cp .env.example .env   # then edit VITE_SITE_URL
npm install
npm run dev        # dev server
npm run build      # static build in dist/ + pre-rendered pages + sitemap
npm run build:spa  # static build only, no pre-rendering
npm run preview    # serve the build
```

`npm run build` runs `scripts/prerender.mjs` after Vite. It opens every public
page in every language in a headless Chrome or Edge (via `puppeteer-core`) and
saves the result as real HTML (`dist/writing/blackout/index.html`,
`dist/hu/writing/blackout/index.html`, …), then writes `dist/sitemap.xml`.
It finds an installed Chrome/Edge automatically; set `CHROME_PATH` to choose
one. Without a browser it skips pre-rendering and the site still works as a
normal client-side app.

## URLs and languages

- English is at the root (`/writing/blackout`); other languages are prefixed:
  `/de/…`, `/es/…`, `/hu/…`, `/fr/…`, `/pl/…`.
- The URL decides the language; picking a language moves to that language's URL.
- On the first load of an unprefixed URL, visitors whose browser language
  isn't English are forwarded once to their language.
- Every public page sets its own title, description, canonical URL and
  `hreflang` alternates. App-only pages (zine editor/reader/print, share,
  story print) are `noindex`.
- The list of public pages lives in `src/seoRoutes.js` (used by the router,
  the SEO tags and the pre-render script).
- Old hash links (`/#/about`) are redirected to the normal URL.

## Hosting

Deploy the contents of `dist/`. The server must serve pre-rendered pages and
fall back to the app shell (`app.html`) for everything else. For nginx:

```nginx
location / {
    try_files $uri $uri/index.html /app.html;
}
```

`robots.txt` and `sitemap.xml` are not in the repository (see `.gitignore`).
The build generates `sitemap.xml`; `robots.txt` is copied from a local
`public/robots.txt` if you have one.

## License

[MIT](LICENSE) © 2026 Istvan Schoffhauzer
