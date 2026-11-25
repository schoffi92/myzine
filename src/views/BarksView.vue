<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import PremisePicker from '../components/PremisePicker.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import {
  TRIGGERS, PROMPTS, LIMITS, MAX_VARIANTS, START_VARIANTS, GOAL_TRIGGERS, GOAL_VARIANTS, blank, clean, promptText, hasBarks,
  filled, checkAll, goals, pick, rows, toCsv, toJson, fileBase, plainText,
} from '../composables/barks'

/*
 * Barks: write the short lines a game character says by itself (idle,
 * spotting the player, hurt, winning…), several per moment, within a length
 * limit and in one voice. Play-test them in a speech bubble, then download the
 * line table as CSV or JSON, the way game studios hand them over.
 */
const ID = 'barks' // IndexedDB drafts id

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const learnOpen = ref(true)

const generic = computed(() => t('writing.barks.generic') || [])
const issues = computed(() => checkAll(state, generic.value))
const goalList = computed(() => goals(state, t, generic.value))
const role = computed(() => promptText(state, t))
const written = computed(() => hasBarks(state))
const tableRows = computed(() => rows(state))
const defaultTitle = computed(() => [state.name.trim(), role.value].filter(Boolean).join(' · '))
const example = computed(() => t('writing.barks.example'))
const covered = computed(() => TRIGGERS.filter((k) => filled(state, k).length >= GOAL_VARIANTS).length)

/* ---- the table ---- */
function addVariant(k) {
  if (state.barks[k].length >= MAX_VARIANTS) return
  state.barks[k].push('')
  nextTick(() => document.getElementById(`bark-${k}-${state.barks[k].length - 1}`)?.focus())
}
function removeVariant(k, i) {
  state.barks[k].splice(i, 1)
  while (state.barks[k].length < START_VARIANTS) state.barks[k].push('')
}
/** Enter: the next line of the trigger (adding one if there's room), else the next trigger. */
function onKey(e, k, i) {
  if (e.key !== 'Enter' || e.isComposing) return
  e.preventDefault()
  if (i + 1 < state.barks[k].length) return document.getElementById(`bark-${k}-${i + 1}`)?.focus()
  if (state.barks[k][i].trim() && state.barks[k].length < MAX_VARIANTS) return addVariant(k)
  const next = TRIGGERS[TRIGGERS.indexOf(k) + 1]
  if (next) document.getElementById(`bark-${next}-0`)?.focus()
}

function loadExample() {
  if (hasBarks(state) && !confirm(t('writing.barks.confirmExample'))) return
  const ex = example.value
  Object.assign(state, clean({ name: ex.name, promptKey: ex.role, voice: ex.voice, limit: 60, barks: ex.barks }))
}

/* ---- play test ---- */
const bubble = ref(null) // { trigger, text }
const history = ref([]) // last lines heard: [{ trigger, text, again }]
const lastOf = {}
function play(k) {
  const text = pick(state, k, lastOf[k])
  if (!text) return
  lastOf[k] = text
  const again = history.value.some((h) => h.text === text)
  bubble.value = { trigger: k, text, key: Date.now() }
  history.value = [{ trigger: k, text, again }, ...history.value].slice(0, 8)
}
const clearHistory = () => {
  history.value = []
  bubble.value = null
}

