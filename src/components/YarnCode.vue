<script setup>
import { computed } from 'vue'

/*
 * Read-only Yarn snippet with colours for each part of the syntax (headers,
 * ---/===, speakers, options, commands, variables, tags, comments).
 * Rendered as text spans, never as HTML.
 */
const props = defineProps({ src: { type: String, required: true } })

const TOKEN = /(\/\/.*$)|(<<[^>]*>>)|(\$[A-Za-z_]\w*)|(#[^\s#]+)|(\{[^}]*\})/g

function lineParts(line) {
  if (/^\s*(---|===)\s*$/.test(line)) return [{ k: 'sep', s: line }]
  const h = /^(\s*)([A-Za-z_][\w-]*:)(.*)$/.exec(line)
  const out = []
  let body = line
  let lead = ''
  if (h && !line.includes('<<') && /^\s*(title|tags|position|color|group)\s*:/.test(line)) return [{ k: 'header', s: line }]
  const opt = /^(\s*)(->)(.*)$/.exec(line)
  if (opt) {
    lead = opt[1]
    out.push({ k: '', s: lead }, { k: 'option', s: opt[2] })
    body = opt[3]
  } else {
    const sp = /^(\s*)([^:{}<>#/\s][^:{}<>#]{0,39}:)(\s.*)?$/.exec(line)
    if (sp && !line.trim().startsWith('<<')) {
      out.push({ k: '', s: sp[1] }, { k: 'speaker', s: sp[2] })
      body = sp[3] || ''
    }
  }
  let last = 0
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > last) out.push({ k: '', s: body.slice(last, m.index) })
    const k = m[1] ? 'comment' : m[2] ? 'command' : m[3] ? 'var' : m[4] ? 'tag' : 'var'
    out.push({ k, s: m[0] })
    last = m.index + m[0].length
  }
  if (last < body.length) out.push({ k: '', s: body.slice(last) })
  return out
}

const lines = computed(() => props.src.split('\n').map(lineParts))
</script>

<template>
  <pre class="yarn-code"><code><template v-for="(parts, i) in lines" :key="i"><span v-for="(p, j) in parts" :key="j" :class="p.k && `y-${p.k}`">{{ p.s }}</span>{{ i < lines.length - 1 ? '\n' : '' }}</template></code></pre>
</template>

<style scoped>
.yarn-code {
  --y-header: #8a5a00; --y-speaker: #b4361b; --y-option: #1f6fd1; --y-command: #7c3aed; --y-var: #0f7b6c; --y-tag: #a3478f;
  margin: 0.4rem 0;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--text) 4%, var(--surface));
  font: 0.88rem/1.5 ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace;
  overflow-x: auto;
  white-space: pre;
  font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0;
}
/* lighter colours on the dark theme (chosen, or the system's when not set to light) */
:global(:root[data-theme='dark']) .yarn-code {
  --y-header: #e0b060; --y-speaker: #ff8f73; --y-option: #7cb4ff; --y-command: #c4a5ff; --y-var: #5fd3c0; --y-tag: #e89bd6;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light'])) .yarn-code {
    --y-header: #e0b060; --y-speaker: #ff8f73; --y-option: #7cb4ff; --y-command: #c4a5ff; --y-var: #5fd3c0; --y-tag: #e89bd6;
  }
}
.y-header { color: var(--y-header); font-weight: 600; }
.y-sep { color: var(--muted); font-weight: 700; }
.y-speaker { color: var(--y-speaker); font-weight: 600; }
.y-option { color: var(--y-option); font-weight: 700; }
.y-command { color: var(--y-command); }
.y-var { color: var(--y-var); font-weight: 600; }
.y-tag { color: var(--y-tag); font-style: italic; }
.y-comment { color: var(--muted); font-style: italic; }
</style>
