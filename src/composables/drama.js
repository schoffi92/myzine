import { analyzeLine, lineValues, checkLine } from '../writing/meter'
import { rhymeOf, compareRhymes } from '../writing/rhyme'

/*
 * Shakespearean drama practice: a writing guide in small parts (as in Game
 * dialogue). The writer builds a scene block by block, speeches in blank
 * verse (iambic pentameter, checked with writing/meter.js) or prose.
 *
 * A work is { part, practice: scene, own: scene }: parts 0–7 write
 * `practice`, part 8 (write your own) writes `own`. A scene is
 *   { title, promptKey, ownPrompt, genre, cast: [{ id, name, desc, rank }], blocks }
 * and a block { id, kind, text } (verse blocks also { marks, counts }, as in
 * the Iamb and trochee practice). One verse block is one line of verse.
 * Premises are stored by key (texts in i18n: writing.drama.prompts.<key>).
 */

export const KINDS = ['heading', 'location', 'direction', 'speaker', 'verse', 'prose']
export const GENRES = ['tragedy', 'comedy']
export const RANKS = ['high', 'low']
export const PROMPTS = ['crown', 'letter', 'disguise', 'feud', 'ghost', 'ring', 'storm', 'exile', 'wager', 'poison']
export const MAX_CAST = 6
/** Blank verse: iambic pentameter. */
export const RHYTHM = 'iamb'
export const FEET = 5

let seq = 0
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
export const newBlock = (kind = 'speaker', text = '') => (kind === 'verse' ? { id: uid('b'), kind, text, marks: {}, counts: {} } : { id: uid('b'), kind, text })
export const newMember = (name = '', desc = '', rank = 'high') => ({ id: uid('c'), name, desc, rank })
export const blankScene = () => ({ title: '', promptKey: null, ownPrompt: '', genre: null, cast: [newMember(), newMember()], blocks: [newBlock('heading')] })

const str = (v) => (typeof v === 'string' ? v : '')
const plainObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {})

/** Blocks from storage (drops unknown kinds, keeps at least one). */
export function cleanBlocks(list) {
  const out = (Array.isArray(list) ? list : [])
    .filter((b) => b && KINDS.includes(b.kind))
    .map((b) => {
      const nb = newBlock(b.kind, str(b.text))
      if (typeof b.id === 'string' && b.id) nb.id = b.id
      if (b.kind === 'verse') Object.assign(nb, { marks: plainObject(b.marks), counts: plainObject(b.counts) })
      return nb
    })
  return out.length ? out : [newBlock('heading')]
}

/** A scene from storage (old or foreign data is evened out). */
export function cleanScene(s) {
  const cast = (Array.isArray(s?.cast) ? s.cast : []).filter((c) => c && typeof c === 'object').slice(0, MAX_CAST).map((c) => ({
    id: typeof c.id === 'string' && c.id ? c.id : uid('c'),
    name: str(c.name),
    desc: str(c.desc),
    rank: RANKS.includes(c.rank) ? c.rank : 'high',
  }))
  return {
    title: str(s?.title),
    promptKey: PROMPTS.includes(s?.promptKey) ? s.promptKey : null,
    ownPrompt: str(s?.ownPrompt),
    genre: GENRES.includes(s?.genre) ? s.genre : null,
    cast: cast.length ? cast : [newMember(), newMember()],
    blocks: cleanBlocks(s?.blocks),
  }
}

/** The premise (built-in by key, or the writer's own). */
export const promptText = (s, t) => (PROMPTS.includes(s?.promptKey) ? t(`writing.drama.prompts.${s.promptKey}`) : s?.ownPrompt?.trim() || '')

export const hasScene = (s) => Array.isArray(s?.blocks) && s.blocks.some((b) => b?.text?.trim())

/* ---------- stage directions ---------- */

