<script setup>
import { ref, reactive, computed, watch, onMounted, shallowRef } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import { listZines } from '../db/zines'
import { countDrafts } from '../db/drafts'
import { buildShareFiles, buildMarkdownFiles, canShareFiles, shareFile, downloadFile, pickAndImportBackup } from '../composables/backup'

const zines = ref([])
const draftCount = ref(0)
const loaded = ref(false)
// format: 'backup' (JSON, importable) | 'markdown' (readable, not importable)
const sel = reactive({ format: 'backup', zineIds: [], includeImages: true, includeDrafts: true })

const prepared = shallowRef(null) // { share: File, download: File, size }
const preparing = ref(false)
const error = ref('')
const shareSupported = canShareFiles()

const nothingSelected = computed(() => !sel.zineIds.length && !(sel.includeDrafts && draftCount.value))

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/*
 * Browsers only open the share menu right after a tap, so the file is built
 * ahead of time whenever the selection changes. The Share button then hands
 * the ready file to navigator.share() without waiting.
 */
let buildToken = 0
let buildTimer = null
function rebuild() {
  clearTimeout(buildTimer)
  // invalidate any build still running for the previous selection
  const mine = ++buildToken
  prepared.value = null
  error.value = ''
  if (nothingSelected.value) {
    preparing.value = false
    return
  }
  preparing.value = true
  buildTimer = setTimeout(async () => {
    try {
      const selection = {
        zineIds: [...sel.zineIds],
        includeImages: sel.includeImages,
        includeDrafts: sel.includeDrafts && draftCount.value > 0,
      }
      const files = sel.format === 'markdown' ? await buildMarkdownFiles(selection) : await buildShareFiles(selection)
      if (mine === buildToken) prepared.value = files
    } catch (e) {
      if (mine === buildToken) error.value = e.message
    } finally {
      if (mine === buildToken) preparing.value = false
    }
  }, 250)
}

watch(sel, rebuild, { deep: true })

function selectAll(on) {
  sel.zineIds = on ? zines.value.map((z) => z.id) : []
}

async function onShare() {
  if (!prepared.value) return
  try {
    await shareFile(prepared.value.share) // first await: keeps the user gesture
  } catch (e) {
    error.value = e.message
  }
}

function onDownload() {
  if (prepared.value) downloadFile(prepared.value.download)
}

onMounted(async () => {
  const [z, d] = await Promise.all([listZines(), countDrafts()])
  zines.value = z
  draftCount.value = d
  sel.zineIds = z.map((x) => x.id)
  sel.includeDrafts = d > 0
  loaded.value = true
  rebuild()
})
</script>

