import { loadDraftData, saveDraftData, deleteDraft } from '../db/drafts'

/*
 * Data for the "Storytelling cards" practice, shared by the editor and the print view.
 * Stored in IndexedDB (drafts store) under STORY_ID.
 *
 * chapter = { id, key: beat key | null (custom), title, desc, enabled, notes: [note] }
 * column  = { id, name, notes: [note] }   (characters and worlds)
 * note    = { id, text }
 */

export const STORY_ID = 'story-cards'
export const BEATS = ['prologue', 'incident', 'doorway1', 'midpoint', 'blackmoment', 'doorway2', 'epilogue']
export const BOARD_COLORS = { chapter: '#e85d3f', character: '#2a6fb0', world: '#3c9a5f' }

let seq = 0
export const uid = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

/** The practice takes apart an existing story: a film or a novel. */
export const SOURCE_KINDS = ['novel', 'film']

export function blankStory() {
  return {
    step: 1,
    kind: 'novel', // film | novel
    title: '', // title of the film or novel

    chapters: BEATS.map((key) => ({ id: uid(), key, title: '', desc: '', enabled: true, notes: [] })),
    characters: [],
    worlds: [],
  }
}

/** Text from a draft or an imported file: anything that isn't a string counts as empty. */
const str = (v) => (typeof v === 'string' ? v : '')
const notesOf = (x) => (Array.isArray(x?.notes) ? x.notes.filter((n) => n && n.id).map((n) => ({ ...n, text: str(n.text) })) : [])
const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

export function normalizeStory(d) {
  if (!d || !Array.isArray(d.chapters)) return blankStory()
  return {
    step: [1, 2, 3].includes(d.step) ? d.step : 1,
    kind: SOURCE_KINDS.includes(d.kind) ? d.kind : 'novel',
    title: str(d.title),
    chapters: listOf(d.chapters).map((c) => ({
      id: c.id ?? uid(),
      key: BEATS.includes(c.key) ? c.key : null,
      title: str(c.title),
      desc: str(c.desc),
      enabled: c.enabled !== false,
      notes: notesOf(c),
    })),
    characters: listOf(d.characters).map((c) => ({ id: c.id ?? uid(), name: str(c.name), notes: notesOf(c) })),
    worlds: listOf(d.worlds).map((c) => ({ id: c.id ?? uid(), name: str(c.name), notes: notesOf(c) })),
  }
}

export const loadStory = async () => normalizeStory(await loadDraftData(STORY_ID))
export const saveStory = (story) => saveDraftData(STORY_ID, story)
export const deleteStory = () => deleteDraft(STORY_ID)

/** Display title of a chapter: built-in beats follow the current language. */
export function chapterTitle(ch, t) {
  if (ch.key) return t(`writing.story.beats.${ch.key}.t`)
  return ch.title.trim() || t('writing.story.unnamed')
}

export function chapterDesc(ch, t) {
  return ch.key ? t(`writing.story.beats.${ch.key}.d`) : ch.desc.trim()
}

/** "Film · Title" (or "Novel · Untitled story") for headings. */
export function sourceLabel(story, t) {
  const kind = t(story.kind === 'film' ? 'writing.story.kindFilm' : 'writing.story.kindNovel')
  return `${kind} · ${story.title?.trim() || t('writing.story.untitledStory')}`
}
