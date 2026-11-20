import { lineWords } from './syllables'

/*
 * Rhyme checking for the Rhyme schemes practice (AABB, ABAB and ABBA).
 *
 * The rhyme of a line is the end of its last word, from the stressed vowel on
 * (night → -ight, Liebe → -iebe, canción → -ón). Stress is guessed per
 * language: Polish second to last syllable; Spanish the written accent, else
 * the ending rule; German the syllable before a weak -e/-en/-er ending;
 * English, French and Hungarian the last vowel. Spelling is evened out a
 * little before comparing (German ie/i, h after a vowel, final d → t; French
 * eau/au/o, silent endings; Polish ó/u, rz/ż, final ę/e; accents in Spanish and French).
 *
 * It reads spelling, not sound, so the page calls it a guess and lets the
 * writer confirm a pair ("They rhyme"). Confirmations are kept as the two
 * words (confirmKey), so they stop counting when a word changes.
 */

export const SCHEMES = ['aabb', 'abab', 'abba']
export const MIN_STANZAS = 1
export const MAX_STANZAS = 3
export const LINES_PER_STANZA = 4

const LINE_LETTERS = { aabb: [0, 0, 1, 1], abab: [0, 1, 0, 1], abba: [0, 1, 1, 0] }
const STANZA_PAIRS = { aabb: [[0, 1], [2, 3]], abab: [[0, 2], [1, 3]], abba: [[0, 3], [1, 2]] }

/** Rhyme letter of line i (0-based): A A B B, then C C D D in the second stanza… */
export const letterOf = (scheme, i) => String.fromCharCode(65 + Math.floor(i / LINES_PER_STANZA) * 2 + LINE_LETTERS[scheme][i % LINES_PER_STANZA])

/** Pairs of line indexes that must rhyme: [[a, b], …] for every stanza. */
export function pairsOf(scheme, lineCount) {
  const out = []
  for (let s = 0; s * LINES_PER_STANZA < lineCount; s++) {
    for (const [a, b] of STANZA_PAIRS[scheme]) out.push([s * LINES_PER_STANZA + a, s * LINES_PER_STANZA + b])
  }
  return out
}

/* ---------- finding the rhyme of a word ---------- */

const VOWELS = {
  en: /[aeiouy]+/g,
  de: /[aeiouyäöü]+/g,
  hu: /[aáeéiíoóöőuúüű]+/g,
  pl: /[aąeęioóuy]+/g,
  es: /[aeiouáéíóúü]+/g,
  fr: /[aeiouyàâäéèêëîïôöûùüœæ]+/g,
}

/** Vowel groups of a (masked) word: [{ start, text }]. */
const groupsOf = (w, locale) => [...w.matchAll(VOWELS[locale] || VOWELS.en)].map((m) => ({ start: m.index, text: m[0] }))

/**
 * The same word with letters that don't sound as vowels replaced by '#', so
 * vowel groups land where they are heard. Keeps the length, so indexes match the word.
 */
