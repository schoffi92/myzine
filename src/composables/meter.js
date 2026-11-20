/*
 * Iamb and trochee: topics (texts in i18n: writing.meter.topics.<key>) and
 * helpers shared by the page and the Markdown export. The rhythm checking
 * itself is in writing/meter.js.
 */
export const METER_TOPICS = ['sea', 'train', 'snow', 'letter', 'cat', 'storm', 'market', 'school']

export const otherRhythm = (r) => (r === 'iamb' ? 'trochee' : 'iamb')

/** The topic text of a work, or ''. */
export const meterTopic = (s, t) => (METER_TOPICS.includes(s?.topicKey) ? t(`writing.meter.topics.${s.topicKey}`) : '')
