<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import CardBoard from '../components/CardBoard.vue'
import { isMobile } from '../composables/useMobile'
import {
  BOARD_COLORS, SOURCE_KINDS, blankStory, loadStory, saveStory, deleteStory, uid, chapterTitle, chapterDesc, sourceLabel,
} from '../composables/storyCards'

const story = reactive(blankStory())
const loaded = ref(false)

const activeChapters = computed(() => story.chapters.filter((c) => c.enabled))

// Phones show one chapter at a time in step 3, chosen from a dropdown.
const currentChapterId = ref(null)
watch(
  activeChapters,
  (list) => {
    if (!list.some((c) => c.id === currentChapterId.value)) currentChapterId.value = list[0]?.id ?? null
  },
  { immediate: true },
)
const visibleChapters = computed(() =>
  isMobile.value ? activeChapters.value.filter((c) => c.id === currentChapterId.value) : activeChapters.value,
)
const noteCount = (cols) => cols.reduce((n, c) => n + c.notes.length, 0)

function go(n) {
  story.step = n
  window.scrollTo({ top: 0 })
}

/* ---- step 1: chapters ---- */
function addChapter() {
  story.chapters.push({ id: uid(), key: null, title: '', desc: '', enabled: true, notes: [] })
}

function removeChapter(i) {
  const ch = story.chapters[i]
  if ((ch.notes.length || ch.title.trim()) && !confirm(t('writing.story.confirmRemoveChapter'))) return
  story.chapters.splice(i, 1)
}

function moveIn(list, i, dir) {
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
}

/* ---- step 2: characters & worlds ---- */
function addColumn(list) {
  list.push({ id: uid(), name: '', notes: [] })
}

function removeColumn(list, i) {
  const col = list[i]
  if ((col.notes.length || col.name.trim()) && !confirm(t('writing.story.confirmRemoveColumn'))) return
  list.splice(i, 1)
}

async function startOver() {
  if (!confirm(t('writing.story.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  // pause autosave while resetting, or the watcher re-saves an empty draft
  loaded.value = false
  Object.assign(story, blankStory())
  await nextTick()
  loaded.value = true
  await deleteStory()
}

/* ---- autosave to IndexedDB ---- */
let saveTimer = null
watch(
  story,
  () => {
    if (!loaded.value) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveStory(story)
    }, 400)
  },
  { deep: true },
)

onMounted(async () => {
  Object.assign(story, await loadStory())
  loaded.value = true
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveStory(story)
  }
})
</script>

