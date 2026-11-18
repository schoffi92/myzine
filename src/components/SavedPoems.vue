<script setup>
/*
 * List of poems the user saved in a writing practice (Haiku, 15-minute poem,
 * cut-up poem): each with Copy and Remove. The parent owns the array and
 * removes the item on the `remove` event (after this asks for confirmation).
 */
import { ref } from 'vue'
import { t, tl } from '../i18n'
import { copyToClipboard } from '../composables/clipboard'
import Icon from './Icon.vue'

const props = defineProps({
  poems: { type: Array, required: true }, // [{ id, lines: string[], at }]
  title: { type: String, default: '' }, // heading; defaults to "Your saved poems"
})
const emit = defineEmits(['remove'])

const copiedId = ref(null)
const textOf = (p) => p.lines.join('\n')

async function copy(p) {
  if (!(await copyToClipboard(textOf(p)))) return // blocked: a dialog shows the text instead
  copiedId.value = p.id
  setTimeout(() => (copiedId.value = null), 1500)
}

function remove(i) {
  if (confirm(t('writing.saved.confirmRemove'))) emit('remove', i)
}
</script>

<template>
  <section v-if="props.poems.length" class="saved">
    <h2>{{ props.title || t('writing.saved.title') }}</h2>
    <ul class="saved__list">
      <li v-for="(p, i) in props.poems" :key="p.id" class="saved__item">
        <p class="saved__poem">{{ textOf(p) }}</p>
        <div class="saved__tools">
          <button class="ghost" @click="copy(p)" :title="copiedId === p.id ? tl('writing.saved.copied') : tl('writing.saved.copy')" :aria-label="copiedId === p.id ? tl('writing.saved.copied') : tl('writing.saved.copy')"><Icon :name="copiedId === p.id ? 'check' : 'copy'" /></button>
          <button class="ghost danger" @click="remove(i)" :title="tl('writing.saved.remove')" :aria-label="tl('writing.saved.remove')"><Icon name="x" /></button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.saved { margin-top: 1.5rem; }
.saved__list { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
.saved__item {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.6rem 1rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
}
.saved__poem {
  flex: 1; min-width: 0; margin: 0;
  white-space: pre-wrap; overflow-wrap: anywhere;
  font: italic 1.15rem/1.7 Georgia, 'Times New Roman', serif;
}
.saved__tools { display: flex; gap: 2px; }
</style>
