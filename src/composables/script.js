/*
 * Screenplay practice: the elements of a script and how they lay out on the page.
 * No Vue here: pure functions used by the page, the preview and the Markdown export.
 *
 * A work is { title, promptKey, ownPrompt, blocks: [{ id, kind, text }], step }.
 * Scene premises are stored by key (texts in i18n: writing.script.prompts.<key>)
 * so a picked one follows the language; the writer's own is stored as text.
 *
 * The page grid is the US screenplay standard in Courier 12 pt: 10 characters
 * per inch, 6 lines per inch. On an 8.5×11" page with 1.5" left and 1" right
 * margins the text is 60 characters wide; with 1" top and bottom margins a page
 * holds 54 lines. One full page is about one minute of screen time.
 */

export const KINDS = ['scene', 'action', 'character', 'paren', 'dialogue', 'transition']

/** What Enter creates after a block of this kind. */
export const NEXT = { scene: 'action', action: 'action', character: 'dialogue', paren: 'dialogue', dialogue: 'character', transition: 'scene' }

export const PROMPTS = ['diner', 'interview', 'wallet', 'breakdown', 'house', 'wrongNumber', 'proposal', 'wrongFlat', 'newBoss', 'lastBus']

/** The premise of a work (built-in by key, or the writer's own). */
export const promptText = (s, t) => (PROMPTS.includes(s?.promptKey) ? t(`writing.script.prompts.${s.promptKey}`) : s?.ownPrompt?.trim() || '')

/** A random premise key other than the current one. */
export function drawPromptKey(current) {
  const pool = PROMPTS.filter((k) => k !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

let seq = 0
export const newBlock = (kind = 'action', text = '') => ({ id: `b${Date.now().toString(36)}${(seq++).toString(36)}`, kind, text })

/** Blocks read from storage: anything malformed is dropped. */
export function cleanBlocks(list) {
  const out = (Array.isArray(list) ? list : [])
    .filter((b) => b && KINDS.includes(b.kind) && typeof b.text === 'string')
    .map((b) => ({ id: typeof b.id === 'string' && b.id ? b.id : newBlock().id, kind: b.kind, text: b.text }))
  return out.length ? out : [newBlock('scene')]
}

/* ---------- page grid (in characters from the left margin, 1 char = 0.1") ---------- */

export const PAGE_LINES = 54
const WIDTH = 60
// indent and width of each element; the transition is right-aligned
const GRID = {
  scene: { indent: 0, width: 60, before: 2 },
  action: { indent: 0, width: 60, before: 1 },
  character: { indent: 22, width: 38, before: 1 },
  paren: { indent: 16, width: 25, before: 0 },
  dialogue: { indent: 10, width: 35, before: 0 },
  transition: { indent: 0, width: 20, before: 1 },
}
export const INDENTS = Object.fromEntries(Object.entries(GRID).map(([k, g]) => [k, g.indent]))

/** Word-wrap text to `width` characters; hard-breaks words longer than a line. */
export function wrap(text, width) {
  const out = []
  for (const para of text.split('\n')) {
    let line = ''
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > width) {
        if (line) out.push(line), (line = '')
        out.push(word.slice(0, width))
        word = word.slice(width)
      }
      if (!line) line = word
      else if (line.length + 1 + word.length <= width) line += ` ${word}`
      else out.push(line), (line = word)
    }
    out.push(line)
  }
  // drop empty lines at the ends (a trailing Enter in an action block)
  while (out.length > 1 && !out[out.length - 1]) out.pop()
  while (out.length > 1 && !out[0]) out.shift()
  return out
}

/** A character name without extensions: "anna (v.o.)" → "ANNA". */
export const speaker = (text) => text.replace(/\([^)]*\)/g, '').trim().toUpperCase()

const withParens = (text) => {
  const s = text.trim()
  return `${s.startsWith('(') ? '' : '('}${s}${s.endsWith(')') ? '' : ')'}`
}

