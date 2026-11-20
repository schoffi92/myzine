/*
 * Difficult situation: unpleasant situations to put a character in. They're
 * stored by key (texts in i18n: writing.situation.situations.<key>) so a
 * picked situation follows the language; the writer's own is stored as text.
 * A work is { character, sitKey, ownSituation, text }.
 */
export const SITUATIONS = ['date', 'breakup', 'illness', 'disaster', 'island', 'lift', 'fired', 'betrayed', 'stranded', 'accused', 'secret']

/** The situation text of a work (built-in by key, or the writer's own). */
export const situationText = (s, t) => (SITUATIONS.includes(s?.sitKey) ? t(`writing.situation.situations.${s.sitKey}`) : s?.ownSituation?.trim() || '')

/** A random situation key other than the current one. */
export function drawSituationKey(current) {
  const pool = SITUATIONS.filter((k) => k !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}
