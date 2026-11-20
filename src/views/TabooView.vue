<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { settings } from '../composables/settings'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { MAX_TRAITS, drawTraits, drawSituation, tabooStems, findTaboo } from '../writing/tabooData'

const ID = 'taboo' // IndexedDB drafts id
const blank = () => ({ step: 1, traits: [], extra: '', situation: '', text: '' })

const state = reactive(blank())
const loaded = ref(false)
const newTrait = ref('')
const revealed = ref(false)
const copied = ref(false)

const extraWords = computed(() => state.extra.split(/[,;\n]/).map((w) => w.trim()).filter(Boolean))
const stems = computed(() => tabooStems([...state.traits, ...extraWords.value]))
const used = computed(() => findTaboo(state.text, stems.value))
const wordCount = computed(() => (state.text.trim() ? state.text.trim().split(/\s+/).length : 0))
const full = computed(() => state.traits.length >= MAX_TRAITS)

/** Furthest step the user may open. */
const maxStep = computed(() => {
  if (!state.traits.length || !state.situation.trim()) return 1
  if (!state.text.trim()) return 2
  return 3
})

function go(n) {
  if (n < 1 || n > maxStep.value) return
  state.step = n
  revealed.value = false
  window.scrollTo({ top: 0 })
}

function addTrait() {
  // "shy, curious" in one go works too
  for (const w of newTrait.value.split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
    if (full.value) break
    if (!state.traits.some((x) => x.toLowerCase() === w.toLowerCase())) state.traits.push(w)
  }
  newTrait.value = ''
}

const removeTrait = (i) => state.traits.splice(i, 1)

/** Fill up to 3 traits; with 3–4 add one more; when all 5 are taken, draw a fresh 3. */
function onDrawTraits() {
  if (full.value) {
    state.traits = drawTraits(settings.locale, 3)
    return
  }
  const n = Math.max(1, 3 - state.traits.length)
  state.traits.push(...drawTraits(settings.locale, n, state.traits))
}

function onDrawSituation() {
  state.situation = drawSituation(settings.locale, state.situation)
}

