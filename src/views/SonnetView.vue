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
import RhythmRow from '../components/RhythmRow.vue'
import RhymePairs from '../components/RhymePairs.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { liveKeys } from '../writing/meter'
import { LINES, RHYTHM, FEET, SCHEME, PARTS, PROMPTS, SONNET_18, blank, clean, promptText, hasSonnet, letter, facts, goals, plainText } from '../composables/sonnet'

/*
 * Shakespearean sonnet: learn the form from Sonnet 18, plan the argument of
 * the three quatrains and the couplet, then write the 14 lines with a rhythm
 * row under each (iambic pentameter) and the rhyme check (ABAB CDCD EFEF GG).
 */
const ID = 'sonnet' // IndexedDB drafts id

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const editCounts = ref(false)
const learnOpen = ref(true)

const locale = computed(() => settings.locale)
const subject = computed(() => promptText(state, t))
const f = computed(() => facts(state, locale.value))
const goalList = computed(() => goals(state, locale.value, t))
const written = computed(() => hasSonnet(state))
const text = computed(() => plainText(state))
const defaultTitle = computed(() => state.title.trim() || state.lines.find((l) => l.text.trim())?.text.trim() || subject.value)
const lineTexts = computed(() => state.lines.map((l) => l.text))

/* ---- rhythm marks and counts ---- */
function setMark(line, key, value) {
  if (value === null) delete line.marks[key]
  else line.marks[key] = value
}
function setCount(line, key, value) {
  if (value === null) delete line.counts[key]
  else line.counts[key] = value
  prune(line)
}
/** Drop marks and counts of words that were edited away, so they can't reappear on a new word later. */
function prune(line) {
  const live = liveKeys(line.text, locale.value, line.counts)
  for (const k of Object.keys(line.counts)) if (!live.counts.has(k)) delete line.counts[k]
  for (const k of Object.keys(line.marks)) if (!live.marks.has(k)) delete line.marks[k]
}

/* ---- rhyme confirmations ---- */
const confirm_ = (k) => !state.confirmed.includes(k) && state.confirmed.push(k)
const unconfirm = (k) => (state.confirmed = state.confirmed.filter((x) => x !== k))

/** Enter goes to the next line. */
function onKey(e, i) {
  if (e.key !== 'Enter' || e.isComposing) return
  e.preventDefault()
  document.getElementById(`sonnet-line-${Math.min(LINES - 1, i + 1)}`)?.focus()
}

