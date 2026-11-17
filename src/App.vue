<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { settings } from './composables/settings'
import { t, languages } from './i18n'
import { status, mmss, ringing, stopAlarm, owner } from './composables/poemTimer'
import { downloadBackup, pickAndImportBackup, backupAndClearAll } from './composables/backup'
import FlagIcon from './components/FlagIcon.vue'

// Same breakpoint as the icon-only top bar in style.css
const mobileQuery = window.matchMedia('(max-width: 640px)')
const isMobile = ref(mobileQuery.matches)
mobileQuery.addEventListener('change', (e) => (isMobile.value = e.matches))

const route = useRoute()
const onTimerPage = computed(() => route.name === owner.value)
const timerActive = computed(() => status.value === 'running' || status.value === 'paused')

watchEffect(() => {
  const root = document.documentElement
  if (settings.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = settings.theme
})
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">
      <!-- same shapes as public/logo.svg, inlined so it follows the theme colour -->
      <svg class="brand__logo" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M5 7 12.5 13v16L5 33Z" />
        <path fill-opacity=".55" d="M12.5 13 20 19v14l-7.5-4Z" />
        <path d="M20 19 27.5 13v16L20 33Z" />
        <path fill-opacity=".55" d="M27.5 13 35 7v26l-7.5-4Z" />
      </svg>
      <span class="brand__text">My<span>Zine</span></span>
    </RouterLink>
    <div class="topbar__controls">
      <RouterLink
        v-if="timerActive && !onTimerPage"
        :to="{ name: owner }"
        class="timer-chip"
        :class="status"
        :title="t('writing.timed.title')"
      >
        ⏱ {{ mmss }}
      </RouterLink>
      <RouterLink :to="{ name: 'share' }" class="btn ghost icon-btn" :title="t('share.tip')" :aria-label="t('share.tip')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
      </RouterLink>
      <button class="ghost icon-btn" :title="t('nav.exportTip')" :aria-label="t('nav.exportTip')" @click="downloadBackup">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 19h16" /></svg>
      </button>
      <button class="ghost icon-btn" :title="t('nav.importTip')" :aria-label="t('nav.importTip')" @click="pickAndImportBackup">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7 8m5-5l5 5M4 19h16" /></svg>
      </button>
      <button class="ghost icon-btn danger-hover" :title="t('nav.clearTip')" :aria-label="t('nav.clearTip')" @click="backupAndClearAll">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
      </button>
      <label class="select-wrap" :title="t('nav.language')">
        <svg v-if="!isMobile" class="select-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
        <FlagIcon v-else :code="settings.locale" />
        <select v-model="settings.locale" :aria-label="t('nav.language')">
          <!-- flag emoji only on phones: their pickers render them; Windows doesn't -->
          <option v-for="l in languages" :key="l.code" :value="l.code">{{ isMobile ? `${l.flag} ${l.name}` : l.name }}</option>
        </select>
      </label>
      <label class="select-wrap" :title="t('nav.theme')">
        <svg class="select-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" class="fill" /></svg>
        <select v-model="settings.theme" :aria-label="t('nav.theme')">
          <option value="system">{{ t('theme.system') }}</option>
          <option value="light">{{ t('theme.light') }}</option>
          <option value="dark">{{ t('theme.dark') }}</option>
        </select>
      </label>
    </div>
  </header>
  <main>
    <RouterView />
  </main>

  <!-- The 15-minute timer rings on any page; this banner shows when you're elsewhere. -->
  <div v-if="ringing && !onTimerPage" class="alarm-toast no-print" role="alert">
    <strong>⏰ {{ t('writing.timed.timesUp') }}</strong>
    <span class="spacer" />
    <RouterLink :to="{ name: owner }" class="btn" @click="stopAlarm">{{ t('writing.timed.goTo') }}</RouterLink>
    <button class="primary" @click="stopAlarm">🔕 {{ t('writing.timed.stopAlarm') }}</button>
  </div>
</template>
