<script setup>
import { ref, onMounted } from 'vue'
import { t } from '../i18n'
import { storageEstimate } from '../db/idb'

const estimate = ref(null)
const persisted = ref(null)

onMounted(async () => {
  // Skip while pre-rendering (automated browser): these numbers belong to the visitor's own browser.
  if (navigator.webdriver) return
  const est = await storageEstimate()
  if (est) {
    estimate.value = {
      used: (est.usage / 1024 / 1024).toFixed(1),
      quota: Math.round(est.quota / 1024 / 1024),
    }
  }
  try {
    persisted.value = (await navigator.storage?.persisted?.()) ?? null
  } catch {
    persisted.value = null
  }
})
</script>

<template>
  <section class="container prose">
    <RouterLink :to="{ name: 'home' }" class="back">← {{ t('nav.home') }}</RouterLink>
    <h1>{{ t('storage.title') }}</h1>
    <p class="lead">{{ t('storage.intro') }}</p>

    <div v-for="(s, i) in t('storage.sections')" :key="i" class="info-block">
      <h2>{{ s.h }}</h2>
      <p>{{ s.p }}</p>
    </div>

    <div v-if="estimate || persisted !== null" class="status-box">
      <h2>{{ t('storage.status') }}</h2>
      <p v-if="estimate">{{ t('storage.usage', estimate) }}</p>
      <p v-if="persisted === true">✓ {{ t('storage.persisted') }}</p>
      <p v-else-if="persisted === false">⚠ {{ t('storage.notPersisted') }}</p>
    </div>
  </section>
</template>
