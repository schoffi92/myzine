/*
 * Barks: the short lines a game character says by itself when something
 * happens (spots the player, gets hurt, wins). Many variants of one moment,
 * a length limit, one voice. The writer fills a trigger table, play-tests it
 * in a speech-bubble simulator and downloads it as a CSV or JSON line table.
 *
 * A work is { name, promptKey, ownPrompt, voice, limit, barks: { <trigger>: [text…] } }.
 * Roles are stored by key (texts in i18n: writing.barks.prompts.<key>).
 */

export const TRIGGERS = ['idle', 'notice', 'search', 'lost', 'hurt', 'lowHealth', 'victory', 'greet']
export const PROMPTS = ['guard', 'shopkeeper', 'companion', 'rival', 'robot', 'ghost', 'pirate', 'wizard']
export const LIMITS = [40, 60, 80]
export const START_VARIANTS = 3
export const MAX_VARIANTS = 6
/** Goals: this many triggers with this many lines each. */
export const GOAL_TRIGGERS = 5
export const GOAL_VARIANTS = 3

const str = (v) => (typeof v === 'string' ? v : '')
const emptyBarks = () => Object.fromEntries(TRIGGERS.map((k) => [k, Array(START_VARIANTS).fill('')]))
export const blank = () => ({ name: '', promptKey: null, ownPrompt: '', voice: '', limit: 60, barks: emptyBarks() })

/** A work from storage (old or foreign data is evened out). */
export function clean(s) {
  const barks = Object.fromEntries(
    TRIGGERS.map((k) => {
      const list = (Array.isArray(s?.barks?.[k]) ? s.barks[k] : []).map(str).slice(0, MAX_VARIANTS)
      while (list.length < START_VARIANTS) list.push('')
      return [k, list]
    }),
  )
  return {
    name: str(s?.name),
    promptKey: PROMPTS.includes(s?.promptKey) ? s.promptKey : null,
    ownPrompt: str(s?.ownPrompt),
    voice: str(s?.voice),
    limit: LIMITS.includes(s?.limit) ? s.limit : 60,
    barks,
  }
}

/** The role (built-in by key, or the writer's own). */
export const promptText = (s, t) => (PROMPTS.includes(s?.promptKey) ? t(`writing.barks.prompts.${s.promptKey}`) : s?.ownPrompt?.trim() || '')

export const hasBarks = (s) => !!(s?.name?.trim() || s?.voice?.trim() || TRIGGERS.some((k) => s?.barks?.[k]?.some((x) => x?.trim())))

/** Lines with text, per trigger. */
export const filled = (s, k) => (s.barks[k] || []).map((x, i) => ({ text: x.trim(), i })).filter((x) => x.text)

/** For comparing lines: lower case, no punctuation, single spaces. */
export const norm = (x) => (x || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const firstWord = (x) => norm(x).split(' ')[0] || ''

/**
 * Problems of every line: { '<trigger>:<i>': [{ key, params }] }, key one of
 * long (over the limit) · dup (the same line elsewhere) · opening (starts with
 * the same word as an earlier line of the trigger) · generic (a stock line).
 */
export function checkAll(s, generic = []) {
  const stock = new Set(generic.map(norm))
  const seen = new Map() // normalised line → first place
  const out = {}
  for (const k of TRIGGERS) {
    const openings = new Map()
    for (const { text, i } of filled(s, k)) {
      const id = `${k}:${i}`
      const list = []
      if (text.length > s.limit) list.push({ key: 'long', params: { n: text.length, limit: s.limit } })
      const n = norm(text)
      if (seen.has(n)) list.push({ key: 'dup' })
      else seen.set(n, id)
      const w = firstWord(text)
      if (w && openings.has(w)) list.push({ key: 'opening', params: { word: text.split(/\s+/)[0].replace(/[^\p{L}\p{N}’']/gu, '') } })
      else if (w) openings.set(w, i)
      if (stock.has(n)) list.push({ key: 'generic' })
      if (list.length) out[id] = list
    }
  }
  return out
}

/** The goals of the bark set. Texts: writing.barks.goals.<key>. */
export function goals(s, t, generic) {
  const issues = Object.values(checkAll(s, generic)).flat()
  const has = (key) => issues.some((x) => x.key === key)
  const covered = TRIGGERS.filter((k) => filled(s, k).length >= GOAL_VARIANTS).length
  const any = TRIGGERS.some((k) => filled(s, k).length)
  return [
    { key: 'character', done: !!(s.name.trim() && promptText(s, t) && s.voice.trim()) },
    { key: 'coverage', done: covered >= GOAL_TRIGGERS },
    { key: 'length', done: any && !has('long') },
    { key: 'unique', done: any && !has('dup') },
    { key: 'varied', done: any && !has('opening') },
    { key: 'fresh', done: any && !has('generic') },
  ]
}

/** A random line of a trigger, not the one heard last time (if there is another). */
export function pick(s, k, last) {
  const list = filled(s, k).map((x) => x.text)
  if (!list.length) return null
  const pool = list.length > 1 ? list.filter((x) => x !== last) : list
  return pool[Math.floor(Math.random() * pool.length)]
}

/* ---------- export: a line table as game studios use it ---------- */

const slug = (x) => norm(x).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'character'
const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/** Rows: [{ id, trigger, character, text, max_length }]. */
export function rows(s) {
  const who = s.name.trim() || 'Character'
  return TRIGGERS.flatMap((k) =>
    filled(s, k).map((x, n) => ({ id: `${slug(who)}_${snake(k)}_${String(n + 1).padStart(2, '0')}`, trigger: snake(k), character: who, text: x.text, max_length: s.limit })),
  )
}

const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
export const toCsv = (s) => ['id,trigger,character,text,max_length', ...rows(s).map((r) => [r.id, r.trigger, r.character, r.text, r.max_length].map(csvCell).join(','))].join('\r\n') + '\r\n'
export const toJson = (s) => `${JSON.stringify(rows(s), null, 2)}\n`
export const fileBase = (s) => `${slug(s.name || 'barks')}_barks`

/** The bark set as text: one block per trigger. */
export function plainText(s, t) {
  return TRIGGERS.map((k) => ({ k, list: filled(s, k) }))
    .filter((x) => x.list.length)
    .map((x) => [`${t(`writing.barks.triggers.${x.k}.name`)}:`, ...x.list.map((l) => `- ${l.text}`)].join('\n'))
    .join('\n\n')
}
