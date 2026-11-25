import { transaction, get, getAll } from '../db/idb'
import { exportSelection, getZine, listPages } from '../db/zines'
import { PREV, ZINE_KEY, placeOf, hasText, content, same, zineSnapshot, zinePrevRecord, mergeDrafts } from './merge'

/*
 * Text-only sync (used by the QR codes on the Share page).
 *
 * The scanned version always becomes the current one; a different version on
 * this device is saved first (rules in merge.js).
 * Images are never sent; local images of a zine are kept, and pages whose
 * picture stayed on the other device are marked `imageElsewhere`.
 */

export { PREV, placeOf }

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
  const now = Date.now()

  /* ---- writing practices ---- */
  const local = new Map((await getAll('drafts')).map((r) => [r.id, r]))
  const { next, drafts, same: sameDrafts, saved } = mergeDrafts(data.drafts, local, now)
  const report = { zines: 0, drafts, same: sameDrafts, saved }

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
      for (const p of pages) pagePuts.push({ ...p, imageId: null, imageElsewhere: !!p.imageElsewhere })
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
      next.set(PREV + ZINE_KEY + z.id, zinePrevRecord(z.id, before, now))
      report.saved.push({ key: ZINE_KEY + z.id, where: 'earlier', title: z.title || mine.title })
    }
    zinePuts.push({ ...mine, title: z.title, description: z.description, color: z.color || mine.color, updatedAt: now })
    const mineById = new Map(myPages.map((p) => [p.id, p]))
    for (const p of pages) {
      const myImage = mineById.get(p.id)?.imageId ?? null
      // the picture stays here; if this page has none, remember the other device has one
      pagePuts.push({ ...mineById.get(p.id), ...p, imageId: myImage, imageElsewhere: !myImage && !!p.imageElsewhere })
    }
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
 * and page texts (images stay where they are). Pages a sync removed come back
 * (as text: their pictures went with them); pages only the current version
 * has are removed when they have no picture: their text goes into the
 * swapped earlier version, so swapping back brings them back too.
 */
export async function restoreEarlier(keys) {
  const now = Date.now()
  const puts = { drafts: [], zines: [], pages: [] }
  const deletes = []
  const pageDeletes = []

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
      const oldPages = (old.pages || []).filter((p) => typeof p?.id === 'string')
      const oldById = new Map(oldPages.map((p) => [p.id, p]))
      const curById = new Map(pages.map((p) => [p.id, p]))
      for (const o of oldPages) {
        const p = curById.get(o.id)
        const text = { title: o.title ?? '', body: o.body ?? '', layout: o.layout || p?.layout || 'image-top', order: o.order ?? p?.order ?? 0 }
        puts.pages.push(p ? { ...p, ...text } : { id: o.id, zineId: id, imageId: null, ...text })
      }
      // pages the earlier version didn't have: without a picture they go (their text is in the swap);
      // with one they stay, after the restored pages
      let next = Math.max(-1, ...oldPages.map((p) => p.order ?? 0)) + 1
      for (const p of pages) {
        if (oldById.has(p.id)) continue
        if (p.imageId) puts.pages.push({ ...p, order: next++ })
        else pageDeletes.push(p.id)
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
    for (const id of pageDeletes) s.pages.delete(id)
    for (const r of puts.drafts) s.drafts.put(r)
    for (const z of puts.zines) s.zines.put(z)
    for (const p of puts.pages) s.pages.put(p)
  })
}
