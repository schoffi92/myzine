<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t, tl } from '../i18n'
import { flushOnHide } from '../composables/flushOnHide'
import { copyToClipboard } from '../composables/clipboard'
import Icon from '../components/Icon.vue'
import EarlierVersion from '../components/EarlierVersion.vue'
import SavedWorks from '../components/SavedWorks.vue'
import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'
import { INTERVIEW_QUESTIONS, interviewQuestion, newQuestionId } from '../composables/interview'

/*
 * Character interview: the writer asks their character questions and writes
 * the answers in the character's own voice. Built-in questions are stored by
 * key (so they follow the language); the writer's own questions by text.
 */
const ID = 'interview' // IndexedDB drafts id
const blank = () => ({ questions: INTERVIEW_QUESTIONS.map((key) => ({ id: newQuestionId(), key, a: '' })) })

const state = reactive(blank())
const loaded = ref(false)
const copied = ref(false)
const newQ = ref('')

const questionOf = (q) => interviewQuestion(q, t)
const answered = computed(() => state.questions.filter((q) => q.a.trim()))
const nameAnswer = computed(() => state.questions.find((q) => q.key === 'name')?.a.trim() || '')
const plainText = computed(() => answered.value.map((q) => `${questionOf(q)}\n${q.a.trim()}`).join('\n\n'))

function addQuestion() {
  const q = newQ.value.trim()
  if (!q) return
  state.questions.push({ id: newQuestionId(), q, a: '' })
  newQ.value = ''
  nextTick(() => document.getElementById(`answer-${state.questions.at(-1).id}`)?.focus())
}

function removeQuestion(i) {
  const q = state.questions[i]
  if (q.a.trim() && !confirm(t('writing.interview.confirmRemove', { q: questionOf(q) }))) return
  state.questions.splice(i, 1)
}

/** Put back the built-in questions that were removed (answers already written stay). */
function restoreQuestions() {
  for (const key of INTERVIEW_QUESTIONS) if (!state.questions.some((q) => q.key === key)) state.questions.push({ id: newQuestionId(), key, a: '' })
}
const missing = computed(() => INTERVIEW_QUESTIONS.some((key) => !state.questions.some((q) => q.key === key)))

async function copyText() {
  if (!(await copyToClipboard(plainText.value))) return // blocked: a dialog shows the text instead
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function startOver() {
  if (!confirm(t('writing.interview.confirmClear'))) return
  clearTimeout(saveTimer)
  saveTimer = null
  // pause autosave while resetting, or the watcher re-saves an empty draft
  loaded.value = false
  Object.assign(state, blank())
  newQ.value = ''
  await nextTick()
  loaded.value = true
  await deleteDraft(ID)
}

/* ---- autosave to IndexedDB ---- */
let saveTimer = null
watch(
  state,
  () => {
    if (!loaded.value) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveDraftData(ID, state)
    }, 400)
  },
  { deep: true },
)

const str = (v) => (typeof v === 'string' ? v : '')

/**
 * Put a draft or a saved work on the page (autosave then stores it as the draft).
 * An own question is kept while it has a question or an answer: clearing the
 * question to retype it must not lose the answer.
 */
function apply(saved) {
  const list = Array.isArray(saved?.questions) ? saved.questions : []
  state.questions = list
    .filter((q) => q && typeof q === 'object' && (INTERVIEW_QUESTIONS.includes(q.key) || str(q.q).trim() || str(q.a).trim()))
    .map((q) => {
      const id = typeof q.id === 'string' && q.id ? q.id : newQuestionId()
      return INTERVIEW_QUESTIONS.includes(q.key) ? { id, key: q.key, a: str(q.a) } : { id, q: str(q.q), a: str(q.a) }
    })
}

onMounted(async () => {
  const saved = await loadDraftData(ID)
  if (saved) apply(saved)
  loaded.value = true
})

/** Save a pending edit now: when leaving the page, and when the tab is hidden or closed. */
function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    saveDraftData(ID, state)
  }
}
const stopFlushOnHide = flushOnHide(flushSave)

onBeforeUnmount(() => {
  stopFlushOnHide()
  flushSave()
})
</script>

