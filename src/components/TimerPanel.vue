<script setup>
import { t, tl } from '../i18n'
import Icon from './Icon.vue'
import { status, mmss, progress, ringing, start, pause, reset, stopAlarm } from '../composables/poemTimer'

// Route name of the practice using this panel; the timer links back here when it rings.
const props = defineProps({ owner: { type: String, required: true } })
</script>

<template>
  <div class="timer" :class="status" :style="{ '--progress': progress }">
    <div class="timer__clock" role="timer" aria-live="off">{{ mmss }}</div>
    <div class="timer__bar"><span /></div>
    <div class="timer__buttons">
      <button v-if="status === 'idle'" class="primary big" @click="start(props.owner)" :title="tl('writing.timed.start')" :aria-label="tl('writing.timed.start')"><Icon name="play" :label="tl('writing.timed.start')" /></button>
      <button v-else-if="status === 'running'" class="big" @click="pause" :title="tl('writing.timed.pause')" :aria-label="tl('writing.timed.pause')"><Icon name="pause" :label="tl('writing.timed.pause')" /></button>
      <button v-else-if="status === 'paused'" class="primary big" @click="start(props.owner)" :title="tl('writing.timed.resume')" :aria-label="tl('writing.timed.resume')"><Icon name="play" :label="tl('writing.timed.resume')" /></button>
      <button v-if="status !== 'idle'" class="ghost" @click="reset" :title="tl('writing.timed.reset')" :aria-label="tl('writing.timed.reset')"><Icon name="reset" :label="tl('writing.timed.reset')" /></button>
    </div>
  </div>

  <div v-if="status === 'done'" class="times-up" :class="{ ringing }" role="alert">
    <div>
      <strong>⏰ {{ t('writing.timed.timesUp') }}</strong>
      <span>{{ t('writing.timed.timesUpBody') }}</span>
    </div>
    <button v-if="ringing" class="primary" @click="stopAlarm">🔕 {{ t('writing.timed.stopAlarm') }}</button>
  </div>
</template>

<style scoped>
.timer {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'clock buttons' 'bar bar';
  align-items: center;
  gap: 0.75rem 1.25rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  margin-bottom: 1rem;
}
.timer__clock {
  grid-area: clock;
  font: 700 2.75rem/1 ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.timer.running .timer__clock { color: var(--accent); }
.timer.done .timer__clock { color: var(--danger); }
.timer__buttons { grid-area: buttons; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; }
.timer__bar { grid-area: bar; height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
.timer__bar span {
  display: block;
  height: 100%;
  width: calc(var(--progress) * 100%);
  background: var(--accent);
  transition: width 0.25s linear;
}
.big { font-size: 1.05rem; padding: 0.6em 1.1em; }

.times-up {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  border: 2px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
}
.times-up div { display: flex; flex-direction: column; }
.times-up strong { font-size: 1.15rem; }
.times-up.ringing { animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse {
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--danger) 25%, transparent); }
}
@media (prefers-reduced-motion: reduce) { .times-up.ringing { animation: none; } }

@media (max-width: 520px) {
  .timer { grid-template-columns: 1fr; grid-template-areas: 'clock' 'bar' 'buttons'; text-align: center; }
  .timer__buttons { justify-content: center; }
}
</style>
