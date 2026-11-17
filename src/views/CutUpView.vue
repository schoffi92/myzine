<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { t } from '../i18n'
import { loadDraft, saveDraft, loadDraftData, saveDraftData } from '../db/drafts'
import { drawCards, CARD_BY_ID } from '../tarot/deck'
import { cardText } from '../tarot'
import TarotHelper from '../components/TarotHelper.vue'
import TimerPanel from '../components/TimerPanel.vue'

// IndexedDB ids (drafts store) for this practice
const TEXT_ID = 'cutup-text'
const CARDS_ID = 'cutup-cards'
const ARRANGE_ID = 'cutup-arrange'

const step = ref(1)

/* ================= Step 1: write ================= */
const text = ref('')
const loaded = ref(false)
let textTimer = null

const wordCount = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0))

function onInput() {
  clearTimeout(textTimer)
  textTimer = setTimeout(() => {
    textTimer = null
    saveDraft(TEXT_ID, text.value)
  }, 400)
}

async function flushText() {
  if (!textTimer) return
  clearTimeout(textTimer)
  textTimer = null
  await saveDraft(TEXT_ID, text.value)
}

/* ================= Step 2: arrange ================= */
// arrangement = { sourceText, cardsKey, tiles: [{ id, text, src: 'text'|'tarot', cardId? }], lines: [[tileId]] }
const arr = ref(null)
const cards = ref([])
const selected = ref(null)
const copied = ref(false)

const cardsKey = (cs) => cs.map((c) => c.id + (c.reversed ? 'r' : 'u')).join(',')
const tileById = computed(() => Object.fromEntries((arr.value?.tiles ?? []).map((x) => [x.id, x])))
const used = computed(() => new Set((arr.value?.lines ?? []).flat()))
const bankWords = computed(() => (arr.value?.tiles ?? []).filter((x) => x.src === 'text' && !used.value.has(x.id)))
const bankExtras = computed(() => (arr.value?.tiles ?? []).filter((x) => x.src === 'tarot' && !used.value.has(x.id)))
const hasExtras = computed(() => (arr.value?.tiles ?? []).some((x) => x.src === 'tarot'))
const textChanged = computed(() => !!arr.value && arr.value.sourceText !== text.value)
const poemText = computed(() =>
  (arr.value?.lines ?? [])
    .map((line) => line.map((id) => tileById.value[id]?.text).join(' '))
    .filter(Boolean)
    .join('\n'),
)

/** Cut text into words, trimming punctuation from both ends (any language). */
const tokenize = (s) =>
  s
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)

let seq = 0
const newId = () => `w${Date.now().toString(36)}${(seq++).toString(36)}`

/** One random keyword from a card, matching its upright/reversed meaning. */
function pickKeyword(card) {
  const ct = cardText(card.id)
  const list = (card.reversed ? ct.rev : ct.up).split(' · ')
  return list[Math.floor(Math.random() * list.length)]
}

const extraTiles = () =>
  cards.value.map((c) => ({ id: newId(), text: pickKeyword(c), src: 'tarot', cardId: c.id }))

function build() {
  arr.value = {
    sourceText: text.value,
    cardsKey: cardsKey(cards.value),
    tiles: [...tokenize(text.value).map((w) => ({ id: newId(), text: w, src: 'text' })), ...extraTiles()],
    lines: [[]],
  }
  selected.value = null
  saveArr()
}

/** Replace the extra words with fresh ones from the current cards. */
function refreshExtras() {
  const a = arr.value
  const oldExtras = a.tiles.filter((x) => x.src === 'tarot')
  const sameCards = cardsKey(cards.value) === a.cardsKey && oldExtras.length === cards.value.length
  if (sameCards) {
    // keep tile ids, so words already placed in lines just change text
    oldExtras.forEach((tile) => {
      const card = cards.value.find((c) => c.id === tile.cardId)
      if (card) tile.text = pickKeyword(card)
    })
  } else {
    const gone = new Set(oldExtras.map((x) => x.id))
    a.lines = a.lines.map((line) => line.filter((id) => !gone.has(id)))
    a.tiles = [...a.tiles.filter((x) => x.src !== 'tarot'), ...extraTiles()]
    a.cardsKey = cardsKey(cards.value)
  }
  saveArr()
}

async function pullHere() {
  cards.value = drawCards(3).map((c) => ({ ...c, revealed: true }))
  await saveDraftData(CARDS_ID, { cards: cards.value })
  refreshExtras()
}

