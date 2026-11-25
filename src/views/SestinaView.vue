<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import {
  N, STANZAS, STEPS, ENVOI_STEP, READ_STEP, ORDERS, ENVOI_PAIRS, blank, clean, hasSestina, wordStatus, wordsReady,
  endStatus, fits, lastWord, acceptKey, stanzaChecks, envoiCheck, stepsDone, plainText,
} from '../composables/sestina'

/*
 * Sestina: choose six end-words, then write six stanzas in which they return
 * in the rotating order (the page shows which word each line must end on),
 * and an envoi that uses all six. Read back with the end-words coloured and
 * the rotation grid.
 */
const ID = 'sestina' // IndexedDB drafts id

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)

const ready = computed(() => wordsReady(state.words))
const done = computed(() => stepsDone(state))
const statuses = computed(() => wordStatus(state.words))
const stanza = computed(() => state.step - 1) // 0–5 on the stanza steps
const checks = computed(() => (state.step >= 1 && state.step <= STANZAS ? stanzaChecks(state, stanza.value) : []))
const envoi = computed(() => envoiCheck(state))
const written = computed(() => hasSestina(state))
const text = computed(() => plainText(state))
const defaultTitle = computed(() => state.title.trim() || state.words.filter((w) => w.trim()).join(', '))
const LETTERS = 'ABCDEF'
const stepName = (i) => (i === 0 ? t('writing.sestina.stepWords') : i === ENVOI_STEP ? t('writing.sestina.stepEnvoi') : i === READ_STEP ? t('writing.sestina.stepRead') : t('writing.sestina.stepStanza', { n: i }))
const wordOf = (i) => state.words[i]?.trim() || LETTERS[i]

