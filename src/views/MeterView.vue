<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { settings } from '../composables/settings'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import RhythmRow from '../components/RhythmRow.vue'
import RhythmMark from '../components/RhythmMark.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { RHYTHMS, FEET_OPTIONS, MIN_LINES, MAX_LINES, usesLength, patternFeet } from '../writing/meter'
import { METER_TOPICS, otherRhythm, meterTopic } from '../composables/meter'

/*
 * Iamb and trochee: write a stanza in one rhythm, then the same stanza in the
 * other. Each line gets a rhythm row (tap to mark stress; long/short is
 * automatic in Hungarian) that shows which feet fit. See writing/meter.js.
 */
const ID = 'meter' // IndexedDB drafts id
const blankLine = () => ({ text: '', marks: {}, counts: {} })
const blank = () => ({
  step: 1,
  first: 'iamb',
  feet: 4,
  topicKey: null,
  lineCount: 4,
  iamb: Array.from({ length: 4 }, blankLine),
  trochee: Array.from({ length: 4 }, blankLine),
})

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const editCounts = ref(false)

const locale = computed(() => settings.locale)
const hu = computed(() => usesLength(locale.value))
const second = computed(() => otherRhythm(state.first))
const nameOf = (r) => t(`writing.meter.${r}`)
const filled = (r) => state[r].some((l) => l.text.trim())
const topic = computed(() => meterTopic(state, t))

/** Furthest step the user may open. */
const maxStep = computed(() => (!filled(state.first) ? 2 : !filled(second.value) ? 3 : 4))

function go(n) {
  if (n < 1 || n > maxStep.value) return
  state.step = n
  editCounts.value = false
  window.scrollTo({ top: 0 })
}

function drawTopic() {
  const pool = METER_TOPICS.filter((k) => k !== state.topicKey)
  state.topicKey = pool[Math.floor(Math.random() * pool.length)]
}

function addLine() {
  if (state.lineCount >= MAX_LINES) return
  state.lineCount++
  for (const r of RHYTHMS) state[r].push(blankLine())
  nextTick(() => document.getElementById(`line-${state.step === 3 ? second.value : state.first}-${state.lineCount - 1}`)?.focus())
}

function removeLine() {
  if (state.lineCount <= MIN_LINES) return
  const i = state.lineCount - 1
  if (RHYTHMS.some((r) => state[r][i]?.text.trim()) && !confirm(t('writing.meter.confirmRemoveLine'))) return
  state.lineCount--
  for (const r of RHYTHMS) state[r].splice(i, 1)
}

function setMark(line, key, value) {
  if (value === null) delete line.marks[key]
  else line.marks[key] = value
}
function setCount(line, key, value) {
  if (value === null) delete line.counts[key]
  else line.counts[key] = value
}

const stanzaText = (r) => state[r].map((l) => l.text.trim()).filter(Boolean).join('\n')
const plainText = computed(() =>
  [state.first, second.value].filter(filled).map((r) => `${nameOf(r)}\n${stanzaText(r)}`).join('\n\n'),
)
const defaultTitle = computed(() => topic.value || state[state.first].find((l) => l.text.trim())?.text.trim() || '')

