import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import { PAGES, PREFIXED_LOCALES } from './seoRoutes'

/*
 * Normal URLs (/writing/blackout) so search engines can index each page.
 * English lives at the root; other languages are prefixed (/hu/writing/blackout).
 * All pages are children of the optional `lang` parent, so links by route name
 * keep the current language automatically.
 *
 * Paths, names and meta (titles, noindex) live in src/seoRoutes.js, shared with
 * the pre-render script; this file only adds the component for each route name.
 *
 * The web server must serve pre-rendered pages and fall back to the app shell, e.g. nginx:
 *   location / { try_files $uri $uri/index.html /app.html; }
 */
const views = {
  home: HomeView,
  writing: () => import('./views/WritingView.vue'),
  blackout: () => import('./views/BlackoutView.vue'),
  timed: () => import('./views/TimedWritingView.vue'),
  cutup: () => import('./views/CutUpView.vue'),
  haiku: () => import('./views/HaikuView.vue'),
  snowflake: () => import('./views/SnowflakeView.vue'),
  mosaic: () => import('./views/MosaicView.vue'),
  story: () => import('./views/StoryCardsView.vue'),
  taboo: () => import('./views/TabooView.vue'),
  'story-print': () => import('./views/StoryPrintView.vue'),
  share: () => import('./views/ShareView.vue'),
  zines: () => import('./views/ZineLibrary.vue'),
  storage: () => import('./views/StorageView.vue'),
  about: () => import('./views/AboutView.vue'),
  edit: () => import('./views/ZineEditor.vue'),
  print: () => import('./views/PrintView.vue'),
  read: () => import('./views/ZineReader.vue'),
}

const pages = PAGES.map((p) => {
  if (!views[p.name]) throw new Error(`No view for route "${p.name}" (src/router.js)`)
  return { ...p, component: views[p.name], props: p.path.includes(':') }
})

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: `/:lang(${PREFIXED_LOCALES.join('|')})?`, children: pages },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})
