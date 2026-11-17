<script setup>
import { computed, toRef } from 'vue'
import { useImageUrl } from '../composables/useImageUrl'
import { t } from '../i18n'

const props = defineProps({
  page: { type: Object, required: true },
  accent: { type: String, default: '#e85d3f' },
  fontSize: { type: Number, default: 18 },
  showBlank: { type: Boolean, default: true },
})

const imageUrl = useImageUrl(toRef(() => props.page.imageId))
const paragraphs = computed(() =>
  (props.page.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
)
const layout = computed(() => (imageUrl.value ? props.page.layout : 'text-only'))
</script>

<template>
  <article class="zine-page" :class="`layout-${layout}`" :style="{ '--accent': accent, fontSize: fontSize + 'px' }">
    <img v-if="imageUrl && layout !== 'text-only'" :src="imageUrl" alt="" class="zine-page__img" />
    <div class="zine-page__text">
      <h2 v-if="page.title">{{ page.title }}</h2>
      <p v-for="(p, i) in paragraphs" :key="i">{{ p }}</p>
      <p v-if="showBlank && !page.title && !paragraphs.length" class="muted">{{ t('reader.blank') }}</p>
    </div>
  </article>
</template>