<template>
  <section class="container story">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <div class="story__head">
      <h1>{{ t('writing.story.title') }}</h1>
      <RouterLink :to="{ name: 'story-print' }" class="btn" :title="tl('writing.story.print')" :aria-label="tl('writing.story.print')"><Icon name="printer" :label="tl('writing.story.print')" /></RouterLink>
    </div>
    <p class="lead prose-w">{{ t('writing.story.intro') }}</p>
    <details class="tips prose-w">
      <summary>{{ t('writing.story.tipsTitle') }}</summary>
      <ul>
        <li v-for="tip in t('writing.story.tips')" :key="tip">{{ tip }}</li>
      </ul>
    </details>

    <ol class="stepper">
      <li v-for="(label, i) in t('writing.story.steps')" :key="i" :class="{ active: story.step === i + 1 }">
        <button class="ghost" @click="go(i + 1)"><b>{{ i + 1 }}</b> {{ label }}</button>
      </li>
    </ol>

    <template v-if="loaded">
      <!-- ============ Step 1: chapter cards ============ -->
      <div v-if="story.step === 1" class="panel prose-w">
        <label class="field-label" for="story-title">{{ t('writing.story.storyTitle') }}</label>
        <fieldset class="kind">
          <legend class="muted small">{{ t('writing.story.kindLabel') }}</legend>
          <label v-for="k in SOURCE_KINDS" :key="k" class="kind__opt">
            <input v-model="story.kind" type="radio" name="story-kind" :value="k" />
            {{ t(k === 'film' ? 'writing.story.kindFilm' : 'writing.story.kindNovel') }}
          </label>
        </fieldset>
        <input id="story-title" v-model="story.title" class="story-title" :placeholder="t('writing.story.storyTitlePh')" />

        <h2>{{ t('writing.story.s1Title') }}</h2>
        <p class="muted">{{ t('writing.story.s1Help') }}</p>

        <ol class="chapter-list">
          <li
            v-for="(ch, i) in story.chapters"
            :key="ch.id"
            class="chapter-card"
            :class="{ off: !ch.enabled, custom: !ch.key }"
          >
            <input
              :id="`ch-${ch.id}`"
              v-model="ch.enabled"
              type="checkbox"
              class="check"
              :aria-label="chapterTitle(ch, t)"
            />
            <div class="chapter-card__body">
              <template v-if="ch.key">
                <label :for="`ch-${ch.id}`" class="chapter-card__title">{{ chapterTitle(ch, t) }}</label>
                <span class="muted small">{{ chapterDesc(ch, t) }}</span>
              </template>
              <template v-else>
                <span class="tag">{{ t('writing.story.custom') }}</span>
                <input v-model="ch.title" class="chapter-card__input" :placeholder="t('writing.story.chapterTitlePh')" />
                <input v-model="ch.desc" class="chapter-card__input small" :placeholder="t('writing.story.chapterDescPh')" />
              </template>
            </div>
            <div class="chapter-card__tools">
              <button class="ghost" :disabled="i === 0" :aria-label="t('writing.story.moveUp')" :title="t('writing.story.moveUp')" @click="moveIn(story.chapters, i, -1)">↑</button>
              <button class="ghost" :disabled="i === story.chapters.length - 1" :aria-label="t('writing.story.moveDown')" :title="t('writing.story.moveDown')" @click="moveIn(story.chapters, i, 1)">↓</button>
              <button v-if="!ch.key" class="ghost danger" :aria-label="t('writing.story.removeChapter')" :title="t('writing.story.removeChapter')" @click="removeChapter(i)">✕</button>
            </div>
          </li>
        </ol>
        <button class="primary" @click="addChapter" :title="tl('writing.story.addChapter')" :aria-label="tl('writing.story.addChapter')"><Icon name="plus" :label="tl('writing.story.addChapter')" /></button>
      </div>

      <!-- ============ Step 2: characters & worlds ============ -->
      <template v-else-if="story.step === 2">
        <div class="panel prose-w">
          <h2>{{ t('writing.story.s2Title') }}</h2>
          <p class="muted">{{ t('writing.story.s2Help') }}</p>
        </div>

        <template v-for="group in [
          { list: story.characters, kind: 'character', heading: 'characters', add: 'addCharacter', ph: 'characterPh', icon: '☺' },
          { list: story.worlds, kind: 'world', heading: 'worlds', add: 'addWorld', ph: 'worldPh', icon: '⌂' },
        ]" :key="group.kind">
          <h2 class="board-title" :style="{ color: BOARD_COLORS[group.kind] }">
            {{ group.icon }} {{ t(`writing.story.${group.heading}`) }}
            <small class="muted">· {{ t('writing.story.cardsCount', { n: noteCount(group.list) }) }}</small>
          </h2>
          <CardBoard :columns="group.list" :color="BOARD_COLORS[group.kind]">
            <template #header="{ col, index }">
              <input v-model="col.name" class="col-name" :placeholder="t(`writing.story.${group.ph}`)" />
              <div class="col-tools">
                <!-- columns stack vertically on phones, so they move up/down there -->
                <button class="ghost" :disabled="index === 0" :aria-label="t(isMobile ? 'writing.story.moveUp' : 'writing.story.moveLeft')" :title="t(isMobile ? 'writing.story.moveUp' : 'writing.story.moveLeft')" @click="moveIn(group.list, index, -1)">{{ isMobile ? '↑' : '←' }}</button>
                <button class="ghost" :disabled="index === group.list.length - 1" :aria-label="t(isMobile ? 'writing.story.moveDown' : 'writing.story.moveRight')" :title="t(isMobile ? 'writing.story.moveDown' : 'writing.story.moveRight')" @click="moveIn(group.list, index, 1)">{{ isMobile ? '↓' : '→' }}</button>
                <span class="spacer" />
                <button class="ghost danger" :aria-label="t('writing.story.removeColumn')" :title="t('writing.story.removeColumn')" @click="removeColumn(group.list, index)">✕</button>
              </div>
            </template>
            <template #after>
              <button class="add-col" :style="{ '--board': BOARD_COLORS[group.kind] }" @click="addColumn(group.list)">
                {{ t(`writing.story.${group.add}`) }}
              </button>
            </template>
          </CardBoard>
        </template>
      </template>

      <!-- ============ Step 3: chapter grid ============ -->
      <template v-else>
        <div class="panel prose-w">
          <h2>{{ t('writing.story.s3Title') }}</h2>
          <p class="muted">{{ t('writing.story.s3Help') }}</p>
        </div>

        <p v-if="!activeChapters.length" class="empty">{{ t('writing.story.noChapters') }}</p>
        <template v-else>
          <h2 class="board-title" :style="{ color: BOARD_COLORS.chapter }">
            ▤ {{ sourceLabel(story, t) }}
            <small class="muted">· {{ t('writing.story.cardsCount', { n: noteCount(activeChapters) }) }}</small>
          </h2>
          <!-- Phones: pick one chapter to show and edit -->
          <select
            v-if="isMobile"
            v-model="currentChapterId"
            class="chapter-select"
            :aria-label="t('writing.story.chooseChapter')"
          >
            <option v-for="(ch, i) in activeChapters" :key="ch.id" :value="ch.id">
              {{ i + 1 }} · {{ chapterTitle(ch, t) }} ({{ t('writing.story.cardsCount', { n: ch.notes.length }) }})
            </option>
          </select>
          <CardBoard :columns="visibleChapters" :color="BOARD_COLORS.chapter">
            <template #header="{ col }">
              <strong class="ch-title"><span class="ch-no">{{ activeChapters.indexOf(col) + 1 }}</span>{{ chapterTitle(col, t) }}</strong>
              <span v-if="chapterDesc(col, t)" class="ch-desc">{{ chapterDesc(col, t) }}</span>
            </template>
          </CardBoard>
        </template>

        <template v-if="story.characters.length">
          <h3 class="board-title small-title" :style="{ color: BOARD_COLORS.character }">☺ {{ t('writing.story.characters') }}</h3>
          <CardBoard :columns="story.characters" :color="BOARD_COLORS.character" readonly>
            <template #header="{ col }"><strong>{{ col.name.trim() || t('writing.story.unnamed') }}</strong></template>
          </CardBoard>
        </template>
        <template v-if="story.worlds.length">
          <h3 class="board-title small-title" :style="{ color: BOARD_COLORS.world }">⌂ {{ t('writing.story.worlds') }}</h3>
          <CardBoard :columns="story.worlds" :color="BOARD_COLORS.world" readonly>
            <template #header="{ col }"><strong>{{ col.name.trim() || t('writing.story.unnamed') }}</strong></template>
          </CardBoard>
        </template>
      </template>

      <div class="step-nav">
        <button v-if="story.step > 1" class="ghost" @click="go(story.step - 1)" :title="tl('writing.story.back')" :aria-label="tl('writing.story.back')"><Icon name="arrow-left" :label="tl('writing.story.back')" /></button>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.story.clear')" :aria-label="tl('writing.story.clear')"><Icon name="trash" :label="tl('writing.story.clear')" /></button>
        <button v-if="story.step < 3" class="primary" @click="go(story.step + 1)" :title="tl('writing.story.next')" :aria-label="tl('writing.story.next')"><Icon name="arrow-right" :label="tl('writing.story.next')" /></button>
        <RouterLink v-else :to="{ name: 'story-print' }" class="btn primary" :title="tl('writing.story.print')" :aria-label="tl('writing.story.print')"><Icon name="printer" :label="tl('writing.story.print')" /></RouterLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
