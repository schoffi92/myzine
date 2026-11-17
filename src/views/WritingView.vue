<script setup>
import { t, tl } from '../i18n'
import Icon from '../components/Icon.vue'

const practices = [
  { to: { name: 'blackout' }, icon: '▬', key: 'writing.blackout' },
  { to: { name: 'timed' }, icon: '⏱', key: 'writing.timed' },
  { to: { name: 'cutup' }, icon: '✂', key: 'writing.cutup' },
  { to: { name: 'snowflake' }, icon: '❄', key: 'writing.snowflake' },
  { to: { name: 'mosaic' }, icon: '▦', key: 'writing.mosaic' },
  { to: { name: 'story' }, icon: '🂡', key: 'writing.story' },
]
</script>

<template>
  <section class="container prose">
    <RouterLink :to="{ name: 'home' }" class="back" :title="tl('nav.home')" :aria-label="tl('nav.home')"><Icon name="arrow-left" :label="tl('nav.home')" /></RouterLink>
    <h1>{{ t('writing.title') }}</h1>
    <p class="lead">{{ t('writing.intro') }}</p>

    <nav class="practice-list">
      <RouterLink v-for="p in practices" :key="p.key" :to="p.to" class="practice-card">
        <span class="practice-card__icon" aria-hidden="true">{{ p.icon }}</span>
        <span class="practice-card__text">
          <strong>{{ t(`${p.key}.title`) }}</strong>
          <span class="muted">{{ t(`${p.key}.card`) }}</span>
        </span>
        <span class="practice-card__go">{{ t('writing.open') }} →</span>
      </RouterLink>
    </nav>

    <p class="muted soon">{{ t('writing.soon') }}</p>
  </section>
</template>
