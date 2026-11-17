import { watchEffect } from 'vue'
import { settings } from '../composables/settings'
import en from './en'
import de from './de'
import es from './es'
import hu from './hu'
import fr from './fr'
import pl from './pl'

// To add a language: create xx.js with the same keys as en.js and list it here.
export const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
]
const messages = { en, de, es, hu, fr, pl }

const lookup = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj)

/** Translate `key` (e.g. 'home.about'), replacing {name} placeholders. Falls back to English. */
export function t(key, params = {}) {
  const msg = lookup(messages[settings.locale], key) ?? lookup(en, key) ?? key
  return typeof msg === 'string' ? msg.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : msg
}

/** First supported language from the browser's preference list, else English. */
function detectLocale() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en']
  for (const tag of prefs) {
    const code = tag.toLowerCase().split('-')[0]
    if (messages[code]) return code
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

if (!messages[settings.locale]) settings.locale = detectLocale()

watchEffect(() => {
  document.documentElement.lang = settings.locale
})
