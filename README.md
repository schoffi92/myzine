# MyZine

A client-only Vue 3 app for making and reading personal zines. There is no server: all data stays in the browser.

## Storage (Rule #1: client-side only)

| What | Where | Code |
|---|---|---|
| Zines, pages, images (as Blobs) | **IndexedDB** database `myzine` (stores: `zines`, `pages`, `images`) | `src/db/idb.js`, `src/db/zines.js` |
| Preferences: theme, reader font size, last opened zine | **localStorage** key `myzine:settings` | `src/composables/settings.js` |

- On startup the app calls `navigator.storage.persist()` to ask the browser not to evict data.
- Because data lives in only one browser, use **Export backup / Import backup** on the home page to move or save it (JSON with images embedded).

## Run

```sh
npm install
npm run dev      # dev server
npm run build    # static build in dist/
npm run preview  # serve the build
```

It uses hash routing (`#/zine/...`), so `dist/` works from any static host.

## License

[MIT](LICENSE) © 2026 Istvan Schoffhauzer
