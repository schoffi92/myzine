<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import ZinePage from '../components/ZinePage.vue'
import { settings } from '../composables/settings'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import { getZine, updateZine, listPages, updatePage, swapPages, saveImage, deleteImage } from '../db/zines'

const props = defineProps({ id: { type: String, required: true } })

const zine = ref(null)
const pages = ref([])
const selectedId = ref(null)
const status = ref('saved') // saved | saving | error
const notFound = ref(false)

const page = computed(() => pages.value.find((p) => p.id === selectedId.value) || null)
const pageIndex = computed(() => pages.value.findIndex((p) => p.id === selectedId.value))

/** Position names for the 8-page A4 format. */
function slotLabel(i) {
  if (i === 0) return t('editor.frontCover')
  if (i === pages.value.length - 1) return t('editor.backCover')
  return t('editor.page', { n: i })
}

/* ---- Debounced autosave: one pending write per key ---- */
const pending = new Map()

function schedule(key, fn, delay = 500) {
  status.value = 'saving'
  clearTimeout(pending.get(key)?.timer)
  pending.set(key, { fn, timer: setTimeout(() => run(key), delay) })
}

async function run(key) {
  const entry = pending.get(key)
  if (!entry) return
  clearTimeout(entry.timer)
  pending.delete(key)
  try {
    await entry.fn()
    if (!pending.size) status.value = 'saved'
  } catch (e) {
    console.error(e)
    status.value = 'error'
  }
}

// Resolves to undefined on purpose: a navigation guard that returns a value
// (e.g. Promise.all's array) is treated by vue-router as a redirect target.
async function flush() {
  await Promise.all([...pending.keys()].map(run))
}

const saveZine = () => schedule('zine', () => updateZine(zine.value))
const savePage = (p = page.value) => p && schedule(`page:${p.id}`, () => updatePage(p))

/* ---- Reordering (page count is fixed at 8) ---- */
async function move(dir) {
  const i = pageIndex.value
  const j = i + dir
  if (i < 0 || j < 0 || j >= pages.value.length) return
  await flush()
  const [a, b] = await swapPages(pages.value[i], pages.value[j])
  pages.value[i] = b
  pages.value[j] = a
}

/* ---- Images ---- */
async function onImage(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  const p = page.value
  if (!file || !p) return
  if (!file.type.startsWith('image/')) return alert(t('editor.notImage'))
  const old = p.imageId
  p.imageId = await saveImage(file)
  if (p.layout === 'text-only') p.layout = 'image-top'
  savePage(p)
  await run(`page:${p.id}`)
  if (old) await deleteImage(old)
}

async function removeImage() {
  const p = page.value
  if (!p?.imageId) return
  const old = p.imageId
  p.imageId = null
  savePage(p)
  await run(`page:${p.id}`)
  await deleteImage(old)
}

/* ---- Lifecycle ---- */
onMounted(async () => {
  zine.value = await getZine(props.id)
  if (!zine.value) {
    notFound.value = true
    return
  }
  settings.lastZineId = props.id
  pages.value = await listPages(props.id)
  selectedId.value = pages.value[0]?.id ?? null
})

const onUnload = () => { flush() }
window.addEventListener('beforeunload', onUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload))
onBeforeRouteLeave(() => flush())
</script>

<template>
  <section v-if="notFound" class="container">
    <p class="error">{{ t('editor.notFound') }}</p>
    <RouterLink :to="{ name: 'zines' }">{{ t('editor.back') }}</RouterLink>
  </section>

  <section v-else-if="zine" class="editor">
    <div class="editor__head">
      <RouterLink :to="{ name: 'zines' }" class="ghost btn">←</RouterLink>
      <input v-model="zine.title" class="title-input" maxlength="80" @input="saveZine" />
      <input v-model="zine.color" type="color" :title="t('editor.accent')" @input="saveZine" />
      <span class="status" :class="status">
        {{ status === 'saving' ? t('editor.saving') : status === 'error' ? t('editor.saveFailed') : t('editor.saved') }}
      </span>
      <RouterLink class="btn" :to="{ name: 'print', params: { id } }" :title="t('print.button')" :aria-label="t('print.button')">
        <svg class="btn-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" /></svg>
        <span class="hide-mobile">{{ t('print.button') }}</span>
      </RouterLink>
      <RouterLink class="btn primary" :to="{ name: 'read', params: { id } }" :title="tl('editor.read')" :aria-label="tl('editor.read')"><Icon name="book" :label="tl('editor.read')" /></RouterLink>
    </div>
    <textarea v-model="zine.description" class="desc-input" rows="1" :placeholder="t('editor.description')" @input="saveZine" />

    <div class="editor__body">
      <aside class="pages">
        <ol>
          <li
            v-for="(p, i) in pages"
            :key="p.id"
            :class="{ active: p.id === selectedId }"
            @click="flush(); selectedId = p.id"
          >
            <span class="num">{{ i + 1 }}</span>
            <span class="name">
              <small class="slot">{{ slotLabel(i) }}</small>
              {{ p.title }}
            </span>
          </li>
        </ol>
        <!-- Phones: a dropdown instead of the list of page buttons -->
        <select
          class="page-select"
          :value="selectedId"
          :aria-label="t('editor.choosePage')"
          @change="flush(); selectedId = $event.target.value"
        >
          <option v-for="(p, i) in pages" :key="p.id" :value="p.id">
            {{ i + 1 }} · {{ slotLabel(i) }}{{ p.title.trim() ? ` — ${p.title.trim()}` : '' }}
          </option>
        </select>
      </aside>

      <div v-if="page" class="page-form">
        <p class="slot-heading">{{ slotLabel(pageIndex) }}</p>
        <div class="row">
          <input v-model="page.title" :placeholder="t('editor.pageTitle')" @input="savePage()" />
          <select v-model="page.layout" @change="savePage()">
            <option value="image-top">{{ t('editor.layoutTop') }}</option>
            <option value="image-left">{{ t('editor.layoutLeft') }}</option>
            <option value="text-only">{{ t('editor.layoutText') }}</option>
          </select>
        </div>
        <textarea v-model="page.body" rows="12" :placeholder="t('editor.body')" @input="savePage()" />
        <div class="row">
          <label class="btn" :title="tl(page.imageId ? 'editor.replaceImage' : 'editor.addImage')" :aria-label="tl(page.imageId ? 'editor.replaceImage' : 'editor.addImage')">
            <Icon name="image" :label="tl(page.imageId ? 'editor.replaceImage' : 'editor.addImage')" />
            <input type="file" accept="image/*" hidden @change="onImage" />
          </label>
          <button v-if="page.imageId" class="ghost" @click="removeImage" :title="tl('editor.removeImage')" :aria-label="tl('editor.removeImage')"><Icon name="x" :label="tl('editor.removeImage')" /></button>
          <span class="spacer" />
          <button class="ghost" :disabled="pageIndex <= 0" :title="t('editor.moveUp')" @click="move(-1)">↑</button>
          <button class="ghost" :disabled="pageIndex >= pages.length - 1" :title="t('editor.moveDown')" @click="move(1)">↓</button>
        </div>
      </div>
      <div v-else class="page-form muted">{{ t('editor.noPages') }}</div>

      <div v-if="page" class="preview">
        <p class="label">{{ t('editor.preview') }}</p>
        <ZinePage :page="page" :accent="zine.color" :font-size="15" />
      </div>
    </div>
  </section>

  <p v-else class="container muted">{{ t('library.loading') }}</p>
</template>
