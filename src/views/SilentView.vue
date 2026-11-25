<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { settings } from '../composables/settings'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import PremisePicker from '../components/PremisePicker.vue'
import ScriptPreview from '../components/ScriptPreview.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { layoutScript, estimate, scriptPlainText, setPrefix, setTime } from '../composables/script'
import { findTelling } from '../writing/telling'
import { PROMPTS, MAX_LINES, MIN_LINES, newLine, blank, clean, promptText, hasSilent, lineIssues, goals, toBlocks } from '../composables/silent'

/*
 * What the camera sees: a short silent scene, action lines only. A checker
 * underlines what a camera can't film (thoughts, named feelings), camera
 * directions and dialogue; the scene is shown on a screenplay page.
 */
const ID = 'silent' // IndexedDB drafts id

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const learnOpen = ref(true)

const locale = computed(() => settings.locale)
const premise = computed(() => promptText(state, t))
const defaultTitle = computed(() => state.title.trim() || premise.value)
const written = computed(() => hasSilent(state))
const goalList = computed(() => goals(state, locale.value, t))
const blocks = computed(() => toBlocks(state, t('writing.silent.fadeOut')))
const seconds = computed(() => Math.max(5, Math.round((estimate(layoutScript(blocks.value)) * 60) / 5) * 5))
const CATS = ['inner', 'emotion', 'camera', 'dialogue', 'long']

/** A text cut into plain and flagged pieces, for the underlined copy under a line. */
function pieces(text) {
  const found = findTelling(text, locale.value)
  const out = []
  let at = 0
  for (const f of found) {
    if (f.index < at) continue
    if (f.index > at) out.push({ text: text.slice(at, f.index) })
    out.push({ text: f.word, cat: f.cat })
    at = f.index + f.word.length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}
/** Each kind of problem once per line, with the words that caused it. */
function issuesOf(text) {
  const by = {}
  for (const i of lineIssues(text, locale.value)) (by[i.cat] ||= []).push(i.word)
  return Object.entries(by).map(([cat, ws]) => ({ cat, words: [...new Set(ws.filter(Boolean))] }))
}

/* ---- heading chips ---- */
const HEADING_CHIPS = [
  ['INT.', (s) => setPrefix(s, 'INT.')], ['EXT.', (s) => setPrefix(s, 'EXT.')],
  ['DAY', (s) => setTime(s, 'DAY')], ['NIGHT', (s) => setTime(s, 'NIGHT')],
]
const headingEl = ref(null)
function chip(fn) {
  state.heading = fn(state.heading)
  nextTick(() => headingEl.value?.focus())
}

/* ---- lines ---- */
const fields = new Map()
const setField = (id, el) => (el ? fields.set(id, el) : fields.delete(id))
const focusLine = (id) => nextTick(() => fields.get(id)?.focus())
function addLine(after = state.lines.length - 1) {
  if (state.lines.length >= MAX_LINES) return
  const l = newLine()
  state.lines.splice(after + 1, 0, l)
  focusLine(l.id)
}
function removeLine(i) {
  state.lines.splice(i, 1)
  if (state.lines.length < MIN_LINES) state.lines.push(newLine())
}
/** Enter: go to the next line (adding one at the end). Backspace in an empty extra line: remove it. */
function onKey(e, i) {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    const next = state.lines[i + 1]
    if (next) focusLine(next.id)
    else if (state.lines.length < MAX_LINES) addLine(i)
    else document.getElementById('silent-ending')?.focus()
  } else if (e.key === 'Backspace' && !state.lines[i].text && state.lines.length > MIN_LINES) {
    e.preventDefault()
    removeLine(i)
    focusLine(state.lines[Math.max(0, i - 1)].id)
  }
}