<template>
  <section class="container prose interview">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>❝ {{ t('writing.interview.title') }}</h1>
    <p class="lead">{{ t('writing.interview.intro') }}</p>
    <EarlierVersion :keys="['interview']" />

    <template v-if="loaded">
      <details class="hints">
        <summary>{{ t('writing.interview.hintsTitle') }}</summary>
        <ul>
          <li v-for="h in t('writing.interview.hints')" :key="h">{{ h }}</li>
        </ul>
      </details>

      <ol class="qa">
        <li v-for="(q, i) in state.questions" :key="q.id" class="qa__item">
          <div class="qa__q">
            <label v-if="q.key" :for="`answer-${q.id}`">{{ questionOf(q) }}</label>
            <input v-else v-model="q.q" class="qa__own" maxlength="200" :aria-label="t('writing.interview.ownLabel')" />
            <button class="ghost qa__x" @click="removeQuestion(i)" :title="t('writing.interview.remove')" :aria-label="t('writing.interview.remove')"><Icon name="x" /></button>
          </div>
          <div class="qa__a">
            <span class="qa__who" aria-hidden="true">{{ nameAnswer || t('writing.interview.character') }}</span>
            <textarea
              :id="`answer-${q.id}`"
              v-model="q.a"
              rows="2"
              class="serif"
              :aria-label="q.key ? null : questionOf(q)"
              :placeholder="t('writing.interview.answerPlaceholder')"
            />
          </div>
        </li>
      </ol>
      <p v-if="!state.questions.length" class="muted">{{ t('writing.interview.noQuestions') }}</p>

      <form class="row add" @submit.prevent="addQuestion">
        <label class="sr-only" for="new-question">{{ t('writing.interview.addLabel') }}</label>
        <input id="new-question" v-model="newQ" maxlength="200" autocomplete="off" :placeholder="t('writing.interview.addPlaceholder')" />
        <button type="submit" class="ghost" :disabled="!newQ.trim()" :title="tl('writing.interview.add')" :aria-label="tl('writing.interview.add')"><Icon name="plus" :label="tl('writing.interview.add')" /></button>
      </form>
      <button v-if="missing" class="ghost small-btn" @click="restoreQuestions">↺ {{ t('writing.interview.restore') }}</button>

      <div class="step-nav">
        <p class="muted small">{{ t('writing.interview.count', { n: answered.length, total: state.questions.length }) }}</p>
        <span class="spacer" />
        <button class="ghost danger" @click="startOver" :title="tl('writing.interview.clear')" :aria-label="tl('writing.interview.clear')"><Icon name="trash" :label="tl('writing.interview.clear')" /></button>
        <button class="primary" :disabled="!answered.length" @click="copyText" :title="copied ? tl('writing.interview.copied') : tl('writing.interview.copy')" :aria-label="copied ? tl('writing.interview.copied') : tl('writing.interview.copy')">
          <Icon :name="copied ? 'check' : 'copy'" :label="copied ? tl('writing.interview.copied') : tl('writing.interview.copy')" />
        </button>
      </div>

      <SavedWorks kind="interview" @open="apply" :data="state" :default-title="nameAnswer" :can-save="answered.length > 0" />
    </template>
  </section>
</template>

<style scoped>
.serif { font: 1.08rem/1.6 Georgia, 'Times New Roman', serif; }
.small { font-size: 0.85rem; margin: 0; }
.hints { margin: 0 0 1.25rem; }
.hints summary { cursor: pointer; font-weight: 600; }
.hints ul { margin: 0.4rem 0 0; }
.qa { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
.qa__item { padding: 0.8rem 0.9rem; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.qa__q { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
.qa__q label { flex: 1; min-width: 0; }
.qa__own { flex: 1; min-width: 0; font-weight: 600; }
.qa__x { flex-shrink: 0; padding: 0.25em 0.4em; }
.qa__a { margin-top: 0.5rem; padding-left: 0.9rem; border-left: 3px solid var(--accent); }
.qa__a textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.qa__who { display: block; font: 600 0.7rem system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.2rem; }
.row { display: flex; gap: 0.5rem; align-items: center; }
.row input { flex: 1; min-width: 0; }
.add { margin-top: 1rem; }
.small-btn { margin-top: 0.5rem; font-size: 0.9rem; }
.step-nav { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.spacer { flex: 1; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
