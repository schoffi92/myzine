/*
 * Character interview: built-in questions (stored by key so they follow the
 * language) and helpers shared by the page and the Markdown export.
 * A question is { id, key, a } for a built-in one or { id, q, a } for the
 * writer's own.
 */
export const INTERVIEW_QUESTIONS = ['name', 'age', 'home', 'food', 'city', 'drink', 'bothers']

/** The question text: built-in by key, the writer's own, or "Your question" while it's empty. */
export const interviewQuestion = (q, t) =>
  INTERVIEW_QUESTIONS.includes(q?.key) ? t(`writing.interview.questions.${q.key}`) : (typeof q?.q === 'string' && q.q.trim()) || t('writing.interview.ownLabel')

export const newQuestionId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
