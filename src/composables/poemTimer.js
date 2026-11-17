import { ref, computed } from 'vue'
import { t } from '../i18n'

/*
 * App-wide 15-minute timer. It lives at module level (not inside a page),
 * so it keeps running and rings wherever the user is in the app.
 * Its small state is kept in localStorage so it survives reloads.
 */

export const DURATION = 15 * 60 * 1000
const KEY = 'myzine:timer15'
const ALARM_MAX_MS = 30_000 // stop ringing on its own after 30 s

// idle | running | paused | done
export const status = ref('idle')
export const remaining = ref(DURATION)
export const ringing = ref(false)
// Route name of the practice that started the timer (where "time's up" links to).
export const owner = ref('timed')

export const mmss = computed(() => {
  const s = Math.ceil(remaining.value / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
export const progress = computed(() => 1 - remaining.value / DURATION)

let endAt = 0
let interval = null

function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ status: status.value, endAt, remaining: remaining.value, owner: owner.value }),
    )
  } catch { /* storage unavailable */ }
}

function tick() {
  remaining.value = Math.max(0, endAt - Date.now())
  if (remaining.value === 0) finish(true)
}

function run() {
  clearInterval(interval)
  interval = setInterval(tick, 250)
  tick()
}

export function start(startedBy) {
  unlockAudio() // called from a click, so the browser allows sound later
  if (startedBy) owner.value = startedBy
  endAt = Date.now() + (status.value === 'paused' ? remaining.value : DURATION)
  status.value = 'running'
  persist()
  run()
}

export function pause() {
  if (status.value !== 'running') return
  clearInterval(interval)
  remaining.value = Math.max(0, endAt - Date.now())
  status.value = 'paused'
  persist()
}

export function reset() {
  clearInterval(interval)
  stopAlarm()
  status.value = 'idle'
  remaining.value = DURATION
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

function finish(withAlarm) {
  clearInterval(interval)
  remaining.value = 0
  status.value = 'done'
  persist()
  if (withAlarm) startAlarm()
}

/* ---------- Alarm: generated with Web Audio, no sound file ---------- */
let audioCtx = null
let ringInterval = null
let ringTimeout = null
let titleInterval = null
const originalTitle = document.title

function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {
    audioCtx = null
  }
}

function beepPattern() {
  if (!audioCtx) return
  const now = audioCtx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    const t0 = now + i * 0.25
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
    osc.connect(gain).connect(audioCtx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.2)
  }
}

function startAlarm() {
  stopAlarm()
  ringing.value = true
  beepPattern()
  ringInterval = setInterval(beepPattern, 1200)
  ringTimeout = setTimeout(stopAlarm, ALARM_MAX_MS)
  navigator.vibrate?.([400, 200, 400, 200, 400])
  let flip = false
  titleInterval = setInterval(() => {
    document.title = (flip = !flip) ? `⏰ ${t('writing.timed.timesUp')}` : originalTitle
  }, 1000)
}

export function stopAlarm() {
  ringing.value = false
  clearInterval(ringInterval)
  clearInterval(titleInterval)
  clearTimeout(ringTimeout)
  document.title = originalTitle
  navigator.vibrate?.(0)
}

/* ---------- Restore after a reload ---------- */
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  if (saved) {
    endAt = saved.endAt
    owner.value = saved.owner || 'timed'
    if (saved.status === 'running') {
      if (endAt > Date.now()) {
        status.value = 'running'
        run()
      } else {
        finish(false) // ended while the app was closed: show "time's up" quietly
      }
    } else if (saved.status === 'paused') {
      status.value = 'paused'
      remaining.value = saved.remaining
    } else if (saved.status === 'done') {
      status.value = 'done'
      remaining.value = 0
    }
  }
} catch { /* ignore */ }

// After a reload, browsers only allow sound once the user has interacted with
// the page, so unlock audio on the first click or key press while a timer is active.
const unlockOnGesture = () => {
  if (status.value === 'running' || status.value === 'paused') unlockAudio()
}
window.addEventListener('pointerdown', unlockOnGesture, { capture: true })
window.addEventListener('keydown', unlockOnGesture, { capture: true })
