import { watch } from 'vue'
import { router } from '../router'
import { t } from '../i18n'
import { settings } from './settings'
import { LOCALES, DEFAULT_LOCALE, localizedPath, stripLocale, normalizeSiteUrl } from '../seoRoutes'

// Public site URL from config (VITE_SITE_URL in .env); falls back to wherever the app runs.
const SITE = normalizeSiteUrl(import.meta.env.VITE_SITE_URL) || location.origin

/*
 * Per-page <title>, description, canonical URL, hreflang alternates, robots
 * and link-preview tags. They're set at runtime (Googlebot runs JavaScript)
 * and also baked into the pre-rendered HTML by scripts/prerender.mjs.
 * Route meta (see router.js) holds i18n keys: title, description, noindex.
 */

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]:not([hreflang])`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** One <link rel="alternate" hreflang> per language (+ x-default → English), or none for noindex pages. */
function setAlternates(basePath, enabled) {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  if (!enabled) return
  const add = (hreflang, locale) => {
    const el = document.createElement('link')
    el.rel = 'alternate'
    el.hreflang = hreflang
    el.href = SITE + localizedPath(locale, basePath)
    document.head.appendChild(el)
  }
  LOCALES.forEach((l) => add(l, l))
  add('x-default', DEFAULT_LOCALE)
}

function apply(route) {
  if (!route.name) return
  const m = route.meta ?? {}
  const pageTitle = m.title ? t(m.title) : ''
  const title = pageTitle ? `${pageTitle} · MyZine` : `MyZine · ${t('home.tagline')}`
  const description = t(m.description || 'home.tagline')
  const url = SITE + route.path

  document.title = title
  setMeta('name', 'description', description)
  setMeta('name', 'robots', m.noindex ? 'noindex, nofollow' : 'index, follow')
  setLink('canonical', url)
  setAlternates(stripLocale(route.path), !m.noindex)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', `${SITE}/apple-touch-icon.png`)
  setMeta('property', 'og:locale', settings.locale)
}

export function installSeo() {
  router.afterEach((to) => apply(to))
  // translations are synchronous, but the URL updates after a language switch
  watch(() => settings.locale, () => apply(router.currentRoute.value), { flush: 'post' })
}
