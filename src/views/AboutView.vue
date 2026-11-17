<script setup>
import { t } from '../i18n'
</script>

<template>
  <section class="container prose about">
    <RouterLink to="/" class="back">← {{ t('nav.home') }}</RouterLink>
    <h1>{{ t('about.title') }}</h1>

    <div v-for="(section, si) in t('about.sections')" :key="si" class="info-block">
      <h2>{{ section.h }}</h2>
      <p v-for="(para, pi) in section.p" :key="pi" :class="{ lead: si === 0 && pi === 0 }">{{ para }}</p>
      <p v-if="section.link">
        <a :href="section.link" target="_blank" rel="noopener noreferrer" class="ext-link">{{ section.link.replace(/^https?:\/\//, '') }} ↗</a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.about .info-block p { margin: 0 0 0.8rem; }
.about .info-block p:last-child { margin-bottom: 0; }
.ext-link { color: var(--accent); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.ext-link:hover { text-decoration: underline; }
</style>
