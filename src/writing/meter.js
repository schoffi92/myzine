import { lineWords, wordSyllables, joinsPrevious } from './syllables'

/*
 * Rhythm checking for the Iamb and trochee practice.
 *
 * A line is split into words and syllables (estimated, see syllables.js).
 * Every syllable gets a value:
 *   'S' stressed (or long), 'u' unstressed (or short), 'x' either.
 * Stress languages: the writer marks stress by tapping. Where the language has
 * a rule the syllables start pre-marked: Polish (second to last), Spanish
 * (written accent, else the ending rule), German (first syllable, except
 * unstressed prefixes and -ieren). English and French start unmarked.
 * One-syllable words count as either until the writer marks them.
 * Hungarian: quantity instead of stress. A syllable is long when its vowel is
 * long or two consonants follow it (also across a word boundary; cs, sz, gy…
 * count as one); the last syllable of a line can be either (anceps), and a
 * long syllable may stand where a short one is expected (spondee).
 *
 * Writer's corrections are kept per line in `marks` ({ "<word>#<n>:<i>": 'S'|'u'|'x' })
 * and `counts` ({ "<word>#<n>": syllables }), keyed by the word and its
 * occurrence, so they survive edits elsewhere in the line.
 */

export const RHYTHMS = ['iamb', 'trochee']
export const FEET_OPTIONS = [3, 4, 5]
export const MIN_LINES = 2
export const MAX_LINES = 8
const PATTERN = { iamb: ['u', 'S'], trochee: ['S', 'u'] }

/** Hungarian uses long/short syllables instead of stress. */
export const usesLength = (locale) => locale === 'hu'

/* ---------- stress guesses ---------- */

const DE_PREFIX = /^(?:be|ge|er|ver|zer|ent|emp|miss)/

/** Syllable that carries a written accent in a Spanish word, or -1. */
function esAccentIndex(word) {
  const w = word.toLowerCase().replace(/y$/, 'i').replace(/(?<=[qg])u(?=[eéií])/g, '')
  let idx = 0
  for (const m of w.matchAll(/[aeiouáéíóúü]+/g)) {
    const group = m[0]
    const syl = Math.max(1, (group.match(/[aeoáéóíú]/g) || []).length)
    let k = 0
    for (const c of group) {
      if (/[áéíóú]/.test(c)) return idx + Math.min(k, syl - 1)
      if (/[aeoáéóíú]/.test(c)) k++
    }
    idx += syl
  }
  return -1
}

/** Index of the stressed syllable of a word with n ≥ 2 syllables, or -1 when the language gives no rule. */
function guessStress(word, n, locale) {
  const w = word.toLowerCase()
  if (locale === 'pl') return n - 2
  if (locale === 'es') {
    const acc = esAccentIndex(w)
    if (acc >= 0) return Math.min(acc, n - 1)
    return /[aeiouns]$/.test(w) ? n - 2 : n - 1
  }
  if (locale === 'de') {
    if (/ieren$/.test(w)) return n - 2
    if (DE_PREFIX.test(w) && (n >= 3 || w.length > 5)) return 1
    return 0
  }
  return -1 // en, fr: spelling doesn't show stress
}

/* ---------- Hungarian syllable length ---------- */

const HU_VOWEL = /[aáeéiíoóöőuúüű]/
const HU_LONG = /[áéíóőúű]/
const HU_DIGRAPH = /^(?:dzs|cs|dz|gy|ly|ny|sz|ty|zs)/

/** Long ('S') or short ('u') for every vowel of every word, counting consonants across word boundaries. */
function huLengths(words) {
  const tokens = []
  words.forEach((word, wi) => {
    const s = word.toLowerCase()
    for (let i = 0; i < s.length; ) {
      const ch = s[i]
      if (HU_VOWEL.test(ch)) {
        tokens.push({ v: true, long: HU_LONG.test(ch), wi })
        i++
      } else if (/\p{L}/u.test(ch)) {
        tokens.push({ v: false })
        i += (HU_DIGRAPH.exec(s.slice(i)) || [ch])[0].length
      } else i++
    }
  })
  const out = words.map(() => [])
  tokens.forEach((tok, k) => {
    if (!tok.v) return
    let cons = 0
    for (let j = k + 1; j < tokens.length && !tokens[j].v; j++) cons++
    out[tok.wi].push(tok.long || cons >= 2 ? 'S' : 'u')
  })
  return out
}

/* ---------- one line ---------- */

const isMark = (m) => m === 'S' || m === 'u' || m === 'x'

/**
 * Words of a line with their syllables:
 * [{ text, key, n, auto, joins, slots: [{ key, auto, value, set, pos }] }]
 * `joins`: Spanish synalepha, the word's first syllable merges into the previous one.
 * `pos`: index of the syllable in the line (merged syllables share one).
 */
