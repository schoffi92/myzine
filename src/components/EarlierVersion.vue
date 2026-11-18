<script setup>
import { ref, onMounted } from 'vue'
import { t } from '../i18n'
import { settings } from '../composables/settings'
import { listEarlier, restoreEarlier, deleteEarlier } from '../sync/textSync'

/*
 * Note shown on a practice page (or the zine editor) when a QR sync replaced
 * its content and kept the earlier version. Restore swaps the two (so the
 * user can swap back), then reloads the page so it reads the swapped data.
 */
const props = defineProps({
  keys: { type: Array, required: true }, // draft ids, or `zine:<id>`
  beforeRestore: { type: Function, default: null }, // e.g. flush unsaved edits
})

const found = ref([]) // [{ key, savedAt }]
const busy = ref(false)

const when = () => {
  const at = Math.max(...found.value.map((f) => f.savedAt || 0))
  return new Date(at).toLocaleString(settings.locale, { dateStyle: 'medium', timeStyle: 'short' })
}

async function restore() {
  if (!confirm(t('qr.earlier.confirmRestore'))) return
  busy.value = true
  try {
    await props.beforeRestore?.()
    await restoreEarlier(found.value.map((f) => f.key))
    location.reload()
  } catch (e) {
    busy.value = false
    alert(e.message)
  }
}

async function remove() {
  if (!confirm(t('qr.earlier.confirmDelete'))) return
  await deleteEarlier(found.value.map((f) => f.key))
  found.value = []
}

onMounted(async () => {
  found.value = await listEarlier(props.keys)
})
</script>

<template>
  <div v-if="found.length" class="earlier" role="note">
    <span>↺ {{ t('qr.earlier.note', { date: when() }) }}</span>
    <span class="earlier__btns">
      <button class="ghost" :disabled="busy" @click="restore">{{ t('qr.earlier.restore') }}</button>
      <button class="ghost danger" :disabled="busy" @click="remove">{{ t('qr.earlier.delete') }}</button>
    </span>
  </div>
</template>

<style scoped>
.earlier {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.75rem 0 1rem;
  padding: 0.5rem 0.8rem;
  border: 1px dashed var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  font-size: 0.92rem;
}
.earlier__btns { display: flex; gap: 0.3rem; }
</style>
