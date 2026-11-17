<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ZinePage from '../components/ZinePage.vue'
import { getZine, listPages } from '../db/zines'
import { settings } from '../composables/settings'
import { t } from '../i18n'

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
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.key === 'ArrowRight' || e.key === ' ') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

onMounted(async () => {
  zine.value = await getZine(props.id)
  if (!zine.value) {
    notFound.value = true
    return
  }
  settings.lastZineId = props.id
  pages.value = await listPages(props.id)
  window.addEventListener('keydown', onKey)
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
      <RouterLink :to="{ name: 'zines' }" class="btn ghost">←</RouterLink>
      <h1>{{ zine.title }}</h1>
      <span class="spacer" />
      <button class="ghost" :title="t('reader.smaller')" @click="font(-2)">A−</button>
      <button class="ghost" :title="t('reader.larger')" @click="font(2)">A+</button>
      <RouterLink class="btn ghost" :to="{ name: 'print', params: { id } }">🖶 {{ t('print.button') }}</RouterLink>
      <RouterLink class="btn" :to="{ name: 'edit', params: { id } }">{{ t('reader.edit') }}</RouterLink>
    </div>

    <p v-if="!pages.length" class="empty">{{ t('reader.empty') }}</p>
    <template v-else>
      <Transition name="flip" mode="out-in">
        <ZinePage :key="current.id" :page="current" :accent="zine.color" :font-size="settings.readerFontSize" class="reader__page" />
      </Transition>
      <div class="reader__nav">
        <button :disabled="index === 0" @click="go(-1)">{{ t('reader.prev') }}</button>
        <span class="muted">{{ index + 1 }} / {{ pages.length }}</span>
        <button :disabled="index === pages.length - 1" @click="go(1)">{{ t('reader.next') }}</button>
      </div>
    </template>
  </section>

  <p v-else class="container muted">{{ t('library.loading') }}</p>
</template>
