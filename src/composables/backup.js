import { exportAll, exportSelection, importAll } from '../db/zines'
import { clearAllStores } from '../db/idb'
import { reset as resetTimer } from './poemTimer'
import { router } from '../router'
import { t } from '../i18n'

const today = () => new Date().toISOString().slice(0, 10)

function downloadFile(file) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Download everything in IndexedDB (zines, pages, images, writing practices) as one JSON file. */
export async function downloadBackup() {
  const data = await exportAll()
  downloadFile(new File([JSON.stringify(data)], `myzine-backup-${today()}.json`, { type: 'application/json' }))
}

/**
 * Build backup files for the Share page from a selection.
 * Returns two files with the same content:
 *  - `share`: .txt / text/plain, because browsers' share menus (e.g. Chrome)
 *    refuse .json files; import reads it just the same
 *  - `download`: the usual .json file
 */
export async function buildShareFiles(selection) {
  const text = JSON.stringify(await exportSelection(selection))
  const base = `myzine-backup-${today()}`
  return {
    share: new File([text], `${base}.txt`, { type: 'text/plain' }),
    download: new File([text], `${base}.json`, { type: 'application/json' }),
    size: new Blob([text]).size,
  }
}

/**
 * Markdown version of a selection, for reading/editing elsewhere (not importable).
 * The shared copy is .txt because share menus refuse .md; the download is a real .md.
 */
export async function buildMarkdownFiles(selection) {
  const { buildMarkdown } = await import('../export/markdown')
  const text = await buildMarkdown(selection)
  const base = `myzine-${today()}`
  return {
    share: new File([text], `${base}.txt`, { type: 'text/plain' }),
    download: new File([text], `${base}.md`, { type: 'text/markdown' }),
    size: new Blob([text]).size,
  }
}

/** Can this browser open the system share menu with a file? */
export function canShareFiles() {
  try {
    const probe = new File(['x'], 'probe.txt', { type: 'text/plain' })
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [probe] }))
  } catch {
    return false
  }
}

/**
 * Open the system share menu with a prepared file. Must be called straight
 * from a click (browsers require a fresh user gesture), so prepare the file first.
 * Resolves false if the user cancelled.
 */
export async function shareFile(file) {
  try {
    await navigator.share({ files: [file], title: 'MyZine backup' })
    return true
  } catch (err) {
    if (err?.name === 'AbortError') return false
    throw err
  }
}

export { downloadFile }

/**
 * Let the user pick a backup file and import it. On success the page reloads,
 * so whatever view is open shows the restored data.
 */
export function pickAndImportBackup() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json,text/plain,.txt'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const { zines, drafts, saved } = await importAll(JSON.parse(await file.text()))
      // tell the user where their own different versions went
      alert([t('share.importedBoth', { z: zines, d: drafts }), saved ? t('share.importKept', { n: saved }) : ''].filter(Boolean).join('\n\n'))
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
    await wait(800) // let the download start

    // The browser may still be asking where to save, or may have blocked the
    // download: only clear once the user says the file is really saved.
    if (!confirm(t('nav.confirmBackupSaved'))) return

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
