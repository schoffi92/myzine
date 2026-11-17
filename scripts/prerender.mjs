/*
 * Pre-render the public pages of the built app into real HTML files, so search
 * engines (and visitors before JavaScript loads) get the full content.
 *
 * Runs after `vite build` (see package.json "build"):
 *  1. keeps the empty app shell as dist/app.html (server fallback for app-only pages)
 *  2. serves dist/ locally and opens every public page in every language in a
 *     headless Chrome/Edge (puppeteer-core; set CHROME_PATH to choose the browser)
 *  3. saves each rendered page as dist/<path>/index.html
 *  4. writes dist/sitemap.xml with hreflang alternates
 *
 * If no browser is found it still writes app.html and the sitemap, and the site
 * keeps working as a normal client-side app.
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { LOCALES, DEFAULT_LOCALE, PUBLIC_PATHS, localizedPath, normalizeSiteUrl } from '../src/seoRoutes.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const log = (...a) => console.log('[prerender]', ...a)

/* ---------- 1. app shell ---------- */
const shellPath = path.join(DIST, 'app.html')
await copyFile(path.join(DIST, 'index.html'), shellPath)
const shell = await readFile(shellPath)

/* ---------- site URL from config (same .env files `vite build` reads) ---------- */
const SITE = normalizeSiteUrl(
  process.env.VITE_SITE_URL || loadEnv(process.env.MODE || 'production', ROOT, 'VITE_').VITE_SITE_URL,
)
if (!SITE) {
  log('WARNING: VITE_SITE_URL is not set (see .env.example); skipping pre-rendering and sitemap.')
  process.exit(0)
}
log(`site: ${SITE}`)

/* ---------- 4 (first, so it exists even without a browser). sitemap ---------- */
async function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10)
  const alternates = (p) =>
    [...LOCALES.map((l) => [l, l]), ['x-default', DEFAULT_LOCALE]]
      .map(([hreflang, l]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${SITE}${localizedPath(l, p)}"/>`)
      .join('\n')
  const urls = PUBLIC_PATHS.flatMap((p) =>
    LOCALES.map(
      (l) => `  <url>\n    <loc>${SITE}${localizedPath(l, p)}</loc>\n    <lastmod>${today}</lastmod>\n${alternates(p)}\n  </url>`,
    ),
  )
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
  await writeFile(path.join(DIST, 'sitemap.xml'), xml)
  log(`sitemap.xml: ${urls.length} URLs`)
}
await writeSitemap()

/* ---------- find a browser ---------- */
function findBrowser() {
  const env = process.env.CHROME_PATH
  if (env && existsSync(env)) return env
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files'
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
  const local = process.env.LOCALAPPDATA || ''
  const candidates = [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
    `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ]
  return candidates.find((c) => c && existsSync(c)) || null
}

const executablePath = findBrowser()
let puppeteer = null
try {
  puppeteer = (await import('puppeteer-core')).default
} catch {
  /* not installed */
}
if (!executablePath || !puppeteer) {
  log('WARNING: no Chrome/Edge (or puppeteer-core) found; skipping pre-rendering. Set CHROME_PATH to enable it.')
  process.exit(0)
}

/* ---------- 2. local static server: files as-is, every page → app shell ---------- */
const MIME = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
}
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = path.join(DIST, urlPath)
  const ext = path.extname(urlPath)
  try {
    if (ext && ext !== '.html' && file.startsWith(DIST) && (await stat(file)).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      res.end(await readFile(file))
      return
    }
  } catch {
    /* fall through to the shell */
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(shell)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`

/* ---------- 3. render every page in every language ---------- */
// Slow servers (small VPS, snap Chromium) need more time: PRERENDER_TIMEOUT=ms
const TIMEOUT = Number(process.env.PRERENDER_TIMEOUT) || 60000
const RETRIES = 3

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  protocolTimeout: Math.max(TIMEOUT * 2, 180000),
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage', // small /dev/shm on Linux servers makes Chrome hang
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
  ],
})
log(`using ${path.basename(executablePath)} (timeout ${TIMEOUT} ms)`)

