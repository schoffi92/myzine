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
import DramaPreview from '../components/DramaPreview.vue'
import RhythmRow from '../components/RhythmRow.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { liveKeys } from '../writing/meter'
import {
  KINDS, GENRES, RANKS, PROMPTS, MAX_CAST, RHYTHM, FEET, PARTS, OWN, LAST_GUIDED, OWN_GOALS, UNLOCK, NEXT,
  newBlock, newMember, blankScene, cleanScene, promptText, hasScene, facts, hintsFor, kindsFor, cuesFor,
  coupletRhymes, namesIn, fitMarks, scenePlainText,
} from '../composables/drama'

/*
 * Shakespearean drama: a writing guide in small parts (as in Game dialogue).
 * Each part teaches one thing about a scene of a Shakespeare play, gives one
 * task and unlocks the next tools; part 8 is a whole scene of the writer's
 * own. The scene is written block by block; every verse line gets the
 * rhythm row of the Iamb and trochee practice (iambic pentameter).
 */
const ID = 'drama' // IndexedDB drafts id
const blank = () => ({ part: 0, practice: blankScene(), own: blankScene() })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const editCounts = ref(false)
const activeId = ref(null)

const locale = computed(() => settings.locale)
const isOwn = computed(() => state.part === OWN)
const scene = computed(() => (isOwn.value ? state.own : state.practice))
const practiceFacts = computed(() => facts(state.practice, locale.value))
const ownFacts = computed(() => facts(state.own, locale.value))
const f = computed(() => (isOwn.value ? ownFacts.value : practiceFacts.value))
const hints = computed(() => hintsFor(f.value.hints, state.part))

const parts = computed(() => t('writing.drama.parts') || [])
const part = computed(() => parts.value[state.part] || {})
const partDone = computed(() => PARTS.map((p) => (p.id === OWN ? p.done(state.own, ownFacts.value, t) : p.done(state.practice, practiceFacts.value, t))))
const goals = computed(() => OWN_GOALS.map((g) => ({ key: g.key, done: g.done(ownFacts.value, state.own, t) })))
const unlocked = (what) => state.part >= UNLOCK[what]
const kinds = computed(() => kindsFor(state.part))
const cues = computed(() => cuesFor(state.part))
const allWords = computed(() => {
  const seen = new Set()
  return parts.value.flatMap((p) => p.words || []).filter((w) => !seen.has(w.term) && seen.add(w.term))
})
const example = computed(() => t('writing.drama.example'))
const premise = computed(() => promptText(scene.value, t))
const defaultTitle = computed(() => state.own.title.trim() || state.practice.title.trim() || promptText(hasScene(state.own) ? state.own : state.practice, t))
const hasWriting = computed(() => hasScene(state.practice) || hasScene(state.own))
const castNames = computed(() => scene.value.cast.map((c) => c.name.trim()).filter(Boolean))
const stats = computed(() => t('writing.drama.stats', { speeches: f.value.speeches, verse: f.value.verseLines, ok: f.value.verseOk, prose: f.value.proseSpeeches }))

