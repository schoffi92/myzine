<script setup>
import { ref, computed, onMounted } from 'vue'
import { t } from '../i18n'
import { CARD_BY_ID, drawCards } from '../tarot/deck'
import { cardText } from '../tarot'
import { loadDraftData, saveDraftData } from '../db/drafts'

// Each practice keeps its own pulled cards in IndexedDB under this id.
const props = defineProps({ storeId: { type: String, default: 'timed-poem-cards' } })

// [{ id, reversed, revealed }]
const cards = ref([])
const allRevealed = computed(() => cards.value.length && cards.value.every((c) => c.revealed))

const save = () => saveDraftData(props.storeId, { cards: cards.value })

function pull() {
  cards.value = drawCards(3)
  save()
}

function reveal(card) {
  if (card.revealed) return
  card.revealed = true
  save()
}

function revealAll() {
  cards.value.forEach((c) => (c.revealed = true))
  save()
}

onMounted(async () => {
  const saved = await loadDraftData(props.storeId)
  if (saved?.cards?.every((c) => CARD_BY_ID[c.id])) cards.value = saved.cards
})
</script>

<template>
  <section class="tarot">
    <h2>🔮 {{ t('writing.timed.tarot.title') }}</h2>
    <p class="muted">{{ t('writing.timed.tarot.intro') }}</p>

    <div class="tarot__actions">
      <button :class="cards.length ? 'ghost' : 'primary'" @click="pull">
        🂠 {{ cards.length ? t('writing.timed.tarot.pullAgain') : t('writing.timed.tarot.pull') }}
      </button>
      <button v-if="cards.length && !allRevealed" class="ghost" @click="revealAll">
        {{ t('writing.timed.tarot.revealAll') }}
      </button>
    </div>

    <ol v-if="cards.length" class="spread">
      <li v-for="(card, i) in cards" :key="card.id + i" class="slot">
        <div class="slot__pos">
          <strong>{{ i + 1 }}. {{ t('writing.timed.tarot.positions')[i].name }}</strong>
          <span class="muted">{{ t('writing.timed.tarot.positions')[i].hint }}</span>
        </div>

        <button
          class="tcard"
          :class="{ revealed: card.revealed, reversed: card.reversed }"
          :style="{ '--card': CARD_BY_ID[card.id].color }"
          :aria-label="card.revealed ? cardText(card.id).name : t('writing.timed.tarot.tapToReveal')"
          :aria-pressed="card.revealed"
          @click="reveal(card)"
        >
          <span class="tcard__inner">
            <span class="tcard__back" aria-hidden="true"><span>✶</span></span>
            <span class="tcard__front" aria-hidden="true">
              <span class="tcard__art">
                <span class="tcard__label">{{ CARD_BY_ID[card.id].label }}</span>
                <span class="tcard__glyph">{{ CARD_BY_ID[card.id].glyph }}</span>
                <span class="tcard__name">{{ cardText(card.id).name }}</span>
              </span>
            </span>
          </span>
        </button>

        <div class="slot__text">
          <template v-if="card.revealed">
            <h3>{{ cardText(card.id).name }}</h3>
            <span class="badge" :class="{ rev: card.reversed }">
              {{ card.reversed ? '↓ ' + t('writing.timed.tarot.reversed') : '↑ ' + t('writing.timed.tarot.upright') }}
            </span>
            <p class="keywords">{{ card.reversed ? cardText(card.id).rev : cardText(card.id).up }}</p>
            <p>{{ card.reversed ? cardText(card.id).revText : cardText(card.id).upText }}</p>
          </template>
          <p v-else class="muted hint">{{ t('writing.timed.tarot.tapToReveal') }}</p>
        </div>
      </li>
    </ol>

    <p v-if="cards.length" class="muted note">{{ t('writing.timed.tarot.note') }}</p>
  </section>
</template>

<style scoped>
.tarot {
  margin: 0 0 1.25rem;
  padding: 1rem 1.25rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.tarot h2 { font-size: 1.15rem; margin: 0 0 0.2rem; }
.tarot > p { margin: 0 0 0.75rem; }
.tarot__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }

.spread { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.slot { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6rem; min-width: 0; }
.slot__pos { display: flex; flex-direction: column; line-height: 1.3; font-size: 0.9rem; }
.slot__text { width: 100%; }
.slot__text h3 { font-size: 1.05rem; margin: 0 0 0.3rem; }
.slot__text p { margin: 0.35rem 0 0; font-size: 0.92rem; }
.keywords { font-style: italic; color: var(--muted); }
.hint { font-size: 0.85rem; }
.badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.1em 0.6em;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.badge.rev { border-color: var(--danger); color: var(--danger); }
.note { font-size: 0.85rem; margin: 1rem 0 0; }

/* ---------- The card ---------- */
.tcard {
  all: unset;
  cursor: pointer;
  width: min(100%, 140px);
  aspect-ratio: 2 / 3;
  perspective: 900px;
  border-radius: 10px;
}
.tcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.tcard.revealed { cursor: default; }
.tcard__inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.3, 1);
}
.tcard.revealed .tcard__inner { transform: rotateY(180deg); }
.tcard:not(.revealed):hover .tcard__inner { transform: translateY(-4px) rotateZ(-1deg); }

.tcard__back,
.tcard__front {
  position: absolute;
  inset: 0;
  display: block;
  border-radius: 10px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.2), 0 8px 20px rgb(0 0 0 / 0.12);
}
.tcard__back {
  background:
    radial-gradient(circle at 50% 50%, transparent 28%, rgb(255 255 255 / 0.07) 29% 31%, transparent 32%),
    repeating-linear-gradient(45deg, rgb(255 255 255 / 0.06) 0 6px, transparent 6px 12px),
    repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.06) 0 6px, transparent 6px 12px),
    linear-gradient(160deg, #3b2160, #1d1233);
  border: 4px solid #c9a94b;
  display: grid;
  place-items: center;
  color: #e7cf7d;
  font-size: 2rem;
}
.tcard__front {
  transform: rotateY(180deg);
  background: #fbf6ea;
  color: #2a2420;
  border: 4px solid #fbf6ea;
  outline: 2px solid var(--card);
  outline-offset: -8px;
}
.tcard__art {
  position: absolute;
  inset: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.3rem;
  transition: transform 0.3s;
}
.tcard.reversed .tcard__art { transform: rotate(180deg); }
.tcard__label { font: 700 0.85rem Georgia, serif; color: var(--card); min-height: 1em; }
.tcard__glyph { font-size: 2.6rem; line-height: 1; color: var(--card); }
.tcard__name {
  font: 600 0.72rem/1.15 Georgia, serif;
  text-align: center;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .tcard__inner { transition: none; }
}

/* Phones: one card per row, text beside it */
@media (max-width: 560px) {
  .spread { grid-template-columns: 1fr; }
  .slot {
    display: grid;
    grid-template-columns: 96px 1fr;
    grid-template-areas: 'pos pos' 'card text';
    align-items: start;
    text-align: left;
    column-gap: 0.9rem;
  }
  .slot__pos { grid-area: pos; flex-direction: row; flex-wrap: wrap; gap: 0 0.5rem; }
  .tcard { grid-area: card; width: 96px; }
  .slot__text { grid-area: text; }
  .tcard__glyph { font-size: 2rem; }
}
</style>
