<script setup>
import { ref, computed } from 'vue'
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

const revealed = ref(false)

/*
 * The example text marks kept words with {braces}. Everything else is
 * "inked", word by word, so the black bars look like marker strokes.
 */
const segments = computed(() =>
  t('writing.blackout.example')
    .split(/(\{[^}]+\})/)
    .filter(Boolean)
    .flatMap((part) =>
      part.startsWith('{')
        ? [{ kept: true, text: part.slice(1, -1) }]
        : part.split(/(\s+)/).filter(Boolean).map((text) => ({ kept: false, space: /^\s+$/.test(text), text })),
    ),
)

const poem = computed(() =>
  segments.value.filter((s) => s.kept).map((s) => s.text).join(' / '),
)
</script>

<template>
  <section class="container prose">
    <RouterLink :to="{ name: 'writing' }" class="back" :title="tl('writing.title')" :aria-label="tl('writing.title')"><Icon name="arrow-left" :label="tl('writing.title')" /></RouterLink>
    <h1>{{ t('writing.blackout.title') }}</h1>
    <p class="lead">{{ t('writing.blackout.intro') }}</p>

    <figure class="blackout-demo">
      <figcaption class="label">{{ t('writing.blackout.exampleTitle') }}</figcaption>
      <p class="blackout-page" :class="{ revealed }">
        <template v-for="(s, i) in segments" :key="i">
          <mark v-if="s.kept" class="kept">{{ s.text }}</mark>
          <template v-else-if="s.space">{{ s.text }}</template>
          <span v-else class="ink">{{ s.text }}</span>
        </template>
      </p>
      <div class="blackout-demo__foot">
        <em>{{ t('writing.blackout.exampleCaption', { poem: `“${poem}”` }) }}</em>
        <button class="ghost" @click="revealed = !revealed">
          {{ revealed ? t('writing.blackout.hideOriginal') : t('writing.blackout.showOriginal') }}
        </button>
      </div>
    </figure>

    <div class="info-block">
      <h2>{{ t('writing.blackout.needTitle') }}</h2>
      <ul>
        <li v-for="(item, i) in t('writing.blackout.need')" :key="i">{{ item }}</li>
      </ul>
    </div>

    <div class="info-block">
      <h2>{{ t('writing.blackout.stepsTitle') }}</h2>
      <ol class="steps">
        <li v-for="(step, i) in t('writing.blackout.steps')" :key="i">
          <strong>{{ step.h }}</strong>
          <p>{{ step.p }}</p>
        </li>
      </ol>
    </div>

    <div class="info-block">
      <h2>{{ t('writing.blackout.tipsTitle') }}</h2>
      <ul>
        <li v-for="(tip, i) in t('writing.blackout.tips')" :key="i">{{ tip }}</li>
      </ul>
    </div>

    <p>
      <RouterLink :to="{ name: 'zines' }" class="btn primary">{{ t('home.create') }} →</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.blackout-demo { margin: 1.5rem 0; }
.label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.4rem; }

/* A paper-like page, always light, whatever the theme */
.blackout-page {
  margin: 0;
  padding: 1.5rem 1.75rem;
  background: #fbf8f1;
  color: #1a1a1a;
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--shadow);
  font: 1.1rem/2 Georgia, 'Times New Roman', serif;
}
.ink {
  background: #111;
  color: transparent;
  border-radius: 2px;
  padding: 0.1em 0.05em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  transition: background 0.25s, color 0.25s;
  user-select: none;
}
.kept {
  background: transparent;
  color: inherit;
  font-weight: 700;
  outline: 1.5px solid #999;
  outline-offset: 2px;
  border-radius: 2px;
}
.revealed .ink { background: rgb(0 0 0 / 0.08); color: #777; user-select: auto; }

.blackout-demo__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin-top: 0.6rem; }
.blackout-demo__foot em { flex: 1; min-width: 14rem; }

.steps { padding-left: 1.4rem; }
.steps li { margin-bottom: 0.8rem; }
.steps p { margin: 0.15rem 0 0; }
.info-block ul { margin: 0; padding-left: 1.3rem; }
.info-block li + li { margin-top: 0.3rem; }
</style>