function rebuild() {
  if (used.value.size && !confirm(t('writing.cutup.confirmRefresh'))) return
  build()
}

async function loadCards() {
  const saved = await loadDraftData(CARDS_ID)
  cards.value = (saved?.cards ?? []).filter((c) => CARD_BY_ID[c.id])
}

async function goToArrange() {
  if (!text.value.trim()) return
  await flushText()
  await loadCards()
  if (!arr.value || (textChanged.value && !used.value.size)) {
    build()
  } else if (cardsKey(cards.value) !== arr.value.cardsKey) {
    refreshExtras()
  }
  step.value = 2
  saveArr()
  window.scrollTo({ top: 0 })
}

function backToWriting() {
  selected.value = null
  step.value = 1
  saveArr()
  window.scrollTo({ top: 0 })
}

/* ---- saving the arrangement (IndexedDB, debounced) ---- */
let arrTimer = null
function saveArr() {
  if (!arr.value) return
  clearTimeout(arrTimer)
  arrTimer = setTimeout(() => {
    arrTimer = null
    saveDraftData(ARRANGE_ID, { ...arr.value, step: step.value })
  }, 250)
}

/* ---- moving words ---- */
function locate(id) {
  const lines = arr.value.lines
  for (let li = 0; li < lines.length; li++) {
    const idx = lines[li].indexOf(id)
    if (idx !== -1) return [li, idx]
  }
  return null
}

/** Put tile `id` into line `li` before position `index` (end if omitted). */
function place(id, li, index = null) {
  const lines = arr.value.lines
  const from = locate(id)
  if (from) {
    lines[from[0]].splice(from[1], 1)
    if (index != null && from[0] === li && from[1] < index) index--
  }
  lines[li].splice(index ?? lines[li].length, 0, id)
  selected.value = null
  saveArr()
}

function toBank(id) {
  const from = locate(id)
  if (from) arr.value.lines[from[0]].splice(from[1], 1)
  selected.value = null
  saveArr()
}

function shift(id, dir) {
  const from = locate(id)
  if (!from) return
  const line = arr.value.lines[from[0]]
  const j = from[1] + dir
  if (j < 0 || j >= line.length) return
  ;[line[from[1]], line[j]] = [line[j], line[from[1]]]
  saveArr()
}

function addLine() {
  arr.value.lines.push([])
  saveArr()
}

function removeLine(li) {
  arr.value.lines.splice(li, 1)
  if (!arr.value.lines.length) arr.value.lines.push([])
  selected.value = null
  saveArr()
}

/* ---- tap to select, tap to place ---- */
function tapBankTile(id) {
  selected.value = selected.value === id ? null : id
}

function tapLineTile(id, li, idx) {
  if (selected.value && selected.value !== id) place(selected.value, li, idx)
  else selected.value = selected.value === id ? null : id
}

function tapLine(li) {
  if (selected.value) place(selected.value, li)
}

/* ---- drag and drop (mouse) ---- */
let dragId = null
function onDragStart(id, e) {
  dragId = id
  selected.value = null
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
}
function dropOnTile(li, idx) {
  if (dragId) place(dragId, li, idx)
  dragId = null
}
function dropOnLine(li) {
  if (dragId) place(dragId, li)
  dragId = null
}
function dropOnBank() {
  if (dragId) toBank(dragId)
  dragId = null
}