export function analyzeLine(text, locale, marks = {}, counts = {}) {
  const hu = usesLength(locale)
  const words = lineWords(text || '', locale)
  const lengths = hu ? huLengths(words) : null
  const seen = {}
  const out = []
  words.forEach((w, wi) => {
    const lw = w.toLowerCase()
    seen[lw] = (seen[lw] ?? -1) + 1
    const key = `${lw}#${seen[lw]}`
    const auto = wordSyllables(w, locale)
    const n = !hu && Number.isInteger(counts[key]) && counts[key] >= 0 ? counts[key] : auto
    let autoVals
    if (hu) autoVals = lengths[wi]
    else {
      const s = n >= 2 ? guessStress(w, n, locale) : -1
      autoVals = Array.from({ length: n }, (_, i) => (n < 2 ? 'x' : i === s ? 'S' : 'u'))
    }
    const slots = autoVals.map((a, i) => {
      const k = `${key}:${i}`
      return { key: k, auto: a, value: isMark(marks[k]) ? marks[k] : a, set: isMark(marks[k]) }
    })
    const prev = out.at(-1)
    const joins = !!(slots.length && prev?.slots.length && joinsPrevious(words[wi - 1], w, locale))
    out.push({ text: w, key, n, auto, joins, slots })
  })
  if (hu) {
    // the last syllable of a line can be long or short
    const last = [...out].reverse().find((w) => w.slots.length)?.slots.at(-1)
    if (last) {
      last.auto = 'x'
      if (!last.set) last.value = 'x'
    }
  }
  let pos = -1
  for (const w of out) w.slots.forEach((s, i) => (s.pos = i === 0 && w.joins ? pos : ++pos))
  return out
}

/** Merged syllables (synalepha): stressed if either is, else unstressed if either is. */
const mergeValues = (a, b) => (a === 'S' || b === 'S' ? 'S' : a === 'u' || b === 'u' ? 'u' : 'x')

/** The line as one value per syllable (merged syllables combined). */
export function lineValues(words) {
  const vals = []
  for (const w of words)
    w.slots.forEach((s, i) => {
      if (i === 0 && w.joins) vals[vals.length - 1] = mergeValues(vals[vals.length - 1], s.value)
      else vals.push(s.value)
    })
  return vals
}

/**
 * Check a line against the rhythm.
 * Leeway: an iamb line may end with one extra unstressed syllable, a trochee
 * line may drop its last unstressed one.
 * Returns null for an empty line, else
 * { feet: [true|false…], fits, total, syllables, min, max, countOk, ok }.
 */
export function checkLine(vals, rhythm, feet, locale) {
  if (!vals.length) return null
  const [a, b] = PATTERN[rhythm]
  const hu = usesLength(locale)
  const fits = (v, want) => v === 'x' || v === want || (hu && want === 'u') // spondee
  const full = feet * 2
  const min = rhythm === 'trochee' ? full - 1 : full
  const max = rhythm === 'iamb' ? full + 1 : full
  const footOk = []
  for (let f = 0; f < feet; f++) {
    const x = vals[2 * f]
    const y = vals[2 * f + 1]
    if (x === undefined) footOk.push(false)
    else if (y === undefined) footOk.push(rhythm === 'trochee' && f === feet - 1 && vals.length === full - 1 && fits(x, a))
    else footOk.push(fits(x, a) && fits(y, b))
  }
  const extraOk = vals.length !== full + 1 || fits(vals[full], 'u')
  const countOk = vals.length >= min && vals.length <= max && extraOk
  const fitsCount = footOk.filter(Boolean).length
  return { feet: footOk, fits: fitsCount, total: feet, syllables: vals.length, min, max, countOk, ok: countOk && fitsCount === feet }
}

/** The writer's next mark for a tapped syllable, or null to go back to the automatic value. */
export function nextMark(slot) {
  const order = slot.auto === 'x' ? ['x', 'S', 'u'] : slot.auto === 'S' ? ['S', 'u'] : ['u', 'S']
  const next = order[(order.indexOf(slot.value) + 1) % order.length] ?? order[0]
  return next === slot.auto ? null : next
}

/** Symbol for a syllable value. */
export const symbolOf = (value, locale) => (usesLength(locale) ? { S: '–', u: '∪', x: '×' } : { S: '●', u: '○', x: '·' })[value]

/** Pattern of a rhythm as values per foot, e.g. [['u', 'S'], ['u', 'S']]. */
export const patternFeet = (rhythm, feet) => Array.from({ length: feet }, () => PATTERN[rhythm])

/** Pattern of a rhythm as symbols, e.g. "○ ● ○ ● ○ ● ○ ●". */
export const patternSymbols = (rhythm, feet, locale) =>
  Array.from({ length: feet }, () => PATTERN[rhythm].map((v) => symbolOf(v, locale)).join(' ')).join('  ')
