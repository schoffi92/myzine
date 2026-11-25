<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import ScriptPreview from '../components/ScriptPreview.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import {
  KINDS, NEXT, PROMPTS, promptText, drawPromptKey, newBlock, cleanBlocks, layoutScript, estimate,
  scriptPlainText, hasScript, checks, speaker, setPrefix, setTime,
} from '../composables/script'

/*
 * Screenplay: learn the page format, the one-page-one-minute rule and the
 * words of a script, then write a short scene element by element (scene
 * heading, action, character, parenthetical, dialogue, transition) with a
 * live, to-scale preview and a screen-time estimate.
 */
const ID = 'script' // IndexedDB drafts id
const STEPS = 4
const blank = () => ({ title: '', promptKey: null, ownPrompt: '', blocks: [newBlock('scene')], step: 0 })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const listOpen = ref(false)
const learnOpen = ref(true)
const activeId = ref(null)

const premise = computed(() => promptText(state, t))
const defaultTitle = computed(() => state.title.trim() || premise.value)
const pages = computed(() => layoutScript(state.blocks))
const pageCount = computed(() => estimate(pages.value))
const hints = computed(() => checks(state.blocks))
const written = computed(() => hasScript(state.blocks))
const names = computed(() => [...new Set(state.blocks.filter((b) => b.kind === 'character').map((b) => speaker(b.text)).filter(Boolean))])
const sample = computed(() => (t('writing.script.sample') || []).map(([kind, text]) => newBlock(kind, text)))

/* ---- screen time ---- */
const screenTime = computed(() => {
  const s = Math.round((pageCount.value * 60) / 5) * 5
  const m = Math.floor(s / 60)
  return m ? t('writing.script.minSec', { m, s: s % 60 }) : t('writing.script.sec', { s })
})
const goal = computed(() => (pageCount.value < 0.75 ? 'goalShort' : pageCount.value <= 2.25 ? 'goalMet' : 'goalLong'))
const pagesLabel = computed(() => pageCount.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))

/* ---- guided steps: each is done when the script has what it asks for ---- */
const stepDone = computed(() => {
  const list = state.blocks.filter((b) => b.text.trim())
  const firstScene = list.findIndex((b) => b.kind === 'scene')
  const speakers = new Set()
  list.forEach((b, i) => {
    if (b.kind === 'dialogue') {
      const who = list.slice(0, i).reverse().find((x) => x.kind === 'character')
      if (who) speakers.add(speaker(who.text))
    }
  })
  const lastDialogue = list.map((b) => b.kind).lastIndexOf('dialogue')
  return [
    firstScene >= 0,
    firstScene >= 0 && list.slice(firstScene + 1).some((b) => b.kind === 'action'),
    speakers.size >= 2,
    lastDialogue >= 0 && list.slice(lastDialogue + 1).some((b) => b.kind === 'action' || b.kind === 'transition'),
  ]
})
const step = computed(() => t('writing.script.steps')[state.step] || {})

/* ---- premise ---- */
function pick(key) {
  state.promptKey = key
  state.ownPrompt = ''
  listOpen.value = false
}
const draw = () => pick(drawPromptKey(state.promptKey))
function onOwnInput() {
  if (state.ownPrompt.trim()) state.promptKey = null
}

/* ---- block editor ---- */
const fields = new Map() // block id → input / textarea
const setField = (id, el) => (el ? fields.set(id, el) : fields.delete(id))
const indexOf = (id) => state.blocks.findIndex((b) => b.id === id)
const multiline = (kind) => kind === 'action' || kind === 'dialogue'

function grow(el) {
  if (el?.tagName !== 'TEXTAREA') return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}
const growAll = () => fields.forEach(grow)

async function focusBlock(id, atEnd = true) {
  await nextTick()
  const el = fields.get(id)
  if (!el) return
  el.focus()
  if (atEnd) el.setSelectionRange(el.value.length, el.value.length)
  else el.setSelectionRange(0, 0)
}

function insertAt(i, kind, text = '') {
  const b = newBlock(kind, text)
  state.blocks.splice(i, 0, b)
  return b
}

function add(kind) {
  const b = insertAt(state.blocks.length, kind)
  if (kind === 'character') insertAt(state.blocks.length, 'dialogue')
  focusBlock(b.id)
}