/* ---- export ---- */
function download(kind) {
  const body = kind === 'csv' ? `﻿${toCsv(state)}` : toJson(state) // BOM: Excel reads the CSV as UTF-8
  const file = new Blob([body], { type: kind === 'csv' ? 'text/csv' : 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `${fileBase(state)}.${kind}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function copyText() {
  const head = [state.name.trim(), role.value].filter(Boolean).join(', ')
  const out = [head, state.voice.trim(), plainText(state, t)].filter(Boolean).join('\n\n')
  if (!(await copyToClipboard(out))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.barks.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  loaded.value = false // pause autosave while resetting
  Object.assign(state, blank())
  clearHistory()
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
  learnOpen.value = !hasBarks(state)
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
  <section class="container prose barks">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>💬 {{ t('writing.barks.title') }}</h1>
    <p class="lead">{{ t('writing.barks.intro') }}</p>
    <EarlierVersion :keys="['barks']" />

    <template v-if="loaded">
      <!-- ---- learn ---- -->
      <div class="panel learn">
        <h2>{{ t('writing.barks.learnTitle') }}</h2>
        <details :open="learnOpen">
          <summary>{{ t('writing.barks.whatTitle') }}</summary>
          <p v-for="p in t('writing.barks.whatText')" :key="p">{{ p }}</p>
          <p class="label">{{ t('writing.barks.rulesTitle') }}</p>
          <ul>
            <li v-for="r in t('writing.barks.rules')" :key="r">{{ r }}</li>
          </ul>
        </details>
        <details>
          <summary>{{ t('writing.barks.exampleTitle', { name: example.name }) }}</summary>
          <p class="muted">{{ example.voice }}</p>
          <dl class="example">
            <template v-for="k in TRIGGERS" :key="k">
              <template v-if="example.barks?.[k]?.length">
                <dt>{{ t(`writing.barks.triggers.${k}.name`) }}</dt>
                <dd><span v-for="(l, i) in example.barks[k]" :key="i" class="say">{{ l }}</span></dd>
              </template>
            </template>
          </dl>
          <button type="button" class="ghost" @click="loadExample">{{ t('writing.barks.loadExample') }}</button>
        </details>
      </div>

      <!-- ---- character ---- -->
      <div class="panel">
        <h2>{{ t('writing.barks.characterTitle') }}</h2>
        <label class="field-label" for="barks-name">{{ t('writing.barks.nameLabel') }}</label>
        <input id="barks-name" v-model="state.name" maxlength="40" autocomplete="off" :placeholder="t('writing.barks.namePlaceholder')" />
        <PremisePicker id="barks-role" base="writing.barks" :keys="PROMPTS" v-model:prompt-key="state.promptKey" v-model:own-prompt="state.ownPrompt" />
        <label class="field-label" for="barks-voice">{{ t('writing.barks.voiceLabel') }}</label>
        <p class="muted small help">{{ t('writing.barks.voiceHelp') }}</p>
        <input id="barks-voice" v-model="state.voice" maxlength="160" autocomplete="off" :placeholder="t('writing.barks.voicePlaceholder')" />
        <fieldset class="limits">
          <legend class="field-label">{{ t('writing.barks.limitLabel') }}</legend>
          <label v-for="n in LIMITS" :key="n" class="limit" :class="{ active: state.limit === n }">
            <input v-model="state.limit" type="radio" name="barks-limit" :value="n" />
            <strong>{{ n }}</strong> <span class="muted small">{{ t(`writing.barks.limits.l${n}`) }}</span>
          </label>
        </fieldset>
      </div>

      <!-- ---- the table ---- -->
      <div class="panel">
        <h2>{{ t('writing.barks.tableTitle') }}</h2>
        <p class="muted small help">{{ t('writing.barks.tableHelp', { triggers: GOAL_TRIGGERS, lines: GOAL_VARIANTS }) }}</p>
        <section v-for="k in TRIGGERS" :key="k" class="trigger">
          <h3>{{ t(`writing.barks.triggers.${k}.name`) }} <span class="muted small count" :class="{ ok: filled(state, k).length >= GOAL_VARIANTS }">{{ filled(state, k).length }}/{{ GOAL_VARIANTS }}</span></h3>
          <p class="muted small hint">{{ t(`writing.barks.triggers.${k}.hint`) }}</p>
          <ol class="variants">
            <li v-for="(v, i) in state.barks[k]" :key="i" class="variant">
              <div class="field">
                <div class="input-wrap">
                  <input
                    :id="`bark-${k}-${i}`"
                    v-model="state.barks[k][i]"
                    maxlength="200"
                    autocomplete="off"
                    :aria-label="t('writing.barks.lineLabel', { trigger: t(`writing.barks.triggers.${k}.name`), n: i + 1 })"
                    :placeholder="i === 0 ? t(`writing.barks.triggers.${k}.placeholder`) : ''"
                    @keydown="onKey($event, k, i)"
                  />
                  <span class="chars" :class="{ over: v.trim().length > state.limit }" aria-hidden="true">{{ v.trim().length }}/{{ state.limit }}</span>
                </div>
                <ul v-if="issues[`${k}:${i}`]" class="issues">
                  <li v-for="x in issues[`${k}:${i}`]" :key="x.key" :class="`i-${x.key}`">{{ t(`writing.barks.issues.${x.key}`, x.params) }}</li>
                </ul>
              </div>
              <button type="button" class="ghost remove" :title="tl('writing.barks.remove')" :aria-label="tl('writing.barks.remove')" @click="removeVariant(k, i)"><Icon name="x" /></button>
            </li>
          </ol>
          <button v-if="state.barks[k].length < MAX_VARIANTS" type="button" class="ghost add" @click="addVariant(k)">+ {{ t('writing.barks.addLine') }}</button>
        </section>
      </div>

      <!-- ---- play test ---- -->
      <div class="panel">
        <h2>{{ t('writing.barks.playTitle') }}</h2>
        <p class="muted small help">{{ t('writing.barks.playHelp') }}</p>
        <div class="events">
          <button v-for="k in TRIGGERS" :key="k" type="button" :disabled="!filled(state, k).length" @click="play(k)">{{ t(`writing.barks.triggers.${k}.event`) }}</button>
        </div>
        <div class="stage" aria-live="polite">
          <div v-if="bubble" :key="bubble.key" class="bubble">
            <span class="who">{{ state.name.trim() || t('writing.barks.namePlaceholder') }}</span>
            <span class="said">{{ bubble.text }}</span>
          </div>
          <p v-else class="muted small">{{ t('writing.barks.playEmpty') }}</p>
        </div>
        <template v-if="history.length">
          <p class="label">{{ t('writing.barks.heard') }} <button type="button" class="linkish small" @click="clearHistory">{{ t('writing.barks.clearHeard') }}</button></p>
          <ol class="heard">
            <li v-for="(h, i) in history" :key="i" :class="{ again: h.again }">
              <span class="muted small">{{ t(`writing.barks.triggers.${h.trigger}.name`) }}</span> {{ h.text }}
              <span v-if="h.again" class="again-tag small">{{ t('writing.barks.again') }}</span>
            </li>
          </ol>
        </template>
      </div>

      <!-- ---- goals and export ---- -->
      <div class="panel">
        <h2>{{ t('writing.barks.goalsTitle') }}</h2>
        <ul class="ticks" aria-live="polite">
          <li v-for="g in goalList" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.barks.goals.${g.key}`, { triggers: GOAL_TRIGGERS, lines: GOAL_VARIANTS, covered }) }}<span class="sr">{{ g.done ? ` (${t('writing.barks.done')})` : '' }}</span></li>
        </ul>
        <details class="fold">
          <summary>{{ t('writing.barks.selfReviewTitle') }}</summary>
          <ul><li v-for="q in t('writing.barks.selfReview')" :key="q">{{ q }}</li></ul>
        </details>

        <h3>{{ t('writing.barks.exportTitle') }}</h3>
        <p class="muted small help">{{ t('writing.barks.exportHelp') }}</p>
        <div class="table-wrap" v-if="tableRows.length">
          <table class="lines-table">
            <thead><tr><th>id</th><th>trigger</th><th>character</th><th>text</th><th>max_length</th></tr></thead>
            <tbody>
              <tr v-for="r in tableRows.slice(0, 6)" :key="r.id"><td><code>{{ r.id }}</code></td><td>{{ r.trigger }}</td><td>{{ r.character }}</td><td>{{ r.text }}</td><td>{{ r.max_length }}</td></tr>
              <tr v-if="tableRows.length > 6"><td colspan="5" class="muted small">{{ t('writing.barks.moreRows', { n: tableRows.length - 6 }) }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="row">
          <button type="button" :disabled="!tableRows.length" @click="download('csv')"><Icon name="download" /> CSV</button>
          <button type="button" :disabled="!tableRows.length" @click="download('json')"><Icon name="download" /> JSON</button>
        </div>
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.barks.clear')" :aria-label="tl('writing.barks.clear')"><Icon name="trash" :label="tl('writing.barks.clear')" /></button>
        <button class="primary" :disabled="!written" @click="copyText" :title="copied ? tl('writing.barks.copied') : tl('writing.barks.copy')" :aria-label="copied ? tl('writing.barks.copied') : tl('writing.barks.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.barks.copied') : tl('writing.barks.copy')" />
        </button>
      </div>

      <SavedWorks kind="barks" @open="apply" :data="state" :default-title="defaultTitle" :can-save="written" />
    </template>
  </section>
</template>

<style scoped>
.panel + .panel { margin-top: 1rem; }
.small { font-size: 0.85rem; }
.help { margin: 0 0 0.4rem; }
.row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.spacer { flex: 1; }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
.label { margin: 0.9rem 0 0.3rem; font-weight: 600; font-size: 0.9rem; }
input:not([type='radio']) { width: 100%; box-sizing: border-box; }
h3 { font-size: 1rem; margin: 1.3rem 0 0.2rem; }
.linkish { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; margin-left: 0.5rem; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.fold { margin-top: 0.6rem; }
.fold summary { cursor: pointer; font-weight: 600; font-size: 0.92rem; }

/* learn */
.learn details { border-top: 1px solid var(--border); padding: 0.6rem 0; }
.learn details:last-child { padding-bottom: 0; }
.learn summary { cursor: pointer; font-weight: 600; }
.learn p { margin: 0.6rem 0; }
.example { display: grid; grid-template-columns: max-content 1fr; gap: 0.4rem 1rem; margin: 0.5rem 0 0.75rem; font-size: 0.92rem; }
.example dt { font-weight: 600; }
.example dd { margin: 0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.say { padding: 0.15em 0.6em; border-radius: 10px 10px 10px 2px; background: color-mix(in srgb, var(--accent) 9%, transparent); }

/* limits */
.limits { border: 0; padding: 0; margin: 0; }
.limits legend { padding: 0; }
.limit { display: inline-flex; align-items: baseline; gap: 0.35rem; margin: 0 0.4rem 0.4rem 0; padding: 0.35rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.limit.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }

/* table */
.trigger + .trigger { border-top: 1px solid var(--border); margin-top: 0.9rem; }
.trigger h3 { display: flex; align-items: baseline; gap: 0.5rem; }
.count { font-weight: 600; }
.count.ok { color: var(--accent); }
.hint { margin: 0 0 0.4rem; }
.variants { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.variant { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.4rem; align-items: start; }
.input-wrap { position: relative; }
.input-wrap input { padding-right: 4.2rem; }
.chars { position: absolute; right: 0.6rem; top: 50%; transform: translateY(-50%); font: 0.75rem system-ui, sans-serif; color: var(--muted); font-variant-numeric: tabular-nums; pointer-events: none; }
.chars.over { color: var(--danger); font-weight: 700; }
.issues { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.85rem; }
.issues li { padding: 0.15rem 0.55rem; border-radius: 6px; background: color-mix(in srgb, #e0a100 14%, transparent); }
.issues li.i-long, .issues li.i-dup { background: color-mix(in srgb, var(--danger) 11%, transparent); }
.remove { padding: 0.35em; color: var(--muted); }
.add { margin-top: 0.3rem; padding-left: 0; }

/* play test */
.events { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.stage { margin-top: 0.9rem; min-height: 5.5rem; padding: 1rem; border-radius: 10px; background: color-mix(in srgb, var(--text) 6%, var(--surface)); display: flex; align-items: center; }
.bubble { position: relative; max-width: 28rem; padding: 0.6rem 0.9rem; border-radius: 14px 14px 14px 3px; background: var(--surface); border: 2px solid var(--text); animation: pop 0.18s ease-out; }
.bubble .who { display: block; font: 700 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.bubble .said { font-size: 1.05rem; }
@keyframes pop { from { transform: scale(0.85); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .bubble { animation: none; } }
.heard { margin: 0; padding-left: 1.4rem; font-size: 0.92rem; }
.heard li.again { color: var(--danger); }
.again-tag { margin-left: 0.4rem; font-weight: 600; }

/* goals and export */
.ticks { list-style: none; padding: 0; margin: 0.3rem 0; }
.ticks li { margin: 0.15rem 0; color: var(--muted); }
.ticks li.ok { color: inherit; }
.ticks li span:first-child { display: inline-block; width: 1.2rem; color: var(--accent); font-weight: 700; }
.table-wrap { overflow-x: auto; margin: 0.5rem 0 0.75rem; }
.lines-table { border-collapse: collapse; font-size: 0.82rem; width: 100%; }
.lines-table th, .lines-table td { border: 1px solid var(--border); padding: 0.25rem 0.45rem; text-align: left; vertical-align: top; }
.lines-table th { font: 600 0.75rem ui-monospace, Consolas, monospace; color: var(--muted); }
.lines-table code { font: 0.78rem ui-monospace, Consolas, monospace; }

.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }

@media (max-width: 640px) {
  .example { grid-template-columns: 1fr; gap: 0.1rem; }
  .example dd { margin-bottom: 0.5rem; }
}
</style>
