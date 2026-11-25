<script setup>
import { ref, computed } from 'vue'
import { t, tl } from '../i18n'

/*
 * Choose a premise: draw one at random, pick one from the list, or write your
 * own. Picking clears your own text, typing your own clears the pick.
 * Texts come from `<base>.prompts.<key>`, `<base>.draw`, `.showList`,
 * `.hideList`, `.promptLabel`, `.noPrompt`, `.ownLabel`, `.ownPlaceholder`.
 */
const props = defineProps({
  keys: { type: Array, required: true },
  base: { type: String, required: true }, // i18n prefix, e.g. 'writing.game'
  id: { type: String, required: true }, // for element ids
})
const promptKey = defineModel('promptKey', { type: [String, null], default: null })
const ownPrompt = defineModel('ownPrompt', { type: String, default: '' })

const listOpen = ref(false)
const current = computed(() => (props.keys.includes(promptKey.value) ? t(`${props.base}.prompts.${promptKey.value}`) : ownPrompt.value.trim()))

function pick(key) {
  promptKey.value = key
  ownPrompt.value = ''
  listOpen.value = false
}
function draw() {
  const pool = props.keys.filter((k) => k !== promptKey.value)
  pick(pool[Math.floor(Math.random() * pool.length)])
}
function onOwn(e) {
  ownPrompt.value = e.target.value
  if (ownPrompt.value.trim()) promptKey.value = null
}
</script>

<template>
  <div class="premise">
    <div class="brief" aria-live="polite">
      <small>{{ t(`${base}.promptLabel`) }}</small>
      <p v-if="current">{{ current }}</p>
      <p v-else class="muted">{{ t(`${base}.noPrompt`) }}</p>
    </div>
    <div class="row">
      <button type="button" class="ghost" @click="draw" :title="tl(`${base}.draw`)" :aria-label="tl(`${base}.draw`)">🎲 <span class="btn-label">{{ t(`${base}.draw`) }}</span></button>
      <button type="button" class="ghost" :aria-expanded="listOpen" :aria-controls="`${id}-list`" @click="listOpen = !listOpen">{{ listOpen ? t(`${base}.hideList`) : t(`${base}.showList`) }}</button>
    </div>
    <ul v-if="listOpen" :id="`${id}-list`" class="opt-list">
      <li v-for="k in keys" :key="k">
        <button type="button" class="opt" :class="{ active: promptKey === k }" :aria-pressed="promptKey === k" @click="pick(k)">{{ t(`${base}.prompts.${k}`) }}</button>
      </li>
    </ul>
    <label class="field-label" :for="`${id}-own`">{{ t(`${base}.ownLabel`) }}</label>
    <input :id="`${id}-own`" :value="ownPrompt" maxlength="200" autocomplete="off" :placeholder="t(`${base}.ownPlaceholder`)" @input="onOwn" />
  </div>
</template>

<style scoped>
.brief {
  margin: 0 0 0.75rem; padding: 0.7rem 1rem;
  border-left: 4px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border-radius: 0 8px 8px 0;
}
.brief p { margin: 0.2rem 0 0; font: 1.08rem/1.5 Georgia, 'Times New Roman', serif; }
.brief p.muted { font: inherit; }
small { display: block; font: 600 0.72rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.opt-list { list-style: none; margin: 0.6rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.opt { width: 100%; text-align: left; justify-content: flex-start; white-space: normal; }
.opt.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.field-label { display: block; font-weight: 600; margin: 1rem 0 0.35rem; }
input { width: 100%; box-sizing: border-box; }
</style>
