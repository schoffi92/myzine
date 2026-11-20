import { METER_TOPICS, meterTopic } from './meter'
import { SCHEMES, LINES_PER_STANZA } from '../writing/rhyme'

/*
 * Rhyme schemes: helpers shared by the page and the Markdown export. The
 * topics are the same as in Iamb and trochee (writing.meter.topics.<key>);
 * the rhyme checking itself is in writing/rhyme.js.
 *
 * A work keeps all three schemes in `order` (the writer's order) and writes
 * the first `count` of them (2 or 3).
 */
export const RHYME_TOPICS = METER_TOPICS
export const DEFAULT_ORDER = ['aabb', 'abba', 'abab']

/** The topic text of a work, or ''. */
export const rhymeTopic = meterTopic

/** A valid `order`: the saved one when it lists every scheme once, else the default. */
export const validOrder = (order) =>
  Array.isArray(order) && order.length === SCHEMES.length && SCHEMES.every((s) => order.includes(s)) ? [...order] : [...DEFAULT_ORDER]

/** How many schemes a work writes: 2 or 3. */
export const validCount = (count) => (count === 3 ? 3 : 2)

/** The schemes a work writes, in order. */
export const activeSchemes = (s) => validOrder(s?.order).slice(0, validCount(s?.count))

/** A list of lines as plain text: stanzas of four, a blank line between them, empty lines dropped. */
export function stanzasText(list) {
  const lines = Array.isArray(list) ? list.map((l) => (typeof l === 'string' ? l.trim() : '')) : []
  const stanzas = []
  for (let i = 0; i < lines.length; i += LINES_PER_STANZA) {
    const s = lines.slice(i, i + LINES_PER_STANZA).filter(Boolean)
    if (s.length) stanzas.push(s.join('\n'))
  }
  return stanzas.join('\n\n')
}