function goPart(i) {
  state.part = Math.max(0, Math.min(OWN, i))
  nextTick(() => document.getElementById('drama-part')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/* ---- cast ---- */
function addMember() {
  if (scene.value.cast.length >= MAX_CAST) return
  const m = newMember()
  scene.value.cast.push(m)
  nextTick(() => document.getElementById(`cast-${m.id}`)?.focus())
}
const removeMember = (i) => scene.value.cast.splice(i, 1)
const memberOf = (name) => scene.value.cast.find((c) => c.name.trim().toLocaleLowerCase() === (name || '').trim().toLocaleLowerCase())

/* ---- block editor ---- */
const fields = new Map() // block id → input / textarea
const setField = (id, el) => (el ? fields.set(id, el) : fields.delete(id))
const blocks = () => scene.value.blocks
const indexOf = (id) => blocks().findIndex((b) => b.id === id)

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
  const at = atEnd ? el.value.length : 0
  el.setSelectionRange(at, at)
  el.scrollIntoView({ block: 'nearest' })
}

function insertAt(i, kind, text = '') {
  const b = newBlock(kind, text)
  blocks().splice(i, 0, b)
  return b
}

/** The kind a speech goes on in: verse for those who speak verse (once verse is unlocked), else prose. */
function speechKind(speakerText) {
  if (!kinds.value.includes('verse')) return 'prose'
  return memberOf(speakerText)?.rank === 'low' ? 'prose' : 'verse'
}
function add(kind) {
  const b = insertAt(blocks().length, kind)
  if (kind === 'speaker') insertAt(blocks().length, speechKind(''))
  focusBlock(b.id)
}

function removeBlock(i) {
  if (blocks().length === 1) {
    blocks()[0].text = ''
    return focusBlock(blocks()[0].id)
  }
  blocks().splice(i, 1)
  focusBlock(blocks()[Math.max(0, i - 1)].id)
}

/** Change a block's kind and keep writing in it (the field may be swapped: input ↔ textarea). */
function setKind(b, kind) {
  b.kind = kind
  if (kind === 'verse') {
    b.marks ||= {}
    b.counts ||= {}
  }
  focusBlock(b.id)
}
function cycle(b, dir) {
  const list = kinds.value
  setKind(b, list[(list.indexOf(b.kind) + dir + list.length) % list.length])
}

/**
 * Enter: the next block (what follows this kind), splitting the text at the caret.
 * Enter in an empty line starts a new speech; in an empty speaker, a direction.
 * Shift+Enter: a new line in prose. Tab / Shift+Tab in an empty block: change its kind.
 * Backspace in an empty block: delete it.
 */
function onKey(e, b) {
  const i = indexOf(b.id)
  if (e.key === 'Enter' && !e.isComposing) {
    if (e.shiftKey && b.kind === 'prose') return
    e.preventDefault()
    if (!b.text.trim()) {
      const to = b.kind === 'speaker' ? 'direction' : 'speaker'
      if (b.kind !== to && kinds.value.includes(to)) setKind(b, to)
      return
    }
    const pos = e.target.selectionStart ?? b.text.length
    const rest = b.text.slice(pos).trimStart()
    b.text = b.text.slice(0, pos).trimEnd()
    let next = NEXT[b.kind]
    if (b.kind === 'speaker') next = speechKind(b.text)
    else if (b.kind === 'verse') next = 'verse'
    if (!kinds.value.includes(next)) next = 'prose'
    const nb = insertAt(i + 1, next, rest)
    focusBlock(nb.id, false)
  } else if (e.key === 'Tab' && !b.text) {
    e.preventDefault()
    cycle(b, e.shiftKey ? -1 : 1)
  } else if (e.key === 'Backspace' && !b.text && blocks().length > 1) {
    e.preventDefault()
    removeBlock(i)
  }
}

/* ---- direction and speaker chips ---- */
const cueWord = (c) => t(`writing.drama.cueWords.${c}`)
function chipCue(b, c) {
  if (c === 'aside') b.text = cueWord('aside')
  else {
    // swap a cue word already at the start for the new one
    const words = ['enter', 'exit', 'exeunt'].map(cueWord)
    const rest = words.reduce((s, w) => (s.toLocaleLowerCase().startsWith(w.toLocaleLowerCase()) ? s.slice(w.length) : s), b.text.trim()).trim()
    b.text = `${cueWord(c)}${c === 'exeunt' && !rest ? '.' : ' '}${rest}`
  }
  focusBlock(b.id)
}
function chipName(b, name) {
  if (b.kind === 'speaker') b.text = name
  else {
    const has = namesIn(b.text, scene.value.cast).length > 0
    const text = b.text.replace(/[\s.]+$/, '')
    b.text = `${text}${has ? ` ${t('writing.drama.and')}` : ''} ${name.toLocaleUpperCase()}`.trimStart()
  }
  focusBlock(b.id)
}

/* ---- verse: rhythm marks and syllable counts, kept per block ---- */
function setMark(b, key, value) {
  if (value === null) delete b.marks[key]
  else b.marks[key] = value
}
function setCount(b, key, value) {
  if (value === null) delete b.counts[key]
  else b.counts[key] = value
}
/** Drop marks and counts of words that were edited away, so they can't reappear on a new word later. */
function prune(b) {
  if (b.kind !== 'verse') return
  const live = liveKeys(b.text, locale.value, b.counts)
  for (const k of Object.keys(b.counts)) if (!live.counts.has(k)) delete b.counts[k]
  for (const k of Object.keys(b.marks)) if (!live.marks.has(k)) delete b.marks[k]
}
const checkOf = (b) => f.value.checks[b.id]

/* ---- show me how, example, own scene ---- */
function showMe() {
  const snippet = part.value.snippet
  if (!snippet?.length) return
  let at = activeId.value ? indexOf(activeId.value) + 1 : 0
  if (at <= 0) at = blocks().length
  // drop a lone empty block the scene starts with
  if (blocks().length === 1 && !blocks()[0].text.trim()) {
    blocks().splice(0, 1)
    at = 0
  }
  const added = snippet.map(([kind, text], k) => insertAt(at + k, kind, text))
  const first = added.find((b) => !b.text.trim() || b.text.endsWith(' ')) || added[0]
  focusBlock(first.id)
}

function sceneFromExample(ex) {
  return cleanScene({
    title: ex.title,
    ownPrompt: ex.prompt,
    genre: ex.genre,
    cast: ex.cast.map(([name, desc, rank]) => newMember(name, desc, rank)),
    blocks: ex.blocks.map(([kind, text]) => fitMarks(newBlock(kind, text), locale.value)),
  })
}

function loadExample() {
  if (hasScene(state.practice) && !confirm(t('writing.drama.confirmExample'))) return
  Object.assign(state.practice, sceneFromExample(example.value))
  if (state.part === 0) state.part = 1
}

function continuePractice() {
  if (hasScene(state.own) && !confirm(t('writing.drama.confirmContinue'))) return
  Object.assign(state.own, cleanScene(JSON.parse(JSON.stringify(state.practice))))
}

/* ---- copy, start over ---- */
async function copyText() {
  if (!(await copyToClipboard(scenePlainText(scene.value, t, locale.value)))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.drama.confirmClear'))) return
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
    part: Number.isInteger(saved?.part) && saved.part >= 0 && saved.part <= OWN ? saved.part : 0,
    practice: cleanScene(saved?.practice),
    own: cleanScene(saved?.own),
  })
}

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
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
  <section class="container prose drama">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>🎭 {{ t('writing.drama.title') }}</h1>
    <p class="lead">{{ t('writing.drama.intro') }}</p>
    <EarlierVersion :keys="['drama']" />

    <template v-if="loaded">
      <!-- ---- the parts of the guide ---- -->
      <nav class="parts" :aria-label="t('writing.drama.partsLabel')">
        <button
          v-for="(p, i) in parts"
          :key="i"
          type="button"
          class="part-btn"
          :class="{ current: state.part === i, done: partDone[i], own: i === OWN }"
          :aria-current="state.part === i ? 'step' : undefined"
          :aria-label="`${i}. ${p.title}${partDone[i] ? ` (${t('writing.drama.done')})` : ''}`"
          @click="goPart(i)"
        >
          <span class="part-no" aria-hidden="true">{{ partDone[i] ? '✓' : i }}</span>
          <span class="part-name">{{ p.short }}</span>
        </button>
      </nav>

      <article id="drama-part" class="panel part-card">
        <p class="eyebrow">{{ t('writing.drama.partN', { n: state.part, total: OWN }) }}<span v-if="partDone[state.part]" class="badge">✓ {{ t('writing.drama.done') }}</span></p>
        <h2>{{ part.title }}</h2>
        <p v-for="p in part.idea" :key="p">{{ p }}</p>

        <figure v-if="part.quote" class="quote">
          <figcaption class="label">{{ t('writing.drama.quoteLabel') }}</figcaption>
          <blockquote lang="en"><p v-for="l in part.quote.lines" :key="l">{{ l }}</p></blockquote>
          <p class="muted small source">{{ part.quote.source }}</p>
        </figure>

        <!-- part 0 and part 8: premise, kind of play, title -->
        <template v-if="state.part === 0 || isOwn">
          <PremisePicker :id="isOwn ? 'drama-own-premise' : 'drama-premise'" base="writing.drama" :keys="PROMPTS" v-model:prompt-key="scene.promptKey" v-model:own-prompt="scene.ownPrompt" />
          <fieldset class="genres">
            <legend class="field-label">{{ t('writing.drama.genreLabel') }}</legend>
            <label v-for="g in GENRES" :key="g" class="genre" :class="{ active: scene.genre === g }">
              <input v-model="scene.genre" type="radio" :name="isOwn ? 'drama-own-genre' : 'drama-genre'" :value="g" />
              <strong>{{ t(`writing.drama.genres.${g}`) }}</strong>
              <span class="muted small">{{ t(`writing.drama.genreHelp.${g}`) }}</span>
            </label>
          </fieldset>
          <label class="field-label" :for="isOwn ? 'drama-own-title' : 'drama-title'">{{ t('writing.drama.titleLabel') }}</label>
          <input :id="isOwn ? 'drama-own-title' : 'drama-title'" v-model="scene.title" maxlength="160" autocomplete="off" :placeholder="t('writing.drama.titlePlaceholder')" />
          <template v-if="state.part === 0">
            <p class="muted small example-note">{{ t('writing.drama.exampleNote') }} <button type="button" class="linkish" @click="loadExample">{{ t('writing.drama.loadExample') }}</button></p>
            <details class="fold">
              <summary>{{ t('writing.drama.structureTitle') }}</summary>
              <p>{{ t('writing.drama.structureIntro') }}</p>
              <dl class="glossary acts">
                <template v-for="a in t('writing.drama.acts')" :key="a.name"><dt>{{ a.name }}</dt><dd>{{ a.text }}</dd></template>
              </dl>
            </details>
          </template>
        </template>

        <!-- part 1 and part 8: the cast -->
        <template v-if="state.part === 1 || isOwn">
          <template v-if="state.part === 1">
            <p class="label">{{ t('writing.drama.exampleLabel') }}</p>
            <DramaPreview :cast="part.example?.cast || []" :locale="locale" />
            <div class="task">
              <p class="label">{{ t('writing.drama.taskLabel') }}</p>
              <p>{{ part.task }}</p>
            </div>
          </template>
          <h3>{{ t('writing.drama.personae') }}</h3>
          <ol class="cast">
            <li v-for="(c, i) in scene.cast" :key="c.id" class="member">
              <input :id="`cast-${c.id}`" v-model="c.name" class="m-name" maxlength="40" autocomplete="off" :aria-label="`${t('writing.drama.memberN', { n: i + 1 })}: ${t('writing.drama.castName')}`" :placeholder="t('writing.drama.castNamePlaceholder')" />
              <input v-model="c.desc" class="m-desc" maxlength="120" autocomplete="off" :aria-label="`${t('writing.drama.memberN', { n: i + 1 })}: ${t('writing.drama.castDesc')}`" :placeholder="t('writing.drama.castDescPlaceholder')" />
              <select v-model="c.rank" class="m-rank" :aria-label="`${t('writing.drama.memberN', { n: i + 1 })}: ${t('writing.drama.castRank')}`">
                <option v-for="r in RANKS" :key="r" :value="r">{{ t('writing.drama.castRank') }}: {{ t(`writing.drama.ranks.${r}`) }}</option>
              </select>
              <button type="button" class="ghost remove" :title="t('writing.drama.removeMember', { name: c.name || i + 1 })" :aria-label="t('writing.drama.removeMember', { name: c.name || i + 1 })" @click="removeMember(i)"><Icon name="x" /></button>
            </li>
          </ol>
          <button type="button" class="ghost" :disabled="scene.cast.length >= MAX_CAST" @click="addMember">+ {{ t('writing.drama.addMember') }}</button>
          <p v-if="state.part === 1" class="label">{{ t('writing.drama.doneWhenLabel') }}</p>
          <ul v-if="state.part === 1" class="ticks">
            <li v-for="d in part.doneWhen" :key="d" :class="{ ok: partDone[1] }"><span aria-hidden="true">{{ partDone[1] ? '✓' : '○' }}</span> {{ d }}</li>
          </ul>
        </template>

        <!-- part 8: start, goals, self-review -->
        <template v-if="isOwn">
          <div v-if="!hasScene(state.own)" class="row wrap start-choice">
            <button type="button" @click="focusBlock(state.own.blocks[0].id)">{{ t('writing.drama.blankStart') }}</button>
            <button v-if="hasScene(state.practice)" type="button" @click="continuePractice">{{ t('writing.drama.continuePractice') }}</button>
          </div>
          <h3>{{ t('writing.drama.goalsTitle') }}</h3>
          <ul class="ticks">
            <li v-for="g in goals" :key="g.key" :class="{ ok: g.done }"><span aria-hidden="true">{{ g.done ? '✓' : '○' }}</span> {{ t(`writing.drama.ownGoals.${g.key}`) }}<span class="sr">{{ g.done ? ` (${t('writing.drama.done')})` : '' }}</span></li>
          </ul>
          <details class="fold">
            <summary>{{ t('writing.drama.selfReviewTitle') }}</summary>
            <ul><li v-for="q in t('writing.drama.selfReview')" :key="q">{{ q }}</li></ul>
          </details>
          <details v-if="hasScene(state.practice)" class="fold">
            <summary>{{ t('writing.drama.practiceFold') }}</summary>
            <DramaPreview :blocks="state.practice.blocks" :cast="state.practice.cast" :locale="locale" />
          </details>
        </template>

        <!-- parts 2–7: example, task, done when, words -->
        <template v-if="state.part >= 2 && !isOwn">
          <p class="label">{{ t('writing.drama.exampleLabel') }}</p>
          <DramaPreview :blocks="part.example?.blocks || []" :locale="locale" />
          <div class="task">
            <p class="label">{{ t('writing.drama.taskLabel') }}</p>
            <p>{{ part.task }}</p>
            <button v-if="part.snippet" type="button" class="ghost show-me" @click="showMe">💡 {{ t('writing.drama.showMe') }}</button>
          </div>
          <p class="label">{{ t('writing.drama.doneWhenLabel') }}</p>
          <ul class="ticks">
            <li v-for="d in part.doneWhen" :key="d" :class="{ ok: partDone[state.part] }"><span aria-hidden="true">{{ partDone[state.part] ? '✓' : '○' }}</span> {{ d }}</li>
          </ul>
          <p v-if="state.part === LAST_GUIDED && f.couplet" class="small couplet" :class="{ ok: coupletRhymes(f) }">
            {{ t('writing.drama.coupletLabel') }}: “{{ f.couplet.a.trim() }}” / “{{ f.couplet.b.trim() }}”: <strong>{{ t(`writing.drama.coupletStatus.${f.couplet.status}`) }}</strong>
          </p>
          <details v-if="part.words?.length" class="fold">
            <summary>{{ t('writing.drama.wordsLabel') }}</summary>
            <dl class="glossary">
              <template v-for="w in part.words" :key="w.term"><dt>{{ w.term }}</dt><dd>{{ w.def }}</dd></template>
            </dl>
          </details>
          <details v-if="state.part === LAST_GUIDED" class="fold">
            <summary>{{ t('writing.drama.compareExample') }}</summary>
            <DramaPreview :blocks="example.blocks" :cast="example.cast" :locale="locale" />
          </details>
        </template>

        <div class="row part-nav">
          <button type="button" class="ghost" :disabled="state.part === 0" @click="goPart(state.part - 1)">← {{ t('writing.drama.prevPart') }}</button>
          <span class="spacer" />
          <button v-if="state.part < OWN" type="button" :class="partDone[state.part] ? 'primary' : 'ghost'" @click="goPart(state.part + 1)">{{ t('writing.drama.nextPart') }} →</button>
        </div>
      </article>

      <!-- ---- the scene, block by block ---- -->
      <div v-if="unlocked('editor')" class="panel">
        <h2>{{ isOwn ? t('writing.drama.ownEditorTitle') : t('writing.drama.editorTitle') }}</h2>
        <p v-if="premise" class="muted small premise-line">{{ premise }}</p>
        <p class="muted small keys">{{ t('writing.drama.keysHelp') }}</p>
        <template v-if="unlocked('meter')">
          <p class="muted small keys">{{ t('writing.drama.meterHelp') }}</p>
          <label class="small check-row"><input v-model="editCounts" type="checkbox" /> {{ t('writing.drama.fixCounts') }}</label>
        </template>

        <datalist id="drama-names">
          <option v-for="n in castNames" :key="n" :value="n" />
        </datalist>
        <ol class="els">
          <li v-for="(b, i) in scene.blocks" :key="b.id" class="el" :class="[`el-${b.kind}`, { active: activeId === b.id }]">
            <select v-model="b.kind" class="kind" :aria-label="t('writing.drama.kindLabel', { n: i + 1 })" @change="setKind(b, b.kind)">
              <option v-for="k in KINDS.filter((k) => kinds.includes(k) || k === b.kind)" :key="k" :value="k">{{ t(`writing.drama.kinds.${k}`) }}</option>
            </select>
            <div class="field">
              <textarea
                v-if="b.kind === 'prose'"
                :ref="(el) => setField(b.id, el)"
                v-model="b.text"
                rows="1"
                :placeholder="t(`writing.drama.placeholders.${b.kind}`)"
                :aria-label="t(`writing.drama.kinds.${b.kind}`)"
                @keydown="onKey($event, b)"
                @input="grow($event.target)"
                @focus="activeId = b.id"
              />
              <input
                v-else
                :ref="(el) => setField(b.id, el)"
                v-model="b.text"
                autocomplete="off"
                :list="b.kind === 'speaker' ? 'drama-names' : undefined"
                :placeholder="t(`writing.drama.placeholders.${b.kind}`)"
                :aria-label="t(`writing.drama.kinds.${b.kind}`)"
                @keydown="onKey($event, b)"
                @input="prune(b)"
                @focus="activeId = b.id"
              />
              <div v-if="activeId === b.id && (b.kind === 'direction' || b.kind === 'speaker') && (castNames.length || b.kind === 'direction')" class="chips">
                <template v-if="b.kind === 'direction'">
                  <button v-for="c in cues" :key="c" type="button" class="chip cue" @mousedown.prevent @click="chipCue(b, c)">{{ cueWord(c) }}</button>
                </template>
                <button v-for="n in castNames" :key="n" type="button" class="chip" @mousedown.prevent @click="chipName(b, n)">{{ b.kind === 'direction' ? n.toLocaleUpperCase() : n }}</button>
              </div>
              <template v-if="b.kind === 'verse' && unlocked('meter') && b.text.trim()">
                <RhythmRow
                  :text="b.text"
                  :locale="locale"
                  :rhythm="RHYTHM"
                  :feet="FEET"
                  :marks="b.marks"
                  :counts="b.counts"
                  :edit-counts="editCounts"
                  :check="checkOf(b)?.shared ? checkOf(b).check : null"
                  :offset="checkOf(b)?.offset || 0"
                  @mark="(k, v) => setMark(b, k, v)"
                  @count="(k, v) => setCount(b, k, v)"
                />
                <p v-if="checkOf(b)?.shared" class="muted small shared">↔ {{ t(checkOf(b).shared === 'first' ? 'writing.drama.sharedFirst' : 'writing.drama.sharedSecond') }}</p>
              </template>
              <p v-if="activeId === b.id && b.kind === 'speaker' && b.text.trim() && memberOf(b.text)" class="muted small rank-note">{{ t('writing.drama.castRank') }}: {{ t(`writing.drama.ranks.${memberOf(b.text).rank}`) }}</p>
            </div>
            <button type="button" class="ghost remove" :title="tl('writing.drama.remove')" :aria-label="tl('writing.drama.remove')" @click="removeBlock(i)"><Icon name="x" /></button>
          </li>
        </ol>
        <div class="row wrap adds">
          <button type="button" @click="add('heading')">+ {{ t('writing.drama.kinds.heading') }}</button>
          <button type="button" @click="add('location')">+ {{ t('writing.drama.kinds.location') }}</button>
          <button type="button" @click="add('direction')">+ {{ t('writing.drama.kinds.direction') }}</button>
          <button type="button" @click="add('speaker')">+ {{ t('writing.drama.addSpeech') }}</button>
        </div>
      </div>

      <!-- ---- the scene as printed, and notes ---- -->
      <div v-if="unlocked('editor')" class="panel">
        <h2>{{ t('writing.drama.previewTitle') }}</h2>
        <p class="counter" aria-live="polite">{{ stats }}</p>
        <div v-if="hasScene(scene)" class="hints" aria-live="polite">
          <p class="label">{{ t('writing.drama.hintsTitle') }}</p>
          <p v-if="!hints.length" class="muted small">{{ t('writing.drama.noHints') }}</p>
          <ul v-else>
            <li v-for="(h, i) in hints" :key="i" :class="`lv-${h.level}`">
              <span class="lv">{{ t(`writing.drama.levels.${h.level}`) }}</span>
              {{ t(`writing.drama.hints.${h.key}`, h.params) }}
              <button v-if="h.blockId" type="button" class="linkish go" @click="focusBlock(h.blockId)">{{ t('writing.drama.goTo') }}</button>
            </li>
          </ul>
        </div>
        <DramaPreview :blocks="scene.blocks" :cast="scene.cast" :locale="locale" :empty="t('writing.drama.previewEmpty')" />
      </div>

      <div class="step-nav">
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.drama.clear')" :aria-label="tl('writing.drama.clear')"><Icon name="trash" :label="tl('writing.drama.clear')" /></button>
        <button class="primary" :disabled="!hasScene(scene)" @click="copyText" :title="copied ? tl('writing.drama.copied') : tl('writing.drama.copy')" :aria-label="copied ? tl('writing.drama.copied') : tl('writing.drama.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.drama.copied') : tl('writing.drama.copy')" />
        </button>
      </div>

      <SavedWorks kind="drama" @open="apply" :data="state" :default-title="defaultTitle" :can-save="hasWriting" />

      <details class="panel all-words">
        <summary>{{ t('writing.drama.allWords') }}</summary>
        <dl class="glossary">
          <template v-for="w in allWords" :key="w.term"><dt>{{ w.term }}</dt><dd>{{ w.def }}</dd></template>
        </dl>
      </details>
      <details class="panel all-words">
        <summary>{{ t('writing.drama.structureTitle') }}</summary>
        <p>{{ t('writing.drama.structureIntro') }}</p>
        <dl class="glossary acts">
          <template v-for="a in t('writing.drama.acts')" :key="a.name"><dt>{{ a.name }}</dt><dd>{{ a.text }}</dd></template>
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
input:not([type='radio']):not([type='checkbox']), textarea { width: 100%; box-sizing: border-box; }
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
.label { margin: 0.9rem 0 0.3rem; font-weight: 600; font-size: 0.9rem; }
.quote { margin: 0.9rem 0 0; }
.quote blockquote { margin: 0; padding: 0.2rem 0 0.2rem 1rem; border-left: 3px solid var(--border); font: italic 1.02rem/1.5 Georgia, 'Times New Roman', serif; }
.quote blockquote p { margin: 0; }
.source { margin: 0.2rem 0 0 1rem; }
.task { margin-top: 0.8rem; padding: 0.5rem 0.9rem 0.7rem; border-left: 4px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); border-radius: 0 8px 8px 0; }
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
.couplet { margin: 0.5rem 0 0; color: var(--muted); }
.couplet.ok { color: inherit; }

