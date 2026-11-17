import { reactive, watch } from 'vue'

// Small user preferences live in localStorage; content lives in IndexedDB.
const KEY = 'myzine:settings'

const defaults = {
  theme: 'system', // system | light | dark
  locale: null, // chosen from the browser's languages on first visit (see i18n/index.js)
  readerFontSize: 18,
  lastZineId: null,
}

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...defaults }
  }
}

export const settings = reactive(load())

watch(
  settings,
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      /* storage full or blocked — settings just won't persist */
    }
  },
  { deep: true },
)

// Keep settings in sync if changed in another tab.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) Object.assign(settings, load())
})
