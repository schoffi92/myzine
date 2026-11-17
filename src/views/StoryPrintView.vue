<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { t } from '../i18n'
import { BOARD_COLORS, loadStory, chapterTitle, chapterDesc } from '../composables/storyCards'

const story = ref(null)
const include = reactive({ chapters: true, characters: true, worlds: true })

const sections = computed(() => {
  if (!story.value) return []
  const s = story.value
  const out = []
  if (include.chapters) {
    out.push({
      key: 'chapters',
      heading: t('writing.story.steps')[2],
      color: BOARD_COLORS.chapter,
      columns: s.chapters
        .filter((c) => c.enabled)
        .map((c, i) => ({ id: c.id, title: `${i + 1}. ${chapterTitle(c, t)}`, desc: chapterDesc(c, t), notes: c.notes })),
    })
  }
  for (const [key, kind] of [['characters', 'character'], ['worlds', 'world']]) {
    if (include[key] && s[key].length) {
      out.push({
        key,
        heading: t(`writing.story.${key}`),
        color: BOARD_COLORS[kind],
        columns: s[key].map((c) => ({ id: c.id, title: c.name.trim() || t('writing.story.unnamed'), desc: '', notes: c.notes })),
      })
    }
  }
  return out
})

/* Page settings only while this view is open */
const pageStyle = document.createElement('style')
pageStyle.textContent = '@page { size: A4 landscape; margin: 10mm; }'

onMounted(async () => {
  document.head.appendChild(pageStyle)
  story.value = await loadStory()
})
onBeforeUnmount(() => pageStyle.remove())

const printPage = () => window.print()
</script>

<template>
  <section class="story-print">
    <div class="toolbar no-print">
      <RouterLink :to="{ name: 'story' }" class="btn ghost">←</RouterLink>
      <h1>{{ t('writing.story.printTitle') }}</h1>
      <span class="spacer" />
      <span class="muted">{{ t('writing.story.include') }}:</span>
      <label><input v-model="include.chapters" type="checkbox" /> {{ t('writing.story.steps')[2] }}</label>
      <label><input v-model="include.characters" type="checkbox" /> {{ t('writing.story.characters') }}</label>
      <label><input v-model="include.worlds" type="checkbox" /> {{ t('writing.story.worlds') }}</label>
      <button class="primary" :disabled="!sections.length" @click="printPage">🖶 {{ t('writing.story.printBtn') }}</button>
    </div>
    <p class="muted no-print hint">{{ t('writing.story.printHint') }}</p>

    <div v-if="story" class="sheets">
      <section v-for="(sec, si) in sections" :key="sec.key" class="sheet" :class="{ first: si === 0 }" :style="{ '--c': sec.color }">
        <header class="sheet__head">
          <span class="story-name">{{ story.title.trim() || t('writing.story.storyTitlePh') }}</span>
          <h2>{{ sec.heading }}</h2>
        </header>
        <div class="grid">
          <div v-for="col in sec.columns" :key="col.id" class="pcol">
            <div class="pcol__head">
              <strong>{{ col.title }}</strong>
              <small v-if="col.desc">{{ col.desc }}</small>
            </div>
            <div v-for="note in col.notes.filter((n) => n.text.trim())" :key="note.id" class="pnote">{{ note.text }}</div>
            <!-- empty ruled cards to write on by hand -->
            <div v-if="!col.notes.some((n) => n.text.trim())" class="pnote blank" />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.story-print { max-width: 1200px; margin: 0 auto; padding: 1rem; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
.toolbar h1 { font-size: 1.25rem; margin: 0; }
.toolbar label { display: inline-flex; align-items: center; gap: 0.3em; font-size: 0.9rem; cursor: pointer; }
.toolbar input { width: auto; }
.hint { font-size: 0.85rem; margin: 0.4rem 0 1rem; }

/* Paper look on screen, whatever the theme */
.sheet {
  background: #fff;
  color: #1c1a17;
  padding: 10mm;
  margin-bottom: 1.25rem;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.15), 0 12px 28px rgb(0 0 0 / 0.1);
}
.sheet__head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; border-bottom: 2px solid var(--c); margin-bottom: 5mm; padding-bottom: 2mm; }
.sheet__head h2 { margin: 0; font: 700 15pt Georgia, serif; color: var(--c); }
.story-name { font: italic 11pt Georgia, serif; color: #555; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(48mm, 1fr)); gap: 4mm; align-items: start; }
.pcol {
  break-inside: avoid;
  border: 0.4mm solid color-mix(in srgb, var(--c) 55%, #ccc);
  border-top: 2mm solid var(--c);
  border-radius: 2mm;
  padding: 2.5mm;
  display: flex;
  flex-direction: column;
  gap: 2mm;
}
.pcol__head strong { display: block; font: 700 10.5pt Georgia, serif; }
.pcol__head small { display: block; font: 7.5pt/1.3 system-ui, sans-serif; color: #666; margin-top: 0.8mm; }
.pnote {
  break-inside: avoid;
  border: 0.3mm dashed #b9b2a5;
  border-radius: 1.5mm;
  padding: 2mm 2.5mm;
  font: 9pt/1.4 Georgia, serif;
  white-space: pre-wrap;
  background: #fffdf5;
}
.pnote.blank {
  min-height: 22mm;
  background: repeating-linear-gradient(transparent 0 5.6mm, #e4ded2 5.6mm 5.9mm);
}

@media print {
  .story-print { padding: 0; max-width: none; }
  .sheet { box-shadow: none; border-radius: 0; padding: 0; margin: 0; }
  .sheet:not(.first) { break-before: page; }
}
</style>
