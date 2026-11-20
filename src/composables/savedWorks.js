import { ref } from 'vue'
import { loadDraftData, saveDraftData } from '../db/drafts'

/*
 * Saved works of a novel practice (Snowflake, Mosaic, Storytelling cards,
 * Taboo, Character interview, Difficult situation, Iamb and trochee, Rhyme schemes), stored in IndexedDB (drafts store) under `<practice id>-saved` as
 * { works: [{ id, title, at, data }] }, newest first. `data` is a snapshot of
 * the practice's draft at the moment of saving.
 */
export const savedWorksId = (kind) => `${kind}-saved`

export async function loadSavedWorks(kind) {
  const saved = await loadDraftData(savedWorksId(kind))
  return Array.isArray(saved?.works) ? saved.works.filter((w) => w?.id && w.data && typeof w.data === 'object') : []
}

export function useSavedWorks(kind) {
  const works = ref([])
  let ready = Promise.resolve()
  const persist = () => saveDraftData(savedWorksId(kind), { works: works.value })

  function load() {
    ready = loadSavedWorks(kind).then((list) => {
      works.value = list
    })
    return ready
  }

  async function add(title, data) {
    await ready // never save over a list that hasn't loaded yet
    works.value.unshift({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      at: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
    })
    await persist()
  }

  async function remove(id) {
    await ready
    works.value = works.value.filter((w) => w.id !== id)
    await persist()
  }

  return { works, load, add, remove }
}
