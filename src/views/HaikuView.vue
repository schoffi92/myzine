<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import SavedPoems from '../components/SavedPoems.vue'
import { settings } from '../composables/settings'
import { loadDraftData, saveDraftData } from '../db/drafts'
import { countSyllables, HAIKU_PATTERN } from '../writing/syllables'

const ID = 'haiku' // IndexedDB drafts id
// lines: the haiku being written · season: drawn prompt [seasonIndex, wordIndex] · kept: finished haiku
const state = reactive({ lines: ['', '', ''], season: null, kept: [] })
const loaded = ref(false)

const counts = computed(() => state.lines.map((l) => countSyllables(l, settings.locale)))
const hasText = computed(() => state.lines.some((l) => l.trim()))

const seasonText = computed(() => {
  if (!state.season) return ''
  const [s, w] = state.season
  return `${t('writing.haiku.seasons')[s]}: ${t('writing.haiku.seasonWords')[s][w]}`
})

function drawSeason() {
  let next
  do next = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)]
  while (state.season && next[0] === state.season[0] && next[1] === state.season[1])
  state.season = next
}

function keep() {
  if (!hasText.value) return
  state.kept.unshift({ id: Date.now().toString(36), lines: state.lines.map((l) => l.trim()), at: Date.now() })
  state.lines = ['', '', '']
}

function clearLines() {
  state.lines = ['', '', '']
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
      lines: [0, 1, 2].map((i) => saved.lines?.[i] ?? ''),
      season: Array.isArray(saved.season) ? saved.season : null,
      kept: Array.isArray(saved.kept) ? saved.kept.filter((h) => Array.isArray(h?.lines)) : [],
    })
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
  <section class="container prose haiku">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>❀ {{ t('writing.haiku.title') }}</h1>
    <p class="lead">{{ t('writing.haiku.intro') }}</p>

    <section class="task" aria-labelledby="haiku-task">
      <h2 id="haiku-task">🌳 {{ t('writing.haiku.taskTitle') }}</h2>
      <p>{{ t('writing.haiku.task') }}</p>
      <ol>
        <li v-for="s in t('writing.haiku.taskSteps')" :key="s">{{ s }}</li>
      </ol>
    </section>

    <h2>{{ t('writing.haiku.rulesTitle') }}</h2>
    <ol class="rules">
      <li v-for="r in t('writing.haiku.rules')" :key="r.h">
        <strong>{{ r.h }}</strong>
        <span>{{ r.p }}</span>
      </li>
    </ol>

    <figure class="example">
      <figcaption>{{ t('writing.haiku.exampleTitle') }}</figcaption>
      <p class="poem">
        <template v-for="(l, i) in t('writing.haiku.example')" :key="i">{{ l }}<br v-if="i < 2" /></template>
      </p>
      <p class="muted small">{{ t('writing.haiku.exampleNote') }}</p>
    </figure>

    <div v-if="loaded" class="panel">
      <h2>{{ t('writing.haiku.writeTitle') }}</h2>

      <div class="prompt">
        <span class="muted">{{ t('writing.haiku.promptTitle') }}</span>
        <button class="ghost" @click="drawSeason" :title="tl('writing.haiku.drawSeason')" :aria-label="tl('writing.haiku.drawSeason')">🎲 <span class="btn-label">{{ t('writing.haiku.drawSeason') }}</span></button>
        <strong v-if="seasonText" class="season" role="status">{{ seasonText }}</strong>
      </div>

      <div v-for="(target, i) in HAIKU_PATTERN" :key="i" class="line">
        <label :for="`haiku-${i}`">{{ t('writing.haiku.lineLabel', { n: i + 1 }) }}</label>
        <div class="line__row">
          <input :id="`haiku-${i}`" v-model="state.lines[i]" class="serif" maxlength="80" autocomplete="off" />
          <span
            class="count"
            :class="{ ok: counts[i] === target, over: counts[i] > target }"
            :aria-label="t('writing.haiku.syllables', { n: counts[i], target })"
          >{{ counts[i] }}/{{ target }}<template v-if="counts[i] === target"> ✓</template></span>
        </div>
      </div>
      <p class="muted small">{{ t('writing.haiku.approx') }}</p>

      <div class="actions">
        <button class="ghost danger" :disabled="!hasText" @click="clearLines" :title="tl('writing.haiku.clearLines')" :aria-label="tl('writing.haiku.clearLines')"><Icon name="trash" :label="tl('writing.haiku.clearLines')" /></button>
        <span class="spacer" />
        <button class="primary" :disabled="!hasText" @click="keep" :title="tl('writing.haiku.keep')" :aria-label="tl('writing.haiku.keep')"><Icon name="save" :label="tl('writing.haiku.keep')" /></button>
      </div>
    </div>

    <SavedPoems :poems="state.kept" :title="t('writing.haiku.keptTitle')" @remove="(i) => state.kept.splice(i, 1)" />
  </section>
</template>

<style scoped>
.serif, .poem { font-family: Georgia, 'Times New Roman', serif; }
.small { font-size: 0.85rem; }
.task {
  margin: 1.25rem 0 1.5rem;
  padding: 0.9rem 1.2rem;
  border: 1px solid color-mix(in srgb, #3c9a5f 45%, var(--border));
  border-radius: var(--radius);
  background: color-mix(in srgb, #3c9a5f 8%, var(--surface));
}
.task h2 { margin: 0 0 0.4rem; font-size: 1.15rem; }
.task p { margin: 0 0 0.5rem; }
.task ol { margin: 0; padding-left: 1.3rem; display: grid; gap: 0.3rem; }
.rules { padding-left: 1.4rem; display: grid; gap: 0.5rem; }
.rules strong { display: block; }
.example {
  margin: 1.5rem 0;
  padding: 0.8rem 1.1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
.example figcaption { font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.poem { font-size: 1.2rem; line-height: 1.7; font-style: italic; margin: 0.4rem 0; }
.prompt { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
.season { padding: 0.15rem 0.6rem; border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.line { margin-top: 0.75rem; }
.line label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem; }
.line__row { display: flex; align-items: center; gap: 0.6rem; }
.line__row input { flex: 1; min-width: 0; font-size: 1.15rem; }
.count { min-width: 4.2em; text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); font-weight: 600; }
.count.ok { color: #3c9a5f; }
.count.over { color: var(--danger); }
.actions { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
</style>
