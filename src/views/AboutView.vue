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
    </div>
  </section>
</template>

<style scoped>
.about .info-block p { margin: 0 0 0.8rem; }
.about .info-block p:last-child { margin-bottom: 0; }
</style>
