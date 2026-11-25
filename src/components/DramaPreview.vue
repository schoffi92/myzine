<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { readScene, verseChecks } from '../composables/drama'

/*
 * A scene of the drama practice as a printed play: cast list, act and scene
 * centred, the place in italics, stage directions indented in italics,
 * speakers in small capitals, verse line by line (the second half of a
 * shared line set in under the end of the first), prose as a paragraph.
 * `blocks` and `cast` may be stored objects or [kind, text] / [name, desc]
 * pairs (the guide's examples).
 */
const props = defineProps({
  blocks: { type: Array, default: () => [] },
  cast: { type: Array, default: () => [] },
  locale: { type: String, required: true },
  empty: { type: String, default: '' },
})

const list = computed(() => props.blocks.map((b, i) => (Array.isArray(b) ? { id: `x${i}`, kind: b[0], text: b[1] } : b)))
const people = computed(() => props.cast.map((c) => (Array.isArray(c) ? { name: c[0], desc: c[1] } : c)).filter((c) => c.name?.trim()))
const items = computed(() => readScene(list.value, props.locale))
const checks = computed(() => verseChecks(items.value, props.locale))

/** Where the second half of a shared line starts: under the end of the first half. */
const pads = computed(() => {
  const out = {}
  let last = null
  for (const x of items.value) {
    if (x.type !== 'speech') continue
    for (const y of x.items) {
      if (y.type !== 'verse') continue
      const c = checks.value[y.block.id]
      if (c?.shared === 'second' && last) out[y.block.id] = `${last.text.trim().length + 1}ch`
      last = c?.shared === 'first' ? y.block : null
    }
  }
  return out
})
const bare = (text) => text.trim().replace(/^\[|\]$/g, '')
</script>

<template>
  <div class="play">
    <div v-if="people.length" class="personae">
      <p class="personae__title">{{ t('writing.drama.personae') }}</p>
      <ul>
        <li v-for="(c, i) in people" :key="i"><span class="sc">{{ c.name.trim() }}</span><template v-if="c.desc?.trim()">, {{ c.desc.trim() }}</template></li>
      </ul>
    </div>
    <p v-if="!items.length && !people.length && empty" class="muted play__empty">{{ empty }}</p>
    <template v-for="x in items" :key="x.block.id">
      <p v-if="x.type === 'heading'" class="hd">{{ x.block.text.trim() }}</p>
      <p v-else-if="x.type === 'location'" class="loc">{{ x.block.text.trim() }}</p>
      <p v-else-if="x.type === 'direction'" class="dir">{{ x.block.text.trim() }}</p>
      <p v-else-if="x.type === 'stray'" class="stray">{{ x.block.text.trim() }}</p>
      <div v-else class="sp">
        <p class="who sc">{{ x.speaker }}</p>
        <template v-for="y in x.items" :key="y.block.id">
          <p v-if="y.type === 'direction'" class="dir-in">[{{ bare(y.block.text) }}]</p>
          <p v-else-if="y.type === 'prose'" class="prose">{{ y.block.text.trim() }}</p>
          <p v-else class="vl" :style="pads[y.block.id] ? { paddingLeft: pads[y.block.id] } : null">{{ y.block.text.trim() }}</p>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.play {
  font: 1.02rem/1.5 Georgia, 'Times New Roman', serif;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  overflow-wrap: anywhere;
}
.play p { margin: 0; }
.play__empty { font: 0.9rem system-ui, sans-serif; }
.sc { font-variant: small-caps; letter-spacing: 0.04em; }
.personae { margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
.personae__title { font-variant: small-caps; letter-spacing: 0.08em; text-align: center; margin-bottom: 0.3rem !important; }
.personae ul { list-style: none; margin: 0; padding: 0; }
.hd { text-align: center; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 0.9rem !important; }
.hd:first-child { margin-top: 0 !important; }
.loc { text-align: center; font-style: italic; }
.dir { font-style: italic; margin: 0.5rem 0 0.5rem 2.5rem !important; }
.stray { color: var(--danger); margin-left: 1.5rem !important; }
.sp { margin: 0.55rem 0; }
.who { font-weight: 600; }
.dir-in { font-style: italic; margin-left: 2.5rem !important; }
.vl { margin-left: 1.5rem !important; }
.prose { margin-left: 1.5rem !important; white-space: pre-line; }
</style>
