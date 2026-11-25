/*
 * Shared rules for bringing writing into this device from another one: the QR
 * text sync (textSync.js) and backup files (db/zines.js importAll).
 *
 * Rule: the incoming version becomes the current one. If this device had a
 * different version, it is saved first:
 *  - the 15-minute poem in the writing box → that practice's saved poems
 *  - Haiku lines in progress               → the kept haiku list
 *  - saved poem / saved work lists         → combined by id, nothing lost
 *  - everything else (and zine texts)      → an "earlier version" record,
 *    id `prev:<key>`, one per practice/zine, which the page can restore.
 * This module only plans the writes; callers put them in their transaction.
 */

export const PREV = 'prev:'
export const ZINE_KEY = 'zine:'

/** Draft id → the practice page it belongs to. */
const PRACTICE_PAGES = [
  [/^timed-poem/, 'timed', 'writing.timed.title'],
  [/^cutup-/, 'cutup', 'writing.cutup.title'],
  [/^haiku$/, 'haiku', 'writing.haiku.title'],
  [/^snowflake$/, 'snowflake', 'writing.snowflake.title'],
  [/^mosaic$/, 'mosaic', 'writing.mosaic.title'],
  [/^story-cards$/, 'story', 'writing.story.title'],
  [/^taboo$/, 'taboo', 'writing.taboo.title'],
  [/^interview$/, 'interview', 'writing.interview.title'],
  [/^situation$/, 'situation', 'writing.situation.title'],
  [/^meter$/, 'meter', 'writing.meter.title'],
  [/^rhyme$/, 'rhyme', 'writing.rhyme.title'],
  [/^script$/, 'script', 'writing.script.title'],
]

/** Where a saved earlier version can be found: { to, titleKey } or { to, title } for zines. */
export function placeOf(key, title) {
  if (key.startsWith(ZINE_KEY)) return { to: { name: 'edit', params: { id: key.slice(ZINE_KEY.length) } }, title }
  const hit = PRACTICE_PAGES.find(([re]) => re.test(key))
  return hit ? { to: { name: hit[1] }, titleKey: hit[2] } : { to: { name: 'writing' }, titleKey: 'writing.title' }
}

/** Settings and ids, not writing: a form that only has these is still empty. */
const NOT_TEXT = new Set(['id', 'key', 'step', 'sep', 'kind', 'color', 'layout', 'order', 'enabled', 'at', 'season', 'angle', 'savedAt', 'updatedAt', 'sitKey', 'first', 'topicKey', 'marks', 'counts', 'feet', 'lineCount', 'stanzas', 'confirmed', 'promptKey'])

/** Does the value hold anything the user wrote (or pulled: tarot cards)? Empty forms don't count. */
export function hasText(v, key) {
  if (key && NOT_TEXT.has(key)) return false
  if (key === 'cards') return Array.isArray(v) && v.length > 0
  if (typeof v === 'string') return !!v.trim()
  if (Array.isArray(v)) return v.some((x) => hasText(x))
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => hasText(x, k))
  return false
}

export const content = (record) => record?.text ?? record?.data ?? null
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Combine two lists of saved items by id, newest first. */
function unionById(a = [], b = [], valid = () => true) {
  const byId = new Map()
  for (const p of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) if (p?.id && valid(p) && !byId.has(p.id)) byId.set(p.id, p)
  return [...byId.values()].sort((x, y) => (y.at || 0) - (x.at || 0))
}
export const unionPoems = (a, b) => unionById(a, b, (p) => Array.isArray(p.lines))
export const unionWorks = (a, b) => unionById(a, b, (w) => w.data && typeof w.data === 'object')

/** The text of a zine that is compared and saved (no images). */
export const zineSnapshot = (zine, pages) => ({
  title: zine.title ?? '',
  description: zine.description ?? '',
  color: zine.color,
  pages: [...pages]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ id: p.id, order: p.order, title: p.title ?? '', body: p.body ?? '', layout: p.layout })),
})

/** The earlier-version record of a zine. */
export const zinePrevRecord = (zineId, snapshot, now) => ({ id: PREV + ZINE_KEY + zineId, data: { savedAt: now, ...snapshot }, updatedAt: now })

/**
 * Plan the import of writing-practice records.
 * incoming: draft records from the other device; local: Map id → record here.
 * Returns { next: Map id → record to write, drafts, same, saved: [{ key, where }] }.
 * `next` may get more records from the caller (zine earlier versions).
 */
export function mergeDrafts(incoming, local, now = Date.now()) {
  const out = { next: new Map(), drafts: 0, same: 0, saved: [] }
  const { next } = out
  const current = (id) => next.get(id) ?? local.get(id)
  const keepAside = (id, record) => next.set(PREV + id, { id: PREV + id, data: { savedAt: now, record }, updatedAt: now })
  const addToSaved = (id, lines) => {
    const list = current(id)?.data?.poems || []
    next.set(id, { id, data: { poems: unionPoems([{ id: newId(), lines, at: now }], list) }, updatedAt: now })
  }

  for (const d of Array.isArray(incoming) ? incoming : []) {
    if (typeof d?.id !== 'string' || d.id.startsWith(PREV)) continue
    const mine = current(d.id)
    if (!mine) {
      next.set(d.id, d)
      out.drafts++
      continue
    }
    if (same(content(mine), content(d))) {
      out.same++
      continue
    }
    out.drafts++

    if (d.id.endsWith('-saved')) {
      const data = {}
      if (d.data?.poems || mine.data?.poems) data.poems = unionPoems(d.data?.poems, mine.data?.poems)
      if (d.data?.works || mine.data?.works) data.works = unionWorks(d.data?.works, mine.data?.works)
      next.set(d.id, { id: d.id, data, updatedAt: now })
    } else if (d.id === 'haiku') {
      const kept = unionPoems(d.data?.kept, mine.data?.kept)
      const myLines = Array.isArray(mine.data?.lines) ? mine.data.lines : []
      if (hasText(myLines) && !same(myLines, d.data?.lines)) {
        kept.unshift({ id: newId(), lines: myLines.map((l) => String(l).trim()), at: now })
        out.saved.push({ key: d.id, where: 'kept' })
      }
      next.set(d.id, { ...d, data: { ...d.data, kept }, updatedAt: now })
    } else if (d.id === 'timed-poem') {
      if (typeof mine.text === 'string' && hasText(mine.text)) {
        addToSaved('timed-poem-saved', mine.text.trim().split('\n').map((l) => l.trimEnd()))
        out.saved.push({ key: d.id, where: 'poems' })
      }
      next.set(d.id, d)
    } else {
      if (hasText(content(mine))) {
        keepAside(d.id, mine)
        if (!out.saved.some((s) => placeOf(s.key).to.name === placeOf(d.id).to.name && s.where === 'earlier')) {
          out.saved.push({ key: d.id, where: 'earlier' })
        }
      }
      next.set(d.id, d)
    }
  }
  return out
}
