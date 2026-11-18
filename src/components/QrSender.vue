<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import qrcode from 'qrcode-generator'
import { t, tl } from '../i18n'
import Icon from './Icon.vue'

/*
 * Shows the QR code texts one after the other, in a loop, so another device
 * can scan them all (in any order). Pause and step through them by hand if
 * the camera is slow.
 */
const props = defineProps({ frames: { type: Array, required: true } })

const SPEEDS = [1200, 600, 350] // ms per code: slow, normal, fast
const speed = ref(1)
const playing = ref(true)
const index = ref(0)

const QUIET = 4 // white border in modules, needed by scanners

/** QR text → { size, path } for an SVG, one 1×1 square per dark module. */
function render(text) {
  const qr = qrcode(0, 'L')
  qr.addData(text, 'Byte')
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`
  }
  return { size: n + QUIET * 2, path: d }
}

const codes = computed(() => props.frames.map(render))
const code = computed(() => codes.value[index.value] || codes.value[0])

let timer = null
function schedule() {
  clearTimeout(timer)
  if (playing.value && props.frames.length > 1) {
    timer = setTimeout(() => {
      index.value = (index.value + 1) % props.frames.length
      schedule()
    }, SPEEDS[speed.value])
  }
}

function step(dir) {
  playing.value = false
  index.value = (index.value + dir + props.frames.length) % props.frames.length
}

watch(() => props.frames, () => { index.value = 0; schedule() }, { immediate: true })
watch([playing, speed], schedule)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="qr-sender">
    <svg
      v-if="code"
      class="qr"
      :viewBox="`0 0 ${code.size} ${code.size}`"
      role="img"
      :aria-label="t('qr.part', { i: index + 1, n: frames.length })"
      shape-rendering="crispEdges"
    >
      <rect :width="code.size" :height="code.size" fill="#fff" />
      <path :d="code.path" fill="#000" />
    </svg>

    <p class="part" aria-live="off">{{ t('qr.part', { i: index + 1, n: frames.length }) }}</p>
    <div class="dots" aria-hidden="true">
      <span v-for="(f, i) in frames" :key="i" :class="{ on: i === index }" />
    </div>

    <div v-if="frames.length > 1" class="controls">
      <button class="ghost" @click="step(-1)" :title="tl('qr.prev')" :aria-label="tl('qr.prev')"><Icon name="chevron-left" /></button>
      <button @click="playing = !playing" :title="tl(playing ? 'qr.pause' : 'qr.play')" :aria-label="tl(playing ? 'qr.pause' : 'qr.play')">
        <Icon :name="playing ? 'pause' : 'play'" :label="tl(playing ? 'qr.pause' : 'qr.play')" />
      </button>
      <button class="ghost" @click="step(1)" :title="tl('qr.next')" :aria-label="tl('qr.next')"><Icon name="chevron-right" /></button>
      <label class="speed">
        <span class="muted">{{ t('qr.speed') }}</span>
        <select v-model.number="speed">
          <option v-for="(s, i) in t('qr.speeds')" :key="i" :value="i">{{ s }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.qr-sender { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin: 0.5rem 0 1rem; }
.qr { width: min(100%, 22rem); height: auto; border-radius: 6px; box-shadow: 0 1px 4px rgb(0 0 0 / 0.15); }
.part { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 22rem; }
.dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--border); }
.dots span.on { background: var(--accent); }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.4rem; }
.speed { display: flex; align-items: center; gap: 0.35rem; margin-left: 0.5rem; font-size: 0.9rem; }
</style>