/* kind of play */
.genres { border: 0; padding: 0; margin: 0.5rem 0 0; }
.genres legend { padding: 0; }
.genre { display: inline-flex; align-items: baseline; gap: 0.4rem; margin: 0 0.5rem 0.4rem 0; padding: 0.4rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.genre.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }

/* cast */
.cast { list-style: none; margin: 0 0 0.5rem; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.member { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) auto auto; gap: 0.4rem; align-items: center; }
.m-rank { font-size: 0.85rem; }

/* block editor */
.premise-line { margin: -0.2rem 0 0.6rem; font-style: italic; }
.keys { margin: 0 0 0.5rem; }
.check-row { display: inline-flex; gap: 0.4rem; align-items: center; margin-bottom: 0.75rem; }
.els { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.el { display: grid; grid-template-columns: 8.5rem minmax(0, 1fr) auto; gap: 0.4rem; align-items: start; }
.kind { font-size: 0.8rem; padding: 0.4em; color: var(--muted); }
.el.active .kind { color: inherit; border-color: var(--accent); }
.field input, .field textarea { font: 1rem/1.45 Georgia, 'Times New Roman', serif; resize: none; overflow: hidden; }
.el-heading .field input { text-align: center; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; }
.el-location .field input { text-align: center; font-style: italic; }
.el-direction .field { padding-left: 12%; }
.el-direction .field input { font-style: italic; }
.el-speaker .field input { font-variant: small-caps; font-weight: 600; letter-spacing: 0.04em; }
.el-verse .field, .el-prose .field { padding-left: 6%; }
.remove { padding: 0.35em; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.3rem; }
.chip { font-size: 0.78rem; padding: 0.2em 0.6em; border-radius: 999px; }
.chip.cue { font-style: italic; }
.shared, .rank-note { margin: 0.15rem 0 0; }
.adds { margin-top: 0.75rem; }

/* preview */
.counter { margin: 0 0 0.6rem; font-size: 0.92rem; }
.hints { margin: 0 0 1rem; }
.hints .label { margin-top: 0; }
.hints ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.hints li { padding: 0.25rem 0.5rem; border-radius: 6px; }
.lv-error { background: color-mix(in srgb, var(--danger) 10%, transparent); }
.lv-warn { background: color-mix(in srgb, #e0a100 12%, transparent); }
.lv-info { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.lv { font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 0.4rem; color: var(--muted); }
.go { margin-left: 0.4rem; font-size: 0.85rem; }

.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.all-words { margin-top: 1.5rem; }
.all-words + .all-words { margin-top: 0.75rem; }
.all-words summary { cursor: pointer; font-weight: 600; }

@media (max-width: 640px) {
  .part-name { display: none; }
  .part-btn.current .part-name { display: inline; }
  .glossary { grid-template-columns: 1fr; gap: 0.1rem; }
  .glossary dd { margin-bottom: 0.4rem; }
  .member { grid-template-columns: minmax(0, 1fr) auto; }
  .m-desc, .m-rank { grid-column: 1 / 2; }
  .el { grid-template-columns: minmax(0, 1fr) auto; }
  .kind { grid-column: 1 / -1; justify-self: start; }
  .el-direction .field { padding-left: 6%; }
  .el-verse .field, .el-prose .field { padding-left: 0; }
}
</style>
