/*
 * Public, indexable pages and language URL rules.
 * Plain JS with no browser APIs: shared by the app (router, SEO tags) and by
 * scripts/prerender.mjs (pre-built HTML + sitemap.xml).
 *
 * URL scheme: English at the root (/writing/blackout),
 * other languages prefixed (/hu/writing/blackout).
 */

/**
 * The public site URL comes from config, not source: VITE_SITE_URL in .env
 * (see .env.example). Returns it without a trailing slash, or '' if unset.
 */
export const normalizeSiteUrl = (url) => (url || '').trim().replace(/\/+$/, '')

export const LOCALES = ['en', 'de', 'es', 'hu', 'fr', 'pl']
export const DEFAULT_LOCALE = 'en'
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE)

/**
 * Every page of the app: path (relative to the language prefix), route name and
 * meta. The router adds the components (src/router.js); this file stays free of
 * Vue imports so scripts/prerender.mjs and scripts/deploy.mjs can read it too.
 *
 * meta.title / meta.description are i18n keys used by composables/seo.js.
 * meta.noindex marks app-only pages that shouldn't appear in search results.
 */
export const PAGES = [
  { path: '', name: 'home', meta: { description: 'home.tagline' } },
  { path: 'writing', name: 'writing', meta: { title: 'writing.title', description: 'writing.intro' } },
  { path: 'writing/blackout', name: 'blackout', meta: { title: 'writing.blackout.title', description: 'writing.blackout.card' } },
  { path: 'writing/15-minute-poem', name: 'timed', meta: { title: 'writing.timed.title', description: 'writing.timed.card' } },
  { path: 'writing/cut-up-poem', name: 'cutup', meta: { title: 'writing.cutup.title', description: 'writing.cutup.card' } },
  { path: 'writing/snowflake', name: 'snowflake', meta: { title: 'writing.snowflake.title', description: 'writing.snowflake.card' } },
  { path: 'writing/mosaic-story', name: 'mosaic', meta: { title: 'writing.mosaic.title', description: 'writing.mosaic.card' } },
  { path: 'writing/story-cards', name: 'story', meta: { title: 'writing.story.title', description: 'writing.story.card' } },
  { path: 'writing/taboo', name: 'taboo', meta: { title: 'writing.taboo.title', description: 'writing.taboo.card' } },
  { path: 'writing/story-cards/print', name: 'story-print', meta: { title: 'writing.story.printTitle', noindex: true } },
  { path: 'share', name: 'share', meta: { title: 'share.title', description: 'share.tip', noindex: true } },
  { path: 'zines', name: 'zines', meta: { title: 'home.create', description: 'library.intro' } },
  { path: 'storage', name: 'storage', meta: { title: 'storage.title', description: 'storage.intro' } },
  { path: 'about', name: 'about', meta: { title: 'about.title', description: 'about.sections.0.p.0' } },
  { path: 'zine/:id/edit', name: 'edit', meta: { noindex: true } },
  { path: 'zine/:id/print', name: 'print', meta: { title: 'print.title', noindex: true } },
  { path: 'zine/:id/read', name: 'read', meta: { noindex: true } },
]

/** Paths (without language prefix) that are pre-rendered and listed in the sitemap. */
export const PUBLIC_PATHS = PAGES.filter((p) => !p.meta.noindex && !p.path.includes(':')).map((p) => `/${p.path}`)

const PREFIX_RE = new RegExp(`^/(${PREFIXED_LOCALES.join('|')})(?=/|$)`)

/** '/about' + 'hu' → '/hu/about'; '/' + 'hu' → '/hu'; English keeps the plain path. */
export function localizedPath(locale, path) {
  if (locale === DEFAULT_LOCALE) return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

/** '/hu/about' → '/about'; '/hu' → '/'. */
export function stripLocale(path) {
  const m = path.match(PREFIX_RE)
  return m ? path.slice(m[0].length) || '/' : path
}
