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

/** Paths (without language prefix) that are pre-rendered and listed in the sitemap. */
export const PUBLIC_PATHS = [
  '/',
  '/writing',
  '/writing/blackout',
  '/writing/15-minute-poem',
  '/writing/cut-up-poem',
  '/writing/snowflake',
  '/writing/mosaic-story',
  '/writing/story-cards',
  '/zines',
  '/storage',
  '/about',
]

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
