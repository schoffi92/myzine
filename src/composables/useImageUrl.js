import { ref, watch, onBeforeUnmount } from 'vue'
import { getImageBlob } from '../db/zines'

/** Turns an IndexedDB image id into an object URL, revoking old ones. */
export function useImageUrl(idRef) {
  const url = ref(null)
  let token = 0

  const revoke = () => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = null
  }

  watch(
    idRef,
    async (id) => {
      const mine = ++token
      const blob = await getImageBlob(id)
      if (mine !== token) return
      revoke()
      if (blob) url.value = URL.createObjectURL(blob)
    },
    { immediate: true },
  )

  onBeforeUnmount(revoke)
  return url
}