const W = (w) => `(?<![\\p{L}])(?:${w})(?![\\p{L}])`
const re = (src) => new RegExp(src, 'iu')
/** Words that mark an entrance, an exit, everyone leaving and an aside, per language (English works everywhere). */
const CUE_WORDS = {
  en: { exeunt: W('exeunt|all exit'), exit: W('exit|exits'), enter: W('enter|enters|re-enter'), aside: W('aside') },
  de: { exeunt: W('alle ab|alle gehen ab'), exit: W('ab|geht ab|gehen ab|abgang'), enter: W('tritt auf|treten auf|auftritt|kommt|kommen'), aside: W('beiseite|für sich') },
  es: { exeunt: W('salen todos|vanse|mutis general|salen'), exit: W('sale|vase|mutis'), enter: W('entra|entran'), aside: W('aparte') },
  fr: { exeunt: W('ils sortent|tous sortent|sortent tous|sortent'), exit: W('sort|sortie'), enter: W('entre|entrent'), aside: W('à part|a part') },
  hu: { exeunt: W('mind el|el mind|mindnyájan el|mindenki el|el mindannyian'), exit: W('el|kimegy|elmegy|kimennek|elmennek'), enter: W('bejön|bejönnek|belép|belépnek|jön|jönnek'), aside: W('félre|magában') },
  pl: { exeunt: W('wszyscy wychodzą|wychodzą wszyscy'), exit: W('wychodzi|wychodzą'), enter: W('wchodzi|wchodzą'), aside: W('na stronie|na stronę|do siebie') },
}
const CUE_ORDER = ['exeunt', 'aside', 'exit', 'enter']
const cueCache = {}
function cueRes(locale) {
  if (!cueCache[locale]) {
    const own = CUE_WORDS[locale] || {}
    cueCache[locale] = Object.fromEntries(CUE_ORDER.map((k) => [k, re([CUE_WORDS.en[k], own[k]].filter(Boolean).join('|'))]))
  }
  return cueCache[locale]
}

/** What a stage direction does: 'exeunt' | 'aside' | 'exit' | 'enter' | null. */
export function cueOf(text, locale) {
  const res = cueRes(locale)
  return CUE_ORDER.find((k) => res[k].test(text || '')) || null
}

const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cast names (as written in the cast list) found in a text. */
export function namesIn(text, cast) {
  return cast.map((c) => c.name.trim()).filter((n) => n && re(W(escapeRe(n))).test(text || ''))
}

/* ---------- reading a scene ---------- */

/**
 * The scene as items:
 *   { type: 'heading' | 'location' | 'direction', block, cue }
 *   { type: 'speech', speaker, block, items: [{ type: 'verse' | 'prose' | 'direction', block, cue }] }
 *   { type: 'stray', block }: a line with no speaker before it
 * A direction between two lines of one speech stays in the speech; an aside
 * right after the speaker's name too.
 */
export function readScene(blocks, locale) {
  const list = (blocks || []).filter((b) => b?.text?.trim())
  const out = []
  let speech = null
  list.forEach((b, i) => {
    if (b.kind === 'speaker') {
      speech = { type: 'speech', speaker: b.text.trim(), block: b, items: [] }
      out.push(speech)
    } else if (b.kind === 'verse' || b.kind === 'prose') {
      if (speech) speech.items.push({ type: b.kind, block: b })
      else out.push({ type: 'stray', block: b })
    } else if (b.kind === 'direction') {
      const cue = cueOf(b.text, locale)
      const next = list[i + 1]
      if (speech && (next?.kind === 'verse' || next?.kind === 'prose')) speech.items.push({ type: 'direction', block: b, cue })
      else {
        speech = null
        out.push({ type: 'direction', block: b, cue })
      }
    } else {
      speech = null
      out.push({ type: b.kind, block: b })
    }
  })
  return out
}

const linesOf = (sp, type) => sp.items.filter((x) => x.type === type)

/** One verse line as rhythm values (see writing/meter.js). */
const valuesOf = (b, locale) => lineValues(analyzeLine(b.text, locale, b.marks, b.counts))

/**
 * The meter check of every verse line: blockId → { check, offset, shared }.
 * A short line at the end of one speech and a short line at the start of the
 * next that together make a pentameter are a shared line: both halves are
 * checked as one line (`offset` is where the second half starts).
 */
