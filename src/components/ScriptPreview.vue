<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { layoutScript } from '../composables/script'

/*
 * Screenplay pages drawn to scale: 8.5×11" Letter, Courier 12 pt, margins
 * 1.5" left, 1" right, top and bottom. Everything is in ch/em of a monospaced
 * font (1ch = 0.1", 1em line = 1/6"), and the font size follows the width of
 * the column, so a page always fits and keeps its proportions.
 * `annotate` tints each element (used by the "The page" lesson, with a legend).
 */
const props = defineProps({
  blocks: { type: Array, required: true },
  annotate: { type: Boolean, default: false },
  minuteLabels: { type: Boolean, default: true },
})

const pages = computed(() => layoutScript(props.blocks))
</script>

<template>
  <div class="script-preview" :class="{ annotate }">
    <figure v-for="(page, i) in pages" :key="i" class="page-wrap">
      <div class="page" :aria-label="t('writing.script.pageN', { n: i + 1 })">
        <span v-if="i > 0" class="page-no" aria-hidden="true">{{ i + 1 }}.</span>
        <div v-for="(l, j) in page" :key="j" class="ln" :class="`k-${l.kind}`" :style="{ paddingLeft: `${l.indent}ch` }"><span>{{ l.text }}</span></div>
      </div>
      <figcaption v-if="minuteLabels" class="muted">{{ t('writing.script.pageMinute', { n: i + 1 }) }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.script-preview { container-type: inline-size; display: flex; flex-direction: column; gap: 1rem; }
.page-wrap { margin: 0; }
.page {
  /* 85 characters across the page: the font size makes 85ch the column width (Courier is 0.6em wide) */
  --fs: calc(100cqi / 85 / 0.6);
  font: var(--fs) / 1 'Courier Prime', 'Courier New', Courier, monospace;
  position: relative;
  box-sizing: border-box;
  width: 85ch;
  height: calc(11 * 6em);
  padding: 6em 10ch 6em 15ch;
  background: #fff;
  color: #111;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.15);
  border-radius: 2px;
  overflow: hidden;
}
.page-no { position: absolute; top: 3em; right: 10ch; }
.ln { white-space: pre; height: 1em; }
.k-more { color: #555; }
figcaption { font-size: 0.8rem; text-align: right; margin-top: 0.25rem; }

/* the lesson sample: only as tall as its text */
.annotate .page { height: auto; padding-bottom: 3em; }
.annotate .k-scene span { background: #ffe1d6; }
.annotate .k-action span { background: #e4f0ff; }
.annotate .k-character span { background: #e6f6e1; }
.annotate .k-paren span { background: #f6ecff; }
.annotate .k-dialogue span { background: #fff6cc; }
.annotate .k-transition span { background: #e9e9e9; }
</style>