function removeBlock(i) {
  if (state.blocks.length === 1) {
    state.blocks[0].text = ''
    return focusBlock(state.blocks[0].id)
  }
  state.blocks.splice(i, 1)
  focusBlock(state.blocks[Math.max(0, i - 1)].id)
}

/** Change a block's kind and keep writing in it (the field may be swapped: input ↔ textarea). */
function setKind(b, kind) {
  b.kind = kind
  focusBlock(b.id)
}
const cycle = (b, dir) => setKind(b, KINDS[(KINDS.indexOf(b.kind) + dir + KINDS.length) % KINDS.length])

/**
 * Enter: the next element (what follows this kind), splitting the text at the caret.
 * Enter in an empty element turns it into action. Shift+Enter: a new line in action and dialogue.
 * Tab / Shift+Tab in an empty element: change its kind. Backspace in an empty element: delete it.
 */
function onKey(e, b) {
  const i = indexOf(b.id)
  if (e.key === 'Enter' && !e.isComposing) {
    if (e.shiftKey && multiline(b.kind)) return
    e.preventDefault()
    if (!b.text.trim()) {
      if (b.kind !== 'action') setKind(b, 'action')
      return
    }
    const pos = e.target.selectionStart ?? b.text.length
    const rest = b.text.slice(pos).trimStart()
    b.text = b.text.slice(0, pos).trimEnd()
    const nb = insertAt(i + 1, NEXT[b.kind], rest)
    focusBlock(nb.id, false)
  } else if (e.key === 'Tab' && !b.text) {
    e.preventDefault()
    cycle(b, e.shiftKey ? -1 : 1)
  } else if (e.key === 'Backspace' && !b.text && state.blocks.length > 1) {
    e.preventDefault()
    removeBlock(i)
  }
}

/* contextual chips under the element being written */
const CHIPS = {
  scene: [
    ['INT.', (s) => setPrefix(s, 'INT.')], ['EXT.', (s) => setPrefix(s, 'EXT.')], ['INT./EXT.', (s) => setPrefix(s, 'INT./EXT.')],
    ['DAY', (s) => setTime(s, 'DAY')], ['NIGHT', (s) => setTime(s, 'NIGHT')], ['CONTINUOUS', (s) => setTime(s, 'CONTINUOUS')], ['LATER', (s) => setTime(s, 'LATER')],
  ],
  character: [
    ['(V.O.)', (s) => `${speaker(s)} (V.O.)`], ['(O.S.)', (s) => `${speaker(s)} (O.S.)`],
  ],
  paren: [['(beat)', () => '(beat)']],
  transition: [['CUT TO:', () => 'CUT TO:'], ['FADE OUT.', () => 'FADE OUT.'], ['DISSOLVE TO:', () => 'DISSOLVE TO:'], ['FADE IN:', () => 'FADE IN:']],
}
function chip(b, fn) {
  b.text = fn(b.text)
  focusBlock(b.id)
}

