<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { analyzeLine, lineValues, checkLine, nextMark, usesLength } from '../writing/meter'
import RhythmMark from './RhythmMark.vue'

/*
 * The rhythm row under one line of the Iamb and trochee practice: one button
 * per syllable (tap to mark stress, or long/short in Hungarian), grouped by
 * word, and how many feet fit the rhythm. With `editCounts` every word gets
 * −/+ to fix a wrong syllable estimate. See writing/meter.js.
 * `check` and `offset`: a half of a longer line (a shared line in the drama
 * practice) shown with the whole line's result; `offset` is where it starts.
 */
const props = defineProps({
  text: { type: String, default: '' },
  locale: { type: String, required: true },
  rhythm: { type: String, required: true }, // iamb | trochee
  feet: { type: Number, required: true },
  marks: { type: Object, default: () => ({}) },
  counts: { type: Object, default: () => ({}) },
  editCounts: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  check: { type: Object, default: null },
  offset: { type: Number, default: 0 },
})
const emit = defineEmits(['mark', 'count'])

const hu = computed(() => usesLength(props.locale))
const words = computed(() => analyzeLine(props.text, props.locale, props.marks, props.counts))
const result = computed(() => props.check ?? checkLine(lineValues(words.value), props.rhythm, props.feet, props.locale))

/** Is the foot a syllable belongs to off the rhythm? */
const badSlot = (s) => {
  const r = result.value
  if (!r) return false
  const foot = Math.floor((s.pos + props.offset) / 2)
  return foot < r.feet.length ? !r.feet[foot] : !r.countOk
}

const stateName = (v) => t(`writing.meter.${hu.value ? { S: 'long', u: 'short', x: 'either' }[v] : { S: 'stressed', u: 'unstressed', x: 'either' }[v]}`)
const slotLabel = (w, i, s) => t('writing.meter.syllableLabel', { word: w.text, i: i + 1, n: w.slots.length, state: stateName(s.value) })

function tap(s) {
  if (props.readonly) return
  emit('mark', s.key, nextMark(s))
}

function changeCount(w, d) {
  const n = Math.max(0, Math.min(9, w.n + d))
  emit('count', w.key, n === w.auto ? null : n)
}
</script>

<template>
  <div v-if="words.length" class="rr">
    <div class="rr__words">
      <span v-for="w in words" :key="w.key" class="rr__w" :class="{ joins: w.joins }">
        <span class="rr__t">{{ w.text }}</span>
        <span class="rr__dots">
          <span v-if="w.joins" class="rr__link" :title="t('writing.meter.joined')" aria-hidden="true">‿</span>
          <template v-for="(s, i) in w.slots" :key="s.key">
            <button
              type="button"
              class="rr__dot"
              :class="{ set: s.set, bad: badSlot(s), [`v-${s.value}`]: true }"
              :disabled="readonly"
              :aria-label="slotLabel(w, i, s)"
              :title="slotLabel(w, i, s)"
              @click="tap(s)"
            ><RhythmMark :value="s.value" :locale="locale" /></button>
          </template>
          <span v-if="!w.slots.length" class="rr__none" aria-hidden="true">∅</span>
        </span>
        <span v-if="editCounts && !hu && !readonly" class="rr__fix">
          <button type="button" :aria-label="t('writing.meter.fewer', { word: w.text })" :title="t('writing.meter.fewer', { word: w.text })" :disabled="w.n <= 0" @click="changeCount(w, -1)">−</button>
          <button type="button" :aria-label="t('writing.meter.more', { word: w.text })" :title="t('writing.meter.more', { word: w.text })" :disabled="w.n >= 9" @click="changeCount(w, 1)">+</button>
        </span>
      </span>
    </div>
    <p v-if="result" class="rr__res" :class="{ ok: result.ok }" role="status">
      <span class="rr__feet" aria-hidden="true"><span v-for="(f, i) in result.feet" :key="i" :class="f ? 'yes' : 'no'">{{ f ? '✓' : '✗' }}</span></span>
      <span>{{ t('writing.meter.feetFit', { n: result.fits, total: result.total }) }}</span>
      <span v-if="!result.countOk" class="rr__count">· {{ t('writing.meter.syllables', { n: result.syllables, need: result.min === result.max ? result.min : `${result.min}–${result.max}` }) }}</span>
    </p>
  </div>
</template>

<style scoped>
.rr { --ok: #2f7d32; margin: 0.25rem 0 0; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .rr { --ok: #7cc47f; } }
:root[data-theme='dark'] .rr { --ok: #7cc47f; }
.rr__words { display: flex; flex-wrap: wrap; gap: 0.15rem 0.7rem; }
.rr__w { display: inline-flex; flex-direction: column; align-items: flex-start; }
.rr__t { font-size: 0.72rem; color: var(--muted); line-height: 1.2; }
.rr__dots { display: inline-flex; align-items: center; }
.rr__dot {
  min-width: 1.6rem; min-height: 1.6rem; padding: 0; margin: 0;
  border: 1px solid transparent; border-radius: 6px; background: none;
  font: 600 1rem/1 system-ui, sans-serif; color: var(--text); cursor: pointer;
}
.rr__dot:hover:not(:disabled) { border-color: var(--border); }
.rr__dot:disabled { cursor: default; opacity: 1; }
.rr__dot.v-x { color: var(--muted); }
.rr__dot.set { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.rr__dot.bad { color: var(--danger); }
.rr__link { color: var(--muted); margin: 0 -0.2rem; }
.rr__none { color: var(--muted); font-size: 0.8rem; padding: 0 0.3rem; }
.rr__fix { display: inline-flex; gap: 2px; margin-top: 2px; }
.rr__fix button { min-height: 0; min-width: 1.5rem; padding: 0 0.2rem; font-size: 0.85rem; line-height: 1.3; }
.rr__res { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.rr__res.ok { color: var(--ok); }
.rr__feet { display: inline-flex; gap: 0.15rem; font-weight: 700; }
.rr__feet .yes { color: var(--ok); }
.rr__feet .no { color: var(--danger); }
</style>