export function verseChecks(items, locale) {
  const out = {}
  const speeches = items.map((x, i) => ({ x, i })).filter(({ x }) => x.type === 'speech')
  for (const { x } of speeches)
    for (const l of linesOf(x, 'verse')) {
      const vals = valuesOf(l.block, locale)
      out[l.block.id] = { vals, check: checkLine(vals, RHYTHM, FEET, locale), offset: 0, shared: null }
    }
  const full = FEET * 2
  for (let k = 1; k < speeches.length; k++) {
    const a = speeches[k - 1]
    const b = speeches[k]
    // only directions may stand between the two speeches
    if (items.slice(a.i + 1, b.i).some((x) => x.type !== 'direction')) continue
    const last = a.x.items.at(-1)
    const first = b.x.items[0]
    if (last?.type !== 'verse' || first?.type !== 'verse') continue
    const A = out[last.block.id]
    const B = out[first.block.id]
    if (A.shared || A.vals.length >= full || B.vals.length >= full) continue
    const n = A.vals.length + B.vals.length
    if (n < full || n > full + 1) continue
    const check = checkLine([...A.vals, ...B.vals], RHYTHM, FEET, locale)
    Object.assign(A, { check, shared: 'first' })
    Object.assign(B, { check, offset: A.vals.length, shared: 'second' })
  }
  return out
}

/**
 * Mark the stress of a loaded example line where the language has no stress
 * rule (English, French: every syllable of a longer word starts unstressed),
 * following the iambs, so a finished example doesn't show as wrong.
 */
export function fitMarks(b, locale) {
  if (b.kind !== 'verse' || !['en', 'fr'].includes(locale)) return b
  const words = analyzeLine(b.text, locale, b.marks, b.counts)
  const n = lineValues(words).length
  if (n < FEET * 2 || n > FEET * 2 + 1) return b
  for (const w of words) if (w.slots.length >= 2) for (const s of w.slots) if (!s.set) b.marks[s.key] = s.pos % 2 ? 'S' : 'u'
  return b
}

/** Do two verse lines rhyme? 'rhyme' | 'near' | 'no' | 'same' | 'empty' (a spelling guess, see writing/rhyme.js). */
export const rhymeStatus = (a, b, locale) => compareRhymes(rhymeOf(a, locale), rhymeOf(b, locale))

/**
 * Facts about a scene, for the done ticks, the goals and the hints:
 * counts, the longest stichomythia, soliloquies and asides (from who is on
 * stage: Enter adds the named characters, Exit takes them off, Exeunt clears).
 */
