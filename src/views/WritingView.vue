<script setup>
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

/*
 * level: difficulty 1–4
 *   1 getting started · 2 building skills
 *   3 skilled writer · 4 experienced writer
 */
const sections = [
  {
    key: 'poems',
    practices: [
      { to: { name: 'blackout' }, icon: '▬', key: 'writing.blackout', level: 1 },
      { to: { name: 'timed' }, icon: '⏱', key: 'writing.timed', level: 1 },
      { to: { name: 'haiku' }, icon: '❀', key: 'writing.haiku', level: 1 },
      { to: { name: 'cutup' }, icon: '✂', key: 'writing.cutup', level: 2 },
    ],
  },
  {
    key: 'novels',
    practices: [
      { to: { name: 'interview' }, icon: '❝', key: 'writing.interview', level: 1 },
      { to: { name: 'taboo' }, icon: '⊘', key: 'writing.taboo', level: 2 },
      { to: { name: 'snowflake' }, icon: '❄', key: 'writing.snowflake', level: 3 },
      { to: { name: 'story' }, icon: '🂡', key: 'writing.story', level: 3 },
      { to: { name: 'mosaic' }, icon: '▦', key: 'writing.mosaic', level: 4 },
    ],
  },
]

const LEVELS = [1, 2, 3, 4]
const levelText = (n) => t('writing.difficulty.levels')[n - 1]
const levelAria = (n) => `${t('writing.difficulty.label')} ${n}/4: ${levelText(n)}`
</script>

<template>
  <section class="container prose">
    <RouterLink :to="{ name: 'home' }" class="back" :title="tl('nav.home')" :aria-label="tl('nav.home')"><Icon name="arrow-left" :label="tl('nav.home')" /></RouterLink>
    <h1>{{ t('writing.title') }}</h1>
    <p class="lead">{{ t('writing.intro') }}</p>

    <details class="legend">
      <summary>{{ t('writing.difficulty.label') }}</summary>
      <ul>
        <li v-for="n in LEVELS" :key="n">
          <span class="dots" aria-hidden="true"><i v-for="d in LEVELS" :key="d" :class="{ on: d <= n }" /></span>
          {{ levelText(n) }}
        </li>
      </ul>
    </details>

    <section v-for="s in sections" :key="s.key" class="practice-section" :aria-labelledby="`sec-${s.key}`">
      <h2 :id="`sec-${s.key}`">{{ t(`writing.sections.${s.key}.title`) }}</h2>
      <p class="muted practice-section__desc">{{ t(`writing.sections.${s.key}.desc`) }}</p>
      <nav class="practice-list">
        <RouterLink v-for="p in s.practices" :key="p.key" :to="p.to" class="practice-card">
          <span class="practice-card__icon" aria-hidden="true">{{ p.icon }}</span>
          <span class="practice-card__text">
            <strong>{{ t(`${p.key}.title`) }}</strong>
            <span class="muted">{{ t(`${p.key}.card`) }}</span>
            <span class="difficulty" :class="`level-${p.level}`" role="img" :aria-label="levelAria(p.level)" :title="levelAria(p.level)">
              <span class="dots" aria-hidden="true"><i v-for="d in LEVELS" :key="d" :class="{ on: d <= p.level }" /></span>
              <span class="difficulty__text" aria-hidden="true">{{ levelText(p.level) }}</span>
            </span>
          </span>
          <span class="practice-card__go">{{ t('writing.open') }} →</span>
        </RouterLink>
      </nav>
    </section>

    <p class="muted soon">{{ t('writing.soon') }}</p>
  </section>
</template>

<style scoped>
.practice-section { margin-top: 2rem; }
.practice-section h2 { margin: 0 0 0.25rem; }
.practice-section__desc { margin: 0; }
.practice-section .practice-list { margin-top: 1rem; }

.legend { margin: 1rem 0 0; font-size: 0.9rem; }
.legend summary { cursor: pointer; font-weight: 600; }
.legend ul { list-style: none; margin: 0.5rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
.legend li { display: flex; align-items: center; gap: 0.6rem; }

.difficulty { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem; font-size: 0.8rem; color: var(--muted); }
.dots { display: inline-flex; gap: 3px; }
.dots i {
  width: 9px; height: 9px; border-radius: 50%;
  border: 1.5px solid var(--accent);
  background: transparent;
}
.dots i.on { background: var(--accent); }
</style>
