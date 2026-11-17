import { shallowRef, watch } from 'vue'
import { settings } from '../composables/settings'
import en from './en'

// Card texts for other languages are loaded on demand (separate small chunks).
const loaders = import.meta.glob(['./*.js', '!./en.js', '!./deck.js', '!./index.js'])

const texts = shallowRef(en)

watch(
  () => settings.locale,
  async (locale) => {
    const load = loaders[`./${locale}.js`]
    try {
      texts.value = load ? (await load()).default : en
    } catch {
      texts.value = en
    }
  },
  { immediate: true },
)

/** Name and meanings of a card in the current language (falls back to English). */
export function cardText(id) {
  return texts.value[id] ?? en[id]
}
