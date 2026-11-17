<script setup>
import { ref, onMounted } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import { storageEstimate } from '../db/idb'

const estimate = ref(null)
const persisted = ref(null)

/*
 * Pasted into the browser console on a MyZine page, this downloads everything
 * in the normal backup format (importable), without using the app's own code.
 * Keep it in sync with exportSelection() in src/db/zines.js.
 */
const backupSnippet = `(async () => {
  const db = await new Promise((ok, err) => {
    const r = indexedDB.open('myzine')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => err(r.error)
  })
  const all = (name) => new Promise((ok, err) => {
    if (!db.objectStoreNames.contains(name)) return ok([])
    const q = db.transaction(name).objectStore(name).getAll()
    q.onsuccess = () => ok(q.result)
    q.onerror = () => err(q.error)
  })
  const toDataURL = (blob) => new Promise((ok) => {
    const f = new FileReader()
    f.onload = () => ok(f.result)
    f.readAsDataURL(blob)
  })
  const images = []
  for (const i of await all('images')) {
    images.push({ id: i.id, dataURL: await toDataURL(i.blob) })
  }
  const data = {
    app: 'myzine', version: 2, exportedAt: new Date().toISOString(),
    zines: await all('zines'), pages: await all('pages'),
    images, drafts: await all('drafts'),
  }
  const file = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = 'myzine-backup.json'
  a.click()
})()`

const copied = ref(false)
async function copySnippet() {
  try {
    await navigator.clipboard.writeText(backupSnippet)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard blocked: the code can still be selected by hand */
  }
}

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
    <RouterLink :to="{ name: 'home' }" class="back" :title="tl('nav.home')" :aria-label="tl('nav.home')"><Icon name="arrow-left" :label="tl('nav.home')" /></RouterLink>
    <h1>{{ t('storage.title') }}</h1>
    <p class="lead">{{ t('storage.intro') }}</p>

    <div v-for="(s, i) in t('storage.sections')" :key="i" class="info-block">
      <h2>{{ s.h }}</h2>
      <p>{{ s.p }}</p>
    </div>

    <section class="access" aria-labelledby="access-title">
      <h2 id="access-title">{{ t('storage.access.title') }}</h2>
      <p>{{ t('storage.access.intro') }}</p>
      <div v-for="(item, i) in t('storage.access.items')" :key="i" class="info-block">
        <h3>{{ item.h }}</h3>
        <p>{{ item.p }}</p>
        <div v-if="item.code" class="snippet">
          <button class="ghost snippet__copy" @click="copySnippet">
            {{ copied ? '✓ ' + t('storage.access.copied') : t('storage.access.copy') }}
          </button>
          <pre><code>{{ backupSnippet }}</code></pre>
        </div>
      </div>
    </section>

    <div v-if="estimate || persisted !== null" class="status-box">
      <h2>{{ t('storage.status') }}</h2>
      <p v-if="estimate">{{ t('storage.usage', estimate) }}</p>
      <p v-if="persisted === true">✓ {{ t('storage.persisted') }}</p>
      <p v-else-if="persisted === false">⚠ {{ t('storage.notPersisted') }}</p>
    </div>
  </section>
</template>

<style scoped>
.access { margin-top: 2.5rem; }
.access > p { margin-top: 0; }
.access h3 { margin: 0 0 0.25rem; font-size: 1.05rem; }
.snippet { position: relative; margin-top: 0.75rem; }
.snippet pre {
  margin: 0;
  padding: 2.75rem 1rem 1rem;
  overflow-x: auto;
  max-width: 100%;
  font-size: 0.8rem;
  line-height: 1.45;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
}
.snippet__copy { position: absolute; top: 0.4rem; right: 0.4rem; font-size: 0.85rem; }
</style>
