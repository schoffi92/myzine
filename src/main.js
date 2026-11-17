import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { installLocaleRouting } from './composables/localeRouting'
import { installSeo } from './composables/seo'
import { openDB, requestPersistence } from './db/idb'
import './style.css'

// Old hash URLs (/#/about) are rewritten by an inline script in index.html,
// which runs before this module (and the router) loads.

openDB().catch((err) => console.error(err))
requestPersistence()
installLocaleRouting() // before installSeo, so tags follow the final URL
installSeo()

createApp(App).use(router).mount('#app')
