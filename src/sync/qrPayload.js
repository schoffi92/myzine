/*
 * Turning data into a series of QR code texts and back.
 *
 * data → JSON → deflate (CompressionStream, if the browser has it) → base64url
 *      → split into parts, each one QR code:
 *        MZ1:<transfer id>:<part>:<total>:<checksum>:<chunk>
 *
 * The sender shows the parts in a loop; the receiver collects them in any
 * order (see createCollector) and checks the SHA-256 checksum of the whole
 * text before unpacking. No network is involved.
 */

const PREFIX = 'MZ1'
/** Characters per QR code. Small enough for a phone camera to read off a screen. */
export const CHUNK = 600

const toB64url = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64url = (str) => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function through(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'

/** Object → compact text. First letter tells how it was packed: z = deflate, j = plain JSON. */
export async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  if (canCompress()) {
    try {
      return 'z' + toB64url(await through(bytes, new CompressionStream('deflate')))
    } catch {
      /* send it uncompressed */
    }
  }
  return 'j' + toB64url(bytes)
}

export async function unpack(text) {
  let bytes = fromB64url(text.slice(1))
  if (text[0] === 'z') {
    if (!canCompress()) throw new Error('This browser can’t unpack compressed data.')
    bytes = await through(bytes, new DecompressionStream('deflate'))
  } else if (text[0] !== 'j') {
    throw new Error('Unknown data format.')
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function checksum(text) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return [...hash.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Object → array of QR code texts. */
export async function toFrames(obj, size = CHUNK) {
  const text = await pack(obj)
  const sum = await checksum(text)
  const id = Math.random().toString(36).slice(2, 6)
  const n = Math.max(1, Math.ceil(text.length / size))
  return Array.from({ length: n }, (_, i) => `${PREFIX}:${id}:${i + 1}:${n}:${sum}:${text.slice(i * size, (i + 1) * size)}`)
}

/** Parse one scanned QR text; null if it isn't one of ours. */
export function parseFrame(raw) {
  const m = /^MZ1:([a-z0-9]+):(\d+):(\d+):([0-9a-f]{8}):([A-Za-z0-9_-]*)$/.exec(raw?.trim() ?? '')
  if (!m) return null
  const [, id, i, n, sum, chunk] = m
  const part = Number(i)
  const total = Number(n)
  if (!total || part < 1 || part > total) return null
  return { id, part, total, sum, chunk }
}

/**
 * Collects scanned parts. add(raw) returns the progress { got, total } or
 * null for a foreign code. A code from a different transfer starts over.
 * When all parts are in, finish() checks and unpacks the data.
 */
export function createCollector() {
  let current = null // { id, total, sum, parts: Map }

  return {
    add(raw) {
      const f = parseFrame(raw)
      if (!f) return null
      if (!current || current.id !== f.id || current.total !== f.total || current.sum !== f.sum) {
        current = { id: f.id, total: f.total, sum: f.sum, parts: new Map() }
      }
      current.parts.set(f.part, f.chunk)
      return { got: current.parts.size, total: current.total }
    },
    get complete() {
      return !!current && current.parts.size === current.total
    },
    reset() {
      current = null
    },
    async finish() {
      if (!this.complete) throw new Error('Not all parts are scanned yet.')
      const text = Array.from({ length: current.total }, (_, i) => current.parts.get(i + 1)).join('')
      if ((await checksum(text)) !== current.sum) throw new Error('Checksum mismatch.')
      return unpack(text)
    },
  }
}
