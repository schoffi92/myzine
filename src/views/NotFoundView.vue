<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { settings } from '../composables/settings'

/*
 * An address that isn't a page of MyZine. The server answers it with status
 * 404 (see the nginx notes in the README); this page tells the visitor and
 * offers the way back. Marked noindex (route meta), so it never shows in search.
 */
// the links stay in the visitor's language
const lang = computed(() => (settings.locale === 'en' ? '' : settings.locale))
</script>

<template>
  <section class="container prose not-found">
    <h1>{{ t('notFound.title') }}</h1>
    <p class="lead">{{ t('notFound.text') }}</p>
    <nav class="links">
      <RouterLink :to="{ name: 'home', params: { lang } }" class="btn primary">{{ t('notFound.home') }}</RouterLink>
      <RouterLink :to="{ name: 'writing', params: { lang } }" class="btn">{{ t('notFound.writing') }}</RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.not-found { padding-top: 2rem; }
.links { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.5rem; }
</style>
