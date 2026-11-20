import { t, tl } from '../i18n'
import { settings } from '../composables/settings'
import { listZines, listPages } from '../db/zines'
import { getAllDrafts } from '../db/drafts'
import { cardText } from '../tarot'
import { CARD_BY_ID } from '../tarot/deck'
import { chapterTitle, chapterDesc, sourceLabel } from '../composables/storyCards'
import { interviewQuestion } from '../composables/interview'
import { situationText } from '../composables/situation'

/*
 * Readable Markdown export of the user's zines and writing practices,
 * in the current language. Not meant to be imported back (that's the JSON backup).
 */

/* ---------- small Markdown helpers ---------- */

/** Escape what would turn plain user text into Markdown syntax. */
const escLine = (line) =>
  line
    .replace(/\\/g, '\\\\') // a typed backslash stays a backslash
    .replace(/\*/g, '\\*') // "5 * 3 * 2" is not emphasis
    .replace(/^(\s*)(#{1,6})(\s|$)/, '$1\\$2$3') // "# x", "## x" → literal
    .replace(/^(\s*)([>+-])(\s)/, '$1\\$2$3') // "- x", "> x" → literal
    .replace(/^(\s*)(\d+)([.)])(\s)/, '$1$2\\$3$4') // "1. x" → "1\. x" (not a list)
    .replace(/^(\s*)([-=_])(\2{2,}\s*)$/, '$1\\$2$3') // "---", "===" → not a rule or heading underline
const esc = (text) => (text || '').split('\n').map(escLine).join('\n')
/** Keep single line breaks (poems, dialogue): two trailing spaces force a break in Markdown. */
const lines = (text) => esc(text.trim()).split('\n').map((l) => (l.trim() ? `${l}  ` : '')).join('\n').replace(/ +$/, '')
const paragraphs = lines
const quote = (text) => esc(text.trim()).split('\n').map((l) => `> ${l}`).join('\n')
const inline = (text) => esc(text).replace(/\s*\n\s*/g, ' ').trim()

function slotLabel(i, count) {
  if (i === 0) return t('editor.frontCover')
  if (i === count - 1) return t('editor.backCover')
  return t('editor.page', { n: i })
}

/* ---------- zines ---------- */

async function zineSection(zine) {
  const pages = await listPages(zine.id)
  const out = [`# ${inline(zine.title) || t('library.untitled')}`]
  if (zine.description?.trim()) out.push(`*${inline(zine.description)}*`)
  pages.forEach((p, i) => {
    if (!p.title?.trim() && !p.body?.trim() && !p.imageId) return // skip empty pages
    const title = p.title?.trim() ? ` — ${inline(p.title)}` : ''
    out.push(`## ${i + 1} · ${slotLabel(i, pages.length)}${title}`)
    if (p.imageId) out.push(`*(${t('share.mdImage')})*`)
    if (p.body?.trim()) out.push(paragraphs(p.body))
  })
  return out.join('\n\n')
}

/* ---------- writing practices ---------- */

function tarotList(cards) {
  if (!cards?.length) return null
  const positions = t('writing.timed.tarot.positions')
  const items = cards
    .filter((c) => CARD_BY_ID[c.id])
    .map((c, i) => {
      const ct = cardText(c.id)
      const orient = c.reversed ? t('writing.timed.tarot.reversed') : t('writing.timed.tarot.upright')
      const kw = c.reversed ? ct.rev : ct.up
      const pos = positions[i]?.name ? `**${positions[i].name}:** ` : ''
      return `- ${pos}${ct.name} (${orient}) — ${kw}`
    })
  return `### ${t('share.mdTarot')}\n\n${items.join('\n')}`
}

/** Poems saved with "Save this poem" (15-minute and cut-up poem), separated by rules. */
function savedList(d, id) {
  const poems = (d[id]?.data?.poems || []).filter((p) => p.lines?.some((l) => l.trim()))
  if (!poems.length) return null
  return `### ${t('writing.saved.title')}\n\n${poems.map((p) => lines(p.lines.join('\n'))).join('\n\n---\n\n')}`
}

function timedSection(d) {
  const text = d['timed-poem']?.text?.trim()
  const cards = tarotList(d['timed-poem-cards']?.data?.cards)
  const saved = savedList(d, 'timed-poem-saved')
  if (!text && !cards && !saved) return null
  return [`## ${t('writing.timed.title')}`, saved, text && lines(text), cards].filter(Boolean).join('\n\n')
}

function cutupSection(d) {
  const text = d['cutup-text']?.text?.trim()
  const arr = d['cutup-arrange']?.data
  const cards = tarotList(d['cutup-cards']?.data?.cards)
  let poem = null
  if (arr?.tiles && arr?.lines) {
    const byId = Object.fromEntries(arr.tiles.map((x) => [x.id, x.text]))
    const rows = arr.lines.map((l) => l.map((id) => byId[id]).filter(Boolean).join(' ')).filter(Boolean)
    if (rows.length) poem = `### ${t('writing.cutup.linesTitle')}\n\n${lines(rows.join('\n'))}`
  }
  const saved = savedList(d, 'cutup-saved')
  if (!text && !poem && !cards && !saved) return null
  return [
    `## ${t('writing.cutup.title')}`,
    saved,
    poem,
    text && `### ${t('share.mdOriginal')}\n\n${lines(text)}`,
    cards,
  ].filter(Boolean).join('\n\n')
}

/*
 * Novel practices: a body builder per practice (data → Markdown blocks, with
 * ### as the top heading level, or null when empty). Used for the current
 * work in the export, for saved works (savedWorkMarkdown) and their print view.
 */

/** Move Markdown headings by `by` levels (user text never starts with #: it's escaped). */
const shiftHeadings = (md, by) =>
  md.replace(/^(#{1,6}) /gm, (_, h) => `${'#'.repeat(Math.min(6, Math.max(1, h.length + by)))} `)

function snowflakeBody(s) {
  if (!s || (!s.one?.trim() && !s.five?.some((x) => x.trim()) && !s.paras?.some((x) => x.trim()))) return null
  const steps = t('writing.snowflake.steps')
  const labels = t('writing.snowflake.s2Labels')
  const out = []
  if (s.one?.trim()) out.push(quote(s.one))
  // bullets, not "1. 2. 5.": Markdown apps would renumber a gappy list
  const five = (s.five || []).map((x, i) => (x.trim() ? `- **${labels[i]}:** ${inline(x)}` : null)).filter(Boolean)
  if (five.length) out.push(`### ${steps[1]}\n\n${five.join('\n')}`)
  const paras = (s.paras || []).map((p, i) => p.trim() || s.five?.[i]?.trim() || '').filter(Boolean)
  if (paras.length) out.push(`### ${t('writing.snowflake.s4Title')}\n\n${paras.map(paragraphs).join('\n\n')}`)
  return out
}

function mosaicBody(m) {
  const tiles = (m?.tiles || []).filter((x) => x.text?.trim())
  if (!m || (!m.center?.trim() && !tiles.length)) return null
  const out = []
  if (m.center?.trim()) out.push(quote(m.center))
  const parts = tiles.map((x, i) =>
    [`### ${x.who?.trim() ? inline(x.who) : t('writing.mosaic.untitledTile', { n: i + 1 })}`, lines(x.text)].join('\n\n'),
  )
  if (parts.length) out.push(parts.join('\n\n---\n\n'))
  return out
}

function storyBody(s) {
  if (!s?.chapters) return null
  const notes = (list) => list.filter((n) => n.text?.trim()).map((n) => `- ${inline(n.text)}`).join('\n')
  const chapters = s.chapters.filter((c) => c.enabled !== false)
  const hasContent = s.title?.trim() || chapters.some((c) => c.notes?.length) || s.characters?.length || s.worlds?.length
  if (!hasContent) return null

  const out = []
  if (chapters.length) {
    out.push(`### ${t('writing.story.steps')[0]}`)
    chapters.forEach((c, i) => {
      const block = [`#### ${i + 1}. ${chapterTitle(c, t)}`]
      const desc = chapterDesc(c, t)
      if (desc) block.push(`*${inline(desc)}*`)
      const n = notes(c.notes || [])
      if (n) block.push(n)
      out.push(block.join('\n\n'))
    })
  }
  for (const [key, list] of [['characters', s.characters], ['worlds', s.worlds]]) {
    if (!list?.length) continue
    out.push(`### ${t(`writing.story.${key}`)}`)
    list.forEach((col) => {
      const block = [`#### ${inline(col.name) || t('writing.story.unnamed')}`]
      const n = notes(col.notes || [])
      if (n) block.push(n)
      out.push(block.join('\n\n'))
    })
  }
  return out
}

const storyKind = (s) => t(s?.kind === 'film' ? 'writing.story.kindFilm' : 'writing.story.kindNovel')

function tabooBody(s) {
  if (!s || (!s.text?.trim() && !s.traits?.length)) return null
  const out = []
  if (s.situation?.trim()) out.push(`**${t('writing.taboo.situation')}:** ${inline(s.situation)}`)
  if (s.traits?.length) out.push(`**${t('writing.taboo.traitsWere')}:** ${s.traits.map(inline).join(', ')}`)
  if (s.text?.trim()) out.push(paragraphs(s.text))
  return out
}

function interviewBody(s) {
  const qs = (Array.isArray(s?.questions) ? s.questions : []).filter((q) => q?.a?.trim())
  if (!qs.length) return null
  return qs.map((q) => `**${inline(interviewQuestion(q, t))}**\n\n${paragraphs(q.a)}`)
}

function situationBody(s) {
  if (!s?.text?.trim()) return null
  const out = []
  if (s.character?.trim()) out.push(`**${t('writing.situation.characterLabel')}:** ${inline(s.character)}`)
  const sit = situationText(s, t)
  if (sit) out.push(`**${t('writing.situation.situationLabel')}:** ${inline(sit)}`)
  out.push(paragraphs(s.text))
  return out
}

/** Draft id → { body, title key } of the novel practices that can save works. */
export const NOVEL_PRACTICES = {
  snowflake: { body: snowflakeBody, titleKey: 'writing.snowflake.title' },
  mosaic: { body: mosaicBody, titleKey: 'writing.mosaic.title' },
  'story-cards': { body: storyBody, titleKey: 'writing.story.title' },
  taboo: { body: tabooBody, titleKey: 'writing.taboo.title' },
  interview: { body: interviewBody, titleKey: 'writing.interview.title' },
  situation: { body: situationBody, titleKey: 'writing.situation.title' },
}

const dateOf = (at) => new Date(at).toLocaleDateString(settings.locale, { year: 'numeric', month: 'long', day: 'numeric' })

/** One saved work as a standalone Markdown document (copy button, print view). */
export function savedWorkMarkdown(kind, work) {
  const p = NOVEL_PRACTICES[kind]
  const sub = [t(p.titleKey), kind === 'story-cards' ? sourceLabel(work.data, t) : null, dateOf(work.at)].filter(Boolean).join(' · ')
  const body = p.body(work.data) || []
  return [`# ${inline(work.title) || t('writing.works.untitled')}`, `*${sub}*`, shiftHeadings(body.join('\n\n'), -1)].filter(Boolean).join('\n\n') + '\n'
}

/** A practice section of the export: the current work, then its saved works. */
function novelSection(d, kind, heading) {
  const p = NOVEL_PRACTICES[kind]
  const current = p.body(d[kind]?.data)
  const saved = (d[`${kind}-saved`]?.data?.works || []).map((w) =>
    [
      `### ${t('writing.works.savedLabel')}: ${inline(w.title) || t('writing.works.untitled')}`,
      `*${dateOf(w.at)}*`,
      shiftHeadings((p.body(w.data) || []).join('\n\n'), 1),
    ].filter(Boolean).join('\n\n'),
  )
  if (!current && !saved.length) return null
  return [heading, ...(current || []), ...saved].join('\n\n')
}

const snowflakeSection = (d) => novelSection(d, 'snowflake', `## ${t('writing.snowflake.title')}`)
const mosaicSection = (d) => novelSection(d, 'mosaic', `## ${t('writing.mosaic.title')}`)
const tabooSection = (d) => novelSection(d, 'taboo', `## ${t('writing.taboo.title')}`)
const interviewSection = (d) => novelSection(d, 'interview', `## ${t('writing.interview.title')}`)
const situationSection = (d) => novelSection(d, 'situation', `## ${t('writing.situation.title')}`)
function storySection(d) {
  const s = d['story-cards']?.data
  const title = s?.title?.trim() ? `: ${inline(s.title)} (${storyKind(s)})` : ''
  return novelSection(d, 'story-cards', `## ${t('writing.story.title')}${title}`)
}

function haikuSection(d) {
  const h = d.haiku?.data
  const poems = (h?.kept || []).filter((x) => x.lines?.some((l) => l.trim()))
  const draft = h?.lines?.some((l) => l.trim()) ? h.lines : null
  if (!poems.length && !draft) return null
  const all = [...poems.map((x) => x.lines), ...(draft ? [draft] : [])]
  return [`## ${t('writing.haiku.title')}`, all.map((ls) => lines(ls.join('\n'))).join('\n\n---\n\n')].join('\n\n')
}

/* ---------- whole document ---------- */

/** selection: { zineIds: string[], includeDrafts: boolean } */
export async function buildMarkdown({ zineIds = [], includeDrafts = true } = {}) {
  const date = new Date().toLocaleDateString(settings.locale, { year: 'numeric', month: 'long', day: 'numeric' })
  const parts = [`*${t('share.mdExported', { date })}*`]

  const ids = new Set(zineIds)
  const zines = (await listZines()).filter((z) => ids.has(z.id))
  for (const z of zines) parts.push(await zineSection(z))

  if (includeDrafts) {
    const d = Object.fromEntries((await getAllDrafts()).map((r) => [r.id, r]))
    const practices = [timedSection(d), haikuSection(d), cutupSection(d), snowflakeSection(d), mosaicSection(d), storySection(d), tabooSection(d), situationSection(d), interviewSection(d)].filter(Boolean)
    if (practices.length) parts.push(`# ${tl('writing.title')}\n\n${practices.join('\n\n')}`)
  }
  return parts.join('\n\n') + '\n'
}
