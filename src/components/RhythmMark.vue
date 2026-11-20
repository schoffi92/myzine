<script setup>
import { usesLength, symbolOf } from '../writing/meter'

/*
 * One rhythm mark. Stress languages: a drawn circle (filled = stressed,
 * empty = unstressed, small dot = either), because ● and ○ differ in size in
 * most fonts. Hungarian: the text symbols – ∪ ×.
 */
defineProps({
  value: { type: String, required: true }, // S | u | x
  locale: { type: String, required: true },
})
</script>

<template>
  <span v-if="usesLength(locale)" class="mk-t" aria-hidden="true">{{ symbolOf(value, locale) }}</span>
  <span v-else class="mk" :class="`mk-${value}`" aria-hidden="true" />
</template>

<style scoped>
.mk { display: inline-block; width: 0.66em; height: 0.66em; border-radius: 50%; border: 2px solid currentColor; box-sizing: border-box; vertical-align: middle; }
.mk-S { background: currentColor; }
.mk-x { width: 0.3em; height: 0.3em; border: 0; background: currentColor; opacity: 0.55; }
.mk-t { display: inline-block; min-width: 0.7em; text-align: center; }
</style>