export function facts(scene, locale) {
  const cast = (scene?.cast || []).filter((c) => c.name.trim())
  const items = readScene(scene?.blocks, locale)
  const checks = verseChecks(items, locale)
  const castOf = (name) => cast.find((c) => norm(c.name) === norm(name))
  const f = {
    items,
    checks,
    cast: cast.length,
    castDescribed: cast.length > 0 && cast.every((c) => c.desc.trim()),
    heading: items.some((x) => x.type === 'heading'),
    location: items.some((x) => x.type === 'location'),
    enters: 0,
    speeches: 0,
    verseLines: 0,
    verseOk: 0,
    verseSpeeches: 0,
    proseSpeeches: 0,
    soliloquy: false,
    longestAlone: 0,
    aside: false,
    stichomythia: 0,
    couplet: null, // { a, b, status } of the last two verse lines
    exitAtEnd: false,
    hints: [],
  }
  const hint = (key, level, part, block, params = {}) => f.hints.push({ key, level, part, blockId: block?.id, params })

  const onStage = new Set()
  const tracking = items.some((x) => (x.type === 'direction' || x.type === 'speech') && (x.cue === 'enter' || x.items?.some((y) => y.cue === 'enter')))
  let run = 0
  let runPrev = null
  let lastSpeaker = null
  const direction = (x) => {
    const names = namesIn(x.block.text, cast).map(norm)
    if (x.cue === 'enter') {
      names.forEach((n) => onStage.add(n))
      f.enters++
    } else if (x.cue === 'exit') {
      const who = names.length ? names : lastSpeaker ? [lastSpeaker] : []
      for (const n of who) {
        if (tracking && !onStage.has(n)) hint('exitAbsent', 'warn', 2, x.block, { name: cast.find((c) => norm(c.name) === n)?.name || n })
        onStage.delete(n)
      }
    } else if (x.cue === 'exeunt') {
      if (names.length) names.forEach((n) => onStage.delete(n))
      else onStage.clear()
    }
  }

  for (const x of items) {
    if (x.type === 'stray' || x.type === 'heading' || x.type === 'location') {
      if (x.type === 'stray') hint('noSpeaker', 'error', 2, x.block)
      run = 0
      runPrev = null
      continue
    }
    if (x.type === 'direction') {
      direction(x)
      continue
    }
    // a speech
    f.speeches++
    const who = norm(x.speaker)
    const member = castOf(x.speaker)
    lastSpeaker = who
    if (cast.length && !member) hint('unknownSpeaker', 'warn', 2, x.block, { name: x.speaker })
    if (tracking && !onStage.has(who)) {
      hint('notOnStage', 'warn', 2, x.block, { name: member?.name || x.speaker })
      onStage.add(who) // say it once
    }
    const verse = linesOf(x, 'verse')
    const prose = linesOf(x, 'prose')
    if (!verse.length && !prose.length) hint('emptySpeech', 'warn', 2, x.block, { name: x.speaker })
    if (verse.length && !prose.length) f.verseSpeeches++
    if (prose.length && !verse.length) f.proseSpeeches++
    if (verse.length && member?.rank === 'low') hint('lowVerse', 'info', 4, x.block, { name: member.name })
    f.verseLines += verse.length
    f.verseOk += verse.filter((l) => checks[l.block.id]?.check?.ok).length
    if (x.items.some((y) => y.cue === 'aside')) f.aside = true
    // alone on stage (nobody else on), counted in verse lines
    const alone = tracking && [...onStage].every((n) => n === who)
    if (alone) f.longestAlone = Math.max(f.longestAlone, verse.length)
    if (alone && verse.length >= 6) f.soliloquy = true
    // stichomythia: one verse line each, the speakers taking turns
    const single = verse.length === 1 && !prose.length
    run = single ? (runPrev !== null && who !== runPrev ? run + 1 : 1) : 0
    runPrev = single ? who : null
    f.stichomythia = Math.max(f.stichomythia, run)
    x.items.filter((y) => y.type === 'direction').forEach(direction)
  }

  const off = f.verseLines - f.verseOk
  if (off) hint('verseOff', 'info', 3, null, { n: off, total: f.verseLines })

  // the exit couplet: the last two verse lines rhyme, and an exit follows them
  const verseItems = items.filter((x) => x.type === 'speech').flatMap((x) => linesOf(x, 'verse').map((l) => l.block))
  if (verseItems.length >= 2) {
    const [a, b] = verseItems.slice(-2)
    f.couplet = { a: a.text, b: b.text, status: rhymeStatus(a.text, b.text, locale) }
  }
  const lastSpeech = items.map((x) => x.type).lastIndexOf('speech')
  const after = lastSpeech >= 0 ? items.slice(lastSpeech + 1) : []
  const lastInSpeech = lastSpeech >= 0 ? items[lastSpeech].items.at(-1) : null
  f.exitAtEnd = after.some((x) => x.cue === 'exit' || x.cue === 'exeunt') || lastInSpeech?.cue === 'exit' || lastInSpeech?.cue === 'exeunt'
  if (f.speeches >= 4 && !f.exitAtEnd) hint('noExit', 'info', 7, null)
  return f
}

export const coupletRhymes = (f) => f.couplet?.status === 'rhyme' || f.couplet?.status === 'near'

/* ---------- the guide ---------- */

/**
 * Parts of the writing guide. `kinds` are the block kinds it adds (on top of
 * the earlier parts'), `cues` the direction chips; `done` ticks it.
 * Texts: writing.drama.parts[i].
 */
export const PARTS = [
  { id: 0, kinds: [], cues: [], done: (s, f, t) => !!promptText(s, t) && !!s.genre },
  { id: 1, kinds: [], cues: [], done: (s, f) => f.cast >= 2 && f.castDescribed },
  { id: 2, kinds: ['heading', 'location', 'direction', 'speaker', 'prose'], cues: ['enter', 'exit', 'exeunt'], done: (s, f) => f.heading && f.enters >= 1 && f.speeches >= 4 },
  { id: 3, kinds: ['verse'], cues: [], done: (s, f) => f.verseOk >= 4 },
  { id: 4, kinds: [], cues: [], done: (s, f) => f.verseSpeeches >= 1 && f.proseSpeeches >= 1 },
  { id: 5, kinds: [], cues: ['aside'], done: (s, f) => f.soliloquy && f.aside },
  { id: 6, kinds: [], cues: [], done: (s, f) => f.stichomythia >= 4 },
  { id: 7, kinds: [], cues: [], done: (s, f) => coupletRhymes(f) && f.exitAtEnd },
  { id: 8, kinds: [], cues: [], done: (s, f, t) => OWN_GOALS.every((g) => g.done(f, s, t)) },
]
export const OWN = 8
export const LAST_GUIDED = 7

