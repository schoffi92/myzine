import { walk, edges, variables, checkYarn, exprVars } from '../writing/yarn'

/*
 * Game dialogue practice (Yarn Spinner): premises, the parts of the writing
 * guide and what each one unlocks, and the checks that tick a part as done.
 *
 * A work is { title, promptKey, ownPrompt, source, part,
 *             ownTitle, ownPromptKey, ownOwnPrompt, ownSource }:
 * parts 1–5 write `source`, part 6 (write your own) writes `ownSource`.
 * Premises are stored by key (texts in i18n: writing.game.prompts.<key>).
 */

export const PROMPTS = ['gate', 'merchant', 'innkeeper', 'suspect', 'ghost', 'robot', 'recruit', 'witch', 'captain', 'rival']

/** The premise (built-in by key, or the writer's own). `own` picks the part 6 fields. */
export function promptText(s, t, own = false) {
  const key = own ? s?.ownPromptKey : s?.promptKey
  const text = own ? s?.ownOwnPrompt : s?.ownPrompt
  return PROMPTS.includes(key) ? t(`writing.game.prompts.${key}`) : text?.trim() || ''
}

/** A random premise key other than the current one. */
export function drawPromptKey(current) {
  const pool = PROMPTS.filter((k) => k !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

/* ---------- facts about a parsed script ---------- */

export function facts(parsed) {
  const f = { nodes: 0, lines: 0, maxNodeLines: 0, optionGroups: 0, maxOptions: 0, sets: 0, conditions: 0, stops: 0, jumps: 0 }
  f.nodes = parsed.nodes.filter((n) => n.title).length
  for (const n of parsed.nodes) {
    let nodeLines = 0
    walk(n.body, (s) => {
      if (s.type === 'line') f.lines++, nodeLines++
      if (s.type === 'options') {
        f.optionGroups++
        f.maxOptions = Math.max(f.maxOptions, s.options.length)
        f.conditions += s.options.filter((o) => o.cond).length
      }
      if (s.type === 'set') f.sets++
      if (s.type === 'if') f.conditions++
      if (s.type === 'stop') f.stops++
      if (s.type === 'jump') f.jumps++
    })
    f.maxNodeLines = Math.max(f.maxNodeLines, nodeLines)
  }
  const es = edges(parsed)
  f.goodJumps = es.filter((e) => !e.missing && e.to !== e.from).length
  f.missing = es.filter((e) => e.missing).length
  // a hub: a node that two or more different jumps lead to
  const incoming = {}
  es.filter((e) => !e.missing).forEach((e) => (incoming[e.to] = (incoming[e.to] || 0) + 1))
  f.hub = Object.values(incoming).some((n) => n >= 2)
  // a variable that's set and also read somewhere (it changes something)
  f.usefulVar = Object.values(variables(parsed)).some((x) => x.set && x.used)
  f.errors = checkYarn(parsed).filter((c) => c.level === 'error').length
  // a way to end: <<stop>>, or a node with no jumps out
  f.ending = f.stops > 0 || parsed.nodes.some((n) => n.title && !es.some((e) => e.from === n.title))
  return f
}

/* ---------- the guide ---------- */

/**
 * Parts of the writing guide. `tools` are the insert buttons it adds (on top of
 * the earlier parts'), `done` ticks it. Texts: writing.game.parts[i].
 */
export const PARTS = [
  { id: 0, tools: [], done: (s, f, t) => !!promptText(s, t) },
  { id: 1, tools: ['node', 'line'], done: (s, f) => f.nodes >= 1 && f.maxNodeLines >= 2 && !f.errors },
  { id: 2, tools: ['option', 'jump', 'stop'], done: (s, f) => f.maxOptions >= 2 && f.goodJumps >= 1 },
  { id: 3, tools: ['set'], done: (s, f) => f.sets >= 1 },
  { id: 4, tools: ['if'], done: (s, f) => f.conditions >= 1 },
  { id: 5, tools: [], done: (s, f) => f.hub && !f.missing && !f.errors },
  { id: 6, tools: [], done: (s, f) => OWN_GOALS.every((g) => g.done(f)) },
]
export const OWN = 6
export const LAST_GUIDED = 5

/** Insert buttons available in a part (part 6 has them all). */
export const toolsFor = (part) => PARTS.slice(0, part + 1).flatMap((p) => p.tools)

/** What the page shows from which part on. */
export const UNLOCK = { editor: 1, play: 1, map: 2, vars: 3, download: 5 }

/** Goals of part 6, ticked from the writer's own script. Texts: writing.game.ownGoals.<key>. */
export const OWN_GOALS = [
  { key: 'nodes', done: (f) => f.nodes >= 4 },
  { key: 'choices', done: (f) => f.optionGroups >= 2 },
  { key: 'variable', done: (f) => f.usefulVar },
  { key: 'condition', done: (f) => f.conditions >= 1 },
  { key: 'hub', done: (f) => f.hub },
  { key: 'ending', done: (f) => f.ending },
  { key: 'noErrors', done: (f) => f.nodes > 0 && !f.errors },
]

/** Problems to show in a part: errors always, warnings/info once the part has taught them. */
export const problemsFor = (checks, part) => checks.filter((c) => c.level === 'error' || c.part <= part)

/** Variables read anywhere in a condition (for the Play panel order: these first). */
export const conditionVars = (parsed) => {
  const out = new Set()
  for (const n of parsed.nodes) {
    walk(n.body, (s) => {
      if (s.type === 'if') s.branches.forEach((b) => b.cond && exprVars(b.cond, out))
      if (s.type === 'options') s.options.forEach((o) => o.cond && exprVars(o.cond, out))
    })
  }
  return out
}

/** A node title that isn't used yet: Node, Node2, Node3… */
export function freeTitle(parsed, base = 'NewNode') {
  const used = new Set(parsed.nodes.map((n) => n.title))
  if (!used.has(base)) return base
  let i = 2
  while (used.has(`${base}${i}`)) i++
  return `${base}${i}`
}

/** A file name for the .yarn download. */
export const fileName = (title) => `${(title || 'dialogue').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'dialogue'}.yarn`
