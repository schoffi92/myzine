<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { SITUATIONS, situationText, drawSituationKey } from '../composables/situation'

/*
 * Difficult situation: put a character into an unpleasant situation and
 * write how they react. Pick or draw a situation, or write your own.
 */
const ID = 'situation' // IndexedDB drafts id
const blank = () => ({ character: '', sitKey: null, ownSituation: '', text: '' })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const listOpen = ref(false)

const current = computed(() => situationText(state, t))
const wordCount = computed(() => (state.text.trim() ? state.text.trim().split(/\s+/).length : 0))
const defaultTitle = computed(() => [state.character.trim(), current.value].filter(Boolean).join(': '))

/** Picking or drawing replaces your own situation (and the other way round, see onOwnInput). */
function pick(key) {
  state.sitKey = key
  state.ownSituation = ''
  listOpen.value = false
}

function draw() {
  pick(drawSituationKey(state.sitKey))
}

/** Typing your own situation replaces a picked one. */
function onOwnInput() {
  if (state.ownSituation.trim()) state.sitKey = null
}

async function copyText() {
  if (!(await copyToClipboard(state.text.trim()))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.situation.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  // pause autosave while resetting, or the watcher re-saves an empty draft
  loaded.value = false
  Object.assign(state, blank())
  await nextTick()
  loaded.value = true
  await deleteDraft(ID)
}

/* ---- autosave to IndexedDB ---- */
let saveTimer = null
watch(
  state,
  () => {
    if (!loaded.value) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveDraftData(ID, state)
    }, 400)
  },
  { deep: true },
)

/** Put a draft or a saved work on the page (autosave then stores it as the draft). */
function apply(saved) {
  Object.assign(state, {
    character: typeof saved?.character === 'string' ? saved.character : '',
    sitKey: SITUATIONS.includes(saved?.sitKey) ? saved.sitKey : null,
    ownSituation: typeof saved?.ownSituation === 'string' ? saved.ownSituation : '',
    text: typeof saved?.text === 'string' ? saved.text : '',
  })
}

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
  loaded.value = true
})

/** Save a pending edit now: when leaving the page, and when the tab is hidden or closed. */
function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    saveDraftData(ID, state)
  }
}
const stopFlushOnHide = flushOnHide(flushSave)

onBeforeUnmount(() => {
  stopFlushOnHide()
  flushSave()
})
</script>

<template>
  <section class="container prose situation">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>⚠ {{ t('writing.situation.title') }}</h1>
    <p class="lead">{{ t('writing.situation.intro') }}</p>
    <EarlierVersion :keys="['situation']" />

    <template v-if="loaded">
      <div class="panel">
        <h2><label for="sit-character">{{ t('writing.situation.characterTitle') }}</label></h2>
        <p class="muted small help">{{ t('writing.situation.characterHelp') }}</p>
        <input id="sit-character" v-model="state.character" maxlength="160" autocomplete="off" :placeholder="t('writing.situation.characterPlaceholder')" />
      </div>

      <div class="panel">
        <h2>{{ t('writing.situation.situationTitle') }}</h2>
        <p class="muted small help">{{ t('writing.situation.situationHelp') }}</p>

        <div class="brief" aria-live="polite">
          <small>{{ t('writing.situation.situationLabel') }}</small>
          <p v-if="current">{{ current }}</p>
          <p v-else class="muted">{{ t('writing.situation.noSituation') }}</p>
        </div>

        <div class="row wrap">
          <button type="button" class="ghost" @click="draw" :title="tl('writing.situation.draw')" :aria-label="tl('writing.situation.draw')">🎲 <span class="btn-label">{{ t('writing.situation.draw') }}</span></button>
          <button type="button" class="ghost" :aria-expanded="listOpen" aria-controls="sit-list" @click="listOpen = !listOpen">{{ listOpen ? t('writing.situation.hideList') : t('writing.situation.showList') }}</button>
        </div>
        <ul v-if="listOpen" id="sit-list" class="sit-list">
          <li v-for="k in SITUATIONS" :key="k">
            <button type="button" class="sit-option" :class="{ active: state.sitKey === k }" :aria-pressed="state.sitKey === k" @click="pick(k)">{{ t(`writing.situation.situations.${k}`) }}</button>
          </li>
        </ul>

        <label class="field-label" for="sit-own">{{ t('writing.situation.ownLabel') }}</label>
        <input id="sit-own" v-model="state.ownSituation" maxlength="200" autocomplete="off" :placeholder="t('writing.situation.ownPlaceholder')" @input="onOwnInput" />
      </div>

      <div class="panel">
        <h2><label for="sit-text">{{ t('writing.situation.writeTitle') }}</label></h2>
        <p class="muted small help">{{ t('writing.situation.writeHelp') }}</p>
        <details class="hints">
          <summary>{{ t('writing.situation.hintsTitle') }}</summary>
          <ul>
            <li v-for="h in t('writing.situation.hints')" :key="h">{{ h }}</li>
          </ul>
        </details>
        <textarea id="sit-text" v-model="state.text" rows="12" class="serif" :placeholder="t('writing.situation.placeholder')" />
        <p class="muted small count">{{ t('writing.situation.words', { n: wordCount }) }}</p>
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.situation.clear')" :aria-label="tl('writing.situation.clear')"><Icon name="trash" :label="tl('writing.situation.clear')" /></button>
        <button class="primary" :disabled="!state.text.trim()" @click="copyText" :title="copied ? tl('writing.situation.copied') : tl('writing.situation.copy')" :aria-label="copied ? tl('writing.situation.copied') : tl('writing.situation.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.situation.copied') : tl('writing.situation.copy')" />
        </button>
      </div>

      <SavedWorks kind="situation" @open="apply" :data="state" :default-title="defaultTitle" :can-save="!!state.text.trim()" />
    </template>
  </section>
</template>

<style scoped>
.serif { font: 1.1rem/1.7 Georgia, 'Times New Roman', serif; }
.panel + .panel { margin-top: 1rem; }
.panel h2 label { font: inherit; }
.small { font-size: 0.85rem; }
.help { margin: 0 0 0.5rem; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input, textarea { width: 100%; box-sizing: border-box; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.wrap { flex-wrap: wrap; }
.brief {
  margin: 0 0 0.75rem; padding: 0.7rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
.brief p { margin: 0.2rem 0 0; font: 1.08rem/1.5 Georgia, 'Times New Roman', serif; }
.brief p.muted { font: inherit; }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.sit-list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.sit-option { width: 100%; text-align: left; justify-content: flex-start; background: var(--surface); border: 1px solid var(--border); white-space: normal; }
.sit-option.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.hints { margin: 0 0 0.75rem; }
.hints summary { cursor: pointer; font-weight: 600; }
.hints ul { margin: 0.4rem 0 0; }
.count { margin: 0.3rem 0 0; text-align: right; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
</style>
