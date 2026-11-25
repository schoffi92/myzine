import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { installLocaleRouting } from './composables/localeRouting'
import { installSeo } from './composables/seo'
import { openDB, requestPersistence } from './db/idb'
import { loadLocale } from './i18n'
import { settings } from './composables/settings'
import { PREFIXED_LOCALES } from './seoRoutes'
import './style.css'

// Old hash URLs (/#/about) are rewritten by an inline script in index.html,
// which runs before this module (and the router) loads.

openDB().catch((err) => console.error(err))
requestPersistence()
installLocaleRouting() // before installSeo, so tags follow the final URL
installSeo()

// The page's language first (the URL's, else the one the router will forward
// to), so a pre-rendered page in that language doesn't flash English on mount.
const first = location.pathname.split('/')[1]
loadLocale(PREFIXED_LOCALES.includes(first) ? first : settings.locale).finally(() => createApp(App).use(router).mount('#app'))
