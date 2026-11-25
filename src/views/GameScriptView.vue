<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import PremisePicker from '../components/PremisePicker.vue'
import YarnCode from '../components/YarnCode.vue'
import YarnEditor from '../components/YarnEditor.vue'
import YarnMap from '../components/YarnMap.vue'
import YarnPlayer from '../components/YarnPlayer.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { parseYarn, checkYarn } from '../writing/yarn'
import { PROMPTS, PARTS, OWN, LAST_GUIDED, OWN_GOALS, UNLOCK, promptText, facts, toolsFor, problemsFor, freeTitle, fileName } from '../composables/gameScript'

/*
 * Game dialogue (Yarn Spinner): a writing guide in small parts. Each part
 * teaches one idea, gives one task and unlocks the next tools; part 6 is a
 * whole conversation of the writer's own. Live checker, map of the branches,
 * and Play to click through the conversation.
 */
const ID = 'game' // IndexedDB drafts id
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
const guided = computed(() => parseYarn(state.source))
const own = computed(() => parseYarn(state.ownSource))
const parsed = computed(() => (isOwn.value ? own.value : guided.value))
const guidedFacts = computed(() => facts(guided.value))
const ownFacts = computed(() => facts(own.value))
const problems = computed(() => problemsFor(checkYarn(parsed.value), state.part))
const marks = computed(() => {
  const rank = { info: 1, warn: 2, error: 3 }
  const out = {}
  for (const p of problems.value) if (!out[p.line] || rank[p.level] > rank[out[p.line]]) out[p.line] = p.level
  return out
})

const parts = computed(() => t('writing.game.parts') || [])
const part = computed(() => parts.value[state.part] || {})
const partDone = computed(() => PARTS.map((p) => p.done(state, p.id === OWN ? ownFacts.value : guidedFacts.value, t)))
const goals = computed(() => OWN_GOALS.map((g) => ({ key: g.key, done: g.done(ownFacts.value) })))
const unlocked = (what) => state.part >= UNLOCK[what]
const allWords = computed(() => {
  const seen = new Set()
  return parts.value.flatMap((p) => p.words || []).filter((w) => !seen.has(w.term) && seen.add(w.term))
})
const example = computed(() => t('writing.game.example'))
const premise = computed(() => promptText(state, t, isOwn.value))
const defaultTitle = computed(() => state.ownTitle.trim() || state.title.trim() || promptText(state, t, !!state.ownSource.trim()) || promptText(state, t))
const hasWriting = computed(() => !!(state.source.trim() || state.ownSource.trim()))

/* ---- editor tools ---- */
/** Name for a new node: Start for the first one, then NewNode, NewNode2… */
const nextTitle = () => (parsed.value.nodes.length ? freeTitle(parsed.value) : 'Start')
const snippet = (id) => t(`writing.game.snippets.${id}`, { title: nextTitle() })
const tools = computed(() => toolsFor(isOwn.value ? LAST_GUIDED : state.part).map((id) => ({ id, label: t(`writing.game.tools.${id}`), text: snippet(id), atEnd: id === 'node' })))
function showMe() {
  const s = t(`writing.game.parts.${state.part}.snippet`, { title: nextTitle() })
  if (!s) return
  editor.value?.insert({ id: 'show', text: s, atEnd: s.startsWith('title:') })
}

