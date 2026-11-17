<script setup>
/*
 * Line icon (+ optional text label) for buttons. On phones the label is hidden
 * (see .btn-label in style.css), so the button must also carry
 * :title and :aria-label with the same text.
 */
defineProps({
  name: { type: String, required: true },
  label: { type: String, default: '' },
})

const PATHS = {
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  book: 'M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  pencil: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  printer: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  download: 'M12 3v12m0 0l-5-5m5 5l5-5M4 19h16',
  upload: 'M12 15V3m0 0L7 8m5-5l5 5M4 19h16',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M5 12l5 5L20 7',
  play: 'M7 4l13 8-13 8z',
  pause: 'M8 5v14M16 5v14',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01',
  x: 'M6 6l12 12M18 6L6 18',
}
</script>

<template>
  <svg class="btn-ico" viewBox="0 0 24 24" aria-hidden="true"><path :d="PATHS[name]" /></svg>
  <span v-if="label" class="btn-label">{{ label }}</span>
</template>