/* ---- copy, start over ---- */
async function copyText() {
  const out = [state.title.trim(), text.value].filter(Boolean).join('\n\n')
  if (!(await copyToClipboard(out))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.sonnet.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  loaded.value = false // pause autosave while resetting
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
watch(lineTexts, () => loaded.value && state.lines.forEach(prune))

/** Put a draft or a saved work on the page (autosave then stores it as the draft). */
const apply = (saved) => Object.assign(state, clean(saved))

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
  learnOpen.value = !hasSonnet(state) // the lesson starts open until there's a poem
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
  <section class="container prose sonnet">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>✒ {{ t('writing.sonnet.title') }}</h1>
    <p class="lead">{{ t('writing.sonnet.intro') }}</p>
    <EarlierVersion :keys="['sonnet']" />

    <template v-if="loaded">
      <!-- ---- learn ---- -->
      <div class="panel learn">
        <h2>{{ t('writing.sonnet.learnTitle') }}</h2>
        <details :open="learnOpen">
          <summary>{{ t('writing.sonnet.formTitle') }}</summary>
          <p v-for="p in t('writing.sonnet.formText')" :key="p">{{ p }}</p>
          <figure class="model">
            <ol class="model__lines" lang="en">
              <li v-for="(l, i) in SONNET_18" :key="i" :class="{ couplet: i >= 12, turn: i === 8 }">
                <span class="letter" aria-hidden="true">{{ letter(i) }}</span><span>{{ l }}</span>
              </li>
            </ol>
            <figcaption class="muted small">{{ t('writing.sonnet.modelCaption') }}</figcaption>
          </figure>
        </details>
        <details>
          <summary>{{ t('writing.sonnet.voltaTitle') }}</summary>
          <p v-for="p in t('writing.sonnet.voltaText')" :key="p">{{ p }}</p>
        </details>
        <details>
          <summary>{{ t('writing.sonnet.wordsTitle') }}</summary>
          <dl class="glossary">
            <template v-for="w in t('writing.sonnet.words')" :key="w.term"><dt>{{ w.term }}</dt><dd>{{ w.def }}</dd></template>
          </dl>
        </details>
      </div>

      <!-- ---- plan ---- -->
      <div class="panel">
        <h2>{{ t('writing.sonnet.planTitle') }}</h2>
        <PremisePicker id="sonnet-premise" base="writing.sonnet" :keys="PROMPTS" v-model:prompt-key="state.promptKey" v-model:own-prompt="state.ownPrompt" />
        <label class="field-label" for="sonnet-title">{{ t('writing.sonnet.titleLabel') }}</label>
        <input id="sonnet-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.sonnet.titlePlaceholder')" />
        <p class="muted small help top">{{ t('writing.sonnet.planHelp') }}</p>
        <div v-for="p in PARTS" :key="p.key" class="plan-row">
          <label class="field-label" :for="`sonnet-plan-${p.key}`">{{ t(`writing.sonnet.parts.${p.key}.name`) }} <span class="muted small">{{ t(`writing.sonnet.parts.${p.key}.lines`) }}</span></label>
          <input :id="`sonnet-plan-${p.key}`" v-model="state.plan[p.key]" maxlength="200" autocomplete="off" :placeholder="t(`writing.sonnet.parts.${p.key}.hint`)" />
        </div>
      </div>

      <!-- ---- write ---- -->
      <div class="panel">
        <h2>{{ t('writing.sonnet.writeTitle') }}</h2>
        <p class="muted small help">{{ t('writing.sonnet.meterHelp') }}</p>
        <label class="small check-row"><input v-model="editCounts" type="checkbox" /> {{ t('writing.sonnet.fixCounts') }}</label>
        <section v-for="p in PARTS" :key="p.key" class="part" :class="{ couplet: p.key === 'couplet' }">
          <h3>{{ t(`writing.sonnet.parts.${p.key}.name`) }}</h3>
          <p v-if="state.plan[p.key].trim()" class="plan-note">{{ state.plan[p.key] }}</p>
          <ol class="lines" :start="p.from + 1">
            <li v-for="i in p.n" :key="i" class="line">
              <span class="letter" aria-hidden="true">{{ letter(p.from + i - 1) }}</span>
              <div class="field">
                <input
                  :id="`sonnet-line-${p.from + i - 1}`"
                  v-model="state.lines[p.from + i - 1].text"
                  maxlength="200"
                  autocomplete="off"
                  :aria-label="t('writing.sonnet.lineLabel', { n: p.from + i, letter: letter(p.from + i - 1) })"
                  @keydown="onKey($event, p.from + i - 1)"
                />
                <RhythmRow
                  v-if="state.lines[p.from + i - 1].text.trim()"
                  :text="state.lines[p.from + i - 1].text"
                  :locale="locale"
                  :rhythm="RHYTHM"
                  :feet="FEET"
                  :marks="state.lines[p.from + i - 1].marks"
                  :counts="state.lines[p.from + i - 1].counts"
                  :edit-counts="editCounts"
                  @mark="(k, v) => setMark(state.lines[p.from + i - 1], k, v)"
                  @count="(k, v) => setCount(state.lines[p.from + i - 1], k, v)"
                />
              </div>
            </li>
          </ol>
        </section>

        <h3>{{ t('writing.sonnet.rhymeTitle') }}</h3>
        <RhymePairs :scheme="SCHEME" :lines="lineTexts" :locale="locale" :confirmed="state.confirmed" @confirm="confirm_" @unconfirm="unconfirm" />

        <h3>{{ t('writing.sonnet.goalsTitle') }}</h3>
        <p class="muted small">{{ t('writing.sonnet.counts', { written: f.written, meter: f.inMeter, rhymes: f.rhymes, pairs: f.pairs }) }}</p>
        <ul class="ticks" aria-live="polite">
          <li v-for="g in goalList" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.sonnet.goals.${g.key}`) }}<span class="sr">{{ g.done ? ` (${t('writing.sonnet.done')})` : '' }}</span></li>
        </ul>
        <details class="fold">
          <summary>{{ t('writing.sonnet.selfReviewTitle') }}</summary>
          <ul><li v-for="q in t('writing.sonnet.selfReview')" :key="q">{{ q }}</li></ul>
        </details>
      </div>

      <!-- ---- the poem ---- -->
      <div v-if="written" class="panel">
        <h2>{{ t('writing.sonnet.poemTitle') }}</h2>
        <div class="poem">
          <p v-if="state.title.trim()" class="poem__title">{{ state.title.trim() }}</p>
          <p v-for="(l, i) in state.lines" :key="i" class="poem__line" :class="{ couplet: i >= 12, gap: i === 12 }">{{ l.text.trim() || ' ' }}</p>
        </div>
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.sonnet.clear')" :aria-label="tl('writing.sonnet.clear')"><Icon name="trash" :label="tl('writing.sonnet.clear')" /></button>
        <button class="primary" :disabled="!written" @click="copyText" :title="copied ? tl('writing.sonnet.copied') : tl('writing.sonnet.copy')" :aria-label="copied ? tl('writing.sonnet.copied') : tl('writing.sonnet.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.sonnet.copied') : tl('writing.sonnet.copy')" />
        </button>
      </div>

      <SavedWorks kind="sonnet" @open="apply" :data="state" :default-title="defaultTitle" :can-save="written" />
    </template>
  </section>
</template>

<style scoped>
.panel + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.help { margin: 0 0 0.4rem; }
.help.top { margin-top: 1rem; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input:not([type='checkbox']) { width: 100%; box-sizing: border-box; }
.spacer { flex: 1; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
h3 { font-size: 1rem; margin: 1.4rem 0 0.3rem; }
.check-row { display: inline-flex; gap: 0.4rem; align-items: center; margin-bottom: 0.5rem; }
.fold { margin-top: 0.6rem; }
.fold summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; }

/* learn */
.learn details { border-top: 1px solid var(--border); padding: 0.6rem 0; }
.learn details:last-child { padding-bottom: 0; }
.learn summary { cursor: pointer; font-weight: 600; }
.learn p { margin: 0.6rem 0; }
.model { margin: 0.75rem 0 0; }
.model__lines { list-style: none; margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); font: 1.02rem/1.55 Georgia, 'Times New Roman', serif; }
.model__lines li { display: flex; gap: 0.75rem; }
.model__lines li.turn { margin-top: 0.6rem; }
.model__lines li.couplet { padding-left: 1.5rem; }
.model__lines li:nth-child(13) { margin-top: 0.6rem; }
.model figcaption { margin-top: 0.3rem; }
.glossary { margin: 0.5rem 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.45rem 1rem; font-size: 0.92rem; }
.glossary dt { font-weight: 600; }
.glossary dd { margin: 0; }

/* letters */
.letter { flex: none; display: inline-grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; font: 700 0.75rem system-ui, sans-serif; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

/* plan */
.plan-row .field-label { margin-top: 0.7rem; }

/* write */
.part { margin-top: 1rem; }
.part h3 { margin: 0 0 0.2rem; }
.plan-note { margin: 0 0 0.4rem; font-style: italic; color: var(--muted); font-size: 0.9rem; }
.lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.line { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr); gap: 0.4rem; align-items: start; }
.line .letter { margin-top: 0.45rem; }
.part.couplet .lines { padding-left: 1.5rem; }
.field input { font: 1.02rem/1.45 Georgia, 'Times New Roman', serif; }

.ticks { list-style: none; padding: 0; margin: 0.3rem 0; }
.ticks li { margin: 0.15rem 0; color: var(--muted); }
.ticks li.ok { color: inherit; }
.ticks li span:first-child { display: inline-block; width: 1.2rem; color: var(--accent); font-weight: 700; }

/* poem */
.poem { font: 1.08rem/1.6 Georgia, 'Times New Roman', serif; padding: 0.5rem 0.25rem; }
.poem p { margin: 0; }
.poem__title { font-weight: 700; margin-bottom: 0.6rem !important; }
.poem__line.couplet { padding-left: 1.5rem; }
.poem__line.gap { margin-top: 0.6rem !important; }

.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }

@media (max-width: 640px) {
  .glossary { grid-template-columns: 1fr; gap: 0.1rem; }
  .glossary dd { margin-bottom: 0.4rem; }
  .part.couplet .lines { padding-left: 0.5rem; }
}
</style>