/**
 * Render one page. A watchdog makes sure a hung browser call (e.g. opening a
 * tab) also ends in an error that says which step it was stuck on.
 */
async function renderOnce(url) {
  const state = { stage: 'start', context: null }
  let timer
  const watchdog = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`stuck at "${state.stage}" for ${TIMEOUT + 15000} ms`)), TIMEOUT + 15000)
  })
  try {
    return await Promise.race([renderSteps(url, state), watchdog])
  } finally {
    clearTimeout(timer)
    await state.context?.close().catch(() => {})
  }
}

async function renderSteps(url, state) {
  // fresh profile per page: no stored language preference, English browser
  state.stage = 'new browser context'
  const context = (state.context = await browser.createBrowserContext())
  // for the error message: what the page was still waiting for, and what broke
  const pending = new Set()
  const problems = []
  try {
    state.stage = 'new tab'
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT)
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`))
    page.on('requestfinished', (r) => pending.delete(r.url()))
    page.on('requestfailed', (r) => {
      pending.delete(r.url())
      if (!['image', 'font', 'media'].includes(r.resourceType())) {
        problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`)
      }
    })
    // images/fonts/media don't change the HTML; skipping them makes pages settle faster
    state.stage = 'request interception'
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      if (['image', 'font', 'media'].includes(req.resourceType())) return req.abort()
      pending.add(req.url())
      req.continue()
    })
    // 'load' + waiting for the rendered heading, instead of 'networkidle0',
    // which can time out when the server is slow to go fully quiet
    state.stage = 'loading the page'
    await page.goto(origin + url, { waitUntil: 'load', timeout: TIMEOUT })
    state.stage = 'waiting for the app to render'
    await page.waitForFunction(
      (expected) => location.pathname === expected && document.querySelector('#app h1'),
      { timeout: TIMEOUT },
      url,
    )
    // let lazy chunks (translations, tarot texts) finish; don't fail if it never fully settles
    state.stage = 'waiting for lazy chunks'
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5000 }).catch(() => {})
    state.stage = 'reading the HTML'
    return '<!doctype html>\n' + (await page.evaluate(() => document.documentElement.outerHTML))
  } catch (err) {
    const detail = [...[...pending].map((u) => `still loading: ${u}`), ...problems]
    err.message += ` [step: ${state.stage}]` + (detail.length ? '\n    ' + detail.slice(0, 8).join('\n    ') : '')
    throw err
  }
}

let count = 0
let failed = 0
try {
  pages: for (const locale of LOCALES) {
    for (const p of PUBLIC_PATHS) {
      const url = localizedPath(locale, p)
      let html = null
      for (let attempt = 1; attempt <= RETRIES && !html; attempt++) {
        const started = Date.now()
        try {
          html = await renderOnce(url)
          log(`(${count + failed + 1}/${LOCALES.length * PUBLIC_PATHS.length}) ${url}  ${Date.now() - started} ms`)
        } catch (err) {
          log(`${attempt < RETRIES ? 'retrying' : 'FAILED'} ${url} (attempt ${attempt}): ${err.message}`)
        }
      }
      if (!html) {
        failed++
        // nothing works at all → the browser itself is broken; don't spend hours retrying
        if (count === 0 && failed >= 2) {
          log('ABORTING: the first pages all failed, so the browser is not working here.')
          log('On Ubuntu, the snap "chromium-browser" often hangs under automation; install')
          log('Google Chrome (.deb) and/or set CHROME_PATH, or build on another machine.')
          break pages
        }
        continue
      }
      const out = url === '/' ? path.join(DIST, 'index.html') : path.join(DIST, url, 'index.html')
      await mkdir(path.dirname(out), { recursive: true })
      await writeFile(out, html)
      count++
    }
  }
} finally {
  await browser.close()
  server.close()
}

const total = LOCALES.length * PUBLIC_PATHS.length
log(`${count} of ${total} pages written${failed ? `, ${failed} failed` : ''}`)
if (count < total) process.exitCode = 1
if (failed) process.exit(1)
