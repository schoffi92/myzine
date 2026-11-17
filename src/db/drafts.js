import { get, put, del } from './idb'

/** Writing-practice drafts, stored in IndexedDB by a fixed id per practice. */
export async function loadDraft(id) {
  return (await get('drafts', id))?.text ?? ''
}

export const saveDraft = (id, text) => put('drafts', { id, text, updatedAt: Date.now() })

export const deleteDraft = (id) => del('drafts', id)

/** Structured practice data (e.g. pulled tarot cards), same store. */
export async function loadDraftData(id) {
  return (await get('drafts', id))?.data ?? null
}

export const saveDraftData = (id, data) =>
  put('drafts', { id, data: JSON.parse(JSON.stringify(data)), updatedAt: Date.now() })
