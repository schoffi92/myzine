<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import { loadDraft, saveDraft, deleteDraft } from '../db/drafts'
import TarotHelper from '../components/TarotHelper.vue'
import TimerPanel from '../components/TimerPanel.vue'
import SavedPoems from '../components/SavedPoems.vue'
import { useSavedPoems } from '../composables/savedPoems'

const DRAFT_ID = 'timed-poem'
const saved = useSavedPoems('timed-poem-saved') // poems the user chose to keep

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

/** Keep the poem in the saved list and clear the box for the next one. */
async function savePoem() {
  if (!text.value.trim()) return
  clearTimeout(saveTimer)
  saveTimer = null
  if (await saved.add(text.value)) {
    text.value = ''
    await deleteDraft(DRAFT_ID)
  }
}

onMounted(async () => {
  saved.load()
  text.value = await loadDraft(DRAFT_ID)
  loaded.value = true
})

// The timer keeps running app-wide when leaving; only flush unsaved text.
/** Save a pending edit now: when leaving the page, and when the tab is hidden or closed. */
function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    saveDraft(DRAFT_ID, text.value)
  }
}
const stopFlushOnHide = flushOnHide(flushSave)

onBeforeUnmount(() => {
  stopFlushOnHide()
  flushSave()
})
</script>

<template>
  <section class="container prose timed">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>{{ t('writing.timed.title') }}</h1>
    <p class="lead">{{ t('writing.timed.intro') }}</p>
    <EarlierVersion :keys="['timed-poem-cards']" />

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
      <button class="primary" :disabled="!text.trim()" @click="savePoem" :title="tl('writing.saved.save')" :aria-label="tl('writing.saved.save')"><Icon name="save" :label="tl('writing.saved.save')" /></button>
    </div>

    <SavedPoems :poems="saved.poems.value" @remove="saved.remove" />
  </section>
</template>
