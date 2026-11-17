import { ref } from 'vue'

/** True on phone-sized screens. Same breakpoint as the mobile rules in style.css. */
const query = window.matchMedia('(max-width: 640px)')
export const isMobile = ref(query.matches)
query.addEventListener('change', (e) => (isMobile.value = e.matches))
