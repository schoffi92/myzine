<script setup>
import { ref, watch, nextTick } from 'vue'
import { t } from '../i18n'
import { blockedText } from '../composables/clipboard'

/*
 * Shown when the browser blocked copying (see composables/clipboard.js): the
 * text is in a selected box, so Ctrl+C / ⌘C or a long-press copies it by hand.
 */
const dialog = ref(null)
const box = ref(null)
let returnTo = null

watch(blockedText, async (text) => {
  if (text == null) return
  returnTo = document.activeElement
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  box.value?.focus()
  box.value?.select()
})

function close() {
  if (dialog.value?.open) dialog.value.close()
}

function onClose() {
  blockedText.value = null
  returnTo?.focus?.()
  returnTo = null
}
</script>

<template>
  <dialog ref="dialog" class="copy-fallback no-print" aria-labelledby="copy-fallback-title" @close="onClose">
    <h2 id="copy-fallback-title">{{ t('copy.title') }}</h2>
    <p class="muted">{{ t('copy.hint') }}</p>
    <textarea ref="box" :value="blockedText ?? ''" readonly rows="8" :aria-label="t('copy.title')" @focus="$event.target.select()" />
    <div class="copy-fallback__btns">
      <button class="primary" @click="close">{{ t('copy.close') }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.copy-fallback {
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: inherit;
}
.copy-fallback::backdrop { background: rgb(0 0 0 / 0.45); }
.copy-fallback h2 { font-size: 1.15rem; margin: 0 0 0.4rem; }
.copy-fallback p { margin: 0 0 0.75rem; font-size: 0.92rem; }
.copy-fallback textarea { width: 100%; box-sizing: border-box; resize: vertical; font-size: 0.92rem; }
.copy-fallback__btns { display: flex; justify-content: flex-end; margin-top: 0.75rem; }
</style>
