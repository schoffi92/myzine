<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'

const ID = 'snowflake' // IndexedDB drafts id
const blank = () => ({ step: 1, one: '', five: ['', '', '', '', ''], paras: ['', '', '', '', ''] })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)

const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)
const filled = (list) => list.some((s) => s.trim())

/** Furthest step the user may open, based on what's written so far. */
const maxStep = computed(() => {
  if (!state.one.trim()) return 1
  if (!filled(state.five)) return 2
  if (!filled(state.paras)) return 3
  return 4
})
const canNext = computed(() => state.step < maxStep.value)

const finalParagraphs = computed(() =>
  state.paras.map((p, i) => p.trim() || state.five[i].trim()).filter(Boolean),
)

function go(n) {
  if (n < 1 || n > maxStep.value) return
  state.step = n
  window.scrollTo({ top: 0 })
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(finalParagraphs.value.join('\n\n'))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* clipboard blocked */ }
}

async function startOver() {
  if (!confirm(t('writing.snowflake.confirmClear'))) return
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

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) {
    const b = blank()
    Object.assign(state, {
      step: saved.step ?? 1,
      one: saved.one ?? '',
      five: b.five.map((_, i) => saved.five?.[i] ?? ''),
      paras: b.paras.map((_, i) => saved.paras?.[i] ?? ''),
    })
  }
  loaded.value = true
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveDraftData(ID, state)
  }
})
</script>

<template>
  <section class="container prose snowflake">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>❄ {{ t('writing.snowflake.title') }}</h1>
    <p class="lead">{{ t('writing.snowflake.intro') }}</p>
    <EarlierVersion :keys="['snowflake']" />

    <ol class="stepper">
      <li v-for="(label, i) in t('writing.snowflake.steps')" :key="i" :class="{ active: state.step === i + 1 }">
        <button class="ghost" :disabled="i + 1 > maxStep" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- Step 1 -->
      <div v-if="state.step === 1" class="panel">
        <h2>{{ t('writing.snowflake.s1Title') }}</h2>
        <p class="muted">{{ t('writing.snowflake.s1Help') }}</p>
        <textarea v-model="state.one" rows="3" class="serif" :placeholder="t('writing.snowflake.s1Placeholder')" />
        <p class="muted small count">{{ t('writing.snowflake.words', { n: countWords(state.one) }) }}</p>
      </div>

      <!-- Step 2 -->
      <div v-else-if="state.step === 2" class="panel">
        <h2>{{ t('writing.snowflake.s2Title') }}</h2>
        <p class="muted">{{ t('writing.snowflake.s2Help') }}</p>
        <blockquote class="seed">
          <small>{{ t('writing.snowflake.yourSentence') }}</small>
          {{ state.one }}
        </blockquote>
        <div v-for="(label, i) in t('writing.snowflake.s2Labels')" :key="i" class="field">
          <label :for="`five-${i}`">{{ i + 1 }}. {{ label }}</label>
          <textarea :id="`five-${i}`" v-model="state.five[i]" rows="2" class="serif" />
        </div>
      </div>

      <!-- Step 3 -->
      <div v-else-if="state.step === 3" class="panel">
        <h2>{{ t('writing.snowflake.s3Title') }}</h2>
        <p class="muted">{{ t('writing.snowflake.s3Help') }}</p>
        <div v-for="(label, i) in t('writing.snowflake.s2Labels')" :key="i" class="field">
          <label :for="`para-${i}`">{{ i + 1 }}. {{ label }}</label>
          <p v-if="state.five[i].trim()" class="guide-sentence">“{{ state.five[i] }}”</p>
          <textarea :id="`para-${i}`" v-model="state.paras[i]" rows="5" class="serif" />
        </div>
      </div>

      <!-- Step 4 -->
      <div v-else class="panel result">
        <h2>{{ t('writing.snowflake.s4Title') }}</h2>
        <blockquote class="seed">{{ state.one }}</blockquote>
        <template v-if="finalParagraphs.length">
          <p v-for="(p, i) in finalParagraphs" :key="i" class="final-p">{{ p }}</p>
          <button class="primary" @click="copyText" :title="copied ? tl('writing.snowflake.copied') : tl('writing.snowflake.copy')" :aria-label="copied ? tl('writing.snowflake.copied') : tl('writing.snowflake.copy')">
            <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.snowflake.copied') : tl('writing.snowflake.copy')" />
          </button>
        </template>
        <p v-else class="muted">{{ t('writing.snowflake.empty') }}</p>
      </div>

      <div class="step-nav">
        <button v-if="state.step > 1" class="ghost" @click="go(state.step - 1)" :title="tl('writing.snowflake.back')" :aria-label="tl('writing.snowflake.back')"><Icon name="arrow-left" :label="tl('writing.snowflake.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.snowflake.clear')" :aria-label="tl('writing.snowflake.clear')"><Icon name="trash" :label="tl('writing.snowflake.clear')" /></button>
        <button v-if="state.step < 4" class="primary" :disabled="!canNext" @click="go(state.step + 1)" :title="tl('writing.snowflake.next')" :aria-label="tl('writing.snowflake.next')">
          <Icon name="arrow-right" :label="tl('writing.snowflake.next')" />
        </button>
      </div>

      <SavedWorks kind="snowflake" :data="state" :default-title="state.one" :can-save="!!(state.one.trim() || state.five.some((x) => x.trim()) || state.paras.some((x) => x.trim()))" />
    </template>
  </section>
</template>

<style scoped>
.serif { font: 1.1rem/1.7 Georgia, 'Times New Roman', serif; }
.count { margin: 0.3rem 0 0; text-align: right; }
.seed {
  margin: 0 0 1rem;
  padding: 0.6rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
  font: italic 1.1rem/1.6 Georgia, serif;
}
.seed small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.field { margin-top: 1rem; }
.field label { display: block; font-weight: 600; margin-bottom: 0.3rem; }
.guide-sentence { margin: 0 0 0.4rem; font-style: italic; color: var(--muted); }
.final-p { font: 1.12rem/1.75 Georgia, serif; margin: 0 0 1rem; white-space: pre-wrap; }
.result .primary { margin-top: 0.5rem; }
.step-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
</style>
