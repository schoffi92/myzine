/*
 * Build on this machine and publish dist/ to the server over SSH.
 *
 *   npm run deploy               check git → build → verify → upload → switch
 *   npm run deploy -- --dry-run  everything except upload/switch
 *   npm run deploy -- --force    skip the git checks (quick test deploys)
 *   npm run deploy -- --skip-build   deploy the existing dist/ (still verified)
 *   npm run deploy:rollback      point the site back to the previous release
 *
 * Server layout (DEPLOY_PATH):
 *   releases/<YYYYMMDD-HHMMSS>-<commit>/   one folder per deploy (last DEPLOY_KEEP kept)
 *   current → releases/…                   symlink, switched atomically; nginx root
 *
 * Settings come from the local, git-ignored .env (see .env.example):
 *   DEPLOY_HOST=user@server   DEPLOY_PATH=/var/www/myzine
 *   DEPLOY_PORT=22 (optional) DEPLOY_KEEP=5 (optional)
 * Needs ssh, scp and tar (built into Windows 10+, macOS and Linux) and SSH key login.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { LOCALES, PUBLIC_PATHS, localizedPath, normalizeSiteUrl } from '../src/seoRoutes.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const args = new Set(process.argv.slice(2))
const ROLLBACK = args.has('rollback')
const DRY = args.has('--dry-run')
const FORCE = args.has('--force')
const SKIP_BUILD = args.has('--skip-build')

const log = (...a) => console.log('[deploy]', ...a)
function fail(msg) {
  console.error(`[deploy] STOPPED: ${msg}`)
  process.exit(1)
}

/* ---------- config ---------- */
const env = { ...loadEnv(process.env.MODE || 'production', ROOT, ''), ...process.env }
const HOST = env.DEPLOY_HOST?.trim()
const REMOTE = env.DEPLOY_PATH?.trim().replace(/\/+$/, '')
const PORT = env.DEPLOY_PORT?.trim()
const KEEP = Math.max(2, Number(env.DEPLOY_KEEP) || 5)
const SITE = normalizeSiteUrl(env.VITE_SITE_URL)

if (!DRY || ROLLBACK) {
  if (!HOST || !REMOTE) fail('set DEPLOY_HOST and DEPLOY_PATH in .env (see .env.example).')
}
if (REMOTE && !REMOTE.startsWith('/')) fail('DEPLOY_PATH must be an absolute path on the server.')
// both end up in shell commands (ssh, scp, the remote script): plain characters only
if (REMOTE && !/^[A-Za-z0-9/._~-]+$/.test(REMOTE)) fail('DEPLOY_PATH may only contain letters, digits and / . _ ~ -')
if (HOST && !/^[A-Za-z0-9._@-]+$/.test(HOST)) fail('DEPLOY_HOST may only contain letters, digits and . _ @ -')
if (HOST?.startsWith('-')) fail('DEPLOY_HOST must not start with "-".')

/* ---------- helpers ---------- */
/** Run a command; resolve with stdout (when captured), reject on a non-zero exit. */
function run(cmd, argv, { capture = false, input = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, {
      cwd: ROOT,
      shell: cmd === 'npm', // npm is a .cmd on Windows
      stdio: [input === null ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'],
    })
    let out = ''
    if (capture) child.stdout.on('data', (d) => (out += d))
    if (input !== null) child.stdin.end(input)
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`${cmd} exited with ${code}`))))
  })
}
const git = (...a) => run('git', a, { capture: true })
const sshArgs = PORT ? ['-p', PORT] : []
const scpArgs = PORT ? ['-P', PORT] : []
/** Run a shell script on the server (sent on stdin, so no quoting trouble). */
const remote = (script, opts = {}) => run('ssh', [...sshArgs, HOST, 'sh -s'], { input: `set -e\n${script}\n`, ...opts })
const q = (s) => `'${s}'` // DEPLOY_PATH is checked to contain plain characters only

/* ---------- rollback ---------- */
if (ROLLBACK) {
  log(`rolling back on ${HOST}:${REMOTE}`)
  await remote(`
cd ${q(REMOTE)}
cur=$(readlink current 2>/dev/null || true)
[ -n "$cur" ] || { echo "no current release"; exit 1; }
prev=$(ls -1d releases/*/ 2>/dev/null | sed 's#/$##' | sort | grep -B1 -x "$cur" | head -n 1)
[ -n "$prev" ] && [ "$prev" != "$cur" ] || { echo "no older release to roll back to"; exit 1; }
ln -sfn "$prev" current.tmp && mv -Tf current.tmp current
echo "[deploy] current: $cur -> $prev"
`).catch((e) => fail(`rollback failed (${e.message}).`))
  process.exit(0)
}

