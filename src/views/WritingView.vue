<script setup>
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

const sections = [
  {
    key: 'poems',
    practices: [
      { to: { name: 'blackout' }, icon: '▬', key: 'writing.blackout' },
      { to: { name: 'timed' }, icon: '⏱', key: 'writing.timed' },
      { to: { name: 'cutup' }, icon: '✂', key: 'writing.cutup' },
    ],
  },
  {
    key: 'novels',
    practices: [
      { to: { name: 'snowflake' }, icon: '❄', key: 'writing.snowflake' },
      { to: { name: 'mosaic' }, icon: '▦', key: 'writing.mosaic' },
      { to: { name: 'story' }, icon: '🂡', key: 'writing.story' },
    ],
  },
]
</script>

<template>
  <section class="container prose">
    <RouterLink :to="{ name: 'home' }" class="back" :title="tl('nav.home')" :aria-label="tl('nav.home')"><Icon name="arrow-left" :label="tl('nav.home')" /></RouterLink>
    <h1>{{ t('writing.title') }}</h1>
    <p class="lead">{{ t('writing.intro') }}</p>

    <section v-for="s in sections" :key="s.key" class="practice-section" :aria-labelledby="`sec-${s.key}`">
      <h2 :id="`sec-${s.key}`">{{ t(`writing.sections.${s.key}.title`) }}</h2>
      <p class="muted practice-section__desc">{{ t(`writing.sections.${s.key}.desc`) }}</p>
      <nav class="practice-list">
        <RouterLink v-for="p in s.practices" :key="p.key" :to="p.to" class="practice-card">
          <span class="practice-card__icon" aria-hidden="true">{{ p.icon }}</span>
          <span class="practice-card__text">
            <strong>{{ t(`${p.key}.title`) }}</strong>
            <span class="muted">{{ t(`${p.key}.card`) }}</span>
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
</style>