/* ---- copy, start over ---- */
async function copyText() {
  if (!(await copyToClipboard(scriptPlainText(state.blocks)))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.script.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  loaded.value = false // pause autosave while resetting
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
    nextTick(growAll)
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
    title: typeof saved?.title === 'string' ? saved.title : '',
    promptKey: PROMPTS.includes(saved?.promptKey) ? saved.promptKey : null,
    ownPrompt: typeof saved?.ownPrompt === 'string' ? saved.ownPrompt : '',
    blocks: cleanBlocks(saved?.blocks),
    step: Number.isInteger(saved?.step) && saved.step >= 0 && saved.step < STEPS ? saved.step : 0,
  })
}

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
  learnOpen.value = !hasScript(state.blocks) // the lessons start open until there's a script
  loaded.value = true
  nextTick(growAll)
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
  <section class="container prose script">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>🎬 {{ t('writing.script.title') }}</h1>
    <p class="lead">{{ t('writing.script.intro') }}</p>
    <EarlierVersion :keys="['script']" />

    <template v-if="loaded">
      <!-- ---- learn ---- -->
      <div class="panel learn">
        <h2>{{ t('writing.script.learnTitle') }}</h2>

        <details :open="learnOpen">
          <summary>{{ t('writing.script.pageTitle') }}</summary>
          <p v-for="p in t('writing.script.pageText')" :key="p">{{ p }}</p>
          <div class="sample">
            <ScriptPreview :blocks="sample" annotate :minute-labels="false" />
            <ul class="legend">
              <li v-for="k in KINDS" :key="k"><i :class="`sw sw-${k}`" aria-hidden="true" /><span><strong>{{ t(`writing.script.kinds.${k}`) }}</strong> {{ t(`writing.script.legend.${k}`) }}</span></li>
            </ul>
          </div>
        </details>

        <details :open="learnOpen">
          <summary>{{ t('writing.script.minuteTitle') }}</summary>
          <p v-for="p in t('writing.script.minuteText')" :key="p">{{ p }}</p>
          <ul>
            <li v-for="l in t('writing.script.lengths')" :key="l">{{ l }}</li>
          </ul>
        </details>

        <details>
          <summary>{{ t('writing.script.glossaryTitle') }}</summary>
          <p class="muted small">{{ t('writing.script.glossaryHelp') }}</p>
          <dl class="glossary">
            <template v-for="g in t('writing.script.glossary')" :key="g.term">
              <dt><code>{{ g.term }}</code></dt>
              <dd>{{ g.def }}</dd>
            </template>
          </dl>
        </details>
      </div>

      <!-- ---- the scene ---- -->
      <div class="panel">
        <h2>{{ t('writing.script.sceneTitle') }}</h2>
        <label class="field-label" for="script-title">{{ t('writing.script.titleLabel') }}</label>
        <input id="script-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.script.titlePlaceholder')" />

        <p class="muted small help top">{{ t('writing.script.promptHelp') }}</p>
        <div class="brief" aria-live="polite">
          <small>{{ t('writing.script.promptLabel') }}</small>
          <p v-if="premise">{{ premise }}</p>
          <p v-else class="muted">{{ t('writing.script.noPrompt') }}</p>
        </div>
        <div class="row wrap">
          <button type="button" class="ghost" @click="draw" :title="tl('writing.script.draw')" :aria-label="tl('writing.script.draw')">🎲 <span class="btn-label">{{ t('writing.script.draw') }}</span></button>
          <button type="button" class="ghost" :aria-expanded="listOpen" aria-controls="script-prompts" @click="listOpen = !listOpen">{{ listOpen ? t('writing.script.hideList') : t('writing.script.showList') }}</button>
        </div>
        <ul v-if="listOpen" id="script-prompts" class="opt-list">
          <li v-for="k in PROMPTS" :key="k">
            <button type="button" class="opt" :class="{ active: state.promptKey === k }" :aria-pressed="state.promptKey === k" @click="pick(k)">{{ t(`writing.script.prompts.${k}`) }}</button>
          </li>
        </ul>
        <label class="field-label" for="script-own">{{ t('writing.script.ownLabel') }}</label>
        <input id="script-own" v-model="state.ownPrompt" maxlength="200" autocomplete="off" :placeholder="t('writing.script.ownPlaceholder')" @input="onOwnInput" />
        <p class="muted small goal-note">{{ t('writing.script.goal') }}</p>
      </div>

      <!-- ---- write ---- -->
      <div class="panel">
        <h2>{{ t('writing.script.writeTitle') }}</h2>

        <ol class="steps" :aria-label="t('writing.script.stepsLabel')">
          <li v-for="(s, i) in t('writing.script.steps')" :key="i">
            <button type="button" class="step-btn" :class="{ current: state.step === i, done: stepDone[i] }" :aria-current="state.step === i ? 'step' : undefined" :aria-label="`${i + 1}. ${s.title}${stepDone[i] ? ` (${t('writing.script.done')})` : ''}`" @click="state.step = i">
              <span class="step-no" aria-hidden="true">{{ stepDone[i] ? '✓' : i + 1 }}</span>
              <span>{{ s.title }}</span>
            </button>
          </li>
        </ol>
        <div class="step-card" aria-live="polite">
          <p class="step-head"><strong>{{ t('writing.script.stepN', { n: state.step + 1, total: STEPS }) }}: {{ step.title }}</strong></p>
          <ul>
            <li v-for="tip in step.tips" :key="tip">{{ tip }}</li>
          </ul>
          <p v-if="step.example" class="example"><small>{{ t('writing.script.example') }}</small><code>{{ step.example }}</code></p>
          <div class="row wrap step-nav-inline">
            <button type="button" class="ghost" :disabled="state.step === 0" @click="state.step--">← {{ t('writing.script.prevStep') }}</button>
            <span class="spacer" />
            <button type="button" class="ghost" :disabled="state.step === STEPS - 1" @click="state.step++">{{ t('writing.script.nextStep') }} →</button>
          </div>
        </div>

        <p class="muted small keys">{{ t('writing.script.keysHelp') }}</p>

        <datalist id="script-names">
          <option v-for="n in names" :key="n" :value="n" />
        </datalist>
        <ol class="els">
          <li v-for="(b, i) in state.blocks" :key="b.id" class="el" :class="[`el-${b.kind}`, { active: activeId === b.id }]">
            <select v-model="b.kind" class="kind" :aria-label="t('writing.script.kindLabel', { n: i + 1 })">
              <option v-for="k in KINDS" :key="k" :value="k">{{ t(`writing.script.kinds.${k}`) }}</option>
            </select>
            <div class="field">
              <textarea
                v-if="multiline(b.kind)"
                :ref="(el) => setField(b.id, el)"
                v-model="b.text"
                rows="1"
                :placeholder="t(`writing.script.placeholders.${b.kind}`)"
                :aria-label="t(`writing.script.kinds.${b.kind}`)"
                @keydown="onKey($event, b)"
                @input="grow($event.target)"
                @focus="activeId = b.id"
              />
              <input
                v-else
                :ref="(el) => setField(b.id, el)"
                v-model="b.text"
                autocomplete="off"
                :list="b.kind === 'character' ? 'script-names' : undefined"
                :placeholder="t(`writing.script.placeholders.${b.kind}`)"
                :aria-label="t(`writing.script.kinds.${b.kind}`)"
                @keydown="onKey($event, b)"
                @focus="activeId = b.id"
              />
              <div v-if="activeId === b.id && CHIPS[b.kind]" class="chips">
                <button v-for="[label, fn] in CHIPS[b.kind]" :key="label" type="button" class="chip" @mousedown.prevent @click="chip(b, fn)">{{ label }}</button>
              </div>
            </div>
            <button type="button" class="ghost remove" :title="tl('writing.script.remove')" :aria-label="tl('writing.script.remove')" @click="removeBlock(i)"><Icon name="x" /></button>
          </li>
        </ol>
        <div class="row wrap adds">
          <button type="button" @click="add('scene')">+ {{ t('writing.script.kinds.scene') }}</button>
          <button type="button" @click="add('action')">+ {{ t('writing.script.kinds.action') }}</button>
          <button type="button" @click="add('character')">+ {{ t('writing.script.addDialogue') }}</button>
          <button type="button" @click="add('transition')">+ {{ t('writing.script.kinds.transition') }}</button>
        </div>
      </div>

      <!-- ---- preview and feedback ---- -->
      <div class="panel">
        <h2>{{ t('writing.script.previewTitle') }}</h2>
        <p class="counter" aria-live="polite">
          <strong>{{ t('writing.script.counter', { pages: pagesLabel, time: screenTime }) }}</strong>
          <span class="muted"> · {{ t(`writing.script.${goal}`) }}</span>
        </p>
        <div v-if="written" class="checks">
          <p class="step-head"><strong>{{ t('writing.script.checksTitle') }}</strong></p>
          <ul v-if="hints.length">
            <li v-for="(h, i) in hints" :key="i">{{ t(`writing.script.checks.${h.key}`, h.params) }}</li>
          </ul>
          <p v-else class="muted">{{ t('writing.script.checksNone') }}</p>
        </div>
        <ScriptPreview :blocks="state.blocks" />
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.script.clear')" :aria-label="tl('writing.script.clear')"><Icon name="trash" :label="tl('writing.script.clear')" /></button>
        <button class="primary" :disabled="!written" @click="copyText" :title="copied ? tl('writing.script.copied') : tl('writing.script.copy')" :aria-label="copied ? tl('writing.script.copied') : tl('writing.script.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.script.copied') : tl('writing.script.copy')" />
        </button>
      </div>

      <SavedWorks kind="script" @open="apply" :data="state" :default-title="defaultTitle" :can-save="written" />
    </template>
  </section>
