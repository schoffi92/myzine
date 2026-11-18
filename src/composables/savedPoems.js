import { ref } from 'vue'
import { loadDraftData, saveDraftData } from '../db/drafts'

/*
 * Saved poems of a writing practice, stored in IndexedDB (drafts store) as
 * { poems: [{ id, lines: string[], at }] } under `storeId`, newest first.
 * Used by the 15-minute poem and the cut-up poem (Haiku keeps its list
 * inside its own draft, in the same shape).
 */
export function useSavedPoems(storeId) {
  const poems = ref([])

  const persist = () => saveDraftData(storeId, { poems: poems.value })

  async function load() {
    const saved = await loadDraftData(storeId)
    poems.value = Array.isArray(saved?.poems) ? saved.poems.filter((p) => Array.isArray(p?.lines)) : []
  }

  /** Save `text` (or an array of lines) as a new poem. Blank lines inside are kept (stanzas). */
  async function add(text) {
    const lines = (Array.isArray(text) ? text : text.split('\n')).map((l) => l.trimEnd())
    while (lines.length && !lines[0].trim()) lines.shift()
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (!lines.length) return false
    poems.value.unshift({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, lines, at: Date.now() })
    await persist()
    return true
  }

  async function remove(i) {
    poems.value.splice(i, 1)
    await persist()
  }

  return { poems, load, add, remove }
}
