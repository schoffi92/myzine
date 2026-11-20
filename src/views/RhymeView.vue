<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { settings } from '../composables/settings'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import RhymePairs from '../components/RhymePairs.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { SCHEMES, MIN_STANZAS, MAX_STANZAS, LINES_PER_STANZA, letterOf, checkPairs, confirmKey } from '../writing/rhyme'
import { RHYME_TOPICS, DEFAULT_ORDER, rhymeTopic, stanzasText, validOrder, validCount, activeSchemes } from '../composables/rhyme'

/*
 * Rhyme schemes: write a stanza with paired (AABB), alternate (ABAB) or
 * enclosed rhymes (ABBA), then the same stanza in a second scheme, and if the
 * writer wants, in the third one too. Steps: Learn, one step per scheme in the
 * writer's order, Compare. Under the lines a rhyme check shows which pairs
 * rhyme (a guess from spelling, see writing/rhyme.js); the writer can confirm
 * a pair the check doesn't recognise.
 */
const ID = 'rhyme' // IndexedDB drafts id
const emptyLines = (stanzas) => Array.from({ length: stanzas * LINES_PER_STANZA }, () => '')
const blank = () => ({
  step: 1,
  order: [...DEFAULT_ORDER],
  count: 2,
  topicKey: null,
  stanzas: 1,
  aabb: emptyLines(1),
  abab: emptyLines(1),
  abba: emptyLines(1),
  confirmed: { aabb: [], abab: [], abba: [] },
})

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)

const locale = computed(() => settings.locale)
const active = computed(() => activeSchemes(state))
const compareStep = computed(() => active.value.length + 2)
/** The scheme written on the current step, or null on Learn and Compare. */
const writing = computed(() => (state.step >= 2 && state.step < compareStep.value ? active.value[state.step - 2] : null))
const nameOf = (s) => t(`writing.rhyme.${s}`)
const patternOf = (s) => Array.from({ length: LINES_PER_STANZA }, (_, i) => letterOf(s, i)).join('')
const filled = (s) => state[s].some((l) => l.trim())
const topic = computed(() => rhymeTopic(state, t))
const stepLabels = computed(() => [t('writing.rhyme.stepLearn'), ...active.value.map(nameOf), t('writing.rhyme.stepCompare')])

/** Furthest step the user may open: the first scheme without text, else Compare. */
const maxStep = computed(() => {
  const i = active.value.findIndex((s) => !filled(s))
  return i < 0 ? compareStep.value : i + 2
})
// a scheme dropped or emptied: don't stay on a step that needs it
watch(maxStep, (m) => {
  if (loaded.value && state.step > m) state.step = m
})

/** Put scheme `s` at place i of the order (the scheme there moves to where `s` was). */
function putAt(i, s) {
  const order = [...state.order]
  const j = order.indexOf(s)
  ;[order[i], order[j]] = [order[j], order[i]]
  state.order = order
}

function go(n) {
  if (n < 1 || n > maxStep.value) return
  state.step = n
  window.scrollTo({ top: 0 })
}

function drawTopic() {
  const pool = RHYME_TOPICS.filter((k) => k !== state.topicKey)
  state.topicKey = pool[Math.floor(Math.random() * pool.length)]
}

function addStanza() {
  if (state.stanzas >= MAX_STANZAS) return
  state.stanzas++
  for (const s of SCHEMES) state[s].push(...emptyLines(1))
  const scheme = writing.value || active.value[0]
  nextTick(() => document.getElementById(`line-${scheme}-${(state.stanzas - 1) * LINES_PER_STANZA}`)?.focus())
}

function removeStanza() {
  if (state.stanzas <= MIN_STANZAS) return
  const from = (state.stanzas - 1) * LINES_PER_STANZA
  if (SCHEMES.some((s) => state[s].slice(from).some((l) => l.trim())) && !confirm(t('writing.rhyme.confirmRemoveStanza'))) return
  state.stanzas--
  for (const s of SCHEMES) state[s].splice(from)
}

function confirmPair(scheme, key) {
  if (!state.confirmed[scheme].includes(key)) state.confirmed[scheme].push(key)
}
function unconfirmPair(scheme, key) {
  state.confirmed[scheme] = state.confirmed[scheme].filter((k) => k !== key)
}

