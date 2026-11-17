// Minimal promise wrapper around the browser's built-in IndexedDB.
// No third-party DB library — everything lives in the user's browser.

const DB_NAME = 'myzine'
const DB_VERSION = 2 // v2: added `drafts` store

let dbPromise = null

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('zines')) {
        db.createObjectStore('zines', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('pages')) {
        const pages = db.createObjectStore('pages', { keyPath: 'id' })
        pages.createIndex('zineId', 'zineId', { unique: false })
      }
      if (!db.objectStoreNames.contains('images')) {
        // { id, blob } — images are stored as Blobs, not base64
        db.createObjectStore('images', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('drafts')) {
        // { id, text, updatedAt } — writing-practice texts
        db.createObjectStore('drafts', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // If another tab upgrades the schema, close so it isn't blocked, and
      // forget the connection so the next call opens a fresh one.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      db.onclose = () => {
        dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => {
      dbPromise = null // allow a retry instead of failing forever
      reject(
        req.error?.name === 'VersionError'
          ? new Error('MyZine was updated in another tab. Reload this page.')
          : req.error,
      )
    }
    // Another tab still has the old version open. Don't fail: the open
    // continues by itself once that tab closes its connection (see onversionchange).
    req.onblocked = () => console.warn('MyZine: waiting for other tabs to close the old database')
  })
  return dbPromise
}

export function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Run `fn(stores)` inside one transaction. `fn` must only queue IDB requests
 * (no awaiting non-IDB promises), and the returned promise resolves with
 * fn's return value once the transaction commits.
 */
export async function transaction(storeNames, mode, fn) {
  const db = await openDB()
  const names = Array.isArray(storeNames) ? storeNames : [storeNames]
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode)
    const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]))
    let result
    try {
      result = fn(stores, tx)
    } catch (err) {
      tx.abort()
      reject(err)
      return
    }
    tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
  })
}

export const get = (store, key) => transaction(store, 'readonly', (s) => s[store].get(key))
export const getAll = (store) => transaction(store, 'readonly', (s) => s[store].getAll())
export const put = (store, value) => transaction(store, 'readwrite', (s) => s[store].put(value))
export const del = (store, key) => transaction(store, 'readwrite', (s) => s[store].delete(key))
export const getAllByIndex = (store, index, value) =>
  transaction(store, 'readonly', (s) => s[store].index(index).getAll(value))

/** Empty every object store (zines, pages, images, drafts) in one transaction. */
export async function clearAllStores() {
  const db = await openDB()
  const names = [...db.objectStoreNames]
  await transaction(names, 'readwrite', (s) => {
    for (const n of names) s[n].clear()
  })
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist()
    }
    return true
  } catch {
    return false
  }
}

export async function storageEstimate() {
  try {
    return (await navigator.storage?.estimate?.()) ?? null
  } catch {
    return null
  }
}