<template>
  <section class="container prose share">
    <RouterLink :to="{ name: 'home' }" class="back" :title="tl('nav.home')" :aria-label="tl('nav.home')"><Icon name="arrow-left" :label="tl('nav.home')" /></RouterLink>
    <h1>{{ t('share.title') }}</h1>
    <p class="lead">{{ t('share.intro') }}</p>

    <template v-if="loaded">
      <!-- 1. What to share -->
      <div class="panel">
        <h2>1 · {{ t('share.whatTitle') }}</h2>

        <div class="group">
          <strong>{{ t('share.formatTitle') }}</strong>
          <div class="formats" role="radiogroup" :aria-label="t('share.formatTitle')">
            <label class="toggle format" :class="{ on: sel.format === 'backup' }">
              <input v-model="sel.format" type="radio" value="backup" name="format" />
              <span>
                {{ t('share.formatBackup') }}
                <small class="muted">{{ t('share.formatBackupHint') }}</small>
              </span>
            </label>
            <label class="toggle format" :class="{ on: sel.format === 'markdown' }">
              <input v-model="sel.format" type="radio" value="markdown" name="format" />
              <span>
                {{ t('share.formatMd') }}
                <small class="muted">{{ t('share.formatMdHint') }}</small>
              </span>
            </label>
          </div>
        </div>

        <div class="group">
          <div class="group__head">
            <strong>{{ t('share.zines') }}</strong>
            <span v-if="zines.length" class="group__links">
              <button class="ghost link-btn" @click="selectAll(true)">{{ t('share.selectAll') }}</button>
              <button class="ghost link-btn" @click="selectAll(false)">{{ t('share.selectNone') }}</button>
            </span>
          </div>
          <p v-if="!zines.length" class="muted small">{{ t('share.noZines') }}</p>
          <ul v-else class="checklist">
            <li v-for="z in zines" :key="z.id">
              <label>
                <input v-model="sel.zineIds" type="checkbox" :value="z.id" />
                <span class="swatch" :style="{ background: z.color }" />
                <span class="name">{{ z.title }}</span>
                <span class="muted small">{{ t('library.pages', { n: z.pageCount }) }}</span>
              </label>
            </li>
          </ul>
          <label v-if="zines.length" class="toggle" :class="{ disabled: sel.format === 'markdown' }">
            <input v-model="sel.includeImages" type="checkbox" :disabled="sel.format === 'markdown'" />
            <span>
              {{ t('share.images') }}
              <small class="muted">{{ t('share.imagesHint') }}</small>
            </span>
          </label>
        </div>

        <div class="group">
          <label class="toggle">
            <input v-model="sel.includeDrafts" type="checkbox" :disabled="!draftCount" />
            <span>
              <strong>{{ t('share.practices') }}</strong>
              <small class="muted">{{ t('share.practicesCount', { n: draftCount }) }}</small>
            </span>
          </label>
        </div>

        <p class="size" aria-live="polite">
          <template v-if="nothingSelected">{{ t('share.nothing') }}</template>
          <template v-else-if="preparing">{{ t('share.preparing') }}</template>
          <template v-else-if="prepared">{{ t('share.size', { size: formatSize(prepared.size) }) }}</template>
        </p>
      </div>

      <!-- 2. Send -->
      <div class="panel">
        <h2>2 · {{ t('share.sendTitle') }}</h2>
        <div class="send-btns">
          <button v-if="shareSupported" class="primary big" :disabled="!prepared" @click="onShare">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            {{ t('share.shareBtn') }}
          </button>
          <button :class="shareSupported ? 'ghost' : 'primary big'" :disabled="!prepared" @click="onDownload">
            ⤓ {{ t('share.download') }}
          </button>
        </div>
        <p v-if="!shareSupported" class="muted small">{{ t('share.noShare') }}</p>
        <p v-if="error" class="error small">{{ error }}</p>

        <h3>{{ t('share.waysTitle') }}</h3>
        <ul class="ways">
          <li v-for="(w, i) in t('share.ways')" :key="i">{{ w }}</li>
        </ul>
      </div>

      <!-- 3. Receive -->
      <div class="panel">
        <h2>3 · {{ t('share.receiveTitle') }}</h2>
        <ol class="steps">
          <li v-for="(s, i) in t('share.steps')" :key="i">{{ s }}</li>
        </ol>
        <p class="muted small">{{ t('share.mergeNote') }}</p>
        <button @click="pickAndImportBackup">⤒ {{ t('share.importBtn') }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.small { font-size: 0.86rem; }
.panel h2 { margin-bottom: 0.75rem; }
.panel h3 { font-size: 1rem; margin: 1.25rem 0 0.4rem; }

.group { padding: 0.75rem 0; border-top: 1px solid var(--border); }
.group:first-of-type { border-top: 0; padding-top: 0; }
.group__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem; }
.group__links { display: flex; gap: 0.25rem; }
.link-btn { padding: 0.1em 0.4em; font-size: 0.85rem; color: var(--accent); }

.checklist { list-style: none; margin: 0 0 0.6rem; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; max-height: 16rem; overflow-y: auto; }
.checklist label,
.toggle { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.2rem; border-radius: 6px; cursor: pointer; }
.checklist label:hover,
.toggle:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.checklist input,
.toggle input { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); flex-shrink: 0; }
.toggle { align-items: flex-start; }
.toggle input { margin-top: 0.15rem; }
.toggle span { display: flex; flex-direction: column; }
.swatch { width: 0.8rem; height: 0.8rem; border-radius: 3px; flex-shrink: 0; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.size { margin: 0.75rem 0 0; font-weight: 600; }
.formats { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.4rem; }
.format { border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.6rem; }
.format.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.toggle.disabled { opacity: 0.5; cursor: default; }

.send-btns { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
.big { font-size: 1.05rem; padding: 0.6em 1.1em; }
.ico { width: 1.1em; height: 1.1em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.ways, .steps { margin: 0 0 0.75rem; padding-left: 1.3rem; }
.ways li + li, .steps li + li { margin-top: 0.25rem; }
</style>
