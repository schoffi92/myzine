<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from './Icon.vue'
import { createStory, initialValues, show } from '../writing/ink'

/*
 * Play an ink story as a reader would: the text appears as a page, the
 * choices are buttons (choices whose condition is false are hidden, as in
 * ink). With `showVars`, the variables panel sets the starting values for the
 * next run and shows the values now. The story restarts when the script changes.
 * Uses the player texts of Game dialogue (writing.game.*) and writing.ink.play*.
 */
const props = defineProps({
  parsed: { type: Object, required: true },
  showVars: { type: Boolean, default: false },
})

const startValues = reactive({})
const log = ref([]) // { type: 'line' | 'choice' | 'end' | 'error' | 'ranOut', text?, tags?, key?, params? }
const choices = ref(null)
const now = ref({})
const pageEl = ref(null)
let story = null

const empty = computed(() => !props.parsed.root.items.length && !props.parsed.knots.size)
const defaults = computed(() => initialValues(props.parsed))
const varNames = computed(() => Object.keys(defaults.value))

function syncStartValues() {
  for (const [name, v] of Object.entries(defaults.value)) {
    if (!(name in startValues) || typeof startValues[name] !== typeof v) startValues[name] = v
  }
  for (const name of Object.keys(startValues)) if (!(name in defaults.value)) delete startValues[name]
}

function advance() {
  const r = story.continue()
  for (const l of r.lines) log.value.push({ type: 'line', text: l.text, tags: l.tags })
  now.value = { ...story.vars }
  if (r.error) log.value.push({ type: 'error', key: r.error.key, params: r.error.params })
  if (r.end) {
    choices.value = null
    log.value.push({ type: r.ranOut && !r.error ? 'ranOut' : 'end' })
  } else choices.value = r.choices
  nextTick(() => pageEl.value && (pageEl.value.scrollTop = pageEl.value.scrollHeight))
}

function restart() {
  syncStartValues()
  log.value = []
  choices.value = null
  if (empty.value) return
  story = createStory(props.parsed, { ...startValues })
  advance()
}

function choose(i) {
  const c = choices.value?.[i]
  if (!c) return
  log.value.push({ type: 'choice', text: c.text })
  choices.value = null
  story.choose(i)
  advance()
}

function setStart(name, raw) {
  const cur = defaults.value[name]
  startValues[name] = typeof cur === 'number' ? Number(raw) || 0 : typeof cur === 'string' ? raw : !!raw
}

let timer = null
watch(
  () => props.parsed,
  () => {
    clearTimeout(timer)
    timer = setTimeout(restart, 350)
  },
  { immediate: true },
)
</script>

<template>
  <div class="player">
    <div class="bar">
      <button type="button" @click="restart" :title="tl('writing.game.restart')" :aria-label="tl('writing.game.restart')"><Icon name="reset" :label="tl('writing.game.restart')" /></button>
    </div>

    <div v-if="showVars && varNames.length" class="vars">
      <p class="vars-title"><strong>{{ t('writing.game.varsTitle') }}</strong> <span class="muted">{{ t('writing.game.varsHelp') }}</span></p>
      <table>
        <thead>
          <tr><th>{{ t('writing.game.varName') }}</th><th>{{ t('writing.game.varStart') }}</th><th>{{ t('writing.game.varNow') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="name in varNames" :key="name">
            <td><code>{{ name }}</code></td>
            <td>
              <input v-if="typeof defaults[name] === 'boolean'" type="checkbox" :checked="!!startValues[name]" :aria-label="name" @change="setStart(name, $event.target.checked); restart()" />
              <input v-else :type="typeof defaults[name] === 'number' ? 'number' : 'text'" class="val" :value="startValues[name]" :aria-label="name" @change="setStart(name, $event.target.value); restart()" />
            </td>
            <td><code>{{ name in now ? (typeof now[name] === 'string' ? `"${now[name]}"` : show(now[name])) : '—' }}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div ref="pageEl" class="page" aria-live="polite">
      <p v-if="empty" class="muted">{{ t('writing.ink.playEmpty') }}</p>
      <template v-for="(m, i) in log" :key="i">
        <p v-if="m.type === 'line'" class="line">{{ m.text }}<span v-for="tag in m.tags" :key="tag" class="tag">#{{ tag }}</span></p>
        <p v-else-if="m.type === 'choice'" class="chosen">→ {{ m.text }}</p>
        <p v-else-if="m.type === 'end'" class="end">— {{ t('writing.ink.end') }} —</p>
        <p v-else-if="m.type === 'ranOut'" class="warn-msg">{{ t('writing.ink.ranOut') }}</p>
        <p v-else-if="m.type === 'error'" class="error-msg">{{ t(`writing.ink.playErrors.${m.key}`, m.params) }}</p>
      </template>
    </div>

    <div v-if="choices" class="options">
      <button v-for="c in choices" :key="c.index" type="button" class="opt" @click="choose(c.index)">{{ c.text }}</button>
    </div>
  </div>
</template>

<style scoped>
.bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem; }
.vars { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; }
.vars-title { margin: 0 0 0.3rem; font-size: 0.9rem; }
.vars table { border-collapse: collapse; font-size: 0.9rem; }
.vars th { text-align: left; font-weight: 600; color: var(--muted); font-size: 0.78rem; padding: 0.15rem 1rem 0.15rem 0; }
.vars td { padding: 0.15rem 1rem 0.15rem 0; }
.val { width: 7rem; padding: 0.2em 0.4em; }
.page {
  max-height: 24rem; overflow-y: auto;
  padding: 1rem 1.25rem; border-radius: 8px;
  background: color-mix(in srgb, var(--text) 4%, var(--surface));
  font: 1.02rem/1.6 Georgia, 'Times New Roman', serif;
}
.page p { margin: 0 0 0.55rem; }
.tag { display: inline-block; margin-left: 0.4rem; font: italic 0.72rem system-ui, sans-serif; color: var(--muted); }
.chosen { color: var(--accent); font-style: italic; }
.end { text-align: center; color: var(--muted); font-size: 0.85rem; }
.warn-msg { text-align: center; color: #b07a00; font: 0.88rem system-ui, sans-serif; }
.error-msg { text-align: center; color: var(--danger); font: 0.9rem system-ui, sans-serif; }
.options { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.6rem; }
.opt { justify-content: flex-start; text-align: left; white-space: normal; }
</style>