async function copyText() {
  if (!(await copyToClipboard(plainText.value))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.meter.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  // pause autosave while resetting, or the watcher re-saves an empty draft
  loaded.value = false
  Object.assign(state, blank())
  editCounts.value = false
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

const plainObject = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? { ...o } : {})

/** Put a draft or a saved work on the page (autosave then stores it as the draft). */
function apply(saved) {
  const count = Math.min(MAX_LINES, Math.max(MIN_LINES, Number.isInteger(saved?.lineCount) ? saved.lineCount : 4))
  const linesOf = (list) =>
    Array.from({ length: count }, (_, i) => {
      const l = Array.isArray(list) ? list[i] : null
      return { text: typeof l?.text === 'string' ? l.text : '', marks: plainObject(l?.marks), counts: plainObject(l?.counts) }
    })
  Object.assign(state, {
    step: [1, 2, 3, 4].includes(saved?.step) ? saved.step : 1,
    first: RHYTHMS.includes(saved?.first) ? saved.first : 'iamb',
    feet: FEET_OPTIONS.includes(saved?.feet) ? saved.feet : 4,
    topicKey: METER_TOPICS.includes(saved?.topicKey) ? saved.topicKey : null,
    lineCount: count,
    iamb: linesOf(saved?.iamb),
    trochee: linesOf(saved?.trochee),
  })
  if (state.step > maxStep.value) state.step = maxStep.value
}

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
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
  <section class="container prose meter">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>♩ {{ t('writing.meter.title') }}</h1>
    <p class="lead">{{ t('writing.meter.intro') }}</p>
    <EarlierVersion :keys="['meter']" />

    <ol class="stepper">
      <li v-for="(label, i) in t('writing.meter.steps')" :key="i" :class="{ active: state.step === i + 1 }">
        <button class="ghost" :disabled="i + 1 > maxStep" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- Step 1: learn the two rhythms, set up -->
      <div v-if="state.step === 1" class="panel">
        <h2>{{ t('writing.meter.learnTitle') }}</h2>
        <div class="rhythms">
          <div v-for="r in RHYTHMS" :key="r" class="rhythm">
            <h3>{{ nameOf(r) }} <span class="beat">{{ t(`writing.meter.${r}Beat`) }}</span></h3>
            <p>{{ t(`writing.meter.${r}Explain`) }}</p>
            <p class="example serif">{{ t(`writing.meter.${r}Example`) }}</p>
            <p class="pattern" role="img" :aria-label="t('writing.meter.patternLabel', { rhythm: nameOf(r) })">
              <span v-for="(foot, f) in patternFeet(r, 4)" :key="f" class="foot"><RhythmMark v-for="(v, i) in foot" :key="i" :value="v" :locale="locale" /></span>
            </p>
          </div>
        </div>
        <details class="hints">
          <summary>{{ t('writing.meter.howTitle') }}</summary>
          <p>{{ t(hu ? 'writing.meter.howLength' : 'writing.meter.howStress') }}</p>
          <p>{{ t('writing.meter.howLeeway') }}</p>
        </details>

        <h2 class="setup-title">{{ t('writing.meter.setupTitle') }}</h2>
        <fieldset class="choice">
          <legend>{{ t('writing.meter.firstLabel') }}</legend>
          <label v-for="r in RHYTHMS" :key="r"><input v-model="state.first" type="radio" name="meter-first" :value="r" /> {{ nameOf(r) }}</label>
        </fieldset>
        <label class="field-label" for="meter-feet">{{ t('writing.meter.feetLabel') }}</label>
        <select id="meter-feet" v-model.number="state.feet">
          <option v-for="n in FEET_OPTIONS" :key="n" :value="n">{{ t('writing.meter.feetOption', { n, syllables: n * 2 }) }}</option>
        </select>

        <label class="field-label">{{ t('writing.meter.topicLabel') }}</label>
        <div class="row">
          <p class="topic serif">{{ topic || t('writing.meter.topicNone') }}</p>
          <button type="button" class="ghost" @click="drawTopic" :title="tl('writing.meter.drawTopic')" :aria-label="tl('writing.meter.drawTopic')">🎲 <span class="btn-label">{{ t('writing.meter.drawTopic') }}</span></button>
          <button v-if="state.topicKey" type="button" class="ghost" @click="state.topicKey = null" :title="tl('writing.meter.clearTopic')" :aria-label="tl('writing.meter.clearTopic')"><Icon name="x" /></button>
        </div>
      </div>

      <!-- Steps 2 and 3: write the stanza in each rhythm -->
      <div v-else-if="state.step === 2 || state.step === 3" class="panel">
        <template v-for="r in [state.step === 2 ? state.first : second]" :key="r">
          <h2>{{ t(state.step === 2 ? 'writing.meter.writeTitle' : 'writing.meter.rewriteTitle', { rhythm: nameOf(r) }) }}</h2>
          <p class="muted">{{ t(state.step === 2 ? 'writing.meter.writeHelp' : 'writing.meter.rewriteHelp', { rhythm: nameOf(r) }) }}</p>
          <p class="brief">
            <small>{{ nameOf(r) }} · {{ t(`writing.meter.${r}Beat`) }}</small>
            <span class="pattern" role="img" :aria-label="t('writing.meter.patternLabel', { rhythm: nameOf(r) })">
              <span v-for="(foot, f) in patternFeet(r, state.feet)" :key="f" class="foot"><RhythmMark v-for="(v, i) in foot" :key="i" :value="v" :locale="locale" /></span>
            </span>
            <template v-if="topic"><small>{{ t('writing.meter.topicLabel') }}</small>{{ topic }}</template>
          </p>
          <div v-if="state.step === 3" class="earlier-stanza">
            <small>{{ t('writing.meter.yourStanza', { rhythm: nameOf(state.first) }) }}</small>
            <p class="serif">{{ stanzaText(state.first) }}</p>
          </div>

          <ol class="lines">
            <li v-for="(line, i) in state[r]" :key="i">
              <label class="sr-only" :for="`line-${r}-${i}`">{{ t('writing.meter.lineLabel', { n: i + 1 }) }}</label>
              <input :id="`line-${r}-${i}`" v-model="line.text" class="serif" maxlength="160" autocomplete="off" spellcheck="true" :placeholder="t('writing.meter.linePlaceholder', { n: i + 1 })" />
              <RhythmRow
                :text="line.text"
                :locale="locale"
                :rhythm="r"
                :feet="state.feet"
                :marks="line.marks"
                :counts="line.counts"
                :edit-counts="editCounts"
                @mark="(k, v) => setMark(line, k, v)"
                @count="(k, v) => setCount(line, k, v)"
              />
            </li>
          </ol>
          <div class="row wrap tools">
            <button type="button" class="ghost" :disabled="state.lineCount >= MAX_LINES" @click="addLine" :title="tl('writing.meter.addLine')" :aria-label="tl('writing.meter.addLine')"><Icon name="plus" :label="tl('writing.meter.addLine')" /></button>
            <button type="button" class="ghost" :disabled="state.lineCount <= MIN_LINES" @click="removeLine">− <span class="btn-label">{{ t('writing.meter.removeLine') }}</span></button>
            <button v-if="!hu" type="button" class="ghost" :aria-pressed="editCounts" @click="editCounts = !editCounts">{{ editCounts ? t('writing.meter.fixCountsDone') : t('writing.meter.fixCounts') }}</button>
          </div>
        </template>
      </div>

      <!-- Step 4: compare -->
      <div v-else class="panel">
        <h2>{{ t('writing.meter.compareTitle') }}</h2>
        <p class="muted">{{ t('writing.meter.compareHelp') }}</p>
        <p v-if="topic" class="brief"><small>{{ t('writing.meter.topicLabel') }}</small>{{ topic }}</p>
        <div class="compare">
          <section v-for="r in [state.first, second]" :key="r" class="compare__col">
            <h3>{{ nameOf(r) }} <span class="beat">{{ t(`writing.meter.${r}Beat`) }}</span></h3>
            <template v-for="(line, i) in state[r]" :key="i">
              <div v-if="line.text.trim()" class="compare__line">
                <p class="serif">{{ line.text }}</p>
                <RhythmRow :text="line.text" :locale="locale" :rhythm="r" :feet="state.feet" :marks="line.marks" :counts="line.counts" readonly />
              </div>
            </template>
          </section>
        </div>
      </div>

      <div class="step-nav">
        <button v-if="state.step > 1" class="ghost" @click="go(state.step - 1)" :title="tl('writing.meter.back')" :aria-label="tl('writing.meter.back')"><Icon name="arrow-left" :label="tl('writing.meter.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.meter.clear')" :aria-label="tl('writing.meter.clear')"><Icon name="trash" :label="tl('writing.meter.clear')" /></button>
        <button v-if="state.step === 4" class="primary" :disabled="!plainText" @click="copyText" :title="copied ? tl('writing.meter.copied') : tl('writing.meter.copy')" :aria-label="copied ? tl('writing.meter.copied') : tl('writing.meter.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.meter.copied') : tl('writing.meter.copy')" />
        </button>
        <button v-else class="primary" :disabled="state.step >= maxStep" @click="go(state.step + 1)" :title="tl('writing.meter.next')" :aria-label="tl('writing.meter.next')">
          <Icon name="arrow-right" :label="tl('writing.meter.next')" />
        </button>
      </div>

      <SavedWorks kind="meter" @open="apply" :data="state" :default-title="defaultTitle" :can-save="filled('iamb') || filled('trochee')" />
    </template>
  </section>
</template>

<style scoped>
.serif { font-family: Georgia, 'Times New Roman', serif; }
.rhythms { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; margin: 0.75rem 0 1rem; }
.rhythm { padding: 0.75rem 0.9rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.rhythm h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.rhythm p { margin: 0.3rem 0; }
.beat { font: 600 0.8rem system-ui, sans-serif; color: var(--accent); margin-left: 0.3rem; letter-spacing: 0.04em; }
.example { font-size: 1.05rem; font-style: italic; }
.pattern { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; font: 600 0.95rem/1.4 system-ui, sans-serif; color: var(--muted); }
.foot { display: inline-flex; gap: 0.4rem; align-items: center; }
.hints { margin: 0 0 1rem; }
.hints summary { cursor: pointer; font-weight: 600; }
.hints p { margin: 0.4rem 0 0; }
.setup-title { margin-top: 1.25rem; }
.choice { border: 0; padding: 0; margin: 0.5rem 0 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1.25rem; }
.choice legend { font-weight: 600; padding: 0; margin-bottom: 0.35rem; }
.choice label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.wrap { flex-wrap: wrap; }
.topic { flex: 1; min-width: 0; margin: 0; font-size: 1.05rem; }
.brief {
  margin: 0.5rem 0 1rem; padding: 0.6rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.earlier-stanza { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border: 1px dashed var(--border); border-radius: 8px; }
.earlier-stanza p { margin: 0.2rem 0 0; white-space: pre-line; }
.lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9rem; }
.lines input { width: 100%; box-sizing: border-box; font-size: 1.08rem; }
.tools { margin-top: 0.9rem; }
.compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-top: 0.75rem; }
.compare__col h3 { margin: 0 0 0.5rem; font-size: 1.05rem; }
.compare__line { margin-bottom: 0.6rem; }
.compare__line p { margin: 0; font-size: 1.05rem; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