function goPart(i) {
  state.part = Math.max(0, Math.min(OWN, i))
  if (!unlocked('map') && tab.value === 'map') tab.value = 'play'
  nextTick(() => document.getElementById('game-part')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function loadExample() {
  if (state.source.trim() && !confirm(t('writing.game.confirmExample'))) return
  state.source = example.value
  if (state.part === 0) state.part = 1
}

function continuePractice() {
  if (state.ownSource.trim() && !confirm(t('writing.game.confirmContinue'))) return
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
  if (!confirm(t('writing.game.confirmClear'))) return
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
  <section class="container prose game">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>🎮 {{ t('writing.game.title') }}</h1>
    <p class="lead">{{ t('writing.game.intro') }}</p>
    <EarlierVersion :keys="['game']" />

    <template v-if="loaded">
      <!-- ---- the parts of the guide ---- -->
      <nav class="parts" :aria-label="t('writing.game.partsLabel')">
        <button
          v-for="(p, i) in parts"
          :key="i"
          type="button"
          class="part-btn"
          :class="{ current: state.part === i, done: partDone[i], own: i === OWN }"
          :aria-current="state.part === i ? 'step' : undefined"
          :aria-label="`${i}. ${p.title}${partDone[i] ? ` (${t('writing.game.done')})` : ''}`"
          @click="goPart(i)"
        >
          <span class="part-no" aria-hidden="true">{{ partDone[i] ? '✓' : i }}</span>
          <span class="part-name">{{ p.short }}</span>
        </button>
      </nav>

      <article id="game-part" class="panel part-card">
        <p class="eyebrow">{{ t('writing.game.partN', { n: state.part, total: OWN }) }}<span v-if="partDone[state.part]" class="badge">✓ {{ t('writing.game.done') }}</span></p>
        <h2>{{ part.title }}</h2>
        <p v-for="p in part.idea" :key="p">{{ p }}</p>

        <!-- part 0: premise and title -->
        <template v-if="state.part === 0">
          <PremisePicker id="game-premise" base="writing.game" :keys="PROMPTS" v-model:prompt-key="state.promptKey" v-model:own-prompt="state.ownPrompt" />
          <label class="field-label" for="game-title">{{ t('writing.game.titleLabel') }}</label>
          <input id="game-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.game.titlePlaceholder')" />
          <p class="muted small example-note">{{ t('writing.game.exampleNote') }} <button type="button" class="linkish" @click="loadExample">{{ t('writing.game.loadExample') }}</button></p>
        </template>

        <!-- part 6: your own -->
        <template v-else-if="isOwn">
          <PremisePicker id="game-own-premise" base="writing.game" :keys="PROMPTS" v-model:prompt-key="state.ownPromptKey" v-model:own-prompt="state.ownOwnPrompt" />
          <label class="field-label" for="game-own-title">{{ t('writing.game.titleLabel') }}</label>
          <input id="game-own-title" v-model="state.ownTitle" maxlength="160" autocomplete="off" :placeholder="t('writing.game.titlePlaceholder')" />
          <div v-if="!state.ownSource.trim()" class="row wrap start-choice">
            <button type="button" @click="editor?.gotoLine(1)">{{ t('writing.game.blankStart') }}</button>
            <button v-if="state.source.trim()" type="button" @click="continuePractice">{{ t('writing.game.continuePractice') }}</button>
          </div>
          <h3>{{ t('writing.game.goalsTitle') }}</h3>
          <ul class="ticks">
            <li v-for="g in goals" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.game.ownGoals.${g.key}`) }}<span class="sr">{{ g.done ? ` (${t('writing.game.done')})` : '' }}</span></li>
          </ul>
          <details class="fold">
            <summary>{{ t('writing.game.selfReviewTitle') }}</summary>
            <ul><li v-for="q in t('writing.game.selfReview')" :key="q">{{ q }}</li></ul>
          </details>
          <details v-if="state.source.trim()" class="fold">
            <summary>{{ t('writing.game.practiceFold') }}</summary>
            <YarnCode :src="state.source" />
          </details>
        </template>

        <!-- parts 1–5: example, task, done when, words -->
        <template v-else>
          <p class="label">{{ t('writing.game.exampleLabel') }}</p>
          <YarnCode :src="part.example || ''" />
          <div class="task">
            <p class="label">{{ t('writing.game.taskLabel') }}</p>
            <p>{{ part.task }}</p>
            <button v-if="part.snippet" type="button" class="ghost show-me" @click="showMe">💡 {{ t('writing.game.showMe') }}</button>
          </div>
          <p class="label">{{ t('writing.game.doneWhenLabel') }}</p>
          <ul class="ticks">
            <li v-for="d in part.doneWhen" :key="d" :class="{ ok: partDone[state.part] }"><span aria-hidden="true">{{ partDone[state.part] ? '✓' : '○' }}</span> {{ d }}</li>
          </ul>
          <details v-if="part.words?.length" class="fold">
            <summary>{{ t('writing.game.wordsLabel') }}</summary>
            <dl class="glossary">
              <template v-for="w in part.words" :key="w.term"><dt><code>{{ w.term }}</code></dt><dd>{{ w.def }}</dd></template>
            </dl>
          </details>
          <details v-if="state.part === LAST_GUIDED" class="fold">
            <summary>{{ t('writing.game.compareExample') }}</summary>
            <YarnCode :src="example" />
          </details>
        </template>

        <div class="row part-nav">
          <button type="button" class="ghost" :disabled="state.part === 0" @click="goPart(state.part - 1)">← {{ t('writing.game.prevPart') }}</button>
          <span class="spacer" />
          <button v-if="state.part < OWN" type="button" :class="partDone[state.part] ? 'primary' : 'ghost'" @click="goPart(state.part + 1)">{{ t('writing.game.nextPart') }} →</button>
        </div>
      </article>

      <!-- ---- editor and problems ---- -->
      <div v-if="unlocked('editor')" class="panel">
        <h2>{{ isOwn ? t('writing.game.ownEditorTitle') : t('writing.game.editorTitle') }}</h2>
        <p v-if="premise" class="muted small premise-line">{{ premise }}</p>
        <YarnEditor ref="editor" v-model="text" :tools="tools" :marks="marks" :label="t('writing.game.editorLabel')" :placeholder="t('writing.game.editorPlaceholder')" />
        <div class="problems" aria-live="polite">
          <p v-if="!problems.length" class="muted small">{{ text.trim() ? t('writing.game.noProblems') : '' }}</p>
          <ul v-else>
            <li v-for="(p, i) in problems" :key="i" :class="`lv-${p.level}`">
              <button type="button" class="linkish line-link" @click="gotoLine(p.line)">{{ t('writing.game.lineN', { n: p.line }) }}</button>
              <span class="lv">{{ t(`writing.game.levels.${p.level}`) }}</span>
              {{ t(`writing.game.checks.${p.key}`, p.params) }}
            </li>
          </ul>
        </div>
      </div>

      <!-- ---- play and map ---- -->
      <div v-if="unlocked('play')" class="panel">
        <div class="tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'play'" :class="{ active: tab === 'play' }" @click="tab = 'play'">▶ {{ t('writing.game.tabPlay') }}</button>
          <button v-if="unlocked('map')" type="button" role="tab" :aria-selected="tab === 'map'" :class="{ active: tab === 'map' }" @click="tab = 'map'">⌘ {{ t('writing.game.tabMap') }}</button>
        </div>
        <YarnPlayer v-if="tab === 'play'" :parsed="parsed" :show-vars="unlocked('vars')" />
        <YarnMap v-else :parsed="parsed" @goto="gotoLine" />
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.game.clear')" :aria-label="tl('writing.game.clear')"><Icon name="trash" :label="tl('writing.game.clear')" /></button>
        <button v-if="unlocked('download')" class="ghost" :disabled="!text.trim()" @click="download" :title="tl('writing.game.download')" :aria-label="tl('writing.game.download')"><Icon name="download" :label="tl('writing.game.download')" /></button>
        <button class="primary" :disabled="!text.trim()" @click="copyText" :title="copied ? tl('writing.game.copied') : tl('writing.game.copy')" :aria-label="copied ? tl('writing.game.copied') : tl('writing.game.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.game.copied') : tl('writing.game.copy')" />
        </button>
      </div>

      <SavedWorks kind="game" @open="apply" :data="state" :default-title="defaultTitle" :can-save="hasWriting" />

      <details class="panel all-words">
        <summary>{{ t('writing.game.allWords') }}</summary>
        <dl class="glossary">
          <template v-for="w in allWords" :key="w.term"><dt><code>{{ w.term }}</code></dt><dd>{{ w.def }}</dd></template>
        </dl>
      </details>
    </template>
  </section>
</template>

<style scoped>
.panel + .panel, .part-card + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.wrap { flex-wrap: wrap; }
.spacer { flex: 1; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input { width: 100%; box-sizing: border-box; }
code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 0.92em; }
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
