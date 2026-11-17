import { watch } from 'vue'
import { START_LOCATION } from 'vue-router'
import { router } from '../router'
import { settings } from './settings'
import { DEFAULT_LOCALE } from '../seoRoutes'

/*
 * Keeps the URL language (/hu/…) and the chosen language in sync.
 *  - The URL decides: opening /de/about shows German and remembers it.
 *  - Picking a language in the top bar moves to that language's URL.
 *  - On the first page load of an unprefixed (English) URL, visitors whose
 *    language isn't English are forwarded once to their own language.
 *    Crawlers browse in English, so they stay on the English pages and reach
 *    the others through hreflang links.
 */

const urlLocale = (route) => route.params.lang || DEFAULT_LOCALE
const langParam = (locale) => (locale === DEFAULT_LOCALE ? '' : locale)

export function installLocaleRouting() {
  router.beforeEach((to, from) => {
    if (
      from === START_LOCATION &&
      to.name &&
      !to.params.lang &&
      settings.locale &&
      settings.locale !== DEFAULT_LOCALE
    ) {
      return {
        name: to.name,
        params: { ...to.params, lang: langParam(settings.locale) },
        query: to.query,
        hash: to.hash,
        replace: true,
      }
    }
  })

  // After navigating (when currentRoute is final), the URL language wins.
  router.afterEach((to) => {
    if (to.name && settings.locale !== urlLocale(to)) settings.locale = urlLocale(to)
  })

  // Language picked in the UI → go to the same page in that language.
  watch(
    () => settings.locale,
    (locale) => {
      const route = router.currentRoute.value
      if (!route.name || urlLocale(route) === locale) return
      router.replace({
        name: route.name,
        params: { ...route.params, lang: langParam(locale) },
        query: route.query,
        hash: route.hash,
      })
    },
  )
}
