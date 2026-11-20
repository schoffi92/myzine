/*
 * Run `fn` when the tab is hidden or the page is closed or reloaded, so a
 * pending (debounced) autosave is written before the browser drops it.
 * In-app navigation unmounts the view, which flushes on its own.
 * Returns a function that removes the listeners.
 */
export function flushOnHide(fn) {
  const onHide = () => fn()
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') fn()
  }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
