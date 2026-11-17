import { t, tl } from '../i18n'
import { settings } from '../composables/settings'
import { listZines, listPages } from '../db/zines'
import { getAllDrafts } from '../db/drafts'
import { cardText } from '../tarot'
import { CARD_BY_ID } from '../tarot/deck'
import { chapterTitle, chapterDesc } from '../composables/storyCards'

/*
 * Readable Markdown export of the user's zines and writing practices,
 * in the current language. Not meant to be imported back (that's the JSON backup).
 */

/* ---------- small Markdown helpers ---------- */

/** Escape characters that would turn plain user text into Markdown syntax at the start of a line. */
const escLine = (line) =>
  line
    .replace(/^(\s*)([#>+\-*])(\s)/, '$1\\$2$3') // "# x", "- x", "> x" → literal
    .replace(/^(\s*)(\d+)([.)])(\s)/, '$1$2\\$3$4') // "1. x" → "1\. x" (not a list)
const esc = (text) => (text || '').split('\n').map(escLine).join('\n')
/** Keep single line breaks (poems): two trailing spaces force a break in Markdown. */
const lines = (text) => esc(text.trim()).split('\n').map((l) => (l.trim() ? `${l}  ` : '')).join('\n').replace(/ +$/, '')
const paragraphs = (text) => esc(text.trim())
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

function timedSection(d) {
  const text = d['timed-poem']?.text?.trim()
  const cards = tarotList(d['timed-poem-cards']?.data?.cards)
  if (!text && !cards) return null
  return [`## ${t('writing.timed.title')}`, text && lines(text), cards].filter(Boolean).join('\n\n')
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
  if (!text && !poem && !cards) return null
  return [
    `## ${t('writing.cutup.title')}`,
    poem,
    text && `### ${t('share.mdOriginal')}\n\n${lines(text)}`,
    cards,
  ].filter(Boolean).join('\n\n')
}

function snowflakeSection(d) {
  const s = d.snowflake?.data
  if (!s || (!s.one?.trim() && !s.five?.some((x) => x.trim()) && !s.paras?.some((x) => x.trim()))) return null
  const steps = t('writing.snowflake.steps')
  const labels = t('writing.snowflake.s2Labels')
  const out = [`## ${t('writing.snowflake.title')}`]
  if (s.one?.trim()) out.push(quote(s.one))
  // bullets, not "1. 2. 5.": Markdown apps would renumber a gappy list
  const five = (s.five || []).map((x, i) => (x.trim() ? `- **${labels[i]}:** ${inline(x)}` : null)).filter(Boolean)
  if (five.length) out.push(`### ${steps[1]}\n\n${five.join('\n')}`)
  const paras = (s.paras || []).map((p, i) => p.trim() || s.five?.[i]?.trim() || '').filter(Boolean)
  if (paras.length) out.push(`### ${t('writing.snowflake.s4Title')}\n\n${paras.map(paragraphs).join('\n\n')}`)
  return out.join('\n\n')
}

function mosaicSection(d) {
  const m = d.mosaic?.data
  const tiles = (m?.tiles || []).filter((x) => x.text?.trim())
  if (!m || (!m.center?.trim() && !tiles.length)) return null
  const out = [`## ${t('writing.mosaic.title')}`]
  if (m.center?.trim()) out.push(quote(m.center))
  const parts = tiles.map((x, i) =>
    [`### ${x.who?.trim() ? inline(x.who) : t('writing.mosaic.untitledTile', { n: i + 1 })}`, lines(x.text)].join('\n\n'),
  )
  if (parts.length) out.push(parts.join('\n\n---\n\n'))
  return out.join('\n\n')
}

function storySection(d) {
  const s = d['story-cards']?.data
  if (!s?.chapters) return null
  const notes = (list) => list.filter((n) => n.text?.trim()).map((n) => `- ${inline(n.text)}`).join('\n')
  const chapters = s.chapters.filter((c) => c.enabled !== false)
  const hasContent =
    s.title?.trim() ||
    chapters.some((c) => c.notes?.length) ||
    s.characters?.length ||
    s.worlds?.length
  if (!hasContent) return null

  const kind = t(s.kind === 'film' ? 'writing.story.kindFilm' : 'writing.story.kindNovel')
  const out = [`## ${t('writing.story.title')}${s.title?.trim() ? `: ${inline(s.title)} (${kind})` : ''}`]
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
  return out.join('\n\n')
}

function haikuSection(d) {
  const h = d.haiku?.data
  const poems = (h?.kept || []).filter((x) => x.lines?.some((l) => l.trim()))
  const draft = h?.lines?.some((l) => l.trim()) ? h.lines : null
  if (!poems.length && !draft) return null
  const all = [...poems.map((x) => x.lines), ...(draft ? [draft] : [])]
  return [`## ${t('writing.haiku.title')}`, all.map((ls) => lines(ls.join('\n'))).join('\n\n---\n\n')].join('\n\n')
}

function tabooSection(d) {
  const s = d.taboo?.data
  if (!s || (!s.text?.trim() && !s.traits?.length)) return null
  const out = [`## ${t('writing.taboo.title')}`]
  if (s.situation?.trim()) out.push(`**${t('writing.taboo.situation')}:** ${inline(s.situation)}`)
  if (s.traits?.length) out.push(`**${t('writing.taboo.traitsWere')}:** ${s.traits.map(inline).join(', ')}`)
  if (s.text?.trim()) out.push(paragraphs(s.text))
  return out.join('\n\n')
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
    const practices = [timedSection(d), haikuSection(d), cutupSection(d), snowflakeSection(d), mosaicSection(d), storySection(d), tabooSection(d)].filter(Boolean)
    if (practices.length) parts.push(`# ${tl('writing.title')}\n\n${practices.join('\n\n')}`)
  }
  return parts.join('\n\n') + '\n'
}