.story { max-width: 1200px; }
.prose-w { max-width: 760px; }
.story__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
.story__head h1 { margin: 0; }
.small { font-size: 0.85rem; }

.field-label { display: block; font-weight: 600; margin-bottom: 0.3rem; }
.story-title { width: 100%; font: 700 1.25rem Georgia, serif; margin-bottom: 1.25rem; }
.kind { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; border: 0; padding: 0; margin: 0 0 0.5rem; }
.kind legend { float: left; margin-right: 0.25rem; padding: 0; }
.kind__opt { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 600; }
.kind__opt input { accent-color: #e85d3f; }
.tips { margin: 0 0 1rem; }
.tips summary { cursor: pointer; font-weight: 600; }
.tips ul { margin: 0.4rem 0 0; }

.chapter-list { list-style: none; padding: 0; margin: 0.75rem 0 1rem; display: flex; flex-direction: column; gap: 0.45rem; }
.chapter-card {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border);
  border-left: 5px solid #e85d3f;
  border-radius: 8px;
  background: var(--surface);
}
.chapter-card.custom { border-left-style: dashed; }
.chapter-card.off { opacity: 0.5; border-left-color: var(--border); }
.check { width: 1.15rem; height: 1.15rem; margin-top: 0.2rem; accent-color: #e85d3f; flex-shrink: 0; cursor: pointer; }
.chapter-card__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.chapter-card__title { font: 700 1.05rem Georgia, serif; cursor: pointer; }
.chapter-card__input { width: 100%; }
.chapter-card__tools { display: flex; gap: 1px; flex-shrink: 0; }
.chapter-card__tools button { padding: 0.2em 0.5em; }
.tag { align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }

.board-title { font-size: 1.15rem; margin: 1.25rem 0 0.5rem; }
.board-title small { font: 400 0.85rem system-ui, sans-serif; }
.small-title { font-size: 1rem; }
.col-name { width: 100%; font-weight: 700; background: var(--surface); }
.col-tools { display: flex; gap: 1px; }
.col-tools button { padding: 0.1em 0.45em; font-size: 0.85rem; }
.add-col {
  flex: 0 0 170px;
  align-self: stretch;
  min-height: 7rem;
  justify-content: center;
  border: 2px dashed color-mix(in srgb, var(--board) 50%, var(--border));
  color: var(--board);
  background: transparent;
  border-radius: 10px;
  font-weight: 600;
}
.chapter-select { width: 100%; margin-bottom: 0.6rem; font-weight: 600; }
@media (max-width: 640px) {
  /* boards stack vertically on phones: the add button becomes a full-width bar */
  .add-col { flex: 0 0 auto; width: 100%; min-height: 3rem; }
}
.ch-title { display: flex; align-items: baseline; gap: 0.4rem; font-family: Georgia, serif; }
.ch-no {
  display: inline-grid;
  place-items: center;
  min-width: 1.4em;
  height: 1.4em;
  border-radius: 50%;
  background: #e85d3f;
  color: #fff;
  font: 700 0.72rem system-ui, sans-serif;
}
.ch-desc { font-size: 0.78rem; line-height: 1.35; color: var(--muted); }
.step-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 1rem; }
</style>