/* ---- copy, start over ---- */
async function copyText() {
  if (!(await copyToClipboard(scriptPlainText(blocks.value)))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.silent.confirmClear'))) return
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
const apply = (saved) => Object.assign(state, clean(saved))

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
  learnOpen.value = !hasSilent(state) // the lesson starts open until there's a scene
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
  <section class="container prose silent">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>🎥 {{ t('writing.silent.title') }}</h1>
    <p class="lead">{{ t('writing.silent.intro') }}</p>
    <EarlierVersion :keys="['silent']" />

    <template v-if="loaded">
      <!-- ---- learn ---- -->
      <div class="panel learn">
        <h2>{{ t('writing.silent.learnTitle') }}</h2>
        <details :open="learnOpen">
          <summary>{{ t('writing.silent.pairsTitle') }}</summary>
          <p v-for="p in t('writing.silent.ruleText')" :key="p">{{ p }}</p>
          <ul class="pairs">
            <li v-for="(p, i) in t('writing.silent.pairs')" :key="i">
              <p class="tell"><small>{{ t('writing.silent.tellLabel') }}</small><span>{{ p.tell }}</span></p>
              <p class="show"><small>{{ t('writing.silent.showLabel') }}</small><span>{{ p.show }}</span></p>
            </li>
          </ul>
        </details>
        <details>
          <summary>{{ t('writing.silent.wordsTitle') }}</summary>
          <p class="muted small">{{ t('writing.silent.wordsHelp') }}</p>
          <dl class="glossary">
            <template v-for="c in CATS" :key="c">
              <dt><span class="swatch" :class="`c-${c}`" aria-hidden="true" />{{ t(`writing.silent.cats.${c}.name`) }}</dt>
              <dd><em>{{ t(`writing.silent.cats.${c}.words`) }}</em><br />{{ t(`writing.silent.cats.${c}.tip`) }}</dd>
            </template>
          </dl>
        </details>
      </div>

      <!-- ---- situation ---- -->
      <div class="panel">
        <h2>{{ t('writing.silent.situationTitle') }}</h2>
        <PremisePicker id="silent-premise" base="writing.silent" :keys="PROMPTS" v-model:prompt-key="state.promptKey" v-model:own-prompt="state.ownPrompt" />
        <label class="field-label" for="silent-title">{{ t('writing.silent.titleLabel') }}</label>
        <input id="silent-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.silent.titlePlaceholder')" />
        <label class="field-label" for="silent-heading">{{ t('writing.silent.headingLabel') }}</label>
        <p class="muted small help">{{ t('writing.silent.headingHelp') }}</p>
        <input id="silent-heading" ref="headingEl" v-model="state.heading" class="heading-input" maxlength="120" autocomplete="off" :placeholder="t('writing.silent.headingPlaceholder')" />
        <div class="chips">
          <button v-for="[label, fn] in HEADING_CHIPS" :key="label" type="button" class="chip" @click="chip(fn)">{{ label }}</button>
        </div>
      </div>

      <!-- ---- write ---- -->
      <div class="panel">
        <h2>{{ t('writing.silent.writeTitle') }}</h2>
        <p class="muted small help">{{ t('writing.silent.writeHelp') }}</p>
        <ol class="lines">
          <li v-for="(l, i) in state.lines" :key="l.id" class="line">
            <span class="no" aria-hidden="true">{{ i + 1 }}</span>
            <div class="field">
              <input
                :ref="(el) => setField(l.id, el)"
                v-model="l.text"
                maxlength="400"
                autocomplete="off"
                :aria-label="t('writing.silent.lineLabel', { n: i + 1 })"
                :placeholder="t('writing.silent.linePlaceholders')[i] || ''"
                @keydown="onKey($event, i)"
              />
              <template v-if="issuesOf(l.text).length">
                <p class="marked" aria-hidden="true"><template v-for="(p, k) in pieces(l.text)" :key="k"><mark v-if="p.cat" :class="`c-${p.cat}`">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></p>
                <ul class="issues">
                  <li v-for="x in issuesOf(l.text)" :key="x.cat" :class="`c-${x.cat}`">
                    <strong>{{ x.words.length ? x.words.map((w) => `“${w}”`).join(', ') : t(`writing.silent.cats.${x.cat}.name`) }}:</strong>
                    {{ t(`writing.silent.cats.${x.cat}.tip`) }}
                  </li>
                </ul>
              </template>
            </div>
            <button type="button" class="ghost remove" :disabled="state.lines.length <= MIN_LINES && !l.text" :title="t('writing.silent.removeLine', { n: i + 1 })" :aria-label="t('writing.silent.removeLine', { n: i + 1 })" @click="removeLine(i)"><Icon name="x" /></button>
          </li>
        </ol>
        <button type="button" class="ghost" :disabled="state.lines.length >= MAX_LINES" @click="addLine()">+ {{ t('writing.silent.addLine') }}</button>

        <label class="field-label" for="silent-ending">{{ t('writing.silent.endingLabel') }}</label>
        <p class="muted small help">{{ t('writing.silent.endingHelp') }}</p>
        <input id="silent-ending" v-model="state.ending" maxlength="400" autocomplete="off" :placeholder="t('writing.silent.endingPlaceholder')" />
        <ul v-if="issuesOf(state.ending).length" class="issues">
          <li v-for="x in issuesOf(state.ending)" :key="x.cat" :class="`c-${x.cat}`">
            <strong>{{ x.words.length ? x.words.map((w) => `“${w}”`).join(', ') : t(`writing.silent.cats.${x.cat}.name`) }}:</strong>
            {{ t(`writing.silent.cats.${x.cat}.tip`) }}
          </li>
        </ul>

        <h3>{{ t('writing.silent.goalsTitle') }}</h3>
        <ul class="ticks" aria-live="polite">
          <li v-for="g in goalList" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.silent.goals.${g.key}`) }}<span class="sr">{{ g.done ? ` (${t('writing.silent.done')})` : '' }}</span></li>
        </ul>
      </div>

      <!-- ---- preview ---- -->
      <div v-if="written" class="panel">
        <h2>{{ t('writing.silent.previewTitle') }}</h2>
        <p class="muted small">{{ t('writing.silent.screenTime', { s: seconds }) }}</p>
        <ScriptPreview :blocks="blocks" :minute-labels="false" />
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.silent.clear')" :aria-label="tl('writing.silent.clear')"><Icon name="trash" :label="tl('writing.silent.clear')" /></button>
        <button class="primary" :disabled="!written" @click="copyText" :title="copied ? tl('writing.silent.copied') : tl('writing.silent.copy')" :aria-label="copied ? tl('writing.silent.copied') : tl('writing.silent.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.silent.copied') : tl('writing.silent.copy')" />
        </button>
      </div>

      <SavedWorks kind="silent" @open="apply" :data="state" :default-title="defaultTitle" :can-save="written" />
    </template>
  </section>
</template>

<style scoped>
.panel + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.help { margin: 0 0 0.4rem; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input { width: 100%; box-sizing: border-box; }
.spacer { flex: 1; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
h3 { font-size: 1rem; margin: 1.4rem 0 0.3rem; }

/* learn */
.learn details { border-top: 1px solid var(--border); padding: 0.6rem 0; }
.learn details:last-child { padding-bottom: 0; }
.learn summary { cursor: pointer; font-weight: 600; }
.learn p { margin: 0.6rem 0; }
.pairs { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.pairs li { display: grid; grid-template-columns: 1fr 1.4fr; gap: 0.6rem; }
.pairs p { margin: 0 !important; padding: 0.45rem 0.75rem; border-radius: 8px; }
.tell { background: color-mix(in srgb, var(--danger) 8%, transparent); }
.tell span { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--danger) 50%, transparent); }
.show { background: color-mix(in srgb, #2f9e44 11%, transparent); font-family: 'Courier Prime', 'Courier New', Courier, monospace; }
.glossary { margin: 0.5rem 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; font-size: 0.92rem; }
.glossary dt { font-weight: 600; display: flex; align-items: baseline; gap: 0.4rem; }
.glossary dd { margin: 0; }
.swatch { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 3px; background: var(--mark); }

/* categories */
.c-inner { --mark: color-mix(in srgb, #7b61ff 28%, transparent); }
.c-emotion { --mark: color-mix(in srgb, #e0567a 28%, transparent); }
.c-camera { --mark: color-mix(in srgb, #2b8fd6 28%, transparent); }
.c-dialogue { --mark: color-mix(in srgb, #e0a100 30%, transparent); }
.c-long { --mark: color-mix(in srgb, #888 28%, transparent); }

/* heading */
.heading-input { font: 700 1rem 'Courier Prime', 'Courier New', Courier, monospace; text-transform: uppercase; }
.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
.chip { font: 0.78rem 'Courier Prime', 'Courier New', Courier, monospace; padding: 0.2em 0.6em; border-radius: 999px; }

/* lines */
.lines { list-style: none; margin: 0 0 0.5rem; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.line { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr) auto; gap: 0.4rem; align-items: start; }
.no { padding-top: 0.55rem; text-align: right; color: var(--muted); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.field input, #silent-ending { font: 1rem/1.45 'Courier Prime', 'Courier New', Courier, monospace; }
.marked { margin: 0.25rem 0 0; padding: 0 0.6rem; font: 0.9rem/1.45 'Courier Prime', 'Courier New', Courier, monospace; color: var(--muted); }
.marked mark { background: var(--mark); color: var(--text); border-radius: 3px; padding: 0 0.1em; }
.issues { list-style: none; margin: 0.25rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.86rem; }
.issues li { padding: 0.25rem 0.6rem; border-radius: 6px; background: var(--mark); }
.remove { padding: 0.35em; color: var(--muted); }

.ticks { list-style: none; padding: 0; margin: 0.3rem 0; }
.ticks li { margin: 0.15rem 0; color: var(--muted); }
.ticks li.ok { color: inherit; }
.ticks li span:first-child { display: inline-block; width: 1.2rem; color: var(--accent); font-weight: 700; }

.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }

@media (max-width: 640px) {
  .pairs li { grid-template-columns: 1fr; gap: 0.2rem; }
  .glossary { grid-template-columns: 1fr; gap: 0.1rem; }
  .glossary dd { margin-bottom: 0.5rem; }
}
</style>
