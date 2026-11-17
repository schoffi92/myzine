import { exportAll, importAll } from '../db/zines'
import { clearAllStores } from '../db/idb'
import { reset as resetTimer } from './poemTimer'
import { router } from '../router'
import { t } from '../i18n'

/** Download everything in IndexedDB (zines, pages, images, writing practices) as one JSON file. */
export async function downloadBackup() {
  const data = await exportAll()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `myzine-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/**
 * Let the user pick a backup file and import it. On success the page reloads,
 * so whatever view is open shows the restored data.
 */
export function pickAndImportBackup() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const n = await importAll(JSON.parse(await file.text()))
      alert(t('library.imported', { n }))
      location.reload()
    } catch (err) {
      alert(t('library.importFailed', { msg: err.message }))
    }
  }
  input.click()
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * After the user confirms: save a backup file, then delete everything MyZine
 * stored in this browser (IndexedDB + its localStorage keys) and reload.
 */
export async function backupAndClearAll() {
  if (!confirm(t('nav.confirmClearAll'))) return
  try {
    // Leave the current page first, so open editors flush unsaved changes
    // into the database (and so nothing re-saves after we clear).
    await router.push({ name: 'home' })
    await wait(150)

    await downloadBackup()
    await wait(800) // let the download start before the page reloads

    resetTimer()
    await clearAllStores()
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('myzine:')) localStorage.removeItem(key)
    }
    location.reload()
  } catch (err) {
    alert(t('nav.clearFailed', { msg: err.message }))
  }
}