function mask(w, locale) {
  const hide = (s, re) => s.replace(re, (m) => '#'.repeat(m.length))
  if (locale === 'en') {
    let m = w.replace(/^y/, '#').replace(/y(?=[aeiou])/g, '#')
    // silent final e (love, time), not in a one-vowel word (the, be)
    if (/[^aeiouy]e$/.test(m) && groupsOf(m.slice(0, -1), 'en').length) m = m.slice(0, -1) + '#'
    return m
  }
  if (locale === 'es') return w.replace(/(?<=[qg])u(?=[eéií])/g, '#').replace(/y$/, 'i')
  if (locale === 'fr') {
    // silent endings: -s/-x plural, mute -e, then a silent consonant (nuit, temps)
    let m = hide(w, /[sx]$/)
    if (/e#?$/.test(m) && groupsOf(m.replace(/e#?$/, ''), 'fr').length) m = hide(m, /e#?$/)
    return m.replace(/[tdpzsx](?=#*$)/, '#')
  }
  return w
}

/** Index where the rhyme starts (the stressed vowel), or -1 when the word has no vowel. */
function rhymeStart(w, locale) {
  const m = mask(w, locale)
  const groups = groupsOf(m, locale)
  if (!groups.length) return -1
  const last = groups[groups.length - 1]
  const penult = groups[groups.length - 2]
  if (locale === 'pl') return (penult || last).start
  if (locale === 'de') return penult && last.text === 'e' ? penult.start : last.start
  if (locale === 'es') {
    const accent = m.search(/[áéíóú]/)
    if (accent >= 0) return accent
    const g = penult && /[aeiouns]$/.test(m) ? penult : last
    // in a diphthong the strong vowel carries the stress (fuego → -ego, quieto → -eto)
    const strong = g.text.search(/[aeo]/)
    return g.start + (strong >= 0 ? strong : g.text.length > 1 ? 1 : 0)
  }
  return last.start
}

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Spelling evened out so that words that sound alike compare equal. */
function normalize(s, locale) {
  if (locale === 'de') {
    return s.replace(/ä/g, 'e').replace(/ai/g, 'ei').replace(/äu/g, 'eu').replace(/ß/g, 'ss').replace(/ie/g, 'i')
      .replace(/(?<=[aeiouöü])h/g, '').replace(/dt$|d$/, 't').replace(/b$/, 'p').replace(/g$/, 'k').replace(/th/g, 't')
  }
  if (locale === 'fr') {
    return stripAccents(s.replace(/œ/g, 'oe')).replace(/eau|au/g, 'o').replace(/ai|ei/g, 'e').replace(/er$|ez$/, 'e')
  }
  if (locale === 'es') return stripAccents(s).replace(/h/g, '').replace(/v/g, 'b').replace(/ll/g, 'y')
  if (locale === 'pl') return s.replace(/ó/g, 'u').replace(/rz/g, 'ż').replace(/ch/g, 'h').replace(/ę$/, 'e')
  return s
}

/** The word a line ends with, as written but without apostrophes ('' when there is none). */
export function lastWord(line, locale) {
  const words = lineWords(line || '', locale)
  const w = words[words.length - 1] || ''
  // French elision (l’eau): the rhyme is in the word after the apostrophe
  return locale === 'fr' ? w.split(/['’]/).pop() : w.replace(/['’]/g, '')
}

/**
 * The rhyme of a line: { word, start, tail, vowels, coda } or null.
 * `word.slice(start)` is the part shown as the rhyme; the rest is for comparing.
 */
export function rhymeOf(line, locale) {
  const word = lastWord(line, locale)
  if (!word) return null
  const lower = word.toLowerCase()
  const start = rhymeStart(lower, locale)
  if (start < 0) return null
  const m = mask(lower, locale)
  const heard = (from, to) => [...lower.slice(from, to)].filter((_, i) => m[from + i] !== '#').join('')
  const groups = groupsOf(m, locale)
  const lastGroup = groups[groups.length - 1]
  return {
    word,
    start,
    whole: normalize(heard(0), locale),
    tail: normalize(heard(start), locale),
    // the vowels of the last two syllables (assonance), and what follows the last vowel
    vowels: groups.slice(-2).map((g) => normalize(g.text, locale)).join('-'),
    lastVowel: normalize(lastGroup.text.slice(-1), locale),
    coda: normalize(heard(lastGroup.start + lastGroup.text.length), locale),
  }
}

/**
 * How two lines rhyme:
 *  'empty' a line has no word yet · 'same' the same word twice
 *  'rhyme' the endings match · 'near' they share the vowels, or the last vowel
 *  and what follows it (assonance, half rhyme) · 'no' no rhyme
 */
export function compareRhymes(a, b) {
  if (!a || !b) return 'empty'
  if (a.whole === b.whole) return 'same'
  if (a.tail === b.tail) return 'rhyme'
  if (a.vowels === b.vowels || (a.lastVowel === b.lastVowel && a.coda === b.coda)) return 'near'
  return 'no'
}

/** Key of a writer's "they rhyme" for two words, in either order. */
export const confirmKey = (a, b) => [a, b].map((w) => w.toLowerCase()).sort().join('|')

/**
 * Every rhyme pair of a stanza list: [{ a, b, letter, ra, rb, status, confirmed, fits }].
 * `confirmed` is the writer's list of confirmKeys for this scheme.
 */
export function checkPairs(scheme, lines, locale, confirmed = []) {
  return pairsOf(scheme, lines.length).map(([a, b]) => {
    const ra = rhymeOf(lines[a], locale)
    const rb = rhymeOf(lines[b], locale)
    const status = compareRhymes(ra, rb)
    const isConfirmed = !!ra && !!rb && status !== 'rhyme' && status !== 'same' && confirmed.includes(confirmKey(ra.word, rb.word))
    return { a, b, letter: letterOf(scheme, a), ra, rb, status, confirmed: isConfirmed, fits: status === 'rhyme' || isConfirmed }
  })
}
