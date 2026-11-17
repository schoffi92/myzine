import { toRaw } from 'vue'
import { transaction, get, getAll, put, del, getAllByIndex } from './idb'

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

export async function touchZine(zineId) {
  const zine = await getZine(zineId)
  if (zine) await put('zines', { ...zine, updatedAt: Date.now() })
}

/** Deletes a zine plus all its pages and images in one transaction. */
export async function deleteZine(id) {
  const pages = await listPages(id)
  await transaction(['zines', 'pages', 'images'], 'readwrite', (s) => {
    s.zines.delete(id)
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

export async function exportAll() {
  const [zines, pages, images, drafts] = await Promise.all([
    getAll('zines'),
    getAll('pages'),
    getAll('images'),
    getAll('drafts'),
  ])
  const encoded = await Promise.all(
    images.map(async (img) => ({ id: img.id, dataURL: await blobToDataURL(img.blob) })),
  )
  // v2 adds `drafts` (writing-practice texts). v1 backups still import fine.
  return { app: 'myzine', version: 2, exportedAt: new Date().toISOString(), zines, pages, images: encoded, drafts }
}

export async function importAll(data) {
  if (data?.app !== 'myzine' || !Array.isArray(data.zines)) {
    throw new Error('This file is not a MyZine backup.')
  }
  const images = await Promise.all(
    (data.images || []).map(async (img) => ({ id: img.id, blob: await (await fetch(img.dataURL)).blob() })),
  )
  await transaction(['zines', 'pages', 'images', 'drafts'], 'readwrite', (s) => {
    for (const z of data.zines) s.zines.put(z)
    for (const p of data.pages || []) s.pages.put(p)
    for (const i of images) s.images.put(i)
    for (const d of data.drafts || []) s.drafts.put(d)
  })
  return data.zines.length
}
