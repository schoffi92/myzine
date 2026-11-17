<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'
import { loadDraft, saveDraft, deleteDraft } from '../db/drafts'
import TarotHelper from '../components/TarotHelper.vue'
import TimerPanel from '../components/TimerPanel.vue'

const DRAFT_ID = 'timed-poem'

const text = ref('')
const loaded = ref(false)
let saveTimer = null

const words = computed(() => (text.value.trim() ? text.value.trim().split(/\s+/).length : 0))

function onInput() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveDraft(DRAFT_ID, text.value)
  }, 400)
}

async function clearText() {
  if (!text.value || !confirm(t('writing.timed.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  text.value = ''
  await deleteDraft(DRAFT_ID)
}

onMounted(async () => {
  text.value = await loadDraft(DRAFT_ID)
  loaded.value = true
})

// The timer keeps running app-wide when leaving; only flush unsaved text.
onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveDraft(DRAFT_ID, text.value)
  }
})
</script>

<template>
  <section class="container prose timed">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>{{ t('writing.timed.title') }}</h1>
    <p class="lead">{{ t('writing.timed.intro') }}</p>

    <details class="rules">
      <summary>{{ t('writing.timed.rulesTitle') }}</summary>
      <ul>
        <li v-for="(r, i) in t('writing.timed.rules')" :key="i">{{ r }}</li>
      </ul>
    </details>

    <TarotHelper store-id="timed-poem-cards" />
    <TimerPanel owner="timed" />

    <textarea
      v-model="text"
      class="poem-box"
      :placeholder="t('writing.timed.placeholder')"
      :disabled="!loaded"
      spellcheck="false"
      @input="onInput"
    />
    <div class="poem-foot">
      <span class="muted">{{ t('writing.timed.words', { n: words }) }} · {{ t('writing.timed.savedLocally') }}</span>
      <span class="spacer" />
      <button class="ghost danger" :disabled="!text" @click="clearText" :title="tl('writing.timed.clear')" :aria-label="tl('writing.timed.clear')"><Icon name="trash" :label="tl('writing.timed.clear')" /></button>
    </div>
  </section>
</template>
