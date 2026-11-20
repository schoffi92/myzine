/*
 * Approximate syllable counting for the Haiku practice, per language.
 * Hungarian is exact (one vowel = one syllable); the others use common
 * spelling rules and can be off by one, so the UI calls it an estimate.
 */

const WORD_RE = /[\p{L}\p{M}'’]+/gu

/* ---- English: classic heuristic ---- */
function en(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length)
}

/* ---- German: vowel groups (ei, au, eu, äu, ie, aa… count once) ---- */
function de(word) {
  const w = word.toLowerCase()
  return Math.max(1, (w.match(/[aeiouyäöü]+/g) || []).length)
}

/* ---- Hungarian: every vowel is a syllable ---- */
function hu(word) {
  return (word.toLowerCase().match(/[aáeéiíoóöőuúüű]/g) || []).length
}

/* ---- Polish: every vowel, except i before another vowel (nie, wiatr) ---- */
function pl(word) {
  const w = word.toLowerCase().replace(/i(?=[aąeęoóuy])/g, '')
  return (w.match(/[aąeęioóuy]/g) || []).length
}

/* ---- Spanish: diphthongs (weak i/u + vowel) count once; í/ú break them ---- */
function es(word) {
  const w = word.toLowerCase().replace(/y$/, 'i').replace(/(?<=[qg])u(?=[eéií])/g, '')
  let n = 0
  for (const group of w.match(/[aeiouáéíóúü]+/g) || []) {
    const strong = (group.match(/[aeoáéóíú]/g) || []).length
    n += Math.max(1, strong)
  }
  return Math.max(1, n)
}

/* ---- French: vowel groups, final silent e / es / ent not counted ---- */
function fr(word) {
  let w = word.toLowerCase()
  const groups = (x) => (x.match(/[aeiouyàâäéèêëîïôöûùüœæ]+/g) || []).length
  if (groups(w) > 1) w = w.replace(/(?:e|es|ent)$/, '')
  return Math.max(1, groups(w))
}

const COUNTERS = { en, de, hu, pl, es, fr }
const startsWithVowel = (w) => /^h?[aeiouáéíóú]/i.test(w)
const endsWithVowel = (w) => /[aeiouáéíóú]$/i.test(w)

/** The words of a line as the counters see them (French elision like l’eau stays one word). */
export const lineWords = (line, locale) => (line.match(WORD_RE) || []).map((w) => w.replace(/^[a-z]{1,2}['’]/i, (m) => (locale === 'fr' ? m : '')))

/** Estimated syllables of one word (from lineWords) in `locale`. */
export const wordSyllables = (word, locale) => (COUNTERS[locale] || en)(word.replace(/['’]/g, ''))

/** Spanish synalepha: a vowel at the end of a word joins the next word's first vowel. */
export const joinsPrevious = (prev, word, locale) => locale === 'es' && !!prev && endsWithVowel(prev) && startsWithVowel(word)

/** Estimated syllables of one line of text in `locale`. */
export function countSyllables(line, locale) {
  const words = lineWords(line, locale)
  let n = 0
  words.forEach((w, i) => {
    n += wordSyllables(w, locale)
    if (joinsPrevious(words[i - 1], w, locale)) n -= 1
  })
  return Math.max(0, n)
}

export const HAIKU_PATTERN = [5, 7, 5]
