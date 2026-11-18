<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ZinePage from '../components/ZinePage.vue'
import { getZine, listPages } from '../db/zines'
import { settings } from '../composables/settings'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

const props = defineProps({ id: { type: String, required: true } })

const zine = ref(null)
const pages = ref([])
const index = ref(0)
const notFound = ref(false)

const current = computed(() => pages.value[index.value])

const go = (d) => {
  index.value = Math.max(0, Math.min(pages.value.length - 1, index.value + d))
}
const font = (d) => {
  settings.readerFontSize = Math.max(12, Math.min(32, settings.readerFontSize + d))
}

function onKey(e) {
  // let form fields, menus and buttons handle their own keys (Space on a
  // focused "Next" button would otherwise turn two pages)
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName) || e.target.isContentEditable) return
  if (e.key === 'ArrowRight' || e.key === ' ') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

onMounted(async () => {
  // added before any await, so onBeforeUnmount always removes it
  window.addEventListener('keydown', onKey)
  zine.value = await getZine(props.id)
  if (!zine.value) {
    notFound.value = true
    return
  }
  settings.lastZineId = props.id
  pages.value = await listPages(props.id)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section v-if="notFound" class="container">
    <p class="error">{{ t('editor.notFound') }}</p>
    <RouterLink :to="{ name: 'zines' }">{{ t('editor.back') }}</RouterLink>
  </section>

  <section v-else-if="zine" class="reader" :style="{ '--accent': zine.color }">
    <div class="reader__bar">
      <RouterLink :to="{ name: 'zines' }" class="btn ghost" :title="tl('editor.back')" :aria-label="tl('editor.back')">←</RouterLink>
      <h1>{{ zine.title }}</h1>
      <span class="spacer" />
      <button class="ghost" :title="t('reader.smaller')" :aria-label="t('reader.smaller')" @click="font(-2)">A−</button>
      <button class="ghost" :title="t('reader.larger')" :aria-label="t('reader.larger')" @click="font(2)">A+</button>
      <RouterLink class="btn ghost" :to="{ name: 'print', params: { id } }" :title="t('print.button')" :aria-label="t('print.button')">
        <svg class="btn-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" /></svg>
        <span class="hide-mobile">{{ t('print.button') }}</span>
      </RouterLink>
      <RouterLink class="btn" :to="{ name: 'edit', params: { id } }" :title="tl('reader.edit')" :aria-label="tl('reader.edit')"><Icon name="pencil" :label="tl('reader.edit')" /></RouterLink>
    </div>

    <p v-if="!pages.length" class="empty">{{ t('reader.empty') }}</p>
    <template v-else>
      <Transition name="flip" mode="out-in">
        <ZinePage :key="current.id" :page="current" :accent="zine.color" :font-size="settings.readerFontSize" class="reader__page" />
      </Transition>
      <div class="reader__nav">
        <button :disabled="index === 0" @click="go(-1)" :title="tl('reader.prev')" :aria-label="tl('reader.prev')"><Icon name="chevron-left" :label="tl('reader.prev')" /></button>
        <span class="muted">{{ index + 1 }} / {{ pages.length }}</span>
        <button :disabled="index === pages.length - 1" @click="go(1)" :title="tl('reader.next')" :aria-label="tl('reader.next')"><Icon name="chevron-right" :label="tl('reader.next')" /></button>
      </div>
    </template>
  </section>

  <p v-else class="container muted">{{ t('library.loading') }}</p>
</template>
