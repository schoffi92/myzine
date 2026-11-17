<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listZines, createZine, deleteZine } from '../db/zines'
import { downloadBackup, pickAndImportBackup } from '../composables/backup'
import { storageEstimate } from '../db/idb'
import { settings } from '../composables/settings'
import { t } from '../i18n'

const router = useRouter()
const zines = ref([])
const loading = ref(true)
const error = ref('')
const newTitle = ref('')
const usage = ref(null)

const lastZine = computed(() => zines.value.find((z) => z.id === settings.lastZineId))

async function refresh() {
  try {
    zines.value = await listZines()
    const est = await storageEstimate()
    usage.value = est
      ? { used: (est.usage / 1024 / 1024).toFixed(1), quota: Math.round(est.quota / 1024 / 1024) }
      : null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function create() {
  const zine = await createZine({ title: newTitle.value.trim() || t('library.untitled') })
  newTitle.value = ''
  router.push({ name: 'edit', params: { id: zine.id } })
}

async function remove(zine) {
  if (!confirm(t('library.confirmDelete', { title: zine.title }))) return
  await deleteZine(zine.id)
  if (settings.lastZineId === zine.id) settings.lastZineId = null
  refresh()
}

const fmt = (ts) =>
  new Date(ts).toLocaleDateString(settings.locale, { month: 'short', day: 'numeric', year: 'numeric' })

onMounted(refresh)
</script>

<template>
  <section class="container">
    <RouterLink :to="{ name: 'home' }" class="back">← {{ t('nav.home') }}</RouterLink>
    <div class="hero">
      <h1>{{ t('library.title') }}</h1>
      <p class="muted">{{ t('library.intro') }}</p>
    </div>

    <form class="create" @submit.prevent="create">
      <input v-model="newTitle" :placeholder="t('library.placeholder')" maxlength="80" />
      <button type="submit" class="primary">{{ t('library.new') }}</button>
    </form>

    <p v-if="lastZine" class="continue">
      {{ t('library.continue') }}
      <RouterLink :to="{ name: 'edit', params: { id: lastZine.id } }">{{ lastZine.title }}</RouterLink>
    </p>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="muted">{{ t('library.loading') }}</p>
    <p v-else-if="!zines.length" class="empty">{{ t('library.empty') }}</p>

    <ul class="grid">
      <li v-for="z in zines" :key="z.id" class="card" :style="{ '--accent': z.color }">
        <div class="card__spine" />
        <div class="card__body">
          <h3>{{ z.title }}</h3>
          <p v-if="z.description" class="muted clamp">{{ z.description }}</p>
          <p class="meta">
            {{ t('library.pages', { n: z.pageCount }) }} · {{ t('library.edited', { date: fmt(z.updatedAt) }) }}
          </p>
          <div class="actions">
            <RouterLink class="btn" :to="{ name: 'read', params: { id: z.id } }">{{ t('library.read') }}</RouterLink>
            <RouterLink class="btn" :to="{ name: 'edit', params: { id: z.id } }">{{ t('library.edit') }}</RouterLink>
            <RouterLink class="btn" :to="{ name: 'print', params: { id: z.id } }">{{ t('print.button') }}</RouterLink>
            <button class="ghost danger" @click="remove(z)">{{ t('library.delete') }}</button>
          </div>
        </div>
      </li>
    </ul>

    <footer class="data-bar">
      <span class="muted">{{ usage ? t('library.usage', usage) : '' }}</span>
      <span class="spacer" />
      <button class="ghost" @click="downloadBackup">{{ t('library.export') }}</button>
      <button class="ghost" @click="pickAndImportBackup">{{ t('library.import') }}</button>
    </footer>
  </section>
</template>
