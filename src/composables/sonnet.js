import { analyzeLine, lineValues, checkLine } from '../writing/meter'
import { checkPairs, letterOf } from '../writing/rhyme'

/*
 * Shakespearean sonnet: 14 lines of iambic pentameter, three quatrains and a
 * couplet rhymed ABAB CDCD EFEF GG, with a turn (volta). The writer plans the
 * argument of each part, then writes it line by line with the rhythm row of
 * the Iamb and trochee practice and the rhyme check of Rhyme schemes.
 *
 * A work is { title, promptKey, ownPrompt, plan: { q1, q2, q3, couplet },
 *             lines: [{ text, marks, counts }] × 14, confirmed: [rhyme confirmKeys] }.
 */

export const LINES = 14
export const RHYTHM = 'iamb'
export const FEET = 5
export const SCHEME = 'sonnet'
/** The four parts: first line and number of lines. Texts: writing.sonnet.parts.<key>. */
export const PARTS = [
  { key: 'q1', from: 0, n: 4 },
  { key: 'q2', from: 4, n: 4 },
  { key: 'q3', from: 8, n: 4 },
  { key: 'couplet', from: 12, n: 2 },
]
export const PROMPTS = ['time', 'love', 'city', 'sea', 'phone', 'mirror', 'winter', 'friend', 'home', 'sleep']

export const blankLine = () => ({ text: '', marks: {}, counts: {} })
export const blank = () => ({ title: '', promptKey: null, ownPrompt: '', plan: { q1: '', q2: '', q3: '', couplet: '' }, lines: Array.from({ length: LINES }, blankLine), confirmed: [] })

const str = (v) => (typeof v === 'string' ? v : '')
const plainObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {})

/** A work from storage (old or foreign data is evened out). */
export function clean(s) {
  const lines = Array.from({ length: LINES }, (_, i) => {
    const l = Array.isArray(s?.lines) ? s.lines[i] : null
    return { text: str(l?.text), marks: plainObject(l?.marks), counts: plainObject(l?.counts) }
  })
  return {
    title: str(s?.title),
    promptKey: PROMPTS.includes(s?.promptKey) ? s.promptKey : null,
    ownPrompt: str(s?.ownPrompt),
    plan: Object.fromEntries(PARTS.map((p) => [p.key, str(s?.plan?.[p.key])])),
    lines,
    confirmed: Array.isArray(s?.confirmed) ? s.confirmed.filter((k) => typeof k === 'string') : [],
  }
}

/** The subject (built-in by key, or the writer's own). */
export const promptText = (s, t) => (PROMPTS.includes(s?.promptKey) ? t(`writing.sonnet.prompts.${s.promptKey}`) : s?.ownPrompt?.trim() || '')

export const hasSonnet = (s) => Array.isArray(s?.lines) && s.lines.some((l) => l?.text?.trim())

export const letter = (i) => letterOf(SCHEME, i)

/** The meter check of one line (null when empty). */
export const lineCheck = (l, locale) => checkLine(lineValues(analyzeLine(l.text, locale, l.marks, l.counts)), RHYTHM, FEET, locale)

/** Counts for the goals: lines written, lines in meter, rhymes that fit. */
export function facts(s, locale) {
  const written = s.lines.filter((l) => l.text.trim()).length
  const inMeter = s.lines.filter((l) => l.text.trim() && lineCheck(l, locale)?.ok).length
  const pairs = checkPairs(SCHEME, s.lines.map((l) => l.text), locale, s.confirmed)
  return { written, inMeter, rhymes: pairs.filter((p) => p.fits).length, pairs: pairs.length, planned: PARTS.filter((p) => s.plan[p.key].trim()).length }
}

/** The goals of the sonnet. Texts: writing.sonnet.goals.<key>. */
export function goals(s, locale, t) {
  const f = facts(s, locale)
  return [
    { key: 'topic', done: !!promptText(s, t) },
    { key: 'plan', done: f.planned === PARTS.length },
    { key: 'lines', done: f.written === LINES },
    { key: 'meter', done: f.written === LINES && f.inMeter >= LINES - 2 },
    { key: 'rhyme', done: f.rhymes === f.pairs },
  ]
}

/** The sonnet as text: the quatrains, then the couplet set in. */
export function plainText(s) {
  const part = (p) => s.lines.slice(p.from, p.from + p.n).map((l) => l.text.trim()).filter(Boolean)
  const [a, b, c, d] = PARTS.map(part)
  return [[...a, ...b, ...c].join('\n'), d.map((l) => `  ${l}`).join('\n')].filter(Boolean).join('\n')
}

/** Sonnet 18, shown in the lesson in Shakespeare's English (public domain, 1609). */
export const SONNET_18 = [
  'Shall I compare thee to a summer’s day?',
  'Thou art more lovely and more temperate:',
  'Rough winds do shake the darling buds of May,',
  'And summer’s lease hath all too short a date;',
  'Sometime too hot the eye of heaven shines,',
  'And often is his gold complexion dimm’d;',
  'And every fair from fair sometime declines,',
  'By chance or nature’s changing course untrimm’d;',
  'But thy eternal summer shall not fade,',
  'Nor lose possession of that fair thou ow’st;',
  'Nor shall Death brag thou wander’st in his shade,',
  'When in eternal lines to time thou grow’st:',
  'So long as men can breathe or eyes can see,',
  'So long lives this, and this gives life to thee.',
]
