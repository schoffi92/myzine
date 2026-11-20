<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { t, tl } from '../i18n'
import Icon from './Icon.vue'
import { createCollector, parseFrame } from '../sync/qrPayload'

/*
 * Reads MyZine QR codes with the camera until every part has arrived, then
 * emits `done` with the unpacked data. Uses the browser's BarcodeDetector
 * where it can read QR codes (Chrome/Edge on Android), otherwise jsQR,
 * loaded only when needed. Nothing leaves the device.
 */
const emit = defineEmits(['done', 'cancel'])

const video = ref(null)
const error = ref('')
const state = reactive({ started: false, got: 0, total: 0, have: new Set(), checking: false })

const collector = createCollector()
let stream = null
let timer = null
let stopped = false
let detect = null // video → Promise<string[]>

async function makeDetector() {
  try {
    if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      const d = new BarcodeDetector({ formats: ['qr_code'] })
      return async (v) => (await d.detect(v)).map((b) => b.rawValue)
    }
  } catch {
    /* fall back to jsQR */
  }
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return async (v) => {
    const scale = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight))
    const w = (canvas.width = Math.round(v.videoWidth * scale))
    const h = (canvas.height = Math.round(v.videoHeight * scale))
    ctx.drawImage(v, 0, 0, w, h)
    const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })
    return code ? [code.data] : []
  }
}

function stopCamera() {
  stopped = true
  clearTimeout(timer)
  stream?.getTracks().forEach((tr) => tr.stop())
  stream = null
}

async function onCode(text) {
  const frame = parseFrame(text)
  const progress = collector.add(text)
  if (!progress || !frame) return
  if (progress.total !== state.total || progress.got < state.have.size) state.have = new Set()
  state.have.add(frame.part)
  state.got = progress.got
  state.total = progress.total
  if (!collector.complete) return

  state.checking = true
  try {
    const data = await collector.finish()
    stopCamera()
    emit('done', data)
  } catch (e) {
    if (e?.code === 'checksum') {
      // a part was misread: start collecting again, the codes keep looping
      error.value = t('qr.badData')
      collector.reset()
      Object.assign(state, { got: 0, total: 0, have: new Set() })
    } else {
      // every part arrived but can't be read here: scanning again won't help
      stopCamera()
      error.value = t(e?.code === 'nodecompress' ? 'qr.noDecompress' : 'qr.cantRead')
    }
  } finally {
    state.checking = false
  }
}

async function tick() {
  if (stopped) return
  try {
    const v = video.value
    if (v && v.readyState >= 2 && v.videoWidth && !state.checking) {
      for (const text of await detect(v)) await onCode(text)
    }
  } catch {
    /* a frame that can't be read; try the next one */
  }
  if (!stopped) timer = setTimeout(tick, 120)
}

onMounted(async () => {
  if (!window.isSecureContext) return (error.value = t('qr.insecure'))
  if (!navigator.mediaDevices?.getUserMedia) return (error.value = t('qr.noCamera', { msg: 'getUserMedia' }))
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    if (stopped) return stopCamera()
    video.value.srcObject = stream
    await video.value.play()
    detect = await makeDetector()
    state.started = true
    tick()
  } catch (e) {
    stopCamera()
    error.value = t('qr.noCamera', { msg: e?.message || e?.name || '' })
  }
})

onBeforeUnmount(stopCamera)

function cancel() {
  stopCamera()
  emit('cancel')
}
</script>

<template>
  <div class="qr-scanner">
    <div class="viewport">
      <video ref="video" muted playsinline />
      <div v-if="state.started" class="frame" aria-hidden="true" />
    </div>

    <p class="status" role="status">
      <template v-if="state.checking">{{ t('qr.checking') }}</template>
      <template v-else-if="state.total">{{ t('qr.received', { got: state.got, n: state.total }) }}</template>
      <template v-else-if="state.started">{{ t('qr.looking') }}</template>
    </p>
    <div v-if="state.total" class="dots" aria-hidden="true">
      <span v-for="i in state.total" :key="i" :class="{ on: state.have.has(i) }" />
    </div>
    <p v-if="error" class="error small">{{ error }}</p>

    <button class="ghost" @click="cancel" :title="tl('qr.stop')" :aria-label="tl('qr.stop')"><Icon name="x" :label="tl('qr.stop')" /></button>
  </div>
</template>

<style scoped>
.qr-scanner { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin: 0.75rem 0; }
.viewport { position: relative; width: min(100%, 26rem); aspect-ratio: 4 / 3; background: #111; border-radius: 8px; overflow: hidden; }
.viewport video { width: 100%; height: 100%; object-fit: cover; display: block; }
.frame { position: absolute; inset: 12%; border: 3px solid rgb(255 255 255 / 0.85); border-radius: 10px; box-shadow: 0 0 0 999px rgb(0 0 0 / 0.25); }
.status { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; min-height: 1.4em; }
.dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 26rem; }
.dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
.dots span.on { background: #3c9a5f; }
.small { font-size: 0.86rem; }
</style>
