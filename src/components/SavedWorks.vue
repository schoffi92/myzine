<script setup>
import { ref, onMounted } from 'vue'
import { t, tl } from '../i18n'
import { copyToClipboard } from '../composables/clipboard'
import { settings } from '../composables/settings'
import Icon from './Icon.vue'
import { useSavedWorks } from '../composables/savedWorks'
import { savedWorkMarkdown } from '../export/markdown'
import { hasText } from '../sync/merge'

/*
 * "Save this work" for the novel practices, plus the list of saved works
 * (title, date; open, print, copy as Markdown, delete). Saving takes a snapshot
 * of `data`; the work on the page stays as it is. Open emits `open` with a copy
 * of a saved work for the page to load; if the work on the page holds any
 * writing that isn't saved yet, it's added to the list first, so opening never
 * loses anything (even when the page wouldn't offer Save yet).
 */
const props = defineProps({
  kind: { type: String, required: true }, // practice draft id: snowflake | mosaic | story-cards | taboo | interview | situation | meter | rhyme | script | game
  data: { type: Object, required: true },
  defaultTitle: { type: String, default: '' },
  canSave: { type: Boolean, default: true },
})

const emit = defineEmits(['open'])

const { works, load, add, remove } = useSavedWorks(props.kind)
const title = ref('')
const justSaved = ref(false)
const copiedId = ref(null)
const notice = ref('')

const shorten = (s, n = 60) => {
  const one = (s || '').replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1).trimEnd()}…` : one
}

const titleNow = () => title.value.trim() || shorten(props.defaultTitle) || t('writing.works.untitled')

async function save() {
  if (!props.canSave) return
  await add(titleNow(), props.data)
  title.value = ''
  justSaved.value = true
  setTimeout(() => (justSaved.value = false), 2500)
}

async function copy(w) {
  if (!(await copyToClipboard(savedWorkMarkdown(props.kind, w)))) return // blocked: a dialog shows the text instead
  copiedId.value = w.id
  setTimeout(() => copiedId.value === w.id && (copiedId.value = null), 2000)
}

/** Same content, ignoring which step the page shows. */
const sameWork = (a, b) => {
  const plain = ({ step, ...rest }) => JSON.stringify(rest)
  return plain(a) === plain(b)
}

async function open(w) {
  await load()
  const current = JSON.parse(JSON.stringify(props.data))
  let kept = ''
  if (hasText(current) && !works.value.some((x) => sameWork(x.data, current))) {
    kept = titleNow()
    await add(kept, current)
    title.value = ''
  }
  emit('open', JSON.parse(JSON.stringify(w.data)))
  const name = w.title || t('writing.works.untitled')
  notice.value = kept ? t('writing.works.openedKept', { title: name, kept }) : t('writing.works.opened', { title: name })
}

function del(w) {
  if (confirm(t('writing.works.confirmRemove', { title: w.title }))) remove(w.id)
}

/** "Open: Marta Kowal": the action and the work's title. */
const labelFor = (key, w) => `${tl(key)}: ${w.title || t('writing.works.untitled')}`

const when = (at) => new Date(at).toLocaleString(settings.locale, { dateStyle: 'medium', timeStyle: 'short' })

onMounted(load)
</script>

<template>
  <section class="works" :aria-labelledby="`works-${kind}`">
    <h2 :id="`works-${kind}`">{{ t('writing.works.saveTitle') }}</h2>
    <form class="works__save" @submit.prevent="save">
      <label class="sr-only" :for="`work-title-${kind}`">{{ t('writing.works.titleLabel') }}</label>
      <input
        :id="`work-title-${kind}`"
        v-model="title"
        maxlength="100"
        autocomplete="off"
        :placeholder="shorten(defaultTitle) || t('writing.works.titleLabel')"
        :disabled="!canSave"
      />
      <button type="submit" class="primary" :disabled="!canSave" :title="tl('writing.works.save')" :aria-label="tl('writing.works.save')">
        <Icon :name="justSaved ? 'check' : 'save'" :label="justSaved ? tl('writing.works.saved') : tl('writing.works.save')" />
      </button>
    </form>
    <p class="muted small">{{ canSave ? t('writing.works.hint') : t('writing.works.nothing') }}</p>
    <p v-if="notice" class="works__notice" role="status">{{ notice }}</p>

    <template v-if="works.length">
      <h3>{{ t('writing.works.listTitle') }}</h3>
      <ul class="works__list">
        <li v-for="w in works" :key="w.id">
          <!-- each button names its work, so screen readers can tell the rows apart -->
          <span class="works__name">
            <strong>{{ w.title || t('writing.works.untitled') }}</strong>
            <small class="muted">{{ when(w.at) }}</small>
          </span>
          <button class="ghost" @click="open(w)" :title="tl('writing.works.open')" :aria-label="labelFor('writing.works.open', w)"><Icon name="pencil" :label="tl('writing.works.open')" /></button>
          <RouterLink
            class="btn ghost"
            :to="{ name: 'saved-print', params: { kind, id: w.id } }"
            :title="tl('writing.works.print')"
            :aria-label="labelFor('writing.works.print', w)"
          ><Icon name="printer" :label="tl('writing.works.print')" /></RouterLink>
          <button
            class="ghost"
            @click="copy(w)"
            :title="copiedId === w.id ? tl('writing.works.copied') : tl('writing.works.copy')"
            :aria-label="labelFor(copiedId === w.id ? 'writing.works.copied' : 'writing.works.copy', w)"
          ><Icon :name="copiedId === w.id ? 'check' : 'copy'" :label="copiedId === w.id ? tl('writing.works.copied') : tl('writing.works.copy')" /></button>
          <button class="ghost danger" @click="del(w)" :title="tl('writing.works.remove')" :aria-label="labelFor('writing.works.remove', w)"><Icon name="trash" :label="tl('writing.works.remove')" /></button>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.works { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }
.works h2 { font-size: 1.2rem; margin: 0 0 0.6rem; }
.works h3 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
.works__save { display: flex; gap: 0.5rem; }
.works__save input { flex: 1; min-width: 0; }
.small { font-size: 0.86rem; margin: 0.4rem 0 0; }
.works__notice { margin: 0.6rem 0 0; padding: 0.45rem 0.7rem; border: 1px dashed var(--accent); border-radius: 8px; font-size: 0.9rem; }
.works__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.works__list li { display: flex; align-items: center; gap: 0.35rem; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.works__name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.works__name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
