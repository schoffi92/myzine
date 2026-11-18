import { ref } from 'vue'

/*
 * Copy text to the clipboard, with feedback when the browser blocks it.
 * 1. the Clipboard API (needs https and, in some browsers, permission);
 * 2. the older execCommand('copy') on a hidden textarea (works on http and
 *    in older browsers);
 * 3. if both fail, CopyFallback.vue (mounted in App.vue) shows the text,
 *    already selected, so the user can copy it by hand.
 * Returns true when the text is on the clipboard.
 */

/** Text the fallback dialog shows, or null when it's closed. */
export const blockedText = ref(null)

function legacyCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;'
  const active = document.activeElement
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  active?.focus?.({ preventScroll: true })
  return ok
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* blocked or missing: try the older way */
  }
  if (legacyCopy(text)) return true
  blockedText.value = text
  return false
}
