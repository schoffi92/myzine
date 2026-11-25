/*
 * Sestina: six stanzas of six lines and a three-line envoi (39 lines). No
 * rhyme: the same six end-words return in every stanza in a rotating order
 * (retrogradatio cruciata: 6 1 5 2 4 3 of the stanza before), and the envoi
 * uses all six, three of them at the ends of its lines.
 *
 * A work is { title, words: [6], lines: [36], envoi: [3], accepted: ['word|ending'], step }.
 * `accepted` holds endings the writer counts as a form of an end-word
 * (lit for light, write for right), keyed by the word and the ending.
 */

export const N = 6
export const STANZAS = 6
export const ENVOI = 3
/** Steps: 0 the words, 1–6 the stanzas, 7 the envoi, 8 read it back. */
export const STEPS = 9
export const ENVOI_STEP = 7
export const READ_STEP = 8

/** Which end-word (index into words) each line of each stanza takes. */
export const ORDERS = (() => {
  const out = [[0, 1, 2, 3, 4, 5]]
  while (out.length < STANZAS) {
    const p = out.at(-1)
    out.push([p[5], p[0], p[4], p[1], p[3], p[2]])
  }
  return out
})()
/** The traditional envoi: the words in the middle and at the end of each line (B…E, D…C, F…A). */
export const ENVOI_PAIRS = [[1, 4], [3, 2], [5, 0]]

export const blank = () => ({ title: '', words: Array(N).fill(''), lines: Array(N * STANZAS).fill(''), envoi: Array(ENVOI).fill(''), accepted: [], step: 0 })

const strs = (v, n) => Array.from({ length: n }, (_, i) => (Array.isArray(v) && typeof v[i] === 'string' ? v[i] : ''))

/** A work from storage (old or foreign data is evened out). */
export const clean = (s) => ({
  title: typeof s?.title === 'string' ? s.title : '',
  words: strs(s?.words, N),
  lines: strs(s?.lines, N * STANZAS),
  envoi: strs(s?.envoi, ENVOI),
  accepted: Array.isArray(s?.accepted) ? s.accepted.filter((k) => typeof k === 'string') : [],
  step: Number.isInteger(s?.step) && s.step >= 0 && s.step < STEPS ? s.step : 0,
})

export const hasSestina = (s) => !!(s?.words?.some((w) => w?.trim()) || s?.lines?.some((l) => l?.trim()) || s?.envoi?.some((l) => l?.trim()))

/* ---------- words ---------- */

export const norm = (w) => (w || '').toLocaleLowerCase().normalize('NFC').replace(/[’']/g, '')
const tokens = (text) => (text || '').match(/[\p{L}\p{N}’'-]+/gu)?.map(norm).filter(Boolean) || []
export const lastWord = (text) => tokens(text).at(-1) || ''
export const acceptKey = (word, ending) => `${norm(word)}|${norm(ending)}`

/** Do the chosen words work? 'empty' | 'many' (more than one word) | 'twice' | 'ok', per word. */
export function wordStatus(words) {
  const seen = words.map((w) => norm(w.trim()))
  return words.map((w, i) => {
    const t = w.trim()
    if (!t) return 'empty'
    if (/\s/.test(t)) return 'many'
    if (seen.indexOf(seen[i]) !== i) return 'twice'
    return 'ok'
  })
}
export const wordsReady = (words) => wordStatus(words).every((x) => x === 'ok')

/** Two forms of one word, by spelling: light/lights, fall/falling, Licht/Lichter. */
function sameStem(a, b) {
  if (!a || !b) return false
  const n = Math.min(a.length, b.length)
  if (n < 3) return false
  let k = 0
  while (k < n && a[k] === b[k]) k++
  // short words: one must start with the other (fall/falling, not leaf/left); longer ones may differ in the last two letters
  return k >= (n <= 5 ? n : n - 2) && Math.abs(a.length - b.length) <= 4
}

/**
 * How a line ends against the end-word it must take:
 * 'empty' · 'ok' the word itself · 'form' a form of it (by spelling) ·
 * 'accepted' the writer counts it · 'no'.
 */
export function endStatus(text, word, accepted = []) {
  const end = lastWord(text)
  if (!end) return 'empty'
  const w = norm(word.trim())
  if (end === w) return 'ok'
  if (sameStem(end, w)) return 'form'
  if (accepted.includes(acceptKey(w, end))) return 'accepted'
  return 'no'
}
export const fits = (status) => status === 'ok' || status === 'form' || status === 'accepted'

/** Is the word (or a form of it, or an accepted one) anywhere in the text? */
export function usesWord(text, word, accepted = []) {
  const w = norm(word.trim())
  return !!w && tokens(text).some((x) => x === w || sameStem(x, w) || accepted.includes(acceptKey(w, x)))
}

/* ---------- progress ---------- */

/** The end-word index for line i of stanza s (both 0-based). */
export const wordAt = (s, i) => ORDERS[s][i]

/** Lines of a stanza with their status: [{ index, word, status }]. */
export function stanzaChecks(st, s) {
  return ORDERS[s].map((w, i) => ({ index: s * N + i, word: w, status: endStatus(st.lines[s * N + i], st.words[w], st.accepted) }))
}
export const stanzaDone = (st, s) => stanzaChecks(st, s).every((c) => fits(c.status))

/** The envoi: which words it uses, and whether each line ends on one of the words. */
export function envoiCheck(st) {
  const used = st.words.map((w) => st.envoi.some((l) => usesWord(l, w, st.accepted)))
  const ends = st.envoi.map((l) => (l.trim() ? st.words.some((w) => fits(endStatus(l, w, st.accepted))) : false))
  return { used, ends, done: used.every(Boolean) && ends.every(Boolean) }
}

/** Done ticks of the steps. */
export function stepsDone(st) {
  const ready = wordsReady(st.words)
  return [ready, ...ORDERS.map((_, s) => ready && stanzaDone(st, s)), ready && envoiCheck(st).done, false]
}

/** The poem as text: six stanzas and the envoi. */
export function plainText(st) {
  const stanzas = ORDERS.map((_, s) => st.lines.slice(s * N, s * N + N).map((l) => l.trim()).filter(Boolean).join('\n')).filter(Boolean)
  const envoi = st.envoi.map((l) => l.trim()).filter(Boolean).join('\n')
  return [...stanzas, envoi].filter(Boolean).join('\n\n')
}