/* ---------- 1. git: deploy only what is committed and pushed ---------- */
let commit = 'local'
try {
  commit = await git('rev-parse', '--short', 'HEAD')
} catch {
  /* not a git checkout */
}
if (FORCE) {
  log('--force: skipping git checks')
} else {
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== 'main') fail(`on branch "${branch}"; deploy from main (or use --force).`)
  if (await git('status', '--porcelain')) fail('uncommitted changes; commit them first (or use --force).')
  await git('fetch', '--quiet', 'origin', 'main').catch(() => log('WARNING: could not reach origin; using last known state'))
  const [ahead, behind] = (await git('rev-list', '--left-right', '--count', 'HEAD...origin/main')).split(/\s+/).map(Number)
  if (ahead) fail(`main has ${ahead} commit(s) not pushed; push first (or use --force).`)
  if (behind) fail(`main is ${behind} commit(s) behind origin; pull first (or use --force).`)
  log(`git ok: main @ ${commit}, in sync with origin`)
}

/* ---------- 2. build (vite + pre-render; exits non-zero unless every page rendered) ---------- */
if (SKIP_BUILD) log('--skip-build: using existing dist/')
else {
  log('building…')
  await run('npm', ['run', 'build']).catch(() => fail('build or pre-rendering failed; nothing was uploaded.'))
}

/* ---------- 3. verify dist/ before anything leaves this machine ---------- */
if (!SITE) fail('VITE_SITE_URL is not set, so pages were not pre-rendered.')
const problems = []
for (const f of ['app.html', 'sitemap.xml', 'index.html']) {
  if (!existsSync(path.join(DIST, f))) problems.push(`missing dist/${f}`)
}
for (const l of LOCALES) {
  for (const p of PUBLIC_PATHS) {
    const url = localizedPath(l, p)
    const file = url === '/' ? path.join(DIST, 'index.html') : path.join(DIST, url, 'index.html')
    const html = existsSync(file) ? await readFile(file, 'utf8') : ''
    if (!/<h1[\s>]/.test(html)) problems.push(`not pre-rendered: ${url}`)
  }
}
const sitemap = existsSync(path.join(DIST, 'sitemap.xml')) ? await readFile(path.join(DIST, 'sitemap.xml'), 'utf8') : ''
if (!sitemap.includes(`<loc>${SITE}/</loc>`)) problems.push('sitemap.xml does not use VITE_SITE_URL')
if (problems.length) fail(`dist/ is not ready:\n  ${problems.slice(0, 10).join('\n  ')}`)
if (!existsSync(path.join(DIST, 'robots.txt'))) log('WARNING: no robots.txt in dist/ (put one in public/)')
const pages = LOCALES.length * PUBLIC_PATHS.length
log(`dist ok: ${pages} pre-rendered pages, app.html, sitemap.xml`)

/* ---------- 4. pack ---------- */
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const release = `${stamp}-${commit}`
const tarball = path.join(os.tmpdir(), `myzine-${release}.tar.gz`)
await run('tar', ['-czf', tarball, '-C', DIST, '.'])
log(`packed ${release} (${((await stat(tarball)).size / 1024).toFixed(0)} KB)`)

if (DRY) {
  log(`--dry-run: would upload to ${HOST || '<DEPLOY_HOST>'}:${REMOTE || '<DEPLOY_PATH>'}/releases/${release}`)
  await rm(tarball, { force: true })
  process.exit(0)
}

/* ---------- 5. upload + 6. unpack, switch, prune ---------- */
try {
  log(`uploading to ${HOST}…`)
  await remote(`mkdir -p ${q(REMOTE)}/releases`)
  await run('scp', [...scpArgs, '-q', tarball, `${HOST}:${REMOTE}/releases/${release}.tar.gz`])
  await remote(`
cd ${q(REMOTE)}
if [ -e current ] && [ ! -L current ]; then
  echo "[deploy] ${REMOTE}/current exists but is not a symlink; move it away first"; exit 1
fi
# unpack into a hidden folder and rename it only when complete, so a failed
# unpack never leaves a half release that rollback or pruning could pick
tmp=releases/.tmp-${release}
trap 'rm -rf "$tmp" releases/${release}.tar.gz' EXIT
rm -rf "$tmp" && mkdir "$tmp"
tar -xzf releases/${release}.tar.gz -C "$tmp" --no-same-owner
chmod -R a+rX "$tmp"
mv -T "$tmp" releases/${release}
ln -sfn releases/${release} current.tmp && mv -Tf current.tmp current
live=$(readlink current)
echo "[deploy] live: $live"
# keep the newest ${KEEP} releases (never the one that is live). The site has
# already switched, so a folder that can't be removed is only a warning.
ls -1d releases/*/ | sed 's#/$##' | sort | head -n -${KEEP} | while read -r old; do
  [ "$old" = "$live" ] || rm -rf "$old" || echo "[deploy] warning: could not remove $old"
done
echo "[deploy] $(ls -1d releases/*/ | wc -l) releases kept"
`)
} catch (e) {
  fail(`upload/switch failed (${e.message}); the live site was not changed unless "live:" was printed.`)
} finally {
  await rm(tarball, { force: true })
}

/* ---------- 7. smoke test ---------- */
try {
  for (const p of ['/', '/sitemap.xml']) {
    const res = await fetch(SITE + p, { cache: 'no-store' })
    log(`${res.ok ? 'ok ' : 'WARNING'} ${res.status} ${SITE}${p}`)
  }
} catch (e) {
  log(`WARNING: could not check the live site (${e.message})`)
}
log(`done: ${release}  (undo with: npm run deploy:rollback)`)