async function copyText() {
  if (!(await copyToClipboard(state.text.trim()))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.taboo.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  // pause autosave while resetting, or the watcher re-saves an empty draft
  loaded.value = false
  Object.assign(state, blank())
  newTrait.value = ''
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
/** Text from a draft or an imported file: anything that isn't a string counts as empty. */
const str = (v) => (typeof v === 'string' ? v : '')

function apply(saved) {
  Object.assign(state, {
    step: [1, 2, 3].includes(saved?.step) ? saved.step : 1,
    traits: (Array.isArray(saved?.traits) ? saved.traits : []).filter((w) => typeof w === 'string' && w.trim()).slice(0, MAX_TRAITS),
    extra: str(saved?.extra),
    situation: str(saved?.situation),
    text: str(saved?.text),
  })
  if (state.step > maxStep.value) state.step = maxStep.value
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
  <section class="container prose taboo">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>⊘ {{ t('writing.taboo.title') }}</h1>
    <p class="lead">{{ t('writing.taboo.intro') }}</p>
    <EarlierVersion :keys="['taboo']" />

    <ol class="stepper">
      <li v-for="(label, i) in t('writing.taboo.steps')" :key="i" :class="{ active: state.step === i + 1 }">
        <button class="ghost" :disabled="i + 1 > maxStep" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- Step 1: character and situation -->
      <div v-if="state.step === 1" class="panel">
        <h2>{{ t('writing.taboo.s1Title') }}</h2>
        <p class="muted">{{ t('writing.taboo.s1Help') }}</p>

        <label class="field-label" for="trait-input">{{ t('writing.taboo.traitLabel') }} ({{ state.traits.length }}/5)</label>
        <ul v-if="state.traits.length" class="chips">
          <li v-for="(w, i) in state.traits" :key="w" class="chip">
            {{ w }}
            <button class="chip__x" @click="removeTrait(i)" :title="t('writing.taboo.remove', { w })" :aria-label="t('writing.taboo.remove', { w })">×</button>
          </li>
        </ul>
        <form class="row" @submit.prevent="addTrait">
          <input id="trait-input" v-model="newTrait" :disabled="full" :placeholder="t('writing.taboo.traitPlaceholder')" maxlength="40" />
          <button type="submit" class="ghost" :disabled="full || !newTrait.trim()" :title="tl('writing.taboo.add')" :aria-label="tl('writing.taboo.add')"><Icon name="plus" :label="tl('writing.taboo.add')" /></button>
          <button type="button" class="ghost" @click="onDrawTraits" :title="tl('writing.taboo.draw')" :aria-label="tl('writing.taboo.draw')">🎲 <span class="btn-label">{{ t('writing.taboo.draw') }}</span></button>
        </form>
        <p v-if="full" class="muted small">{{ t('writing.taboo.maxReached') }}</p>

        <label class="field-label" for="extra-input">{{ t('writing.taboo.extraLabel') }}</label>
        <p class="muted small help">{{ t('writing.taboo.extraHelp') }}</p>
        <input id="extra-input" v-model="state.extra" :placeholder="t('writing.taboo.extraPlaceholder')" />

        <label class="field-label" for="situation-input">{{ t('writing.taboo.situationLabel') }}</label>
        <p class="muted small help">{{ t('writing.taboo.situationHelp') }}</p>
        <div class="row">
          <input id="situation-input" v-model="state.situation" maxlength="160" />
          <button type="button" class="ghost" @click="onDrawSituation" :title="tl('writing.taboo.drawSituation')" :aria-label="tl('writing.taboo.drawSituation')">🎲 <span class="btn-label">{{ t('writing.taboo.drawSituation') }}</span></button>
        </div>
      </div>

      <!-- Step 2: write -->
      <div v-else-if="state.step === 2" class="panel">
        <h2>{{ t('writing.taboo.s2Title') }}</h2>
        <p class="muted">{{ t('writing.taboo.s2Help') }}</p>

        <div class="brief">
          <p><small>{{ t('writing.taboo.situation') }}</small>{{ state.situation }}</p>
          <p>
            <small>{{ t('writing.taboo.tabooTitle') }}</small>
            <span v-for="(w, i) in [...state.traits, ...extraWords]" :key="`${i}:${w}`" class="taboo-word">{{ w }}</span>
          </p>
        </div>

        <details class="hints">
          <summary>{{ t('writing.taboo.hintsTitle') }}</summary>
          <ul>
            <li v-for="h in t('writing.taboo.hints')" :key="h">{{ h }}</li>
          </ul>
        </details>

        <textarea v-model="state.text" rows="12" class="serif" :placeholder="t('writing.taboo.placeholder')" />
        <div class="check">
          <p v-if="used.length" class="warn" role="status">
            ⚠ {{ t('writing.taboo.found') }}
            <span v-for="u in used" :key="u.word" class="taboo-word hit">{{ u.hits[0] }}<template v-if="u.hits.length > 1"> ×{{ u.hits.length }}</template></span>
          </p>
          <p v-else-if="wordCount" class="ok" role="status">✓ {{ t('writing.taboo.clean') }}</p>
          <span class="spacer" />
          <p class="muted small">{{ t('writing.taboo.words', { n: wordCount }) }}</p>
        </div>
      </div>

      <!-- Step 3: read and guess -->
      <div v-else class="panel">
        <h2>{{ t('writing.taboo.s3Title') }}</h2>
        <p class="muted">{{ t('writing.taboo.s3Help') }}</p>
        <p class="situation-line"><small>{{ t('writing.taboo.situation') }}</small>{{ state.situation }}</p>
        <div v-if="state.text.trim()" class="final">{{ state.text.trim() }}</div>
        <p v-else class="muted">{{ t('writing.taboo.empty') }}</p>

        <div class="reveal">
          <button class="ghost" @click="revealed = !revealed">{{ revealed ? t('writing.taboo.hide') : t('writing.taboo.reveal') }}</button>
          <p v-if="revealed" class="revealed">
            <small>{{ t('writing.taboo.traitsWere') }}</small>
            <span v-for="w in state.traits" :key="w" class="taboo-word">{{ w }}</span>
          </p>
        </div>
        <p v-if="revealed && used.length" class="warn">
          ⚠ {{ t('writing.taboo.found') }}
          <span v-for="u in used" :key="u.word" class="taboo-word hit">{{ u.hits[0] }}</span>
        </p>

        <button v-if="state.text.trim()" class="primary" @click="copyText" :title="copied ? tl('writing.taboo.copied') : tl('writing.taboo.copy')" :aria-label="copied ? tl('writing.taboo.copied') : tl('writing.taboo.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.taboo.copied') : tl('writing.taboo.copy')" />
        </button>
      </div>

      <div class="step-nav">
        <button v-if="state.step > 1" class="ghost" @click="go(state.step - 1)" :title="tl('writing.taboo.back')" :aria-label="tl('writing.taboo.back')"><Icon name="arrow-left" :label="tl('writing.taboo.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.taboo.clear')" :aria-label="tl('writing.taboo.clear')"><Icon name="trash" :label="tl('writing.taboo.clear')" /></button>
        <button v-if="state.step < 3" class="primary" :disabled="state.step >= maxStep" @click="go(state.step + 1)" :title="tl('writing.taboo.next')" :aria-label="tl('writing.taboo.next')">
          <Icon name="arrow-right" :label="tl('writing.taboo.next')" />
        </button>
      </div>

      <SavedWorks kind="taboo" @open="apply" :data="state" :default-title="state.situation" :can-save="!!(state.text.trim() || state.traits.length)" />
    </template>
  </section>
</template>

<style scoped>
.serif { font: 1.1rem/1.7 Georgia, 'Times New Roman', serif; }
.field-label { display: block; font-weight: 600; margin: 1.25rem 0 0.35rem; }
.help { margin: -0.2rem 0 0.4rem; }
.small { font-size: 0.85rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.row input { flex: 1; min-width: 0; }
input { width: 100%; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.5rem; padding: 0; }
.chip {
  display: inline-flex; align-items: center; gap: 0.15rem;
  padding: 0.2rem 0.3rem 0.2rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}
.chip__x { border: 0; background: none; padding: 0 0.35rem; font-size: 1.1rem; line-height: 1; cursor: pointer; color: inherit; min-height: 0; }
.brief {
  margin: 0 0 1rem; padding: 0.7rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
.brief p { margin: 0.2rem 0; }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.taboo-word {
  display: inline-block; margin: 0.15rem 0.35rem 0.15rem 0;
  padding: 0 0.45rem; border-radius: 4px;
  text-decoration: line-through;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}
.taboo-word.hit { text-decoration: none; font-weight: 600; color: var(--danger); }
.hints { margin: 0 0 1rem; }
.hints summary { cursor: pointer; font-weight: 600; }
.hints ul { margin: 0.4rem 0 0; }
.check { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.4rem; }
.check p { margin: 0; }
.warn { color: var(--danger); }
.ok { color: var(--accent); font-weight: 600; }
.situation-line { margin: 0 0 1rem; font-style: italic; }
.final { font: 1.12rem/1.75 Georgia, serif; white-space: pre-wrap; margin: 0 0 1.25rem; }
.reveal { margin: 0 0 1rem; }
.revealed { margin: 0.6rem 0 0; }
.step-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
</style>
