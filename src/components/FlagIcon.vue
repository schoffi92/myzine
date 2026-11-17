<script setup>
// Small inline SVG flags for the language picker (emoji flags don't render on Windows).
// Simplified designs; Spain without the coat of arms.
defineProps({ code: { type: String, required: true } })
</script>

<template>
  <span class="flag" aria-hidden="true">
    <svg v-if="code === 'en'" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">
      <clipPath id="flag-gb-t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6" />
      <path d="M0 0l60 30M60 0L0 30" clip-path="url(#flag-gb-t)" stroke="#C8102E" stroke-width="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6" />
    </svg>
    <svg v-else-if="code === 'de'" viewBox="0 0 5 3" preserveAspectRatio="none">
      <rect width="5" height="1" fill="#000" />
      <rect y="1" width="5" height="1" fill="#DD0000" />
      <rect y="2" width="5" height="1" fill="#FFCE00" />
    </svg>
    <svg v-else-if="code === 'es'" viewBox="0 0 3 2" preserveAspectRatio="none">
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </svg>
    <svg v-else-if="code === 'hu'" viewBox="0 0 6 3" preserveAspectRatio="none">
      <rect width="6" height="1" fill="#CE2939" />
      <rect y="1" width="6" height="1" fill="#fff" />
      <rect y="2" width="6" height="1" fill="#477050" />
    </svg>
    <svg v-else-if="code === 'fr'" viewBox="0 0 3 2" preserveAspectRatio="none">
      <rect width="1" height="2" fill="#002654" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#CE1126" />
    </svg>
    <svg v-else-if="code === 'pl'" viewBox="0 0 8 5" preserveAspectRatio="none">
      <rect width="8" height="2.5" fill="#fff" />
      <rect y="2.5" width="8" height="2.5" fill="#DC143C" />
    </svg>
  </span>
</template>

<style scoped>
.flag {
  display: inline-block;
  width: 1.5rem;
  height: 1rem;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.18);
  line-height: 0;
  flex-shrink: 0;
}
.flag svg { width: 100%; height: 100%; display: block; }
</style>
