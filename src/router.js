import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import { PREFIXED_LOCALES } from './seoRoutes'

/*
 * Normal URLs (/writing/blackout) so search engines can index each page.
 * English lives at the root; other languages are prefixed (/hu/writing/blackout).
 * All pages are children of the optional `lang` parent, so links by route name
 * keep the current language automatically.
 *
 * The web server must serve pre-rendered pages and fall back to the app shell, e.g. nginx:
 *   location / { try_files $uri $uri/index.html /app.html; }
 *
 * meta.title / meta.description are i18n keys used by composables/seo.js.
 * meta.noindex marks app-only pages that shouldn't appear in search results.
 */
const pages = [
  { path: '', name: 'home', component: HomeView, meta: { description: 'home.tagline' } },
  {
    path: 'writing',
    name: 'writing',
    component: () => import('./views/WritingView.vue'),
    meta: { title: 'writing.title', description: 'writing.intro' },
  },
  {
    path: 'writing/blackout',
    name: 'blackout',
    component: () => import('./views/BlackoutView.vue'),
    meta: { title: 'writing.blackout.title', description: 'writing.blackout.card' },
  },
  {
    path: 'writing/15-minute-poem',
    name: 'timed',
    component: () => import('./views/TimedWritingView.vue'),
    meta: { title: 'writing.timed.title', description: 'writing.timed.card' },
  },
  {
    path: 'writing/cut-up-poem',
    name: 'cutup',
    component: () => import('./views/CutUpView.vue'),
    meta: { title: 'writing.cutup.title', description: 'writing.cutup.card' },
  },
  {
    path: 'writing/snowflake',
    name: 'snowflake',
    component: () => import('./views/SnowflakeView.vue'),
    meta: { title: 'writing.snowflake.title', description: 'writing.snowflake.card' },
  },
  {
    path: 'writing/mosaic-story',
    name: 'mosaic',
    component: () => import('./views/MosaicView.vue'),
    meta: { title: 'writing.mosaic.title', description: 'writing.mosaic.card' },
  },
  {
    path: 'writing/story-cards',
    name: 'story',
    component: () => import('./views/StoryCardsView.vue'),
    meta: { title: 'writing.story.title', description: 'writing.story.card' },
  },
  {
    path: 'writing/story-cards/print',
    name: 'story-print',
    component: () => import('./views/StoryPrintView.vue'),
    meta: { title: 'writing.story.printTitle', noindex: true },
  },
  {
    path: 'share',
    name: 'share',
    component: () => import('./views/ShareView.vue'),
    meta: { title: 'share.title', description: 'share.tip', noindex: true },
  },
  {
    path: 'zines',
    name: 'zines',
    component: () => import('./views/ZineLibrary.vue'),
    meta: { title: 'home.create', description: 'library.intro' },
  },
  {
    path: 'storage',
    name: 'storage',
    component: () => import('./views/StorageView.vue'),
    meta: { title: 'storage.title', description: 'storage.intro' },
  },
  {
    path: 'about',
    name: 'about',
    component: () => import('./views/AboutView.vue'),
    meta: { title: 'about.title', description: 'about.sections.0.p.0' },
  },
  {
    path: 'zine/:id/edit',
    name: 'edit',
    component: () => import('./views/ZineEditor.vue'),
    props: true,
    meta: { noindex: true },
  },
  {
    path: 'zine/:id/print',
    name: 'print',
    component: () => import('./views/PrintView.vue'),
    props: true,
    meta: { title: 'print.title', noindex: true },
  },
  {
    path: 'zine/:id/read',
    name: 'read',
    component: () => import('./views/ZineReader.vue'),
    props: true,
    meta: { noindex: true },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: `/:lang(${PREFIXED_LOCALES.join('|')})?`, children: pages },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})