/** Text as it is printed: some elements are always in capitals. */
export function printed(kind, text) {
  const s = text.trim()
  if (kind === 'scene' || kind === 'character' || kind === 'transition') return s.toUpperCase()
  if (kind === 'paren') return withParens(s)
  return s
}

const line = (kind, text, indent) => ({ kind, text, indent })

function elementLines(kind, text) {
  const g = GRID[kind]
  return wrap(printed(kind, text), g.width).map((l) => {
    if (kind !== 'transition') return line(kind, l, g.indent)
    // FADE IN: opens the script at the left margin; other transitions sit on the right
    return line(kind, l, /^FADE IN/.test(l) ? 0 : WIDTH - l.length)
  })
}

/**
 * Blocks → chunks: a scene heading, an action paragraph, a transition, or a
 * speech (character + parentheticals + dialogue), each with the blank lines
 * before it. A character who speaks again after only action gets (CONT'D).
 */
function chunks(blocks) {
  const out = []
  let lastSpeaker = null
  let speech = null
  for (const b of blocks) {
    if (!b.text.trim()) continue
    if (b.kind === 'character') {
      let text = b.text
      const name = speaker(text)
      if (name && name === lastSpeaker && !/CONT['’]?D/i.test(text)) text = `${text.trim()} (CONT'D)`
      lastSpeaker = name
      speech = { kind: 'speech', name: printed('character', text), before: 1, lines: elementLines('character', text) }
      out.push(speech)
    } else if (b.kind === 'paren' || b.kind === 'dialogue') {
      if (!speech) {
        // dialogue with nobody speaking: laid out as a speech without a name
        speech = { kind: 'orphan', before: 1, lines: [] }
        out.push(speech)
      }
      speech.lines.push(...elementLines(b.kind, b.text))
    } else {
      speech = null
      if (b.kind === 'scene') lastSpeaker = null
      out.push({ kind: b.kind, before: GRID[b.kind].before, lines: elementLines(b.kind, b.text) })
    }
  }
  return out
}

/** How many lines of a chunk may stay on a page with `room` lines left (0: move it all). */
function splitCount(c, room) {
  const n = c.lines.length
  if (c.kind === 'action' || c.kind === 'orphan') {
    const keep = Math.min(room, n - 2) // at least 2 lines on each side
    return keep >= 2 ? keep : 0
  }
  if (c.kind === 'speech') {
    let keep = Math.min(room - 1, n - 1) // one line for (MORE); at least one line goes on
    while (keep > 0 && c.lines[keep - 1].kind === 'paren') keep-- // never end on a parenthetical
    return keep >= 3 ? keep : 0 // the name and at least 2 lines of dialogue
  }
  return 0
}

/**
 * Lay the blocks out on screenplay pages: [[{ kind, text, indent }]].
 * Blank lines have kind 'blank'. A scene heading is never left at the bottom
 * of a page; a speech split across pages gets (MORE) and (CONT'D).
 */
export function layoutScript(blocks) {
  const list = chunks(blocks || [])
  const pages = [[]]
  let page = pages[0]
  const newPage = () => pages.push((page = []))
  const blanks = (n) => {
    for (let k = 0; k < n; k++) page.push(line('blank', '', 0))
  }

  list.forEach((c, i) => {
    if (c.kind === 'scene' && page.length) {
      const next = list[i + 1]
      const need = c.before + c.lines.length + (next ? next.before + Math.min(2, next.lines.length) : 0)
      if (need > PAGE_LINES - page.length) newPage()
    }
    let lines = c.lines
    let first = true
    for (;;) {
      const gap = first && page.length ? c.before : 0
      const room = PAGE_LINES - page.length - gap
      if (lines.length <= room) {
        blanks(gap)
        page.push(...lines)
        break
      }
      const keep = splitCount({ ...c, lines }, room)
      if (keep) {
        blanks(gap)
        page.push(...lines.slice(0, keep))
        if (c.kind === 'speech') page.push(line('more', '(MORE)', GRID.character.indent))
        newPage()
        const rest = lines.slice(keep)
        lines = c.kind === 'speech' ? [line('character', `${c.name.replace(/\s*\(CONT['’]?D\)/i, '')} (CONT'D)`, GRID.character.indent), ...rest] : rest
      } else if (!page.length) {
        page.push(...lines) // longer than a page and can't be split: let it run over
        break
      } else newPage()
      first = false
    }
  })
  return pages
}

/** Pages of screen time, to a tenth: full pages plus the share of the last one. */
export function estimate(pages) {
  const used = pages[pages.length - 1].length
  if (pages.length === 1 && !used) return 0
  return Math.round(((pages.length - 1) + used / PAGE_LINES) * 10) / 10
}

/** The layout as plain monospaced text (copy, Markdown export, print). */
export function scriptPlainText(blocks) {
  return layoutScript(blocks)
    .map((p) => p.map((l) => `${' '.repeat(l.indent)}${l.text}`.trimEnd()).join('\n'))
    .join('\n\n')
    .trim()
}

export const hasScript = (blocks) => Array.isArray(blocks) && blocks.some((b) => b?.text?.trim())

/* ---------- scene heading helpers ---------- */

const PREFIX_RE = /^\s*(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\/E\.?|INT\.?|EXT\.?)(\s+|$)/i
const TIME_RE = /\s+[-–—]\s*([^-–—]*)$/

/** Put INT. / EXT. / INT./EXT. at the start of a heading, replacing any there. */
export const setPrefix = (text, prefix) => `${prefix} ${text.replace(PREFIX_RE, '').trimStart()}`.replace(/\s+$/, ' ')

/** Put the time of day at the end of a heading, replacing any there. */
export const setTime = (text, time) => `${text.replace(TIME_RE, '').trimEnd()} - ${time}`

/* ---------- gentle checks ---------- */

const shortText = (s, n = 30) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

/**
 * Hints about the form of the script: [{ key, params }], key under
 * writing.script.checks. Only form, never taste.
 */
export function checks(blocks) {
  const list = (blocks || []).filter((b) => b.text.trim())
  const out = []
  const firstReal = list.find((b) => !(b.kind === 'transition' && /^FADE IN/i.test(b.text.trim())))
  if (firstReal && firstReal.kind !== 'scene') out.push({ key: 'noScene' })

  const names = new Set(list.filter((b) => b.kind === 'character').map((b) => speaker(b.text)).filter(Boolean))
  const introduced = new Set()

  list.forEach((b, i) => {
    const text = b.text.trim()
    const next = list[i + 1]
    const prev = list[i - 1]
    if (b.kind === 'scene') {
      if (!PREFIX_RE.test(text)) out.push({ key: 'scenePrefix', params: { text: shortText(text) } })
      if (!TIME_RE.test(text)) out.push({ key: 'sceneTime', params: { text: shortText(text) } })
    } else if (b.kind === 'character') {
      introduced.add(speaker(text))
      if (!next || (next.kind !== 'dialogue' && next.kind !== 'paren')) out.push({ key: 'charNoDialogue', params: { name: speaker(text) } })
    } else if (b.kind === 'paren' || b.kind === 'dialogue') {
      if (!prev || !['character', 'paren', 'dialogue'].includes(prev.kind)) out.push({ key: 'noSpeaker', params: { text: shortText(text) } })
      if (b.kind === 'paren' && text.replace(/[()]/g, '').trim().split(/\s+/).length > 5) out.push({ key: 'longParen', params: { text: shortText(text) } })
    } else if (b.kind === 'action') {
      if (wrap(text, WIDTH).length > 4) out.push({ key: 'longAction', params: { text: shortText(text) } })
      // the first time a speaking character appears in action, the name is in CAPS
      for (const name of names) {
        if (introduced.has(name) || name.length < 2) continue
        const m = new RegExp(`(^|[^\\p{L}])(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}])`, 'iu').exec(text)
        if (!m) continue
        introduced.add(name)
        if (m[2] !== m[2].toUpperCase()) out.push({ key: 'nameCaps', params: { name } })
      }
    }
  })
  return out
}
