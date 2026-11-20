import { transaction, get, getAll } from '../db/idb'
import { exportSelection, getZine, listPages } from '../db/zines'

/*
 * Text-only sync (used by the QR codes on the Share page).
 *
 * Rule: the scanned version always becomes the current one. If this device
 * had a different version, it is saved first:
 *  - the 15-minute poem in the writing box → that practice's saved poems
 *  - Haiku lines in progress               → the kept haiku list
 *  - saved poem / saved work lists         → combined, nothing to save
 *  - everything else (and zine texts)      → an "earlier version" record,
 *    id `prev:<key>`, one per practice/zine, which the page can restore.
 * Images are never sent; local images of a zine are kept.
 */

export const PREV = 'prev:'
const ZINE_KEY = 'zine:'

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
]

/** Where a saved earlier version can be found: { to, titleKey } or { to, title } for zines. */
export function placeOf(key, title) {
  if (key.startsWith(ZINE_KEY)) return { to: { name: 'edit', params: { id: key.slice(ZINE_KEY.length) } }, title }
  const hit = PRACTICE_PAGES.find(([re]) => re.test(key))
  return hit ? { to: { name: hit[1] }, titleKey: hit[2] } : { to: { name: 'writing' }, titleKey: 'writing.title' }
}

/* ---------- helpers ---------- */

/** Settings and ids, not writing: a form that only has these is still empty. */
const NOT_TEXT = new Set(['id', 'key', 'step', 'sep', 'kind', 'color', 'layout', 'order', 'enabled', 'at', 'season', 'angle', 'savedAt', 'updatedAt'])

/** Does the value hold anything the user wrote (or pulled: tarot cards)? Empty forms don't count. */
function hasText(v, key) {
  if (key && NOT_TEXT.has(key)) return false
  if (key === 'cards') return Array.isArray(v) && v.length > 0
  if (typeof v === 'string') return !!v.trim()
  if (Array.isArray(v)) return v.some((x) => hasText(x))
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => hasText(x, k))
  return false
}

const content = (record) => record?.text ?? record?.data ?? null
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Combine two lists of saved items by id, newest first. */
function unionById(a = [], b = [], valid = () => true) {
  const byId = new Map()
  for (const p of [...(a || []), ...(b || [])]) if (p?.id && valid(p) && !byId.has(p.id)) byId.set(p.id, p)
  return [...byId.values()].sort((x, y) => (y.at || 0) - (x.at || 0))
}
const unionPoems = (a, b) => unionById(a, b, (p) => Array.isArray(p.lines))
const unionWorks = (a, b) => unionById(a, b, (w) => w.data && typeof w.data === 'object')

/** The text of a zine that is compared and saved (no images). */
const zineSnapshot = (zine, pages) => ({
  title: zine.title ?? '',
  description: zine.description ?? '',
  color: zine.color,
  pages: [...pages]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ id: p.id, order: p.order, title: p.title ?? '', body: p.body ?? '', layout: p.layout })),
})

/* ---------- sending ---------- */

/** What the QR codes carry: zines and pages without images, writing practices without earlier versions. */
export async function buildTextPayload({ zineIds = [], includeDrafts = true } = {}) {
  const b = await exportSelection({ zineIds, includeImages: false, includeDrafts })
  return {
    app: 'myzine',
    kind: 'texts',
    version: 1,
    exportedAt: b.exportedAt,
    zines: b.zines,
    pages: b.pages.map(({ imageId, ...p }) => p),
    drafts: b.drafts.filter((d) => typeof d?.id === 'string' && !d.id.startsWith(PREV)),
  }
}

/* ---------- receiving ---------- */

/**
 * Import a text payload. Returns
 * { zines, drafts, same, saved: [{ key, where: 'poems' | 'kept' | 'earlier', title? }] }
 */
