<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl, tRaw } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import PremisePicker from '../components/PremisePicker.vue'
import YarnEditor from '../components/YarnEditor.vue'
import YarnMap from '../components/YarnMap.vue'
import InkPlayer from '../components/InkPlayer.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { parseInk, checkInk, facts, graphOf, fileName } from '../writing/ink'
import { PROMPTS, PARTS, OWN, LAST_GUIDED, OWN_GOALS, UNLOCK, promptText, toolsFor, problemsFor, freeKnot } from '../composables/inkStory'

/*
 * Interactive fiction in ink (inkle's language for branching stories): a
 * writing guide in small parts, as in Game dialogue. Each part teaches one
 * idea, gives one task and unlocks the next tools; part 7 is a whole story of
 * the writer's own. Live checker, map of the knots, and Play to read the story.
 */
const ID = 'ink' // IndexedDB drafts id
const blank = () => ({ title: '', promptKey: null, ownPrompt: '', source: '', part: 0, ownTitle: '', ownPromptKey: null, ownOwnPrompt: '', ownSource: '' })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const tab = ref('play')
const editor = ref(null)

const isOwn = computed(() => state.part === OWN)
const text = computed({
  get: () => (isOwn.value ? state.ownSource : state.source),
  set: (v) => (isOwn.value ? (state.ownSource = v) : (state.source = v)),
})
const guided = computed(() => parseInk(state.source))
const own = computed(() => parseInk(state.ownSource))
const parsed = computed(() => (isOwn.value ? own.value : guided.value))
const guidedFacts = computed(() => facts(guided.value))
const ownFacts = computed(() => facts(own.value))
const problems = computed(() => problemsFor(checkInk(parsed.value), state.part))
const graph = computed(() => graphOf(parsed.value))
const marks = computed(() => {
  const rank = { info: 1, warn: 2, error: 3 }
  const out = {}
  for (const p of problems.value) if (!out[p.line] || rank[p.level] > rank[out[p.line]]) out[p.line] = p.level
  return out
})

const parts = computed(() => t('writing.ink.parts') || [])
const part = computed(() => parts.value[state.part] || {})
const partDone = computed(() => PARTS.map((p) => p.done(state, p.id === OWN ? ownFacts.value : guidedFacts.value, t)))
const goals = computed(() => OWN_GOALS.map((g) => ({ key: g.key, done: g.done(ownFacts.value) })))
const unlocked = (what) => state.part >= UNLOCK[what]
const allWords = computed(() => {
  const seen = new Set()
  return parts.value.flatMap((p) => p.words || []).filter((w) => !seen.has(w.term) && seen.add(w.term))
})
const example = computed(() => tRaw('writing.ink.example')) // raw: the story's {x} must not be filled in
const premise = computed(() => promptText(state, t, isOwn.value))
const defaultTitle = computed(() => state.ownTitle.trim() || state.title.trim() || promptText(state, t, !!state.ownSource.trim()) || promptText(state, t))
const hasWriting = computed(() => !!(state.source.trim() || state.ownSource.trim()))

/* ---- editor tools ---- */
/** Name for a new knot: start for the first one, then new_knot, new_knot_2… */
const nextKnot = () => freeKnot(parsed.value)
/** A tool's snippet; the first knot of an empty script also gets the divert that starts the story. */
const snippet = (id) => {
  const s = t(`writing.ink.snippets.${id}`, { knot: nextKnot() })
  return id === 'knot' && !text.value.trim() ? `-> ${nextKnot()}

${s}` : s
}
const tools = computed(() => toolsFor(isOwn.value ? OWN : state.part).map((id) => ({ id, label: t(`writing.ink.tools.${id}`), text: snippet(id), atEnd: id === 'knot' })))
function showMe() {
  const s = t(`writing.ink.parts.${state.part}.snippet`, { knot: nextKnot() })
  if (!s) return
  editor.value?.insert({ id: 'show', text: s, atEnd: s.startsWith('===') || s.startsWith('->') })
}