/** Forget confirmations of word pairs that are no longer in the poem. */
watch(
  () => SCHEMES.map((s) => state[s].join('\n')).join('\n'),
  () => {
    if (!loaded.value) return
    for (const s of SCHEMES) {
      const live = new Set(checkPairs(s, state[s], locale.value).filter((p) => p.ra && p.rb).map((p) => confirmKey(p.ra.word, p.rb.word)))
      if (state.confirmed[s].some((k) => !live.has(k))) state.confirmed[s] = state.confirmed[s].filter((k) => live.has(k))
    }
  },
)

const plainText = computed(() =>
  active.value.filter(filled).map((s) => `${nameOf(s)}\n${stanzasText(state[s])}`).join('\n\n'),
)
const defaultTitle = computed(() => topic.value || state[active.value[0]].find((l) => l.trim())?.trim() || '')

async function copyText() {
  if (!(await copyToClipboard(plainText.value))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.rhyme.confirmClear'))) return
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

const strings = (list) => (Array.isArray(list) ? list.filter((k) => typeof k === 'string') : [])

/** Put a draft or a saved work on the page (autosave then stores it as the draft). */
function apply(saved) {
  const stanzas = Math.min(MAX_STANZAS, Math.max(MIN_STANZAS, Number.isInteger(saved?.stanzas) ? saved.stanzas : 1))
  const linesOf = (list) => Array.from({ length: stanzas * LINES_PER_STANZA }, (_, i) => (Array.isArray(list) && typeof list[i] === 'string' ? list[i] : ''))
  Object.assign(state, {
    step: Number.isInteger(saved?.step) && saved.step >= 1 ? saved.step : 1,
    order: validOrder(saved?.order),
    count: validCount(saved?.count),
    topicKey: RHYME_TOPICS.includes(saved?.topicKey) ? saved.topicKey : null,
    stanzas,
    ...Object.fromEntries(SCHEMES.map((s) => [s, linesOf(saved?.[s])])),
    confirmed: Object.fromEntries(SCHEMES.map((s) => [s, strings(saved?.confirmed?.[s])])),
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
  <section class="container prose rhyme">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>♫ {{ t('writing.rhyme.title') }}</h1>
    <p class="lead">{{ t('writing.rhyme.intro') }}</p>
    <EarlierVersion :keys="['rhyme']" />

    <ol class="stepper">
      <li v-for="(label, i) in stepLabels" :key="i" :class="{ active: state.step === i + 1 }">
        <button class="ghost" :disabled="i + 1 > maxStep" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- Step 1: learn the schemes, set up -->
      <div v-if="state.step === 1" class="panel">
        <h2>{{ t('writing.rhyme.learnTitle') }}</h2>
        <div class="schemes">
          <div v-for="s in SCHEMES" :key="s" class="scheme">
            <h3>{{ nameOf(s) }} <span class="beat">{{ patternOf(s) }}</span></h3>
            <p>{{ t(`writing.rhyme.${s}Explain`) }}</p>
            <ol class="example serif">
              <li v-for="(line, i) in t(`writing.rhyme.${s}Example`)" :key="i"><span class="mini-letter" aria-hidden="true">{{ letterOf(s, i) }}</span>{{ line }}</li>
            </ol>
          </div>
        </div>
        <details class="hints">
          <summary>{{ t('writing.rhyme.howTitle') }}</summary>
          <p>{{ t('writing.rhyme.howLetters') }}</p>
          <p>{{ t('writing.rhyme.howCheck') }}</p>
        </details>

        <h2 class="setup-title">{{ t('writing.rhyme.setupTitle') }}</h2>
        <fieldset class="choice">
          <legend>{{ t('writing.rhyme.firstLabel') }}</legend>
          <label v-for="s in SCHEMES" :key="s"><input type="radio" name="rhyme-first" :value="s" :checked="state.order[0] === s" @change="putAt(0, s)" /> {{ nameOf(s) }} <span class="beat">{{ patternOf(s) }}</span></label>
        </fieldset>
        <fieldset class="choice">
          <legend>{{ t('writing.rhyme.secondLabel') }}</legend>
          <label v-for="s in SCHEMES.filter((x) => x !== state.order[0])" :key="s"><input type="radio" name="rhyme-second" :value="s" :checked="state.order[1] === s" @change="putAt(1, s)" /> {{ nameOf(s) }} <span class="beat">{{ patternOf(s) }}</span></label>
        </fieldset>
        <label class="third"><input type="checkbox" :checked="state.count === 3" @change="state.count = $event.target.checked ? 3 : 2" /><span>{{ t('writing.rhyme.thirdLabel', { scheme: nameOf(state.order[2]) }) }} <span class="beat">{{ patternOf(state.order[2]) }}</span></span></label>

        <label class="field-label">{{ t('writing.meter.topicLabel') }}</label>
        <div class="row">
          <p class="topic serif">{{ topic || t('writing.meter.topicNone') }}</p>
          <button type="button" class="ghost" @click="drawTopic" :title="tl('writing.meter.drawTopic')" :aria-label="tl('writing.meter.drawTopic')">🎲 <span class="btn-label">{{ t('writing.meter.drawTopic') }}</span></button>
          <button v-if="state.topicKey" type="button" class="ghost" @click="state.topicKey = null" :title="tl('writing.meter.clearTopic')" :aria-label="tl('writing.meter.clearTopic')"><Icon name="x" /></button>
        </div>
      </div>

      <!-- One step per scheme: write the stanza -->
      <div v-else-if="writing" class="panel">
        <template v-for="s in [writing]" :key="s">
          <h2>{{ t(state.step === 2 ? 'writing.rhyme.writeTitle' : 'writing.rhyme.rewriteTitle', { scheme: nameOf(s) }) }}</h2>
          <p class="muted">{{ t(state.step === 2 ? 'writing.rhyme.writeHelp' : 'writing.rhyme.rewriteHelp', { scheme: nameOf(s) }) }}</p>
          <p class="brief">
            <small>{{ nameOf(s) }}</small><span class="beat">{{ patternOf(s) }}</span>
            <template v-if="topic"><small>{{ t('writing.meter.topicLabel') }}</small>{{ topic }}</template>
          </p>
          <div v-if="state.step > 2" class="earlier-stanza">
            <small>{{ t('writing.rhyme.yourStanza', { scheme: nameOf(active[state.step - 3]) }) }}</small>
            <p class="serif">{{ stanzasText(state[active[state.step - 3]]) }}</p>
          </div>

          <ol class="lines">
            <li v-for="(_, i) in state[s]" :key="i" :class="{ 'stanza-start': i > 0 && i % LINES_PER_STANZA === 0 }">
              <span class="letter" aria-hidden="true">{{ letterOf(s, i) }}</span>
              <label class="sr-only" :for="`line-${s}-${i}`">{{ t('writing.rhyme.lineLabel', { n: i + 1, letter: letterOf(s, i) }) }}</label>
              <input :id="`line-${s}-${i}`" v-model="state[s][i]" class="serif" maxlength="160" autocomplete="off" spellcheck="true" :placeholder="t('writing.rhyme.linePlaceholder', { n: i + 1, letter: letterOf(s, i) })" />
            </li>
          </ol>
          <RhymePairs :scheme="s" :lines="state[s]" :locale="locale" :confirmed="state.confirmed[s]" @confirm="(k) => confirmPair(s, k)" @unconfirm="(k) => unconfirmPair(s, k)" />
          <div class="row wrap tools">
            <button type="button" class="ghost" :disabled="state.stanzas >= MAX_STANZAS" @click="addStanza" :title="tl('writing.rhyme.addStanza')" :aria-label="tl('writing.rhyme.addStanza')">+ <span class="btn-label">{{ t('writing.rhyme.addStanza') }}</span></button>
            <button type="button" class="ghost" :disabled="state.stanzas <= MIN_STANZAS" @click="removeStanza" :title="tl('writing.rhyme.removeStanza')" :aria-label="tl('writing.rhyme.removeStanza')">− <span class="btn-label">{{ t('writing.rhyme.removeStanza') }}</span></button>
          </div>
        </template>
      </div>

      <!-- Last step: compare -->
      <div v-else class="panel">
        <h2>{{ t('writing.rhyme.compareTitle') }}</h2>
        <p class="muted">{{ t('writing.rhyme.compareHelp') }}</p>
        <p v-if="topic" class="brief"><small>{{ t('writing.meter.topicLabel') }}</small>{{ topic }}</p>
        <div class="compare">
          <section v-for="s in active" :key="s" class="compare__col">
            <h3>{{ nameOf(s) }} <span class="beat">{{ patternOf(s) }}</span></h3>
            <ol class="compare__lines serif">
              <template v-for="(line, i) in state[s]" :key="i">
                <li v-if="line.trim()" :class="{ 'stanza-start': i > 0 && i % LINES_PER_STANZA === 0 }"><span class="mini-letter" aria-hidden="true">{{ letterOf(s, i) }}</span>{{ line }}</li>
              </template>
            </ol>
            <RhymePairs :scheme="s" :lines="state[s]" :locale="locale" :confirmed="state.confirmed[s]" readonly />
          </section>
        </div>
      </div>

      <div class="step-nav">
        <button v-if="state.step > 1" class="ghost" @click="go(state.step - 1)" :title="tl('writing.meter.back')" :aria-label="tl('writing.meter.back')"><Icon name="arrow-left" :label="tl('writing.meter.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.meter.clear')" :aria-label="tl('writing.meter.clear')"><Icon name="trash" :label="tl('writing.meter.clear')" /></button>
        <button v-if="state.step === compareStep" class="primary" :disabled="!plainText" @click="copyText" :title="copied ? tl('writing.meter.copied') : tl('writing.rhyme.copy')" :aria-label="copied ? tl('writing.meter.copied') : tl('writing.rhyme.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.meter.copied') : tl('writing.rhyme.copy')" />
        </button>
        <button v-else class="primary" :disabled="state.step >= maxStep" @click="go(state.step + 1)" :title="tl('writing.meter.next')" :aria-label="tl('writing.meter.next')">
          <Icon name="arrow-right" :label="tl('writing.meter.next')" />
        </button>
      </div>

      <SavedWorks kind="rhyme" @open="apply" :data="state" :default-title="defaultTitle" :can-save="SCHEMES.some(filled)" />
    </template>
  </section>
</template>

<style scoped>
.serif { font-family: Georgia, 'Times New Roman', serif; }
.schemes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; margin: 0.75rem 0 1rem; }
.scheme { padding: 0.75rem 0.9rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.scheme h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.scheme p { margin: 0.3rem 0; }
.beat { font: 600 0.8rem system-ui, sans-serif; color: var(--accent); margin-left: 0.3rem; letter-spacing: 0.12em; }
.example { list-style: none; margin: 0.5rem 0 0; padding: 0; font-style: italic; }
.mini-letter { display: inline-block; width: 1.3em; font: 700 0.75rem system-ui, sans-serif; color: var(--accent); font-style: normal; }
.hints { margin: 0 0 1rem; }
.hints summary { cursor: pointer; font-weight: 600; }
.hints p { margin: 0.4rem 0 0; }
.setup-title { margin-top: 1.25rem; }
.choice { border: 0; padding: 0; margin: 0.5rem 0 0; display: flex; flex-wrap: wrap; gap: 0.4rem 1.25rem; }
.choice legend { font-weight: 600; padding: 0; margin-bottom: 0.35rem; }
.choice label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
.choice + .choice { margin-top: 0.9rem; }
.third { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.9rem; cursor: pointer; }
.third input { flex: none; }
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
.brief .beat { display: block; margin: 0 0 0.4rem; }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.earlier-stanza { margin: 0 0 1rem; padding: 0.6rem 0.9rem; border: 1px dashed var(--border); border-radius: 8px; }
.earlier-stanza p { margin: 0.2rem 0 0; white-space: pre-line; }
.lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.lines li { display: flex; align-items: center; gap: 0.5rem; }
.lines .stanza-start { margin-top: 1rem; }
.lines input { flex: 1; min-width: 0; box-sizing: border-box; font-size: 1.08rem; }
.letter {
  flex: none; display: inline-grid; place-items: center; width: 1.8rem; height: 1.8rem; border-radius: 50%;
  font: 700 0.9rem system-ui, sans-serif; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent);
}
.tools { margin-top: 0.9rem; }
.compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-top: 0.75rem; }
.compare__col { min-width: 0; }
.compare__col h3 { margin: 0 0 0.5rem; font-size: 1.05rem; }
.compare__lines { list-style: none; margin: 0; padding: 0; font-size: 1.05rem; }
.compare__lines li { margin: 0.15rem 0; overflow-wrap: anywhere; }
.compare__lines .stanza-start { margin-top: 0.9rem; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