export async function importTexts(data) {
  if (data?.app !== 'myzine' || data.kind !== 'texts' || !Array.isArray(data.zines) || !Array.isArray(data.drafts)) {
    throw new Error('The scanned codes are not MyZine texts.')
  }
  const report = { zines: 0, drafts: 0, same: 0, saved: [] }
  const now = Date.now()

  /* ---- writing practices ---- */
  const local = new Map((await getAll('drafts')).map((r) => [r.id, r]))
  const next = new Map() // id → record to write
  const current = (id) => next.get(id) ?? local.get(id)
  const keepAside = (id, record) => next.set(PREV + id, { id: PREV + id, data: { savedAt: now, record }, updatedAt: now })
  const addToSaved = (id, lines) => {
    const list = current(id)?.data?.poems || []
    next.set(id, { id, data: { poems: unionPoems([{ id: newId(), lines, at: now }], list) }, updatedAt: now })
  }

  for (const d of data.drafts) {
    if (typeof d?.id !== 'string' || d.id.startsWith(PREV)) continue
    const mine = current(d.id)
    if (!mine) {
      next.set(d.id, d)
      report.drafts++
      continue
    }
    if (same(content(mine), content(d))) {
      report.same++
      continue
    }
    report.drafts++

    if (d.id.endsWith('-saved')) {
      const data = {}
      if (d.data?.poems || mine.data?.poems) data.poems = unionPoems(d.data?.poems, mine.data?.poems)
      if (d.data?.works || mine.data?.works) data.works = unionWorks(d.data?.works, mine.data?.works)
      next.set(d.id, { id: d.id, data, updatedAt: now })
    } else if (d.id === 'haiku') {
      const kept = unionPoems(d.data?.kept, mine.data?.kept)
      const myLines = mine.data?.lines || []
      if (hasText(myLines) && !same(myLines, d.data?.lines)) {
        kept.unshift({ id: newId(), lines: myLines.map((l) => l.trim()), at: now })
        report.saved.push({ key: d.id, where: 'kept' })
      }
      next.set(d.id, { ...d, data: { ...d.data, kept }, updatedAt: now })
    } else if (d.id === 'timed-poem') {
      if (hasText(mine.text)) {
        addToSaved('timed-poem-saved', mine.text.trim().split('\n').map((l) => l.trimEnd()))
        report.saved.push({ key: d.id, where: 'poems' })
      }
      next.set(d.id, d)
    } else {
      if (hasText(content(mine))) {
        keepAside(d.id, mine)
        if (!report.saved.some((s) => placeOf(s.key).to.name === placeOf(d.id).to.name && s.where === 'earlier')) {
          report.saved.push({ key: d.id, where: 'earlier' })
        }
      }
      next.set(d.id, d)
    }
  }

  /* ---- zines (texts only; local images stay) ---- */
  const zinePuts = []
  const pagePuts = []
  const pageDeletes = []
  const imageDeletes = []
  const incomingPages = data.pages || []
  for (const z of data.zines) {
    if (typeof z?.id !== 'string') continue
    const pages = incomingPages.filter((p) => p.zineId === z.id)
    const [mine, myPages] = await Promise.all([getZine(z.id), listPages(z.id)])
    if (!mine) {
      zinePuts.push(z)
      for (const p of pages) pagePuts.push({ ...p, imageId: null })
      report.zines++
      continue
    }
    const before = zineSnapshot(mine, myPages)
    if (same(before, zineSnapshot(z, pages))) {
      report.same++
      continue
    }
    report.zines++
    if (hasText(before)) {
      next.set(PREV + ZINE_KEY + z.id, { id: PREV + ZINE_KEY + z.id, data: { savedAt: now, ...before }, updatedAt: now })
      report.saved.push({ key: ZINE_KEY + z.id, where: 'earlier', title: z.title || mine.title })
    }
    zinePuts.push({ ...mine, title: z.title, description: z.description, color: z.color || mine.color, updatedAt: now })
    const mineById = new Map(myPages.map((p) => [p.id, p]))
    for (const p of pages) pagePuts.push({ ...mineById.get(p.id), ...p, imageId: mineById.get(p.id)?.imageId ?? null })
    const keep = new Set(pages.map((p) => p.id))
    for (const p of myPages) {
      if (keep.has(p.id)) continue
      pageDeletes.push(p.id)
      if (p.imageId) imageDeletes.push(p.imageId)
    }
  }

  await transaction(['zines', 'pages', 'images', 'drafts'], 'readwrite', (s) => {
    for (const id of pageDeletes) s.pages.delete(id)
    for (const id of imageDeletes) s.images.delete(id)
    for (const z of zinePuts) s.zines.put(z)
    for (const p of pagePuts) s.pages.put(p)
    for (const r of next.values()) s.drafts.put(r)
  })
  return report
}

/* ---------- earlier versions ---------- */

/** Saved earlier versions for these keys (draft ids or `zine:<id>`): [{ key, savedAt }]. */
export async function listEarlier(keys) {
  const recs = await Promise.all(keys.map((k) => get('drafts', PREV + k)))
  return recs.filter(Boolean).map((r) => ({ key: r.id.slice(PREV.length), savedAt: r.data?.savedAt || r.updatedAt }))
}

export async function deleteEarlier(keys) {
  await transaction('drafts', 'readwrite', (s) => {
    for (const k of keys) s.drafts.delete(PREV + k)
  })
}

/**
 * Swap the current and the earlier version, so the user can swap back.
 * Writing practices: whole draft records. Zines: title, description, colour
 * and page texts (images stay where they are).
 */
export async function restoreEarlier(keys) {
  const now = Date.now()
  const puts = { drafts: [], zines: [], pages: [] }
  const deletes = []

  for (const key of keys) {
    const prev = await get('drafts', PREV + key)
    if (!prev?.data) continue

    if (key.startsWith(ZINE_KEY)) {
      const id = key.slice(ZINE_KEY.length)
      const [zine, pages] = await Promise.all([getZine(id), listPages(id)])
      if (!zine) {
        deletes.push(PREV + key)
        continue
      }
      const { savedAt, ...old } = prev.data
      puts.drafts.push({ id: PREV + key, data: { savedAt: now, ...zineSnapshot(zine, pages) }, updatedAt: now })
      puts.zines.push({ ...zine, title: old.title, description: old.description, color: old.color || zine.color, updatedAt: now })
      const oldById = new Map((old.pages || []).map((p) => [p.id, p]))
      for (const p of pages) {
        const o = oldById.get(p.id)
        if (o) puts.pages.push({ ...p, title: o.title, body: o.body, layout: o.layout || p.layout, order: o.order ?? p.order })
      }
      continue
    }

    const cur = await get('drafts', key)
    const record = prev.data.record
    if (record?.id === key) puts.drafts.push({ ...record, updatedAt: now })
    if (cur && hasText(content(cur))) puts.drafts.push({ id: PREV + key, data: { savedAt: now, record: cur }, updatedAt: now })
    else deletes.push(PREV + key)
  }

  await transaction(['zines', 'pages', 'drafts'], 'readwrite', (s) => {
    for (const id of deletes) s.drafts.delete(id)
    for (const r of puts.drafts) s.drafts.put(r)
    for (const z of puts.zines) s.zines.put(z)
    for (const p of puts.pages) s.pages.put(p)
  })
}
