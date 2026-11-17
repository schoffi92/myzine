/*
 * The 78-card tarot deck: 22 Major Arcana + 4 suits × 14 Minor Arcana.
 * Card names and meanings live in ./<locale>.js, keyed by the ids below.
 */

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI']

// Suit glyphs follow the traditional playing-card mapping.
export const SUITS = {
  wands: { glyph: '♣', color: '#c2571a' }, // fire
  cups: { glyph: '♥', color: '#2a6fb0' }, // water
  swords: { glyph: '♠', color: '#55606e' }, // air
  pentacles: { glyph: '♦', color: '#a8840f' }, // earth
}

const pad = (n) => String(n).padStart(2, '0')

export const DECK = [
  ...ROMAN.map((label, i) => ({ id: `m${pad(i)}`, arcana: 'major', label, glyph: '✶', color: '#6b3fa0' })),
  ...Object.entries(SUITS).flatMap(([suit, { glyph, color }]) =>
    Array.from({ length: 14 }, (_, k) => {
      const rank = k + 1
      return {
        id: `${suit}-${pad(rank)}`,
        arcana: 'minor',
        suit,
        rank,
        label: rank === 1 ? 'A' : rank <= 10 ? String(rank) : '',
        glyph,
        color,
      }
    }),
  ),
]

export const CARD_BY_ID = Object.fromEntries(DECK.map((c) => [c.id, c]))

function randomInt(max) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

/** Draw `n` different cards, each randomly upright or reversed, face down. */
export function drawCards(n = 3) {
  const ids = DECK.map((c) => c.id)
  // partial Fisher–Yates shuffle
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(ids.length - i)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, n).map((id) => ({ id, reversed: randomInt(2) === 1, revealed: false }))
}