</template>

<style scoped>
.panel + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.help { margin: 0 0 0.5rem; }
.help.top { margin-top: 1rem; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
.field-label:first-of-type { margin-top: 0.5rem; }
input, textarea { width: 100%; box-sizing: border-box; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.wrap { flex-wrap: wrap; }
.spacer { flex: 1; }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }

/* learn */
.learn details { border-top: 1px solid var(--border); padding: 0.6rem 0; }
.learn details:last-child { padding-bottom: 0; }
.learn summary { cursor: pointer; font-weight: 600; }
.learn p { margin: 0.6rem 0; }
.sample { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 1rem; align-items: start; margin-top: 0.75rem; }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; }
.legend li { display: flex; gap: 0.5rem; align-items: baseline; }
.sw { flex: none; width: 0.9rem; height: 0.9rem; border-radius: 3px; border: 1px solid rgb(0 0 0 / 0.15); transform: translateY(0.1rem); }
.sw-scene { background: #ffe1d6; }
.sw-action { background: #e4f0ff; }
.sw-character { background: #e6f6e1; }
.sw-paren { background: #f6ecff; }
.sw-dialogue { background: #fff6cc; }
.sw-transition { background: #e9e9e9; }
.glossary { margin: 0.5rem 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.45rem 1rem; }
.glossary dt { font-weight: 600; }
.glossary dd { margin: 0; }
code { font-family: 'Courier Prime', 'Courier New', Courier, monospace; font-size: 0.95em; }

/* premise */
.brief {
  margin: 0 0 0.75rem; padding: 0.7rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
.brief p { margin: 0.2rem 0 0; font: 1.08rem/1.5 Georgia, 'Times New Roman', serif; }
.brief p.muted { font: inherit; }
.opt-list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.opt { width: 100%; text-align: left; justify-content: flex-start; white-space: normal; }
.opt.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.goal-note { margin: 0.6rem 0 0; }

/* steps */
.steps { list-style: none; margin: 0.5rem 0 0.75rem; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.step-btn { gap: 0.45rem; }
.step-btn.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.step-no { display: inline-grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; background: var(--border); font-size: 0.8rem; font-weight: 700; }
.step-btn.done .step-no { background: var(--accent); color: #fff; }
.step-card { padding: 0.7rem 1rem; border: 1px solid var(--border); border-radius: 8px; }
.step-card ul { margin: 0.3rem 0 0.5rem; }
.step-head { margin: 0; }
.example { margin: 0.4rem 0; }
.example code { display: block; white-space: pre-wrap; margin-top: 0.2rem; }
.step-nav-inline { margin-top: 0.25rem; }
.keys { margin: 0.9rem 0 0.5rem; }

/* element editor */
.els { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.el { display: grid; grid-template-columns: 9.5rem minmax(0, 1fr) auto; gap: 0.4rem; align-items: start; }
.kind { font-size: 0.8rem; padding: 0.4em 0.4em; color: var(--muted); }
.el.active .kind { color: inherit; border-color: var(--accent); }
.field input, .field textarea { font: 1rem/1.45 'Courier Prime', 'Courier New', Courier, monospace; resize: none; overflow: hidden; }
.el-scene .field input { text-transform: uppercase; font-weight: 700; }
.el-character .field { padding-left: 30%; }
.el-character .field input { text-transform: uppercase; }
.el-paren .field { padding-left: 22%; padding-right: 20%; }
.el-dialogue .field { padding-left: 14%; padding-right: 12%; }
.el-transition .field input { text-transform: uppercase; text-align: right; }
.remove { padding: 0.35em; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
.chip { font: 0.78rem 'Courier Prime', 'Courier New', Courier, monospace; padding: 0.2em 0.6em; border-radius: 999px; }
.adds { margin-top: 0.75rem; }

/* preview */
.counter { margin: 0 0 0.6rem; }
.checks { margin: 0 0 1rem; padding: 0.6rem 1rem; border-left: 4px solid var(--border); }
.checks ul { margin: 0.3rem 0 0; }
.checks p.muted { margin: 0.3rem 0 0; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }

@media (max-width: 640px) {
  .sample { grid-template-columns: 1fr; }
  .glossary { grid-template-columns: 1fr; gap: 0.1rem; }
  .glossary dd { margin-bottom: 0.4rem; }
  .el { grid-template-columns: minmax(0, 1fr) auto; }
  .kind { grid-column: 1 / -1; justify-self: start; }
  .el-character .field { padding-left: 18%; }
  .el-paren .field { padding-left: 12%; padding-right: 8%; }
  .el-dialogue .field { padding-left: 6%; padding-right: 4%; }
}
</style>