function go(i) {
  if (i > 0 && !ready.value) return
  state.step = Math.max(0, Math.min(STEPS - 1, i))
  nextTick(() => document.getElementById('sestina-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** Draw one of the suggested word sets. */
function drawWords() {
  const sets = t('writing.sestina.wordSets') || []
  const current = state.words.join('|')
  const pool = sets.filter((s) => s.join('|') !== current)
  const pick = pool[Math.floor(Math.random() * pool.length)]
  if (!pick) return
  if (state.words.some((w) => w.trim()) && !confirm(t('writing.sestina.confirmWords'))) return
  state.words = [...pick]
}

/** Enter goes to the next line. */
function onKey(e, id) {
  if (e.key !== 'Enter' || e.isComposing) return
  e.preventDefault()
  document.getElementById(id)?.focus()
}

const accept = (word, line) => {
  const k = acceptKey(word, lastWord(line))
  if (!state.accepted.includes(k)) state.accepted.push(k)
}
const unaccept = (word, line) => (state.accepted = state.accepted.filter((k) => k !== acceptKey(word, lastWord(line))))

/** A line cut before its last word, so the end-word can be coloured. */
function split(line) {
  const m = /([\p{L}\p{N}’'-]+)([^\p{L}\p{N}]*)$/u.exec(line.trim())
  return m ? { head: line.trim().slice(0, m.index), end: m[1], tail: m[2] } : { head: line.trim(), end: '', tail: '' }
}
/** Which end-word a line of the finished poem ends on (for the colour), or -1. */
const endIndex = (line, expected) => (expected >= 0 && fits(endStatus(line, state.words[expected], state.accepted)) ? expected : state.words.findIndex((w) => w.trim() && fits(endStatus(line, w, state.accepted))))

/* ---- copy, start over ---- */
async function copyText() {
  const out = [state.title.trim(), text.value].filter(Boolean).join('\n\n')
  if (!(await copyToClipboard(out))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.sestina.confirmClear'))) return
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
  Object.assign(state, clean(saved))
  if (!wordsReady(state.words)) state.step = 0
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
  <section class="container prose sestina">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>❋ {{ t('writing.sestina.title') }}</h1>
    <p class="lead">{{ t('writing.sestina.intro') }}</p>
    <EarlierVersion :keys="['sestina']" />

    <template v-if="loaded">
      <nav class="steps" :aria-label="t('writing.sestina.stepsLabel')">
        <button
          v-for="i in STEPS"
          :key="i"
          type="button"
          class="step-btn"
          :class="{ current: state.step === i - 1, done: done[i - 1] }"
          :disabled="i > 1 && !ready"
          :aria-current="state.step === i - 1 ? 'step' : undefined"
          :aria-label="`${stepName(i - 1)}${done[i - 1] ? ` (${t('writing.sestina.done')})` : ''}`"
          @click="go(i - 1)"
        >
          <span class="step-no" aria-hidden="true">{{ done[i - 1] ? '✓' : i - 1 === 0 ? '❋' : i - 1 === ENVOI_STEP ? 'E' : i - 1 === READ_STEP ? '◎' : i - 1 }}</span>
          <span class="step-name">{{ stepName(i - 1) }}</span>
        </button>
      </nav>

      <article id="sestina-step" class="panel">
        <!-- ---- step 0: the form and the six words ---- -->
        <template v-if="state.step === 0">
          <h2>{{ t('writing.sestina.formTitle') }}</h2>
          <p v-for="p in t('writing.sestina.formText')" :key="p">{{ p }}</p>
          <div class="grid-wrap">
            <table class="grid" :aria-label="t('writing.sestina.gridLabel')">
              <thead><tr><th scope="col" /><th v-for="i in N" :key="i" scope="col">{{ i }}</th></tr></thead>
              <tbody>
                <tr v-for="(o, s) in ORDERS" :key="s">
                  <th scope="row">{{ s + 1 }}</th>
                  <td v-for="(w, i) in o" :key="i" :class="`w${w}`">{{ LETTERS[w] }}</td>
                </tr>
                <tr>
                  <th scope="row">E</th>
                  <td colspan="6" class="envoi-cell">
                    <span v-for="(p, k) in ENVOI_PAIRS" :key="k">{{ LETTERS[p[0]] }}…<b>{{ LETTERS[p[1]] }}</b></span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="muted small">{{ t('writing.sestina.gridHelp') }}</p>
          </div>

          <h3>{{ t('writing.sestina.wordsTitle') }}</h3>
          <ul class="advice">
            <li v-for="a in t('writing.sestina.wordsAdvice')" :key="a">{{ a }}</li>
          </ul>
          <div class="words">
            <label v-for="(w, i) in state.words" :key="i" class="word" :class="`w${i}`">
              <span class="badge" aria-hidden="true">{{ LETTERS[i] }}</span>
              <input v-model="state.words[i]" maxlength="30" autocomplete="off" :aria-label="t('writing.sestina.wordLabel', { letter: LETTERS[i] })" :placeholder="t('writing.sestina.wordPlaceholder')" />
              <span v-if="statuses[i] === 'many' || statuses[i] === 'twice'" class="warn small">{{ t(`writing.sestina.wordStatus.${statuses[i]}`) }}</span>
            </label>
          </div>
          <button type="button" class="ghost" @click="drawWords">🎲 {{ t('writing.sestina.drawWords') }}</button>
          <label class="field-label" for="sestina-title">{{ t('writing.sestina.titleLabel') }}</label>
          <input id="sestina-title" v-model="state.title" maxlength="160" autocomplete="off" :placeholder="t('writing.sestina.titlePlaceholder')" />
        </template>

        <!-- ---- steps 1–6: a stanza ---- -->
        <template v-else-if="state.step <= STANZAS">
          <h2>{{ t('writing.sestina.stepStanza', { n: state.step }) }}</h2>
          <p class="muted">{{ t(state.step === 1 ? 'writing.sestina.firstHelp' : 'writing.sestina.stanzaHelp') }}</p>
          <details v-if="state.step > 1" class="fold">
            <summary>{{ t('writing.sestina.previous', { n: state.step - 1 }) }}</summary>
            <p v-for="(c, i) in stanzaChecks(state, state.step - 2)" :key="i" class="prev-line">{{ state.lines[c.index] || '…' }} <span class="chip" :class="`w${c.word}`">{{ wordOf(c.word) }}</span></p>
          </details>
          <ol class="lines">
            <li v-for="(c, i) in checks" :key="c.index" class="line">
              <div class="field">
                <input
                  :id="`sestina-line-${c.index}`"
                  v-model="state.lines[c.index]"
                  maxlength="240"
                  autocomplete="off"
                  :aria-label="t('writing.sestina.lineLabel', { n: i + 1, word: wordOf(c.word) })"
                  @keydown="onKey($event, i < N - 1 ? `sestina-line-${c.index + 1}` : '')"
                />
                <p v-if="c.status === 'no'" class="miss small">
                  {{ t('writing.sestina.endsOn', { end: lastWord(state.lines[c.index]), word: wordOf(c.word) }) }}
                  <button type="button" class="linkish" @click="accept(state.words[c.word], state.lines[c.index])">{{ t('writing.sestina.accept', { end: lastWord(state.lines[c.index]), word: wordOf(c.word) }) }}</button>
                </p>
                <p v-else-if="c.status === 'accepted'" class="muted small">
                  {{ t('writing.sestina.accepted') }} <button type="button" class="linkish" @click="unaccept(state.words[c.word], state.lines[c.index])">{{ t('writing.sestina.unaccept') }}</button>
                </p>
              </div>
              <span class="chip end" :class="[`w${c.word}`, { ok: fits(c.status) }]">
                <span aria-hidden="true">{{ fits(c.status) ? '✓' : '…' }}</span> {{ wordOf(c.word) }}<span v-if="c.status === 'form'" class="muted"> ≈</span>
              </span>
            </li>
          </ol>
        </template>

        <!-- ---- step 7: the envoi ---- -->
        <template v-else-if="state.step === ENVOI_STEP">
          <h2>{{ t('writing.sestina.stepEnvoi') }}</h2>
          <p v-for="p in t('writing.sestina.envoiText')" :key="p" class="muted">{{ p }}</p>
          <ol class="lines">
            <li v-for="(l, i) in state.envoi" :key="i" class="line">
              <div class="field">
                <input
                  :id="`sestina-envoi-${i}`"
                  v-model="state.envoi[i]"
                  maxlength="240"
                  autocomplete="off"
                  :aria-label="t('writing.sestina.envoiLine', { n: i + 1 })"
                  :placeholder="t('writing.sestina.envoiHint', { a: wordOf(ENVOI_PAIRS[i][0]), b: wordOf(ENVOI_PAIRS[i][1]) })"
                  @keydown="onKey($event, i < 2 ? `sestina-envoi-${i + 1}` : '')"
                />
              </div>
              <span class="chip end" :class="{ ok: envoi.ends[i] }"><span aria-hidden="true">{{ envoi.ends[i] ? '✓' : '…' }}</span> {{ t('writing.sestina.endsOnWord') }}</span>
            </li>
          </ol>
          <p class="label">{{ t('writing.sestina.usedTitle') }}</p>
          <ul class="used">
            <li v-for="(w, i) in state.words" :key="i" class="chip" :class="[`w${i}`, { ok: envoi.used[i] }]"><span aria-hidden="true">{{ envoi.used[i] ? '✓' : '○' }}</span> {{ wordOf(i) }}</li>
          </ul>
        </template>

        <!-- ---- step 8: read it back ---- -->
        <template v-else>
          <h2>{{ t('writing.sestina.stepRead') }}</h2>
          <div class="poem">
            <p v-if="state.title.trim()" class="poem__title">{{ state.title.trim() }}</p>
            <div v-for="(o, s) in ORDERS" :key="s" class="stanza">
              <p v-for="(w, i) in o" :key="i">
                <template v-if="state.lines[s * N + i].trim()">{{ split(state.lines[s * N + i]).head }}<mark :class="`w${endIndex(state.lines[s * N + i], w)}`">{{ split(state.lines[s * N + i]).end }}</mark>{{ split(state.lines[s * N + i]).tail }}</template>
                <span v-else class="muted">…</span>
              </p>
            </div>
            <div class="stanza envoi">
              <p v-for="(l, i) in state.envoi" :key="i">
                <template v-if="l.trim()">{{ split(l).head }}<mark :class="`w${endIndex(l, -1)}`">{{ split(l).end }}</mark>{{ split(l).tail }}</template>
                <span v-else class="muted">…</span>
              </p>
            </div>
          </div>
          <details class="fold">
            <summary>{{ t('writing.sestina.selfReviewTitle') }}</summary>
            <ul><li v-for="q in t('writing.sestina.selfReview')" :key="q">{{ q }}</li></ul>
          </details>
        </template>

        <div class="row nav">
          <button type="button" class="ghost" :disabled="state.step === 0" @click="go(state.step - 1)">← {{ t('writing.sestina.back') }}</button>
          <span class="spacer" />
          <button v-if="state.step < READ_STEP" type="button" :class="done[state.step] ? 'primary' : 'ghost'" :disabled="!ready" @click="go(state.step + 1)">{{ t('writing.sestina.next') }} →</button>
        </div>
      </article>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.sestina.clear')" :aria-label="tl('writing.sestina.clear')"><Icon name="trash" :label="tl('writing.sestina.clear')" /></button>
        <button class="primary" :disabled="!text" @click="copyText" :title="copied ? tl('writing.sestina.copied') : tl('writing.sestina.copy')" :aria-label="copied ? tl('writing.sestina.copied') : tl('writing.sestina.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.sestina.copied') : tl('writing.sestina.copy')" />
        </button>
      </div>

      <SavedWorks kind="sestina" @open="apply" :data="state" :default-title="defaultTitle" :can-save="written" />
    </template>
  </section>
</template>

<style scoped>
.small { font-size: 0.85rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.spacer { flex: 1; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
.label { margin: 1rem 0 0.3rem; font-weight: 600; font-size: 0.9rem; }
input { width: 100%; box-sizing: border-box; }
h3 { font-size: 1rem; margin: 1.4rem 0 0.3rem; }
.linkish { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
.fold { margin: 0.5rem 0; }
.fold summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; }

/* six word colours */
.w0 { --w: #e0567a; }
.w1 { --w: #2b8fd6; }
.w2 { --w: #2f9e44; }
.w3 { --w: #e08a00; }
.w4 { --w: #7b61ff; }
.w5 { --w: #0f9e9e; }

/* steps */
.steps { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 1.25rem 0 0.75rem; }
.step-btn { gap: 0.4rem; padding: 0.35em 0.7em; font-size: 0.88rem; }
.step-btn.current { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-weight: 600; }
.step-no { display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 50%; background: var(--border); font-size: 0.75rem; font-weight: 700; }
.step-btn.done .step-no { background: var(--accent); color: #fff; }

/* grid */
.grid-wrap { margin: 0.75rem 0; }
.grid { border-collapse: separate; border-spacing: 3px; font: 600 0.9rem system-ui, sans-serif; }
.grid th { color: var(--muted); font-weight: 600; padding: 0 0.4rem; }
.grid td { width: 2rem; height: 1.8rem; text-align: center; border-radius: 5px; background: color-mix(in srgb, var(--w) 22%, transparent); color: var(--text); }
.grid td.envoi-cell { background: none; text-align: left; display: flex; gap: 0.9rem; }

/* words */
.advice { margin: 0.3rem 0 0.75rem; }
.words { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 0.6rem; }
.word { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.word input { flex: 1; min-width: 0; width: auto; border-left: 4px solid var(--w); }
.badge { display: inline-grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: color-mix(in srgb, var(--w) 25%, transparent); font: 700 0.78rem system-ui, sans-serif; }
.warn { color: var(--danger); width: 100%; }

/* lines */
.lines { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; counter-reset: ln; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) 9.5rem; gap: 0.5rem; align-items: start; }
.field input { font: 1.02rem/1.45 Georgia, 'Times New Roman', serif; }
.chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25em 0.65em; border-radius: 999px; font-size: 0.85rem; background: color-mix(in srgb, var(--w, var(--border)) 18%, transparent); border: 1px solid transparent; }
.chip.end { margin-top: 0.35rem; justify-content: flex-start; overflow: hidden; }
.chip.ok { border-color: var(--w, var(--accent)); font-weight: 600; }
.miss { margin: 0.2rem 0 0; color: var(--danger); }
.miss .linkish { margin-left: 0.4rem; }
.prev-line { margin: 0.2rem 0; font: 0.95rem/1.4 Georgia, 'Times New Roman', serif; color: var(--muted); }
.used { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }

/* poem */
.poem { font: 1.05rem/1.6 Georgia, 'Times New Roman', serif; }
.poem p { margin: 0; }
.poem__title { font-weight: 700; margin-bottom: 0.6rem !important; }
.stanza { margin-bottom: 0.9rem; }
.stanza.envoi { padding-left: 1.5rem; }
.poem mark { background: color-mix(in srgb, var(--w, transparent) 26%, transparent); color: inherit; border-radius: 3px; padding: 0 0.1em; }

.nav { margin-top: 1.1rem; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }

@media (max-width: 640px) {
  .step-name { display: none; }
  .step-btn.current .step-name { display: inline; }
  .words { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .line { grid-template-columns: 1fr; gap: 0.2rem; }
  .chip.end { margin-top: 0; justify-self: start; }
}
</style>