/** Block kinds and direction chips available in a part (part 8 has them all). */
export const kindsFor = (part) => KINDS.filter((k) => PARTS.slice(0, Math.min(part, LAST_GUIDED) + 1).some((p) => p.kinds.includes(k)))
export const cuesFor = (part) => PARTS.slice(0, Math.min(part, LAST_GUIDED) + 1).flatMap((p) => p.cues)

/** What the page shows from which part on. */
export const UNLOCK = { editor: 2, meter: 3 }

/** Goals of part 8, ticked from the writer's own scene. Texts: writing.drama.ownGoals.<key>. */
export const OWN_GOALS = [
  { key: 'premise', done: (f, s, t) => !!promptText(s, t) && !!s.genre },
  { key: 'cast', done: (f) => f.cast >= 2 && f.castDescribed },
  { key: 'opening', done: (f) => f.heading && f.location && f.enters >= 1 },
  { key: 'verse', done: (f) => f.verseLines >= 10 && f.verseOk >= f.verseLines * 0.8 },
  { key: 'prose', done: (f) => f.proseSpeeches >= 1 },
  { key: 'inner', done: (f) => f.soliloquy || f.aside },
  { key: 'stichomythia', done: (f) => f.stichomythia >= 4 },
  { key: 'couplet', done: (f) => coupletRhymes(f) && f.exitAtEnd },
]

/** Hints to show in a part: errors always, the rest once the part has taught them. */
export const hintsFor = (hints, part) => hints.filter((h) => h.level === 'error' || h.part <= part)

/** Where Enter goes from each kind (a speaker goes on in verse or prose by rank). */
export const NEXT = { heading: 'location', location: 'direction', direction: 'speaker', speaker: 'verse', verse: 'verse', prose: 'speaker' }

/* ---------- plain text ---------- */

/**
 * The scene as text, laid out as in a printed play: cast list, heading and
 * place, directions indented, the speaker's name in capitals, verse line by
 * line, prose as a paragraph.
 */
export function scenePlainText(scene, t, locale) {
  const out = []
  const cast = (scene?.cast || []).filter((c) => c.name.trim())
  if (cast.length) {
    out.push(t('writing.drama.personae').toUpperCase())
    cast.forEach((c) => out.push(`${c.name.trim().toUpperCase()}${c.desc.trim() ? `, ${c.desc.trim()}` : ''}`))
    out.push('')
  }
  const items = readScene(scene?.blocks, locale)
  const checks = verseChecks(items, locale)
  let pad = 0 // width of the first half of a shared line
  for (const x of items) {
    if (x.type === 'heading') out.push('', x.block.text.trim().toUpperCase())
    else if (x.type === 'location') out.push(x.block.text.trim())
    else if (x.type === 'direction') out.push('', `        ${x.block.text.trim()}`)
    else if (x.type === 'stray') out.push(`    ${x.block.text.trim()}`)
    else {
      out.push('', x.speaker.toUpperCase())
      for (const y of x.items) {
        const text = y.block.text.trim()
        if (y.type === 'direction') out.push(`        [${text.replace(/^\[|\]$/g, '')}]`)
        else if (y.type === 'prose') out.push(...text.split('\n').map((l) => `    ${l.trim()}`))
        else {
          const c = checks[y.block.id]
          out.push(`    ${c?.shared === 'second' ? ' '.repeat(pad) : ''}${text}`)
          pad = c?.shared === 'first' ? text.length + 1 : 0
        }
      }
    }
  }
  return out.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n')
}

/** A file-safe name for the scene. */
export const fileName = (title) => `${(title || 'scene').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'scene'}.txt`
