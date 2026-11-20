<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import { loadSavedWorks } from '../composables/savedWorks'
import { NOVEL_PRACTICES, savedWorkMarkdown } from '../export/markdown'
import { mdToHtml } from '../export/mdToHtml'

/* Print page for one saved work of a novel practice (A4, plain text layout). */
const props = defineProps({ kind: { type: String, required: true }, id: { type: String, required: true } })

const ROUTES = { snowflake: 'snowflake', mosaic: 'mosaic', 'story-cards': 'story', taboo: 'taboo', interview: 'interview', situation: 'situation', meter: 'meter' }
const back = computed(() => ({ name: ROUTES[props.kind] || 'writing' }))
const backLabel = computed(() => tl(NOVEL_PRACTICES[props.kind]?.titleKey || 'writing.title'))

const work = ref(null)
const loaded = ref(false)
// mdToHtml escapes all user text, so v-html is safe here
const html = computed(() => (work.value ? mdToHtml(savedWorkMarkdown(props.kind, work.value)) : ''))

const pageStyle = document.createElement('style')
pageStyle.textContent = '@page { size: A4 portrait; margin: 18mm; }'

onMounted(async () => {
  document.head.appendChild(pageStyle)
  if (NOVEL_PRACTICES[props.kind]) work.value = (await loadSavedWorks(props.kind)).find((w) => w.id === props.id) || null
  if (work.value) document.title = `${work.value.title} · MyZine`
  loaded.value = true
})
onBeforeUnmount(() => pageStyle.remove())
const printPage = () => window.print()
</script>

<template>
  <section class="container saved-print">
    <div class="toolbar no-print">
      <RouterLink :to="back" class="back" :title="backLabel" :aria-label="backLabel"><Icon name="arrow-left" :label="backLabel" /></RouterLink>
      <span class="spacer" />
      <button v-if="work" class="primary" @click="printPage" :title="tl('writing.works.print')" :aria-label="tl('writing.works.print')">
        <Icon name="printer" :label="tl('writing.works.print')" />
      </button>
    </div>
    <p v-if="loaded && !work" class="error">{{ t('writing.works.notFound') }}</p>
    <article v-else class="sheet prose" v-html="html" />
  </section>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
.sheet {
  max-width: 46rem;
  margin: 0 auto 2rem;
  padding: 2.5rem 3rem;
  background: #fff;
  color: #1d1d1f;
  border-radius: 6px;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.12);
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.6;
}
.sheet :deep(h1) { margin: 0 0 0.2rem; font-size: 1.9rem; }
.sheet :deep(h1 + p) { margin-top: 0; color: #666; }
.sheet :deep(h2) { font-size: 1.3rem; margin: 1.6rem 0 0.5rem; }
.sheet :deep(h3) { font-size: 1.1rem; margin: 1.2rem 0 0.4rem; }
.sheet :deep(blockquote) { margin: 1rem 0; padding: 0.2rem 1rem; border-left: 3px solid #e85d3f; font-style: italic; }
.sheet :deep(hr) { border: 0; text-align: center; margin: 1.2rem 0; }
.sheet :deep(hr)::after { content: '*'; color: #888; }
@media (max-width: 640px) { .sheet { padding: 1.5rem 1.2rem; } }
@media print {
  .container { padding: 0; max-width: none; }
  .sheet { box-shadow: none; padding: 0; max-width: none; margin: 0; }
  .sheet :deep(h2), .sheet :deep(h3) { break-after: avoid; }
}
</style>
