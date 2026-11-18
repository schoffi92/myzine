<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'

const ID = 'mosaic' // IndexedDB drafts id
const COLORS = ['#e85d3f', '#2a6fb0', '#3c9a5f', '#c9a227', '#8e5bb5', '#d16a9a', '#3aa3a3', '#7a6a58']
const SEPARATORS = ['*', '◆', '—', ''] // '' = just a blank line

// tile = { id, who, text, color, angle: { v, t, f } | null }  (angle stores list indexes, so it follows the language)
const blank = () => ({ step: 1, center: '', tiles: [], sep: '*' })
const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)

let seq = 0
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`
const countWords = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)
const randomIndex = (n) => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

const filledTiles = computed(() => state.tiles.filter((x) => x.text.trim()))
const totalWords = computed(() => filledTiles.value.reduce((n, x) => n + countWords(x.text), 0))

const maxStep = computed(() => {
  if (!state.center.trim()) return 1
  if (!filledTiles.value.length) return 2
  return 4
})

function go(n) {
  if (n < 1 || n > maxStep.value) return
  if (n === 2 && !state.tiles.length) addTile()
  state.step = n
  window.scrollTo({ top: 0 })
}

/* ---- tiles ---- */
function addTile() {
  state.tiles.push({ id: newId(), who: '', text: '', color: COLORS[state.tiles.length % COLORS.length], angle: null })
}

function removeTile(i) {
  if (state.tiles[i].text.trim() && !confirm(t('writing.mosaic.confirmRemove'))) return
  state.tiles.splice(i, 1)
}

function cycleColor(tile) {
  tile.color = COLORS[(COLORS.indexOf(tile.color) + 1) % COLORS.length]
}

function suggest(tile) {
  tile.angle = {
    v: randomIndex(t('writing.mosaic.voices').length),
    t: randomIndex(t('writing.mosaic.times').length),
    f: randomIndex(t('writing.mosaic.forms').length),
  }
}

function move(i, dir) {
  const j = i + dir
  if (j < 0 || j >= state.tiles.length) return
  ;[state.tiles[i], state.tiles[j]] = [state.tiles[j], state.tiles[i]]
}

/* drag to reorder (mouse) */
let dragFrom = null
function onDragStart(i, e) {
  dragFrom = i
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(i))
}
function onDrop(i) {
  if (dragFrom == null || dragFrom === i) return
  const [moved] = state.tiles.splice(dragFrom, 1)
  state.tiles.splice(i, 0, moved)
  dragFrom = null
}

/* ---- result ---- */
const storyText = computed(() => {
  const sep = state.sep ? `\n\n${state.sep}\n\n` : '\n\n\n'
  return filledTiles.value
    .map((x) => (x.who.trim() ? `${x.who.trim().toUpperCase()}\n` : '') + x.text.trim())
    .join(sep)
})

async function copyStory() {
  try {
    await navigator.clipboard.writeText(storyText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* clipboard blocked */ }
}

async function startOver() {
  if (!confirm(t('writing.mosaic.confirmClear'))) return
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

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) {
    Object.assign(state, {
      step: saved.step ?? 1,
      center: saved.center ?? '',
      tiles: Array.isArray(saved.tiles) ? saved.tiles : [],
      sep: SEPARATORS.includes(saved.sep) ? saved.sep : '*',
    })
    if (state.step > maxStep.value) state.step = maxStep.value
  }
  loaded.value = true
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveDraftData(ID, state)
  }
})
</script>

<template>
  <section class="container prose mosaic">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>{{ t('writing.mosaic.title') }}</h1>
    <p class="lead">{{ t('writing.mosaic.intro') }}</p>
    <EarlierVersion :keys="['mosaic']" />

    <ol class="stepper">
      <li v-for="(label, i) in t('writing.mosaic.steps')" :key="i" :class="{ active: state.step === i + 1 }">
        <button class="ghost" :disabled="i + 1 > maxStep" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- Mosaic colour bar: one block per written tile, sized by length -->
      <div v-if="state.step > 1 && filledTiles.length" class="mosaic-bar" aria-hidden="true">
        <span
          v-for="tile in filledTiles"
          :key="tile.id"
          :style="{ background: tile.color, flexGrow: Math.max(1, countWords(tile.text)) }"
          :title="tile.who"
        />
      </div>

      <!-- Step 1: center -->
      <div v-if="state.step === 1" class="panel">
        <h2>{{ t('writing.mosaic.s1Title') }}</h2>
        <p class="muted">{{ t('writing.mosaic.s1Help') }}</p>
        <textarea v-model="state.center" rows="2" class="serif" :placeholder="t('writing.mosaic.s1Placeholder')" />
      </div>

      <!-- Step 2: tiles -->
      <template v-else-if="state.step === 2">
        <div class="panel">
          <h2>{{ t('writing.mosaic.s2Title') }}</h2>
          <p class="muted">{{ t('writing.mosaic.s2Help') }}</p>
          <blockquote class="center">{{ state.center }}</blockquote>
        </div>

        <div v-for="(tile, i) in state.tiles" :key="tile.id" class="tile-card" :style="{ '--tile': tile.color }">
          <div class="tile-card__head">
            <button
              class="swatch"
              :style="{ background: tile.color }"
              :aria-label="`${t('writing.mosaic.untitledTile', { n: i + 1 })} · color`"
              @click="cycleColor(tile)"
            />
            <strong>{{ t('writing.mosaic.untitledTile', { n: i + 1 }) }}</strong>
            <span class="spacer" />
            <button class="ghost small" @click="suggest(tile)">{{ t('writing.mosaic.suggest') }}</button>
            <button
              class="ghost danger small"
              :title="t('writing.mosaic.removeTile')"
              :aria-label="t('writing.mosaic.removeTile')"
              @click="removeTile(i)"
            >✕</button>
          </div>

          <div v-if="tile.angle" class="angle">
            <span><small>{{ t('writing.mosaic.voiceLabel') }}</small>{{ t('writing.mosaic.voices')[tile.angle.v] }}</span>
            <span><small>{{ t('writing.mosaic.timeLabel') }}</small>{{ t('writing.mosaic.times')[tile.angle.t] }}</span>
            <span><small>{{ t('writing.mosaic.formLabel') }}</small>{{ t('writing.mosaic.forms')[tile.angle.f] }}</span>
            <button class="ghost small" aria-label="✕" @click="tile.angle = null">✕</button>
          </div>

          <input v-model="tile.who" class="who" :placeholder="t('writing.mosaic.who') + ' · ' + t('writing.mosaic.whoPlaceholder')" />
          <textarea v-model="tile.text" rows="5" class="serif" :placeholder="t('writing.mosaic.tilePlaceholder')" />
          <p class="muted small count">{{ t('writing.mosaic.words', { n: countWords(tile.text) }) }}</p>
        </div>

        <button class="primary" @click="addTile" :title="tl('writing.mosaic.addTile')" :aria-label="tl('writing.mosaic.addTile')"><Icon name="plus" :label="tl('writing.mosaic.addTile')" /></button>
        <p class="muted small">
          {{ t('writing.mosaic.tilesCount', { n: filledTiles.length }) }} · {{ t('writing.mosaic.words', { n: totalWords }) }}
        </p>
      </template>

      <!-- Step 3: arrange -->
      <div v-else-if="state.step === 3" class="panel">
        <h2>{{ t('writing.mosaic.s3Title') }}</h2>
        <p class="muted">{{ t('writing.mosaic.s3Help') }}</p>

        <ol class="order">
          <li
            v-for="(tile, i) in state.tiles"
            :key="tile.id"
            class="order__item"
            :class="{ empty: !tile.text.trim() }"
            :style="{ '--tile': tile.color }"
            draggable="true"
            @dragstart="onDragStart(i, $event)"
            @dragover.prevent
            @drop.prevent="onDrop(i)"
          >
            <span class="grip" aria-hidden="true">⋮⋮</span>
            <span class="order__text">
              <strong v-if="tile.who.trim()">{{ tile.who }}</strong>
              <span>{{ tile.text.trim() || t('writing.mosaic.untitledTile', { n: i + 1 }) }}</span>
            </span>
            <span class="order__btns">
              <button class="ghost" :disabled="i === 0" :aria-label="t('writing.mosaic.moveUp')" :title="t('writing.mosaic.moveUp')" @click="move(i, -1)">↑</button>
              <button class="ghost" :disabled="i === state.tiles.length - 1" :aria-label="t('writing.mosaic.moveDown')" :title="t('writing.mosaic.moveDown')" @click="move(i, 1)">↓</button>
            </span>
          </li>
        </ol>

        <div class="sep-choice">
          <span>{{ t('writing.mosaic.separator') }}:</span>
          <button
            v-for="s in SEPARATORS"
            :key="s || 'blank'"
            :class="{ primary: state.sep === s }"
            @click="state.sep = s"
          >{{ s || '¶' }}</button>
        </div>
      </div>

      <!-- Step 4: read -->
      <div v-else class="panel result">
        <h2>{{ t('writing.mosaic.s4Title') }}</h2>
        <blockquote class="center">{{ state.center }}</blockquote>
        <template v-if="filledTiles.length">
          <template v-for="(tile, i) in filledTiles" :key="tile.id">
            <div v-if="i > 0" class="sep">{{ state.sep || ' ' }}</div>
            <article class="fragment" :style="{ '--tile': tile.color }">
              <h3 v-if="tile.who.trim()">{{ tile.who }}</h3>
              <p>{{ tile.text.trim() }}</p>
            </article>
          </template>
          <button class="primary" @click="copyStory" :title="copied ? tl('writing.mosaic.copied') : tl('writing.mosaic.copy')" :aria-label="copied ? tl('writing.mosaic.copied') : tl('writing.mosaic.copy')">
            <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.mosaic.copied') : tl('writing.mosaic.copy')" />
          </button>
        </template>
        <p v-else class="muted">{{ t('writing.mosaic.empty') }}</p>
      </div>

      <div class="step-nav">
        <button v-if="state.step > 1" class="ghost" @click="go(state.step - 1)" :title="tl('writing.mosaic.back')" :aria-label="tl('writing.mosaic.back')"><Icon name="arrow-left" :label="tl('writing.mosaic.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.mosaic.clear')" :aria-label="tl('writing.mosaic.clear')"><Icon name="trash" :label="tl('writing.mosaic.clear')" /></button>
        <button v-if="state.step < 4" class="primary" :disabled="state.step + 1 > maxStep" @click="go(state.step + 1)" :title="tl('writing.mosaic.next')" :aria-label="tl('writing.mosaic.next')">
          <Icon name="arrow-right" :label="tl('writing.mosaic.next')" />
        </button>
      </div>

      <SavedWorks kind="mosaic" :data="state" :default-title="state.center" :can-save="!!(state.center.trim() || state.tiles.some((x) => x.text.trim()))" />
    </template>
  </section>
</template>

<style scoped>
.serif { font: 1.08rem/1.7 Georgia, 'Times New Roman', serif; }
.small { font-size: 0.85rem; }
.count { margin: 0.25rem 0 0; text-align: right; }

.mosaic-bar { display: flex; gap: 3px; height: 14px; margin-bottom: 1rem; border-radius: 4px; overflow: hidden; }
.mosaic-bar span { flex-basis: 0; min-width: 6px; }

.center {
  margin: 0.75rem 0 0;
  padding: 0.6rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
  font: italic 1.08rem/1.6 Georgia, serif;
}

.tile-card {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 6px solid var(--tile);
  border-radius: 10px;
  box-shadow: var(--shadow);
}
.tile-card__head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.swatch {
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border-radius: 4px;
  border: 2px solid var(--surface);
  outline: 1px solid var(--border);
  cursor: pointer;
}
.who { width: 100%; margin-bottom: 0.5rem; font-style: italic; }
.angle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  font-size: 0.9rem;
}
.angle > span {
  padding: 0.2em 0.65em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tile) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--tile) 45%, transparent);
}
.angle small { margin-right: 0.35em; font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em; opacity: 0.75; }

.order { list-style: none; margin: 0.75rem 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.order__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-left: 6px solid var(--tile);
  border-radius: 8px;
  background: var(--surface);
  cursor: grab;
}
.order__item.empty { opacity: 0.5; }
.grip { color: var(--muted); letter-spacing: -2px; user-select: none; }
.order__text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.order__text span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: Georgia, serif; }
.order__text strong { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
.order__btns { display: flex; gap: 2px; flex-shrink: 0; }
.order__btns button { padding: 0.2em 0.5em; }
.sep-choice { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
.sep-choice button { min-width: 2.4em; justify-content: center; }

.result { display: flex; flex-direction: column; }
.result .center { margin-bottom: 1.25rem; }
.fragment h3 {
  margin: 0 0 0.3rem;
  font: 700 0.8rem system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--tile);
}
.fragment p { margin: 0; font: 1.1rem/1.75 Georgia, serif; white-space: pre-wrap; }
.sep { text-align: center; margin: 1.1rem 0; color: var(--muted); letter-spacing: 0.3em; }
.result > .primary { align-self: flex-start; margin-top: 1.25rem; }
.step-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
</style>