async function copyPoem() {
  try {
    await navigator.clipboard.writeText(poemText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard blocked; nothing else to do */
  }
}

/* ================= lifecycle ================= */
onMounted(async () => {
  const [savedText, savedArr] = await Promise.all([loadDraft(TEXT_ID), loadDraftData(ARRANGE_ID)])
  text.value = savedText
  await loadCards()
  if (savedArr?.tiles && savedArr?.lines) {
    const { step: savedStep, ...rest } = savedArr
    arr.value = rest
    if (savedStep === 2) step.value = 2
  }
  loaded.value = true
})

onBeforeUnmount(() => {
  if (textTimer) {
    clearTimeout(textTimer)
    saveDraft(TEXT_ID, text.value)
  }
  if (arrTimer) {
    clearTimeout(arrTimer)
    saveDraftData(ARRANGE_ID, { ...arr.value, step: step.value })
  }
})
</script>

<template>
  <section class="container prose cutup">
    <RouterLink :to="{ name: 'writing' }" class="back">← {{ t('writing.title') }}</RouterLink>
    <h1>{{ t('writing.cutup.title') }}</h1>
    <p class="lead">{{ t('writing.cutup.intro') }}</p>

    <ol class="stepper">
      <li :class="{ active: step === 1 }">
        <button class="ghost" @click="step === 2 && backToWriting()"><b>1</b> {{ t('writing.cutup.step1') }}</button>
      </li>
      <li :class="{ active: step === 2 }">
        <button class="ghost" :disabled="!text.trim()" @click="step === 1 && goToArrange()">
          <b>2</b> {{ t('writing.cutup.step2') }}
        </button>
      </li>
    </ol>

    <!-- ============ Step 1 ============ -->
    <template v-if="step === 1">
      <details class="rules">
        <summary>{{ t('writing.timed.rulesTitle') }}</summary>
        <ul>
          <li v-for="(r, i) in t('writing.timed.rules')" :key="i">{{ r }}</li>
        </ul>
      </details>

      <TarotHelper :store-id="CARDS_ID" />
      <TimerPanel owner="cutup" />

      <textarea
        v-model="text"
        class="poem-box"
        :placeholder="t('writing.timed.placeholder')"
        :disabled="!loaded"
        spellcheck="false"
        @input="onInput"
      />
      <div class="poem-foot">
        <span class="muted">{{ t('writing.timed.words', { n: wordCount }) }} · {{ t('writing.timed.savedLocally') }}</span>
        <span class="spacer" />
        <button class="primary" :disabled="!text.trim()" @click="goToArrange">{{ t('writing.cutup.next') }}</button>
      </div>
      <p v-if="loaded && !text.trim()" class="muted small">{{ t('writing.cutup.needText') }}</p>
    </template>

    <!-- ============ Step 2 ============ -->
    <template v-else-if="arr">
      <div class="step2-bar">
        <button class="ghost" @click="backToWriting">{{ t('writing.cutup.back') }}</button>
      </div>

      <div v-if="textChanged" class="notice">
        <span>{{ t('writing.cutup.changed') }}</span>
        <button @click="rebuild">✂ {{ t('writing.cutup.refresh') }}</button>
      </div>

      <!-- Word bank -->
      <div class="panel" @dragover.prevent @drop.prevent="dropOnBank">
        <h2>{{ t('writing.cutup.bankTitle') }}</h2>
        <p class="muted small">{{ t('writing.cutup.bankHint') }}</p>
        <div class="tiles">
          <button
            v-for="tile in bankWords"
            :key="tile.id"
            class="tile"
            :class="{ selected: selected === tile.id }"
            draggable="true"
            @dragstart="onDragStart(tile.id, $event)"
            @click="tapBankTile(tile.id)"
          >{{ tile.text }}</button>
          <p v-if="!bankWords.length" class="muted small">{{ t('writing.cutup.emptyBank') }}</p>
        </div>

        <h3 class="extra-title">🔮 {{ t('writing.cutup.extraTitle') }}</h3>
        <template v-if="cards.length && hasExtras">
          <div class="tiles">
            <button
              v-for="tile in bankExtras"
              :key="tile.id"
              class="tile tarot"
              :class="{ selected: selected === tile.id }"
              :title="cardText(tile.cardId)?.name"
              draggable="true"
              @dragstart="onDragStart(tile.id, $event)"
              @click="tapBankTile(tile.id)"
            >{{ tile.text }}</button>
          </div>
          <button class="ghost small-btn" @click="refreshExtras">🎲 {{ t('writing.cutup.newExtras') }}</button>
        </template>
        <div v-else class="no-cards">
          <span class="muted small">{{ t('writing.cutup.noCards') }}</span>
          <button @click="pullHere">🂠 {{ t('writing.cutup.pullCards') }}</button>
        </div>
      </div>

      <!-- Lines -->
      <div class="panel">
        <h2>{{ t('writing.cutup.linesTitle') }}</h2>
        <ol class="lines">
          <li v-for="(line, li) in arr.lines" :key="li" class="line-row">
            <span class="line-no">{{ li + 1 }}</span>
            <div
              class="line"
              :class="{ target: selected && !line.includes(selected) }"
              @click="tapLine(li)"
              @dragover.prevent
              @drop.prevent.stop="dropOnLine(li)"
            >
              <template v-for="(id, idx) in line" :key="id">
                <button
                  class="tile"
                  :class="{ selected: selected === id, tarot: tileById[id]?.src === 'tarot' }"
                  draggable="true"
                  @dragstart="onDragStart(id, $event)"
                  @dragover.prevent
                  @drop.prevent.stop="dropOnTile(li, idx)"
                  @click.stop="tapLineTile(id, li, idx)"
                >{{ tileById[id]?.text }}</button>
                <span v-if="selected === id" class="tile-tools" @click.stop>
                  <button class="ghost" :title="t('writing.cutup.moveLeft')" :aria-label="t('writing.cutup.moveLeft')" :disabled="idx === 0" @click="shift(id, -1)">←</button>
                  <button class="ghost" :title="t('writing.cutup.moveRight')" :aria-label="t('writing.cutup.moveRight')" :disabled="idx === line.length - 1" @click="shift(id, 1)">→</button>
                  <button class="ghost" :title="t('writing.cutup.toBank')" :aria-label="t('writing.cutup.toBank')" @click="toBank(id)">↩</button>
                </span>
              </template>
              <span v-if="!line.length" class="line-empty">{{ selected ? t('writing.cutup.emptyLine') : '' }}</span>
            </div>
            <button
              class="ghost line-del"
              :title="t('writing.cutup.removeLine')"
              :aria-label="t('writing.cutup.removeLine')"
              @click="removeLine(li)"
            >✕</button>
          </li>
        </ol>
        <button class="ghost" @click="addLine">{{ t('writing.cutup.addLine') }}</button>
      </div>

      <!-- Result -->
      <div v-if="poemText" class="panel result">
        <pre class="poem-preview">{{ poemText }}</pre>
        <button class="primary" @click="copyPoem">{{ copied ? '✓ ' + t('writing.cutup.copied') : t('writing.cutup.copy') }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.small { font-size: 0.88rem; }
.stepper { list-style: none; display: flex; gap: 0.5rem; padding: 0; margin: 0 0 1.25rem; }
.stepper button { border: 1px solid var(--border); border-radius: 999px; padding: 0.35em 0.9em; }
.stepper b {
  display: inline-grid;
  place-items: center;
  width: 1.4em;
  height: 1.4em;
  border-radius: 50%;
  background: var(--border);
  font-size: 0.8em;
}
.stepper li.active button { border-color: var(--accent); color: var(--accent); font-weight: 600; }
.stepper li.active b { background: var(--accent); color: #fff; }

.step2-bar { margin-bottom: 0.75rem; }
.notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}

.panel {
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.panel h2 { font-size: 1.15rem; margin: 0 0 0.2rem; }
.panel > p { margin: 0 0 0.75rem; }
.extra-title { font-size: 1rem; margin: 1.25rem 0 0.6rem; }
.no-cards { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.small-btn { margin-top: 0.6rem; font-size: 0.9rem; }

/* Word tiles: like fridge-magnet poetry */
.tiles { display: flex; flex-wrap: wrap; gap: 0.4rem; max-height: 18rem; overflow-y: auto; padding: 2px; }
.tile {
  padding: 0.25em 0.6em;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: #fffdf8;
  color: #1f1b16;
  font: 1rem Georgia, 'Times New Roman', serif;
  box-shadow: 0 1px 0 rgb(0 0 0 / 0.08), 0 2px 4px rgb(0 0 0 / 0.06);
  cursor: grab;
  user-select: none;
  touch-action: manipulation;
  transition: transform 0.1s, box-shadow 0.1s;
}
.tile:hover { transform: translateY(-1px); }
.tile.tarot { border-color: #6b3fa0; color: #4a2a75; background: #f7f1ff; font-style: italic; }
.tile.selected {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  transform: translateY(-2px) rotate(-1deg);
  box-shadow: 0 6px 14px rgb(0 0 0 / 0.15);
}

.lines { list-style: none; margin: 0.5rem 0 0.75rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.line-row { display: flex; align-items: center; gap: 0.5rem; }
.line-no { width: 1.5em; text-align: right; font-size: 0.8rem; color: var(--muted); flex-shrink: 0; }
.line {
  flex: 1;
  min-width: 0;
  min-height: 2.6rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: 8px;
  cursor: pointer;
}
.line.target { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.line-empty { font-size: 0.85rem; color: var(--muted); }
.line-del { flex-shrink: 0; padding: 0.3em 0.5em; color: var(--muted); }
.tile-tools { display: inline-flex; gap: 2px; }
.tile-tools button { padding: 0.15em 0.45em; font-size: 0.9rem; }

.result { display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; }
.poem-preview {
  margin: 0;
  white-space: pre-wrap;
  font: 1.15rem/1.7 Georgia, 'Times New Roman', serif;
}
</style>
