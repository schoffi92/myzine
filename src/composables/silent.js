import { findTelling } from '../writing/telling'
import { newBlock } from './script'

/*
 * "What the camera sees": a silent scene of action lines only. The writer
 * learns to write what can be seen and heard, not what a character thinks
 * or feels. A work is { title, promptKey, ownPrompt, heading, lines: [{ id, text }], ending }.
 * Situations are stored by key (texts in i18n: writing.silent.prompts.<key>).
 */

export const PROMPTS = ['call', 'vase', 'umbrella', 'letter', 'exam', 'stranger', 'birthday', 'keys', 'train', 'photo']
export const MIN_LINES = 5
export const MAX_LINES = 12
/** An action line longer than this is more than one picture. */
export const LONG_WORDS = 35

let seq = 0
export const newLine = (text = '') => ({ id: `l${Date.now().toString(36)}${(seq++).toString(36)}`, text })
export const blank = () => ({ title: '', promptKey: null, ownPrompt: '', heading: '', lines: Array.from({ length: MIN_LINES }, () => newLine()), ending: '' })

const str = (v) => (typeof v === 'string' ? v : '')

/** A work from storage (old or foreign data is evened out). */
export function clean(s) {
  const lines = (Array.isArray(s?.lines) ? s.lines : []).filter((l) => l && typeof l === 'object').slice(0, MAX_LINES).map((l) => {
    const nl = newLine(str(l.text))
    if (typeof l.id === 'string' && l.id) nl.id = l.id
    return nl
  })
  while (lines.length < MIN_LINES) lines.push(newLine())
  return {
    title: str(s?.title),
    promptKey: PROMPTS.includes(s?.promptKey) ? s.promptKey : null,
    ownPrompt: str(s?.ownPrompt),
    heading: str(s?.heading),
    lines,
    ending: str(s?.ending),
  }
}

/** The situation (built-in by key, or the writer's own). */
export const promptText = (s, t) => (PROMPTS.includes(s?.promptKey) ? t(`writing.silent.prompts.${s.promptKey}`) : s?.ownPrompt?.trim() || '')

export const hasSilent = (s) => !!(s?.heading?.trim() || s?.ending?.trim() || s?.lines?.some((l) => l?.text?.trim()))

const DIALOGUE = /["“”„«»]|^\s*[-–—]\s/u
const words = (text) => (text.match(/[\p{L}\p{N}’']+/gu) || []).length

/**
 * What to point out in one action line: [{ cat, word? }], cat one of
 * inner | emotion | camera (with the word), dialogue, long.
 */
export function lineIssues(text, locale) {
  if (!text?.trim()) return []
  const out = findTelling(text, locale).map(({ cat, word }) => ({ cat, word }))
  if (DIALOGUE.test(text)) out.push({ cat: 'dialogue' })
  if (words(text) > LONG_WORDS) out.push({ cat: 'long' })
  return out
}

/** The goals of the scene, ticked as it's written. Texts: writing.silent.goals.<key>. */
export function goals(s, locale, t) {
  const filled = s.lines.filter((l) => l.text.trim())
  const all = [...filled.map((l) => l.text), s.ending].filter((x) => x.trim())
  const issues = all.flatMap((x) => lineIssues(x, locale))
  return [
    { key: 'premise', done: !!promptText(s, t) },
    { key: 'heading', done: !!s.heading.trim() },
    { key: 'lines', done: filled.length >= MIN_LINES },
    { key: 'noTelling', done: filled.length > 0 && !issues.some((i) => ['inner', 'emotion', 'camera'].includes(i.cat)) },
    { key: 'noDialogue', done: filled.length > 0 && !issues.some((i) => i.cat === 'dialogue') },
    { key: 'ending', done: !!s.ending.trim() },
  ]
}

/** The scene as screenplay blocks (for the preview, copy and export). */
export function toBlocks(s, fadeOut) {
  const out = []
  if (s.heading?.trim()) out.push(newBlock('scene', s.heading.trim()))
  for (const l of s.lines || []) if (l.text.trim()) out.push(newBlock('action', l.text.trim()))
  if (s.ending?.trim()) {
    out.push(newBlock('action', s.ending.trim()))
    if (fadeOut) out.push(newBlock('transition', fadeOut))
  }
  return out.length ? out : [newBlock('scene', '')]
}
