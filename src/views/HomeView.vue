<script setup>
import { t } from '../i18n'

const items = [
  { to: { name: 'writing' }, icon: '✎', label: 'home.writing', desc: 'home.writingDesc' },
  { to: { name: 'zines' }, icon: '▤', label: 'home.create', desc: 'home.createDesc' },
  { to: { name: 'storage' }, icon: '⛁', label: 'home.storage', desc: 'home.storageDesc' },
  { to: { name: 'about' }, icon: 'ⓘ', label: 'home.about', desc: 'home.aboutDesc' },
]
</script>

<template>
  <section class="home">
    <p class="home__tagline">{{ t('home.tagline') }}</p>
    <nav class="home__menu">
      <RouterLink v-for="item in items" :key="item.label" :to="item.to" class="menu-btn">
        <span class="menu-btn__icon" aria-hidden="true">{{ item.icon }}</span>
        <span class="menu-btn__label">{{ t(item.label) }}</span>
        <span class="menu-btn__desc">{{ t(item.desc) }}</span>
      </RouterLink>
    </nav>
  </section>
</template>
