<script setup>
import { nextTick } from 'vue'
import { t, tl } from '../i18n'
import Icon from './Icon.vue'
import { uid } from '../composables/storyCards'

/*
 * A horizontal board of columns, each holding note cards.
 * Columns are objects with a `notes` array; they're mutated in place
 * (the parent owns the reactive story state and autosaves it).
 */
const props = defineProps({
  columns: { type: Array, required: true },
  color: { type: String, default: '#e85d3f' },
  readonly: { type: Boolean, default: false },
})

let boardEl = null

async function addNote(col, ci) {
  col.notes.push({ id: uid(), text: '' })
  await nextTick()
  const areas = boardEl?.querySelectorAll(`[data-col="${ci}"] textarea`)
  areas?.[areas.length - 1]?.focus()
}

function removeNote(col, j) {
  if (col.notes[j].text.trim() && !confirm(t('writing.story.removeNote') + '?')) return
  col.notes.splice(j, 1)
}

function moveNote(col, j, dir) {
  const k = j + dir
  if (k < 0 || k >= col.notes.length) return
  ;[col.notes[j], col.notes[k]] = [col.notes[k], col.notes[j]]
}
</script>

<template>
  <div :ref="(el) => (boardEl = el)" class="board" :class="{ readonly }" :style="{ '--board': color }">
    <div v-for="(col, ci) in columns" :key="col.id" class="col" :data-col="ci">
      <div class="col__head">
        <slot name="header" :col="col" :index="ci" />
      </div>

      <div class="col__notes">
        <div v-for="(note, j) in col.notes" :key="note.id" class="note">
          <p v-if="readonly" class="note__text">{{ note.text }}</p>
          <template v-else>
            <textarea v-model="note.text" rows="3" :placeholder="t('writing.story.notePh')" />
            <div class="note__tools">
              <button class="ghost" :disabled="j === 0" :aria-label="t('writing.story.moveUp')" :title="t('writing.story.moveUp')" @click="moveNote(col, j, -1)">↑</button>
              <button class="ghost" :disabled="j === col.notes.length - 1" :aria-label="t('writing.story.moveDown')" :title="t('writing.story.moveDown')" @click="moveNote(col, j, 1)">↓</button>
              <button class="ghost danger" :aria-label="t('writing.story.removeNote')" :title="t('writing.story.removeNote')" @click="removeNote(col, j)">✕</button>
            </div>
          </template>
        </div>
        <p v-if="!col.notes.length" class="col__empty">{{ t('writing.story.emptyColumn') }}</p>
      </div>

      <button v-if="!readonly" class="ghost add-note" @click="addNote(col, ci)" :title="tl('writing.story.addNote')" :aria-label="tl('writing.story.addNote')"><Icon name="plus" :label="tl('writing.story.addNote')" /></button>
    </div>

    <slot name="after" />
  </div>
</template>

<style scoped>
.board {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.25rem 0.1rem 0.75rem;
  align-items: flex-start;
  scroll-snap-type: x proximity;
}
.col {
  flex: 0 0 230px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem;
  background: color-mix(in srgb, var(--board) 7%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--board) 30%, var(--border));
  border-top: 5px solid var(--board);
  border-radius: 10px;
}
.readonly .col { flex-basis: 190px; }
.col__head { display: flex; flex-direction: column; gap: 0.3rem; }
.col__notes { display: flex; flex-direction: column; gap: 0.45rem; }
.col__empty { margin: 0; font-size: 0.82rem; color: var(--muted); font-style: italic; }

.note {
  background: #fffdf5;
  color: #221f1a;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), 0 3px 8px rgb(0 0 0 / 0.06);
  padding: 0.35rem;
}
.note textarea {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0.2rem 0.25rem;
  font: 0.95rem/1.45 Georgia, 'Times New Roman', serif;
  resize: vertical;
  field-sizing: content;
  min-height: 3.2em;
}
.note textarea::placeholder { color: #9b9383; }
.note textarea:focus { outline: none; }
.note:focus-within { outline: 2px solid var(--board); }
.note__tools { display: flex; justify-content: flex-end; gap: 1px; opacity: 0.55; }
.note:hover .note__tools, .note:focus-within .note__tools { opacity: 1; }
.note__tools button { padding: 0.1em 0.45em; font-size: 0.82rem; color: #4d463c; }
.note__tools button.danger { color: var(--danger); }
.note__text { margin: 0; padding: 0.2rem 0.3rem; font: 0.88rem/1.4 Georgia, serif; white-space: pre-wrap; }
.add-note { justify-content: center; border: 1px dashed color-mix(in srgb, var(--board) 45%, var(--border)); }

/* Phones: stack columns vertically, full width, instead of scrolling sideways */
@media (max-width: 640px) {
  .board {
    flex-direction: column;
    align-items: stretch;
    overflow-x: visible;
    scroll-snap-type: none;
  }
  .col,
  .readonly .col { flex: 0 0 auto; width: 100%; }
}
</style>
