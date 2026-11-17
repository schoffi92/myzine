<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { settings } from './composables/settings'
import { t, languages } from './i18n'
import { status, mmss, ringing, stopAlarm, owner } from './composables/poemTimer'
import { downloadBackup, pickAndImportBackup, backupAndClearAll } from './composables/backup'

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
    <RouterLink to="/" class="brand">My<span>Zine</span></RouterLink>
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
        <span class="select-icon" aria-hidden="true">🌐</span>
        <select v-model="settings.locale" :aria-label="t('nav.language')">
          <option v-for="l in languages" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
      </label>
      <label class="select-wrap" :title="t('nav.theme')">
        <span class="select-icon" aria-hidden="true">◐</span>
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