function goPart(i) {
  state.part = Math.max(0, Math.min(OWN, i))
  if (!unlocked('map') && tab.value === 'map') tab.value = 'play'
  nextTick(() => document.getElementById('ink-part')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function loadExample() {
  if (state.source.trim() && !confirm(t('writing.ink.confirmExample'))) return
  state.source = example.value
  if (state.part === 0) state.part = 1
}

function continuePractice() {
  if (state.ownSource.trim() && !confirm(t('writing.ink.confirmContinue'))) return
  state.ownSource = state.source
}

const gotoLine = (n) => editor.value?.gotoLine(n)

/* ---- copy, download, start over ---- */
async function copyText() {
  if (!(await copyToClipboard(text.value))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function download() {
  const file = new Blob([text.value.endsWith('\n') ? text.value : `${text.value}\n`], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = fileName(isOwn.value ? state.ownTitle || state.title : state.title)
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function startOver() {
  if (!confirm(t('writing.ink.confirmClear'))) return
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
  const str = (v) => (typeof v === 'string' ? v : '')
  Object.assign(state, {
    title: str(saved?.title),
    promptKey: PROMPTS.includes(saved?.promptKey) ? saved.promptKey : null,
    ownPrompt: str(saved?.ownPrompt),
    source: str(saved?.source),
    part: Number.isInteger(saved?.part) && saved.part >= 0 && saved.part <= OWN ? saved.part : 0,
    ownTitle: str(saved?.ownTitle),
    ownPromptKey: PROMPTS.includes(saved?.ownPromptKey) ? saved.ownPromptKey : null,
    ownOwnPrompt: str(saved?.ownOwnPrompt),
    ownSource: str(saved?.ownSource),
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
  <section class="container prose ink">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>📖 {{ t('writing.ink.title') }}</h1>
    <p class="lead">{{ t('writing.ink.intro') }}</p>
    <EarlierVersion :keys="['ink']" />

    <template v-if="loaded">
      <!-- ---- the parts of the guide ---- -->
      <nav class="parts" :aria-label="t('writing.ink.partsLabel')">
        <button
          v-for="(p, i) in parts"
          :key="i"
          type="button"
          class="part-btn"
          :class="{ current: state.part === i, done: partDone[i], own: i === OWN }"
          :aria-current="state.part === i ? 'step' : undefined"
          :aria-label="`${i}. ${p.title}${partDone[i] ? ` (${t('writing.ink.done')})` : ''}`"
          @click="goPart(i)"
        >
          <span class="part-no" aria-hidden="true">{{ partDone[i] ? '✓' : i }}</span>
          <span class="part-name">{{ p.short }}</span>
        </button>
      </nav>

      <article id="ink-part" class="panel part-card">
        <p class="eyebrow">{{ t('writing.ink.partN', { n: state.part, total: OWN }) }}<span v-if="partDone[state.part]" class="badge">✓ {{ t('writing.ink.done') }}</span></p>
        <h2>{{ part.title }}</h2>
        <p v-for="p in part.idea" :key="p">{{ p }}</p>

        <!-- part 0: premise and title -->
        <template v-if="state.part === 0">
          <PremisePicker id="ink-premise" base="writing.ink" :keys="PROMPTS" v-model:prompt-key="state.promptKey" v-model:own-prompt="state.ownPrompt" />
          <label class="field-label" for="ink-title">{{ t('writing.ink.titleLabel') }}</label>
          <input id="ink-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.ink.titlePlaceholder')" />
          <p class="muted small example-note">{{ t('writing.ink.exampleNote') }} <button type="button" class="linkish" @click="loadExample">{{ t('writing.ink.loadExample') }}</button></p>
        </template>

        <!-- part 6: your own -->
        <template v-else-if="isOwn">
          <PremisePicker id="ink-own-premise" base="writing.ink" :keys="PROMPTS" v-model:prompt-key="state.ownPromptKey" v-model:own-prompt="state.ownOwnPrompt" />
          <label class="field-label" for="ink-own-title">{{ t('writing.ink.titleLabel') }}</label>
          <input id="ink-own-title" v-model="state.ownTitle" maxlength="160" autocomplete="off" :placeholder="t('writing.ink.titlePlaceholder')" />
          <div v-if="!state.ownSource.trim()" class="row wrap start-choice">
            <button type="button" @click="editor?.gotoLine(1)">{{ t('writing.ink.blankStart') }}</button>
            <button v-if="state.source.trim()" type="button" @click="continuePractice">{{ t('writing.ink.continuePractice') }}</button>
          </div>
          <h3>{{ t('writing.ink.goalsTitle') }}</h3>
          <ul class="ticks">
            <li v-for="g in goals" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.ink.ownGoals.${g.key}`) }}<span class="sr">{{ g.done ? ` (${t('writing.ink.done')})` : '' }}</span></li>
          </ul>
          <details class="fold">
            <summary>{{ t('writing.ink.selfReviewTitle') }}</summary>
            <ul><li v-for="q in t('writing.ink.selfReview')" :key="q">{{ q }}</li></ul>
          </details>
          <details v-if="state.source.trim()" class="fold">
            <summary>{{ t('writing.ink.practiceFold') }}</summary>
            <pre class="code">{{ state.source }}</pre>
          </details>
        </template>

        <!-- parts 1–5: example, task, done when, words -->
        <template v-else>
          <p class="label">{{ t('writing.ink.exampleLabel') }}</p>
          <pre class="code">{{ part.example || '' }}</pre>
          <div class="task">
            <p class="label">{{ t('writing.ink.taskLabel') }}</p>
            <p>{{ part.task }}</p>
            <button v-if="part.snippet" type="button" class="ghost show-me" @click="showMe">💡 {{ t('writing.ink.showMe') }}</button>
          </div>
          <p class="label">{{ t('writing.ink.doneWhenLabel') }}</p>
          <ul class="ticks">
            <li v-for="d in part.doneWhen" :key="d" :class="{ ok: partDone[state.part] }"><span aria-hidden="true">{{ partDone[state.part] ? '✓' : '○' }}</span> {{ d }}</li>
          </ul>
          <details v-if="part.words?.length" class="fold">
            <summary>{{ t('writing.ink.wordsLabel') }}</summary>
            <dl class="glossary">
              <template v-for="w in part.words" :key="w.term"><dt><code>{{ w.term }}</code></dt><dd>{{ w.def }}</dd></template>
            </dl>
          </details>
          <details v-if="state.part === LAST_GUIDED" class="fold">
            <summary>{{ t('writing.ink.compareExample') }}</summary>
            <pre class="code">{{ example }}</pre>
          </details>
        </template>

        <div class="row part-nav">
          <button type="button" class="ghost" :disabled="state.part === 0" @click="goPart(state.part - 1)">← {{ t('writing.ink.prevPart') }}</button>
          <span class="spacer" />
          <button v-if="state.part < OWN" type="button" :class="partDone[state.part] ? 'primary' : 'ghost'" @click="goPart(state.part + 1)">{{ t('writing.ink.nextPart') }} →</button>
        </div>
      </article>

      <!-- ---- editor and problems ---- -->
      <div v-if="unlocked('editor')" class="panel">
        <h2>{{ isOwn ? t('writing.ink.ownEditorTitle') : t('writing.ink.editorTitle') }}</h2>
        <p v-if="premise" class="muted small premise-line">{{ premise }}</p>
        <YarnEditor ref="editor" v-model="text" :tools="tools" :marks="marks" :label="t('writing.ink.editorLabel')" :placeholder="t('writing.ink.editorPlaceholder')" :yarn-options="false" />
        <div class="problems" aria-live="polite">
          <p v-if="!problems.length" class="muted small">{{ text.trim() ? t('writing.ink.noProblems') : '' }}</p>
          <ul v-else>
            <li v-for="(p, i) in problems" :key="i" :class="`lv-${p.level}`">
              <button type="button" class="linkish line-link" @click="gotoLine(p.line)">{{ t('writing.ink.lineN', { n: p.line }) }}</button>
              <span class="lv">{{ t(`writing.ink.levels.${p.level}`) }}</span>
              {{ t(`writing.ink.checks.${p.key}`, p.params) }}
            </li>
          </ul>
        </div>
      </div>

      <!-- ---- play and map ---- -->
      <div v-if="unlocked('play')" class="panel">
        <div class="tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'play'" :class="{ active: tab === 'play' }" @click="tab = 'play'">▶ {{ t('writing.ink.tabPlay') }}</button>
          <button v-if="unlocked('map')" type="button" role="tab" :aria-selected="tab === 'map'" :class="{ active: tab === 'map' }" @click="tab = 'map'">⌘ {{ t('writing.ink.tabMap') }}</button>
        </div>
        <InkPlayer v-if="tab === 'play'" :parsed="parsed" :show-vars="unlocked('vars')" />
        <YarnMap v-else :graph="graph" @goto="gotoLine" />
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.ink.clear')" :aria-label="tl('writing.ink.clear')"><Icon name="trash" :label="tl('writing.ink.clear')" /></button>
        <button v-if="unlocked('download')" class="ghost" :disabled="!text.trim()" @click="download" :title="tl('writing.ink.download')" :aria-label="tl('writing.ink.download')"><Icon name="download" :label="tl('writing.ink.download')" /></button>
        <button class="primary" :disabled="!text.trim()" @click="copyText" :title="copied ? tl('writing.ink.copied') : tl('writing.ink.copy')" :aria-label="copied ? tl('writing.ink.copied') : tl('writing.ink.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.ink.copied') : tl('writing.ink.copy')" />
        </button>
      </div>

      <SavedWorks kind="ink" @open="apply" :data="state" :default-title="defaultTitle" :can-save="hasWriting" />

      <details class="panel all-words">
        <summary>{{ t('writing.ink.allWords') }}</summary>
        <dl class="glossary">
          <template v-for="w in allWords" :key="w.term"><dt><code>{{ w.term }}</code></dt><dd>{{ w.def }}</dd></template>
        </dl>
      </details>
    </template>
  </section>
</template>

<style scoped>
/* show -> and === as typed, not as font ligatures (arrows, bars) */
textarea, pre, code, .code { font-variant-ligatures: none; font-feature-settings: 'calt' 0, 'liga' 0; }
.panel + .panel, .part-card + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.wrap { flex-wrap: wrap; }
.spacer { flex: 1; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input { width: 100%; box-sizing: border-box; }
code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 0.92em; }
.code { margin: 0.3rem 0 0; padding: 0.6rem 0.8rem; border-radius: 8px; background: color-mix(in srgb, var(--text) 5%, var(--surface)); font: 0.86rem/1.5 ui-monospace, 'Cascadia Code', Consolas, monospace; white-space: pre-wrap; overflow-x: auto; }
.linkish { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

/* part bar */
.parts { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 1.25rem 0 0.75rem; }
.part-btn { gap: 0.4rem; padding: 0.35em 0.7em; font-size: 0.88rem; }
.part-btn.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-weight: 600; }
.part-btn.own { border-style: dashed; }
.part-no { display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 50%; background: var(--border); font-size: 0.75rem; font-weight: 700; }
.part-btn.done .part-no { background: var(--accent); color: #fff; }

/* part card */
.part-card h2 { margin: 0.1rem 0 0.5rem; }
.part-card h3 { font-size: 1rem; margin: 1.1rem 0 0.3rem; }
.eyebrow { margin: 0; font: 600 0.75rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.badge { margin-left: 0.6rem; color: var(--accent); }
.label { margin: 0.9rem 0 0.1rem; font-weight: 600; font-size: 0.9rem; }
.task { margin-top: 0.6rem; padding: 0.5rem 0.9rem 0.7rem; border-left: 4px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); border-radius: 0 8px 8px 0; }
.task .label { margin-top: 0.2rem; }
.task p { margin: 0.2rem 0; }
.show-me { margin-top: 0.3rem; padding-left: 0; }
.ticks { list-style: none; padding: 0; margin: 0.3rem 0; }
.ticks li { margin: 0.15rem 0; color: var(--muted); }
.ticks li.ok { color: inherit; }
.ticks li span:first-child { display: inline-block; width: 1.2rem; color: var(--accent); font-weight: 700; }
.fold { margin-top: 0.6rem; }
.fold summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; }
.glossary { margin: 0.5rem 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; font-size: 0.92rem; }
.glossary dt { font-weight: 600; }
.glossary dd { margin: 0; }
.example-note { margin-top: 1rem; }
.start-choice { margin-top: 1rem; }
.part-nav { margin-top: 1.1rem; }

/* editor */
.premise-line { margin: -0.2rem 0 0.6rem; font-style: italic; }
.problems { margin-top: 0.6rem; }
.problems ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.problems li { padding: 0.25rem 0.5rem; border-radius: 6px; }
.lv-error { background: color-mix(in srgb, var(--danger) 10%, transparent); }
.lv-warn { background: color-mix(in srgb, #e0a100 12%, transparent); }
.lv-info { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.lv { font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0.4rem; color: var(--muted); }
.line-link { font: 600 0.82rem ui-monospace, Consolas, monospace; }

/* play / map */
.tabs { display: flex; gap: 0.35rem; margin-bottom: 0.75rem; }
.tabs button.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-weight: 600; }

.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.all-words { margin-top: 1.5rem; }
.all-words summary { cursor: pointer; font-weight: 600; }

@media (max-width: 640px) {
  .part-name { display: none; }
  .part-btn.current .part-name { display: inline; }
  .glossary { grid-template-columns: 1fr; gap: 0.1rem; }
  .glossary dd { margin-bottom: 0.4rem; }
}
</style>
