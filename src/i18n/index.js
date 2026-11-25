import { watchEffect, shallowReactive } from 'vue'
import { settings } from '../composables/settings'
import en from './en'

// To add a language: create xx.js with the same keys as en.js, list it here and in LOADERS.
export const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
]

/*
 * English is built in (it is also the fallback for any missing key); the other
 * languages are separate chunks, loaded when needed, so a visitor downloads one
 * language, not six. main.js loads the page's language before the app mounts,
 * so pre-rendered pages don't flash English. `messages` is reactive: texts of
 * a language picked later appear as soon as its chunk arrives.
 */
const LOADERS = {
  de: () => import('./de'),
  es: () => import('./es'),
  hu: () => import('./hu'),
  fr: () => import('./fr'),
  pl: () => import('./pl'),
}
const messages = shallowReactive({ en })
const loading = {}

const supported = (code) => code === 'en' || code in LOADERS

/** Load a language's texts (once). Resolves when they are available. */
export function loadLocale(code) {
  if (messages[code] || !LOADERS[code]) return Promise.resolve()
  loading[code] ||= LOADERS[code]()
    .then((m) => {
      messages[code] = m.default
    })
    .catch((err) => {
      delete loading[code] // a failed chunk (offline): try again next time
      console.error(err)
    })
  return loading[code]
}

const lookup = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

/** The message for `key` as written, without replacing {placeholders}. Falls back to English. */
export const tRaw = (key) => lookup(messages[settings.locale], key) ?? lookup(en, key) ?? key

/** Translate `key` (e.g. 'home.about'), replacing {name} placeholders. Falls back to English. */
export function t(key, params = {}) {
  const msg = tRaw(key)
  return typeof msg === 'string' ? msg.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : msg
}

/** First supported language from the browser's preference list, else English. */
function detectLocale() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en']
  for (const tag of prefs) {
    const code = tag.toLowerCase().split('-')[0]
    if (supported(code)) return code
  }
  return 'en'
}

/**
 * Button label for use next to an <Icon>: the translation without the
 * decorative symbols some labels carry ('Next →', '+ New zine', '🖶 Print').
 */
export function tl(key, params) {
  return t(key, params).replace(/^[\s←→‹›▸▶+⤓⤒🖶✂↩]+|[\s←→‹›▸▶+⤓⤒🖶✂↩]+$/gu, '')
}

if (!supported(settings.locale)) settings.locale = detectLocale()

// whatever picks the language (the URL, the language menu), its texts get loaded
watchEffect(() => {
  document.documentElement.lang = settings.locale
  loadLocale(settings.locale)
})
