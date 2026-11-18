<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ZinePage from '../components/ZinePage.vue'
import { getZine, listPages, ZINE_PAGE_COUNT } from '../db/zines'
import { settings } from '../composables/settings'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

const props = defineProps({ id: { type: String, required: true } })

/*
 * Imposition for a one-sheet, 8-page zine on landscape A4 (4 columns × 2 rows).
 * Numbers are page indexes: 0 = front cover, 1–6 = inside pages, 7 = back cover.
 * The top row is printed upside down so every page reads upright after folding.
 *
 *   ┌───┬───┬───┬───┐
 *   │ 4 │ 3 │ 2 │ 1 │  ← rotated 180°
 *   ├───┼───┼───┼───┤
 *   │ 5 │ 6 │ 7 │ 0 │
 *   └───┴───┴───┴───┘
 */
const TOP_ROW = [4, 3, 2, 1]
const BOTTOM_ROW = [5, 6, 7, 0]

const MM = 96 / 25.4 // CSS px per mm
const SHEET_W = 297 * MM
const SHEET_H = 210 * MM

const zine = ref(null)
const pages = ref([])
const notFound = ref(false)
const showGuides = ref(true)

const slots = computed(() => [
  ...TOP_ROW.map((i) => ({ i, flipped: true, page: pages.value[i] })),
  ...BOTTOM_ROW.map((i) => ({ i, flipped: false, page: pages.value[i] })),
])

/* Scale the real-size A4 sheet to fit the screen (print uses real size). */
const frame = ref(null)
const scale = ref(1)
let observer

/* Page-level print settings only while this view is open. */
const pageStyle = document.createElement('style')
pageStyle.textContent = '@page { size: A4 landscape; margin: 0; }'

onMounted(async () => {
  document.head.appendChild(pageStyle)
  observer = new ResizeObserver(([entry]) => {
    scale.value = Math.min(1, entry.contentRect.width / SHEET_W)
  })
  observer.observe(frame.value)

  zine.value = await getZine(props.id)
  if (!zine.value) {
    notFound.value = true
    return
  }
  settings.lastZineId = props.id
  pages.value = await listPages(props.id)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  pageStyle.remove()
})

const print = () => window.print()
</script>

<template>
  <section class="print-view">
    <div class="print-toolbar no-print">
      <RouterLink :to="{ name: 'edit', params: { id } }" class="btn ghost" :title="t('print.back')" :aria-label="t('print.back')">←</RouterLink>
      <h1>{{ t('print.title') }}<template v-if="zine">: {{ zine.title }}</template></h1>
      <span class="spacer" />
      <label class="check">
        <input v-model="showGuides" type="checkbox" />
        {{ t('print.guides') }}
      </label>
      <button class="primary" :disabled="!zine" @click="print" :title="tl('print.print')" :aria-label="tl('print.print')"><Icon name="printer" :label="tl('print.print')" /></button>
    </div>

    <p v-if="notFound" class="error no-print">{{ t('editor.notFound') }}</p>
    <p v-if="pages.length > ZINE_PAGE_COUNT" class="warning no-print">
      {{ t('print.extraPages', { n: pages.length }) }}
    </p>

    <div ref="frame" class="sheet-frame" :style="{ height: SHEET_H * scale + 'px' }">
      <div
        v-if="zine"
        class="sheet"
        :class="{ 'with-guides': showGuides }"
        :style="{ transform: `scale(${scale})`, '--accent': zine.color }"
      >
        <div v-for="slot in slots" :key="slot.i" class="panel" :class="{ flipped: slot.flipped }">
          <ZinePage v-if="slot.page" :page="slot.page" :accent="zine.color" :font-size="11" :show-blank="false" />
        </div>

        <template v-if="showGuides">
          <span class="guide fold v" style="left: 25%" />
          <span class="guide fold v" style="left: 50%" />
          <span class="guide fold v" style="left: 75%" />
          <span class="guide fold h" style="left: 0; width: 25%" />
          <span class="guide fold h" style="left: 75%; width: 25%" />
          <span class="guide cut h" style="left: 25%; width: 50%"><i>✂</i></span>
        </template>
      </div>
    </div>

    <div class="fold-help no-print">
      <h2>{{ t('print.howTo') }}</h2>
      <ol>
        <li v-for="(step, n) in t('print.steps')" :key="n">{{ step }}</li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.print-view { max-width: 1200px; margin: 0 auto; padding: 1rem; }
.print-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.print-toolbar h1 { font-size: 1.3rem; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.check { display: inline-flex; align-items: center; gap: 0.4em; font-size: 0.9rem; cursor: pointer; }
.check input { width: auto; }
.warning { padding: 0.6rem 0.9rem; border-radius: 8px; background: color-mix(in srgb, var(--accent) 15%, transparent); }

.sheet-frame { width: 100%; position: relative; }

/* The sheet is always paper-white, whatever the site theme. */
.sheet {
  --surface: #fff;
  --text: #1a1a1a;
  --muted: #777;
  --border: #ddd;
  color-scheme: light;
  position: absolute;
  top: 0;
  left: 0;
  width: 297mm;
  height: 210mm;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  background: #fff;
  color: var(--text);
  transform-origin: top left;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.15), 0 12px 32px rgb(0 0 0 / 0.12);
  overflow: hidden;
}

.panel { position: relative; overflow: hidden; min-width: 0; min-height: 0; }
.panel.flipped { transform: rotate(180deg); }

.panel :deep(.zine-page) {
  height: 100%;
  border: 0;
  border-top: 2.5mm solid var(--accent);
  border-radius: 0;
  box-shadow: none;
  padding: 5mm 5mm 4mm;
  display: flex;
  flex-direction: column;
}
.panel :deep(.zine-page h2) { font-size: 1.45em; }
.panel :deep(.zine-page p) { margin-bottom: 0.6em; }
.panel :deep(.layout-image-left) { display: flex; }
.panel :deep(.zine-page__img) {
  width: 100%;
  max-height: 48%;
  min-height: 0;
  object-fit: cover;
  margin: 0 0 3mm;
  flex-shrink: 0;
}
.panel :deep(.zine-page__text) { min-height: 0; overflow: hidden; }

/* Fold (dashed) and cut (solid) guides */
.guide { position: absolute; pointer-events: none; }
.guide.v { top: 0; bottom: 0; width: 0; border-left: 0.3mm dashed #b5b5b5; }
.guide.h { top: 50%; height: 0; }
.guide.fold.h { border-top: 0.3mm dashed #b5b5b5; }
.guide.cut { border-top: 0.4mm solid #555; }
.guide.cut i { position: absolute; left: -2.2mm; top: -2.4mm; font-size: 3.5mm; font-style: normal; line-height: 1; color: #555; background: #fff; }

.fold-help { max-width: 720px; margin-top: 1.5rem; }
.fold-help h2 { font-size: 1.2rem; }
.fold-help li { margin-bottom: 0.4rem; }

@media print {
  .print-view { padding: 0; max-width: none; }
  .sheet-frame { height: auto !important; }
  .sheet {
    position: static;
    transform: none !important;
    box-shadow: none;
    height: 209.5mm; /* a hair under A4 so browsers don't spill onto a 2nd page */
  }
}
</style>
