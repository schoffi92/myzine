<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { checkPairs, confirmKey } from '../writing/rhyme'

/*
 * The rhyme check under a stanza list: one row per pair of lines that must
 * rhyme (letter, the two last words with their rhyme highlighted, a verdict).
 * Not readonly: a pair the check doesn't recognise can be confirmed by the
 * writer, which emits `confirm` / `unconfirm` with the pair's confirmKey.
 */
const props = defineProps({
  scheme: { type: String, required: true },
  lines: { type: Array, required: true },
  locale: { type: String, required: true },
  confirmed: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'unconfirm'])

const pairs = computed(() => checkPairs(props.scheme, props.lines, props.locale, props.confirmed))
const ready = computed(() => pairs.value.filter((p) => p.status !== 'empty'))
const fitting = computed(() => pairs.value.filter((p) => p.fits).length)

const ICON = { rhyme: '✓', near: '≈', no: '✗', same: '=', empty: '…' }
const statusText = (p) => t(p.confirmed ? 'writing.rhyme.statusConfirmed' : `writing.rhyme.status_${p.status}`)
const verdict = (p) => (p.fits ? 'ok' : p.status === 'near' || p.status === 'same' ? 'warn' : p.status === 'empty' ? 'wait' : 'bad')
const keyOf = (p) => confirmKey(p.ra.word, p.rb.word)
</script>

<template>
  <div class="pairs">
    <p class="pairs__sum" :class="{ done: ready.length && fitting === pairs.length }">
      {{ t('writing.rhyme.fitCount', { n: fitting, total: pairs.length }) }}
    </p>
    <ul>
      <li v-for="p in pairs" :key="`${p.a}-${p.b}`" :class="`pair pair--${verdict(p)}`">
        <span class="letter" aria-hidden="true">{{ p.letter }}</span>
        <span class="sr-only">{{ t('writing.rhyme.pairLabel', { letter: p.letter, a: p.a + 1, b: p.b + 1 }) }}</span>
        <span class="words serif">
          <template v-for="(r, i) in [p.ra, p.rb]" :key="i">
            <span v-if="i" class="dash" aria-hidden="true">–</span>
            <span v-if="r" class="word">{{ r.word.slice(0, r.start) }}<b>{{ r.word.slice(r.start) }}</b></span>
            <span v-else class="word missing">{{ t('writing.rhyme.lineN', { n: (i ? p.b : p.a) + 1 }) }}</span>
          </template>
        </span>
        <span class="verdict"><span aria-hidden="true">{{ p.confirmed ? '✓' : ICON[p.status] }}</span> {{ statusText(p) }}</span>
        <template v-if="!readonly && p.ra && p.rb && (p.status === 'near' || p.status === 'no')">
          <button v-if="p.confirmed" type="button" class="ghost small" @click="emit('unconfirm', keyOf(p))">{{ t('writing.rhyme.unconfirm') }}</button>
          <button v-else type="button" class="ghost small" @click="emit('confirm', keyOf(p))">{{ t('writing.rhyme.confirm') }}</button>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pairs { margin-top: 1rem; }
.pairs__sum { margin: 0 0 0.4rem; font-weight: 600; color: var(--muted); }
.pairs__sum.done { color: var(--accent); }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.pair {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.7rem;
  padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; background: var(--surface);
}
.letter {
  display: inline-grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%;
  font: 700 0.85rem system-ui, sans-serif; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent);
}
.words { flex: 1 1 10rem; min-width: 0; overflow-wrap: anywhere; }
.word b { color: var(--accent); }
.missing { color: var(--muted); font-style: italic; }
.dash { margin: 0 0.35rem; color: var(--muted); }
.verdict { font-size: 0.9rem; }
.pair--ok .verdict { color: var(--accent); font-weight: 600; }
.pair--warn .verdict { color: var(--text, inherit); font-style: italic; }
.pair--bad .verdict { color: var(--danger, #b42318); }
.pair--wait .verdict { color: var(--muted); }
.small { padding: 0.2rem 0.6rem; font-size: 0.85rem; }
.serif { font-family: Georgia, 'Times New Roman', serif; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
