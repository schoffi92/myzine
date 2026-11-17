import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

// Hash history so the built app works from any static host or file server.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/writing', name: 'writing', component: () => import('./views/WritingView.vue') },
    { path: '/writing/blackout', name: 'blackout', component: () => import('./views/BlackoutView.vue') },
    { path: '/writing/15-minute-poem', name: 'timed', component: () => import('./views/TimedWritingView.vue') },
    { path: '/writing/cut-up-poem', name: 'cutup', component: () => import('./views/CutUpView.vue') },
    { path: '/writing/snowflake', name: 'snowflake', component: () => import('./views/SnowflakeView.vue') },
    { path: '/writing/mosaic-story', name: 'mosaic', component: () => import('./views/MosaicView.vue') },
    { path: '/writing/story-cards', name: 'story', component: () => import('./views/StoryCardsView.vue') },
    { path: '/writing/story-cards/print', name: 'story-print', component: () => import('./views/StoryPrintView.vue') },
    { path: '/share', name: 'share', component: () => import('./views/ShareView.vue') },
    { path: '/zines', name: 'zines', component: () => import('./views/ZineLibrary.vue') },
    { path: '/storage', name: 'storage', component: () => import('./views/StorageView.vue') },
    { path: '/about', name: 'about', component: () => import('./views/AboutView.vue') },
    { path: '/zine/:id/edit', name: 'edit', component: () => import('./views/ZineEditor.vue'), props: true },
    { path: '/zine/:id/print', name: 'print', component: () => import('./views/PrintView.vue'), props: true },
    { path: '/zine/:id/read', name: 'read', component: () => import('./views/ZineReader.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
