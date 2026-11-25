/*
 * Interactive fiction (ink): premises, the parts of the writing guide and what
 * each one unlocks, and the checks that tick a part as done. As in Game
 * dialogue, parts 1–6 write `source`, part 7 (write your own) writes `ownSource`.
 *
 * A work is { title, promptKey, ownPrompt, source, part, ownTitle, ownPromptKey, ownOwnPrompt, ownSource }.
 * Premises are stored by key (texts in i18n: writing.ink.prompts.<key>).
 */

export const PROMPTS = ['lighthouse', 'heist', 'dragon', 'detective', 'island', 'interview', 'spaceship', 'forest', 'ballroom', 'museum']

/** The premise (built-in by key, or the writer's own). `own` picks the part 7 fields. */
export function promptText(s, t, own = false) {
  const key = own ? s?.ownPromptKey : s?.promptKey
  const text = own ? s?.ownOwnPrompt : s?.ownPrompt
  return PROMPTS.includes(key) ? t(`writing.ink.prompts.${key}`) : text?.trim() || ''
}

/**
 * Parts of the writing guide. `tools` are the insert buttons it adds (on top of
 * the earlier parts'), `done` ticks it from the facts of the script (writing/ink.js).
 * Texts: writing.ink.parts[i].
 */
export const PARTS = [
  { id: 0, tools: [], done: (s, f, t) => !!promptText(s, t) },
  { id: 1, tools: ['knot', 'divert', 'end'], done: (s, f) => f.knots >= 2 && f.knotDiverts >= 1 && f.ends >= 1 && !f.errors },
  { id: 2, tools: ['choice', 'bracket'], done: (s, f) => f.maxGroup >= 2 && !f.errors },
  { id: 3, tools: ['gather', 'nested'], done: (s, f) => f.gathers >= 1 && f.nested >= 1 && !f.errors },
  { id: 4, tools: ['var', 'set', 'show', 'cond', 'condChoice'], done: (s, f) => f.vars >= 1 && f.sets >= 1 && f.conditions >= 1 && !f.errors },
  { id: 5, tools: ['sequence', 'cycle', 'shuffle', 'visits'], done: (s, f) => f.variations >= 1 && f.visitChecks >= 1 && !f.errors },
  { id: 6, tools: ['sticky', 'label'], done: (s, f) => f.sticky >= 1 && f.hub && f.ends >= 2 && !f.errors },
  { id: 7, tools: [], done: (s, f) => OWN_GOALS.every((g) => g.done(f)) },
]
export const OWN = 7
export const LAST_GUIDED = 6

/** Insert buttons available in a part (part 7 has them all). */
export const toolsFor = (part) => PARTS.slice(0, Math.min(part, LAST_GUIDED) + 1).flatMap((p) => p.tools)

/** What the page shows from which part on. */
export const UNLOCK = { editor: 1, play: 1, map: 1, vars: 4, download: 6 }

/** Goals of part 7, ticked from the writer's own story. Texts: writing.ink.ownGoals.<key>. */
export const OWN_GOALS = [
  { key: 'knots', done: (f) => f.knots >= 4 },
  { key: 'choices', done: (f) => f.choiceGroups >= 3 },
  { key: 'weave', done: (f) => f.gathers >= 1 },
  { key: 'variable', done: (f) => f.vars >= 1 && f.sets >= 1 && f.conditions >= 1 },
  { key: 'variety', done: (f) => f.variations >= 1 },
  { key: 'endings', done: (f) => f.ends >= 2 },
  { key: 'noErrors', done: (f) => f.knots > 0 && !f.errors },
]

/** Problems to show in a part: errors always, warnings and notes once the part has taught them. */
export const problemsFor = (checks, part) => checks.filter((c) => c.level === 'error' || c.part <= part)

/** A knot name that isn't used yet: start, then new_knot, new_knot_2… */
export function freeKnot(parsed, base = 'new_knot') {
  if (!parsed.knots.size) return 'start'
  if (!parsed.knots.has(base)) return base
  let i = 2
  while (parsed.knots.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}
