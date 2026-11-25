import { toRaw } from 'vue'
import { transaction, get, getAll, put, del, getAllByIndex } from './idb'
import { PREV, mergeDrafts, hasText, same, zineSnapshot, zinePrevRecord } from '../sync/merge'

const uid = () =>
  crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)

// Vue reactive proxies can't be structured-cloned into IndexedDB.
const plain = (obj) => ({ ...toRaw(obj) })

/* ---------- Zines ---------- */

export async function listZines() {
  const [zines, pages] = await Promise.all([getAll('zines'), getAll('pages')])
  const counts = {}
  for (const p of pages) counts[p.zineId] = (counts[p.zineId] || 0) + 1
  return zines
    .map((z) => ({ ...z, pageCount: counts[z.id] || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getZine = (id) => get('zines', id)

/** One A4 sheet folded into a mini-zine = 8 pages (front cover, 6 inside, back cover). */
export const ZINE_PAGE_COUNT = 8

const newPage = (zineId, order, fields = {}) => ({
  id: uid(),
  zineId,
  order,
  title: '',
  body: '',
  layout: 'image-top', // image-top | image-left | text-only
  imageId: null,
  ...fields,
})

export async function createZine({ title = 'Untitled zine', description = '', color = '#e85d3f' } = {}) {
  const now = Date.now()
  const zine = { id: uid(), title, description, color, format: 'a4-8', createdAt: now, updatedAt: now }
  await transaction(['zines', 'pages'], 'readwrite', (s) => {
    s.zines.put(zine)
    for (let i = 0; i < ZINE_PAGE_COUNT; i++) s.pages.put(newPage(zine.id, i))
  })
  return zine
}

export async function updateZine(zine) {
  const record = { ...plain(zine), updatedAt: Date.now() }
  delete record.pageCount
  await put('zines', record)
  return record
}

/** Bump a zine's updatedAt. Read and write in one transaction, so a title saved meanwhile isn't overwritten. */
export function touchZine(zineId) {
  return transaction('zines', 'readwrite', (s) => {
    const req = s.zines.get(zineId)
    req.onsuccess = () => {
      if (req.result) s.zines.put({ ...req.result, updatedAt: Date.now() })
    }
  })
}

/** Deletes a zine plus all its pages and images in one transaction. */
export async function deleteZine(id) {
  const pages = await listPages(id)
  await transaction(['zines', 'pages', 'images', 'drafts'], 'readwrite', (s) => {
    s.zines.delete(id)
    s.drafts.delete(`prev:zine:${id}`) // its earlier version from a QR sync
    for (const p of pages) {
      s.pages.delete(p.id)
      if (p.imageId) s.images.delete(p.imageId)
    }
  })
}

/* ---------- Pages ---------- */

export async function listPages(zineId) {
  const pages = await getAllByIndex('pages', 'zineId', zineId)
  return pages.sort((a, b) => a.order - b.order)
}

export async function addPage(zineId, fields = {}) {
  const pages = await listPages(zineId)
  const order = pages.length ? pages[pages.length - 1].order + 1 : 0
  const page = newPage(zineId, order, fields)
  await put('pages', page)
  await touchZine(zineId)
  return page
}

export async function updatePage(page) {
  const record = plain(page)
  await put('pages', record)
  await touchZine(record.zineId)
  return record
}

export async function deletePage(page) {
  await transaction(['pages', 'images'], 'readwrite', (s) => {
    s.pages.delete(page.id)
    if (page.imageId) s.images.delete(page.imageId)
  })
  await touchZine(page.zineId)
}

/** Swap the `order` of two pages atomically. */
export async function swapPages(a, b) {
  const ra = { ...plain(a), order: b.order }
  const rb = { ...plain(b), order: a.order }
  await transaction('pages', 'readwrite', (s) => {
    s.pages.put(ra)
    s.pages.put(rb)
  })
  await touchZine(a.zineId)
  return [ra, rb]
}

/* ---------- Images (stored as Blobs) ---------- */

export async function saveImage(blob) {
  const id = uid()
  await put('images', { id, blob })
  return id
}

export async function getImageBlob(id) {
  if (!id) return null
  const rec = await get('images', id)
  return rec?.blob ?? null
}

export const deleteImage = (id) => del('images', id)

/* ---------- Backup ---------- */

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/**
 * Build a backup object.
 * selection: { zineIds?: string[] (default: all), includeImages = true, includeDrafts = true }
 * Same format as a full backup, so importAll() reads both.
 */
export async function exportSelection({ zineIds = null, includeImages = true, includeDrafts = true } = {}) {
  const [allZines, allPages, allImages, drafts] = await Promise.all([
    getAll('zines'),
    getAll('pages'),
    getAll('images'),
    includeDrafts ? getAll('drafts') : [],
  ])
  const ids = zineIds ? new Set(zineIds) : null
  const zines = ids ? allZines.filter((z) => ids.has(z.id)) : allZines
  let pages = ids ? allPages.filter((p) => ids.has(p.zineId)) : allPages

  let images = []
  if (includeImages) {
    const needed = new Set(pages.map((p) => p.imageId).filter(Boolean))
    images = await Promise.all(
      allImages
        .filter((img) => needed.has(img.id))
        .map(async (img) => ({ id: img.id, dataURL: await blobToDataURL(img.blob) })),
    )
  } else {
    // no dangling references to images that aren't in the file; imageElsewhere
    // tells the other device that this page has a picture (here), so it keeps its own
    pages = pages.map((p) => ({ ...p, imageId: null, imageElsewhere: !!p.imageId || !!p.imageElsewhere }))
  }

  // v2 adds `drafts` (writing-practice texts). v1 backups still import fine.
  // includesImages: false tells importAll to keep the pictures already on the device.
  return { app: 'myzine', version: 2, exportedAt: new Date().toISOString(), includesImages: includeImages, zines, pages, images, drafts }
}

export const exportAll = () => exportSelection()

/** Only real image data is read from a backup; a link to elsewhere would make the browser fetch it. */
const isImageData = (img) => typeof img?.id === 'string' && typeof img.dataURL === 'string' && /^data:image\//.test(img.dataURL)

/**
 * Import a backup file. Zines in the file replace the local copies, writing
 * practices follow the rules in sync/merge.js (saved lists are combined, a
 * different version here is saved as an earlier version first). Returns
 * { zines, drafts, saved } where saved = how many earlier versions were kept.
 */
export async function importAll(data) {
  if (data?.app !== 'myzine' || !Array.isArray(data.zines)) {
    throw new Error('This file is not a MyZine backup.')
  }
  const now = Date.now()
  const zines = data.zines.filter((z) => typeof z?.id === 'string')
  const images = await Promise.all(
    (data.images || []).filter(isImageData).map(async (img) => ({ id: img.id, blob: await (await fetch(img.dataURL)).blob() })),
  )
  // An imported zine replaces the local copy of that zine: pages that are no
  // longer in the backup (deleted on the other device) are removed too.
  // A backup made without images keeps the pictures already on this device
  // (older files have no flag: no images and no image links means the same).
  // A page marked imageElsewhere has a picture on another device that the file
  // doesn't carry (it came by QR, or from a backup without images): keep ours.
  const withoutImages =
    data.includesImages === false ||
    (data.includesImages === undefined && !data.images?.length && !(data.pages || []).some((p) => p.imageId))
  const local = (await Promise.all(zines.map((z) => listPages(z.id)))).flat()
  const localById = new Map(local.map((p) => [p.id, p]))
  const zineIds = new Set(zines.map((z) => z.id))
  // only pages of the zines in the file (others would belong to no zine here)
  const incoming = (data.pages || []).filter((p) => typeof p?.id === 'string' && zineIds.has(p.zineId)).map((p) => {
    if (p.imageId) return { ...p, imageElsewhere: false }
    if (!withoutImages && !p.imageElsewhere) return p
    const mine = localById.get(p.id)?.imageId ?? null
    return { ...p, imageId: mine, imageElsewhere: !mine && !!p.imageElsewhere }
  })
  const keepPages = new Set(incoming.map((p) => p.id))
  const keepImages = new Set(incoming.map((p) => p.imageId).filter(Boolean))
  const stale = local.filter((p) => !keepPages.has(p.id))
  // images that no page uses any more (a page now has another picture or none)
  const orphans = local.filter((p) => p.imageId && !keepImages.has(p.imageId)).map((p) => p.imageId)

  // writing practices: combine saved lists, keep a different local version as an earlier version
  const localDrafts = new Map((await getAll('drafts')).map((r) => [r.id, r]))
  const plan = mergeDrafts(data.drafts, localDrafts, now)
  // earlier versions in the file are added where this device has none
  for (const d of data.drafts || []) {
    if (typeof d?.id === 'string' && d.id.startsWith(PREV) && !localDrafts.has(d.id)) plan.next.set(d.id, d)
  }
  // zines whose text differs here: keep the local text as an earlier version
  let zinesKept = 0
  for (const z of zines) {
    const mine = await getZine(z.id)
    if (!mine) continue
    const before = zineSnapshot(mine, local.filter((p) => p.zineId === z.id))
    const after = zineSnapshot(z, incoming.filter((p) => p.zineId === z.id))
    if (!same(before, after) && hasText(before)) {
      plan.next.set(PREV + 'zine:' + z.id, zinePrevRecord(z.id, before, now))
      zinesKept++
    }
  }

  await transaction(['zines', 'pages', 'images', 'drafts'], 'readwrite', (s) => {
    for (const p of stale) s.pages.delete(p.id)
    for (const id of orphans) s.images.delete(id)
    for (const z of zines) s.zines.put(z)
    for (const p of incoming) s.pages.put(p)
    for (const i of images) s.images.put(i)
    for (const r of plan.next.values()) s.drafts.put(r)
  })
  return { zines: zines.length, drafts: plan.drafts, saved: plan.saved.length + zinesKept }
}
