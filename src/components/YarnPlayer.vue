<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from './Icon.vue'
import { createRunner, initialValues } from '../writing/yarn'

/*
 * Play a Yarn conversation as the player would: lines appear as a chat,
 * options are buttons (an option whose condition is false is shown disabled
 * with the condition). With `showVars`, the variables panel sets the starting
 * values for the next run and shows the values now.
 * The conversation restarts when the script changes.
 */
const props = defineProps({
  parsed: { type: Object, required: true },
  showVars: { type: Boolean, default: false },
  showDisabled: { type: Boolean, default: true },
})

const startValues = reactive({}) // name → value chosen by the writer
const startFrom = ref('')
const log = ref([]) // { type: 'line' | 'command' | 'choice' | 'end' | 'error', ... }
const options = ref(null)
const now = ref({})
const chatEl = ref(null)
let runner = null

const titles = computed(() => [...new Set(props.parsed.nodes.map((n) => n.title).filter(Boolean))])
const defaults = computed(() => initialValues(props.parsed))
const varNames = computed(() => Object.keys(defaults.value))

/** Keep the writer's chosen start values when the script changes; add new variables, drop gone ones. */
function syncStartValues() {
  for (const [name, v] of Object.entries(defaults.value)) {
    if (!(name in startValues) || typeof startValues[name] !== typeof v) startValues[name] = v
  }
  for (const name of Object.keys(startValues)) if (!(name in defaults.value)) delete startValues[name]
}

function advance() {
  for (let guard = 0; guard < 500; guard++) {
    const step = runner.next()
    now.value = { ...runner.vars }
    if (step.type === 'options') {
      options.value = step.options
      break
    }
    log.value.push(step)
    if (step.type === 'end' || step.type === 'error') break
  }
  nextTick(() => chatEl.value && (chatEl.value.scrollTop = chatEl.value.scrollHeight))
}

function restart() {
  syncStartValues()
  log.value = []
  options.value = null
  if (!titles.value.length) return
  runner = createRunner(props.parsed, { ...startValues }, startFrom.value)
  advance()
}

function choose(i) {
  const o = options.value[i]
  if (!o.available) return
  log.value.push({ type: 'choice', text: o.text })
  options.value = null
  runner.choose(i)
  advance()
}

const show = (v) => (typeof v === 'string' ? `"${v}"` : String(v))
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
watch(startFrom, restart)
</script>

<template>
  <div class="player">
    <div class="bar">
      <button type="button" @click="restart" :title="tl('writing.game.restart')" :aria-label="tl('writing.game.restart')"><Icon name="reset" :label="tl('writing.game.restart')" /></button>
      <label class="from">
        <span>{{ t('writing.game.startFrom') }}</span>
        <select v-model="startFrom">
          <option value="">{{ t('writing.game.startDefault') }}</option>
          <option v-for="ti in titles" :key="ti" :value="ti">{{ ti }}</option>
        </select>
      </label>
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
            <td><code>{{ name in now ? show(now[name]) : '—' }}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div ref="chatEl" class="chat" aria-live="polite">
      <p v-if="!titles.length" class="muted">{{ t('writing.game.playEmpty') }}</p>
      <template v-for="(m, i) in log" :key="i">
        <div v-if="m.type === 'line'" class="msg" :class="{ narration: !m.speaker }">
          <strong v-if="m.speaker" class="who">{{ m.speaker }}</strong>
          <span>{{ m.text }}</span>
          <span v-for="tag in m.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>
        <div v-else-if="m.type === 'command'" class="cmd">⟨{{ m.text }}⟩</div>
        <div v-else-if="m.type === 'choice'" class="msg you"><span class="who">{{ t('writing.game.you') }}</span> {{ m.text }}</div>
        <div v-else-if="m.type === 'end'" class="end">— {{ t('writing.game.end') }} —</div>
        <div v-else-if="m.type === 'error'" class="error-msg">{{ t(`writing.game.playErrors.${m.key}`, m.params) }}</div>
      </template>
    </div>

    <div v-if="options" class="options">
      <template v-for="(o, i) in options" :key="i">
        <button v-if="o.available || showDisabled" type="button" class="opt" :disabled="!o.available" @click="choose(i)">
          <span>→ {{ o.text }}</span>
          <small v-if="!o.available" class="cond">{{ t('writing.game.needs', { cond: o.condSrc }) }}</small>
        </button>
      </template>
      <p v-if="!options.some((o) => o.available)" class="muted small">{{ t('writing.game.noOptions') }}</p>
    </div>
  </div>
</template>

<style scoped>
.bar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem; }
.from { display: flex; gap: 0.4rem; align-items: center; font-size: 0.9rem; }
.vars { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; }
.vars-title { margin: 0 0 0.3rem; font-size: 0.9rem; }
.vars table { border-collapse: collapse; font-size: 0.9rem; }
.vars th { text-align: left; font-weight: 600; color: var(--muted); font-size: 0.78rem; padding: 0.15rem 1rem 0.15rem 0; }
.vars td { padding: 0.15rem 1rem 0.15rem 0; }
.val { width: 7rem; padding: 0.2em 0.4em; }
.chat {
  max-height: 22rem; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.45rem;
  padding: 0.75rem; border-radius: 8px;
  background: color-mix(in srgb, var(--text) 4%, var(--surface));
}
.msg { align-self: flex-start; max-width: 85%; padding: 0.45rem 0.75rem; border-radius: 12px 12px 12px 4px; background: var(--surface); border: 1px solid var(--border); }
.msg .who { display: block; font-size: 0.78rem; color: var(--accent); }
.msg.narration { align-self: center; background: transparent; border: 0; font-style: italic; color: var(--muted); text-align: center; }
.msg.you { align-self: flex-end; border-radius: 12px 12px 4px 12px; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.msg.you .who { display: inline; color: var(--muted); }
.tag { display: inline-block; margin-left: 0.4rem; font-size: 0.72rem; color: var(--muted); font-style: italic; }
.cmd { align-self: center; font: 0.8rem ui-monospace, Consolas, monospace; color: var(--muted); }
.end { align-self: center; color: var(--muted); font-size: 0.85rem; margin-top: 0.3rem; }
.error-msg { align-self: center; color: var(--danger); font-size: 0.9rem; }
.options { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.6rem; }
.opt { justify-content: space-between; text-align: left; white-space: normal; flex-wrap: wrap; }
.opt:disabled { opacity: 0.6; }
.cond { font: 0.75rem ui-monospace, Consolas, monospace; color: var(--muted); }
.small { font-size: 0.85rem; margin: 0.2rem 0 0; }
</style>
