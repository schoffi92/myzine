<script setup>
import { ref, computed, nextTick } from 'vue'

/*
 * Text editor for Yarn: a monospaced textarea with line numbers (problem
 * lines marked) and buttons that insert a snippet. Tab indents only where
 * indentation means something (under an option, or an indented line), so a
 * keyboard user can still Tab out of the box everywhere else.
 */
const props = defineProps({
  modelValue: { type: String, required: true },
  tools: { type: Array, default: () => [] }, // [{ id, label, text, atEnd }]
  marks: { type: Object, default: () => ({}) }, // line → 'error' | 'warn' | 'info'
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  // Yarn: a line starting with -> is an option, and what's under it is indented. Off for ink, where -> is a divert.
  yarnOptions: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const ta = ref(null)
const gutter = ref(null)
const count = computed(() => Math.max(1, props.modelValue.split('\n').length))

const syncScroll = () => {
  if (gutter.value && ta.value) gutter.value.scrollTop = ta.value.scrollTop
}

async function setValue(value, caret) {
  emit('update:modelValue', value)
  await nextTick()
  const el = ta.value
  if (!el) return
  el.focus()
  el.setSelectionRange(caret, caret)
  syncScroll()
}

const lineStart = (s, pos) => s.lastIndexOf('\n', pos - 1) + 1
const lineEnd = (s, pos) => {
  const i = s.indexOf('\n', pos)
  return i < 0 ? s.length : i
}

/**
 * Insert a snippet. A node goes to the end of the text; anything else goes
 * on a new line after the caret's line, with that line's indentation (an
 * empty line is replaced). "…" in the snippet is where the caret lands.
 */
function insert(tool) {
  const s = props.modelValue
  const el = ta.value
  let text = tool.text
  let at
  let value
  if (tool.atEnd || !el) {
    const sep = !s.trim() ? '' : s.endsWith('\n\n') ? '' : s.endsWith('\n') ? '\n' : '\n\n'
    at = s.length + sep.length
    value = s + sep + text
  } else {
    const pos = el.selectionStart
    const start = lineStart(s, pos)
    const end = lineEnd(s, pos)
    const cur = s.slice(start, end)
    let indent = cur.match(/^[ ]*/)[0]
    if (props.yarnOptions && /^\s*->/.test(cur) && !/^\s*->/.test(text)) indent += '    ' // under an option: one level deeper
    text = text.split('\n').map((l) => (l ? indent + l : l)).join('\n')
    if (!cur.trim()) {
      value = s.slice(0, start) + text + s.slice(end)
      at = start
    } else {
      value = `${s.slice(0, end)}\n${text}${s.slice(end)}`
      at = end + 1
    }
  }
  const mark = text.indexOf('…')
  const caret = mark >= 0 ? at + mark : at + text.length
  setValue(value, caret)
  if (mark < 0) return
  // select the placeholder so typing replaces it: a whole "Character: …" line, else just the "…"
  const ls = text.lastIndexOf('\n', mark) + 1
  const lineText = text.slice(ls, mark + 1)
  const whole = /^\s*[^\s:<>-][^:<>]*: …$/.test(lineText)
  const from = whole ? at + ls + lineText.match(/^\s*/)[0].length : caret
  nextTick(() => ta.value?.setSelectionRange(from, caret + 1))
}

function onKey(e) {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return
  const s = props.modelValue
  const el = e.target
  const pos = el.selectionStart
  const start = lineStart(s, pos)
  const cur = s.slice(start, lineEnd(s, pos))
  const prevStart = start > 0 ? lineStart(s, start - 1) : -1
  const prev = prevStart >= 0 ? s.slice(prevStart, start - 1) : ''
  const option = (l) => props.yarnOptions && /^\s*->/.test(l)
  const meaningful = /^\s+\S/.test(cur) || option(cur) || option(prev) || /^\s+\S/.test(prev)
  if (!meaningful) return // let Tab move the focus
  e.preventDefault()
  if (e.shiftKey) {
    const n = Math.min(4, cur.match(/^ */)[0].length)
    if (n) setValue(s.slice(0, start) + s.slice(start + n), Math.max(start, pos - n))
  } else setValue(`${s.slice(0, start)}    ${s.slice(start)}`, pos + 4)
}

/** Put the caret at the start of a line (1-based) and show it. */
function gotoLine(n) {
  const el = ta.value
  if (!el) return
  const lines = props.modelValue.split('\n')
  let pos = 0
  for (let i = 0; i < Math.min(n - 1, lines.length); i++) pos += lines[i].length + 1
  el.focus()
  el.setSelectionRange(pos, pos + (lines[n - 1]?.length || 0))
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
  el.scrollTop = Math.max(0, (n - 4) * lineHeight)
  syncScroll()
}

defineExpose({ gotoLine, insert })
</script>

<template>
  <div class="yarn-editor">
    <div v-if="tools.length" class="toolbar" role="toolbar" :aria-label="label">
      <button v-for="tool in tools" :key="tool.id" type="button" class="tool" @mousedown.prevent @click="insert(tool)">+ {{ tool.label }}</button>
    </div>
    <div class="box">
      <div ref="gutter" class="gutter" aria-hidden="true">
        <div v-for="n in count" :key="n" class="num" :class="marks[n] && `m-${marks[n]}`">{{ n }}</div>
      </div>
      <textarea
        ref="ta"
        :value="modelValue"
        wrap="off"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        :aria-label="label"
        :placeholder="placeholder"
        @input="emit('update:modelValue', $event.target.value)"
        @scroll="syncScroll"
        @keydown="onKey"
      />
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.tool { font: 0.82rem ui-monospace, 'Cascadia Code', Consolas, monospace; padding: 0.3em 0.7em; }
.box {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  --lh: 1.55rem;
}
.box:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.gutter {
  flex: none;
  min-width: 2.6rem;
  padding: 0.6rem 0;
  overflow: hidden;
  text-align: right;
  font: 0.8rem/var(--lh) ui-monospace, 'Cascadia Code', Consolas, monospace;
  color: var(--muted);
  border-right: 1px solid var(--border);
  user-select: none;
  height: 26rem;
  box-sizing: border-box;
}
.num { padding: 0 0.5rem; height: var(--lh); }
.num.m-error { background: color-mix(in srgb, var(--danger, #c0392b) 22%, transparent); color: inherit; font-weight: 700; }
.num.m-warn { background: color-mix(in srgb, #e0a100 25%, transparent); }
.num.m-info { background: color-mix(in srgb, var(--accent) 12%, transparent); }
textarea {
  flex: 1;
  min-width: 0;
  height: 26rem;
  border: 0;
  border-radius: 0;
  outline: none !important;
  resize: none;
  padding: 0.6rem 0.75rem;
  font: 0.92rem/var(--lh) ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace;
  white-space: pre;
  overflow: auto;
  tab-size: 4;
  /* show -> === << exactly as typed (coding fonts would join them into arrows) */
  font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0;
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .gutter, textarea { height: 20rem; }
  .gutter { min-width: 2.1rem; }
}
</style>
