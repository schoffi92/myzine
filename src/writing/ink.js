/*
 * ink (inkle's language for interactive stories): the subset a beginner
 * writes, read, checked and played in the browser for the Interactive
 * fiction practice. Scripts written here run unchanged in Inky / inklecate.
 *
 * Covered:
 *   text lines, # tags, glue <>, // and /* *​/ comments
 *   === knot ===  (== knot), = stitch
 *   -> divert (knot, knot.stitch, stitch or label in this knot, END, DONE), at the end of a line too
 *   * once-only and + sticky choices, nested (* *), [bracket] text, {condition}s, (labels)
 *   - gathers (- -), with (labels)
 *   VAR / CONST, ~ x = …, ~ x += …, ~ x++ / ~ x--, ~ temp x = …
 *   {expr} in text, {cond: a|b}, sequences {a|b|c}, cycles {&a|b}, shuffles {~a|b}, once-only {!a|b}
 *   visit counts: a knot, stitch or label name in an expression is how many times it was seen
 * Not covered (reported as notes; they work in Inky): functions, tunnels (->->),
 * threads (<-), LIST, INCLUDE, EXTERNAL, multi-line { } blocks, fallback choices.
 *
 * Parsed: { vars: [{ name, expr, line }], root: Scope, knots: Map(name → Knot), problems: [] }
 *   Scope { name, items: Item[], labels: Map(label → { list, index }) }
 *   Knot  Scope & { stitches: Map(name → Scope), line }
 *   Item  { type: 'text' | 'divert' | 'logic' | 'choice' | 'gather' | 'unsupported', line, … }
 *   A choice owns `body` (Item[]) up to the next choice or gather of its level or above.
 */

const STEP_LIMIT = 20000
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/* ======================================================================
 * expressions
 * ==================================================================== */

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*")|(&&|\|\||==|!=|<=|>=|\+=|-=|\+\+|--|[-+*/%<>!()=?^])|([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*))/y

function tokenize(src) {
  const out = []
  TOKEN.lastIndex = 0
  let pos = 0
  src = src.trim()
  while (pos < src.length) {
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(src)
    if (!m || m.index !== pos || !m[0].trim()) throw new Error(`bad token at ${pos}`)
    pos = TOKEN.lastIndex
    if (m[1]) out.push({ t: 'num', v: Number(m[1]) })
    else if (m[2]) out.push({ t: 'str', v: m[2].slice(1, -1).replace(/\\(.)/g, '$1') })
    else if (m[3]) out.push({ t: 'op', v: m[3] })
    else {
      const w = m[4]
      if (w === 'true' || w === 'false') out.push({ t: 'bool', v: w === 'true' })
      else if (w === 'and' || w === 'or' || w === 'not' || w === 'mod') out.push({ t: 'op', v: { and: '&&', or: '||', not: '!', mod: '%' }[w] })
      else out.push({ t: 'id', v: w })
    }
    while (pos < src.length && /\s/.test(src[pos])) pos++
  }
  return out
}

const BIN = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']]

/** Expression source → tree: { t: 'lit', v } | { t: 'id', name } | { t: 'un', op, a } | { t: 'bin', op, a, b }. Throws when unreadable. */
export function parseExpr(src) {
  const toks = tokenize(src)
  let i = 0
  const peek = () => toks[i]
  const isOp = (v) => peek()?.t === 'op' && peek().v === v
  function level(n) {
    if (n === BIN.length) return unary()
    let a = level(n + 1)
    while (peek()?.t === 'op' && BIN[n].includes(peek().v)) {
      const op = toks[i++].v
      a = { t: 'bin', op, a, b: level(n + 1) }
    }
    return a
  }
  function unary() {
    if (isOp('!') || isOp('-')) {
      const op = toks[i++].v
      return { t: 'un', op, a: unary() }
    }
    return primary()
  }
  function primary() {
    const tok = toks[i++]
    if (!tok) throw new Error('unexpected end')
    if (tok.t === 'num' || tok.t === 'str' || tok.t === 'bool') return { t: 'lit', v: tok.v }
    if (tok.t === 'id') return { t: 'id', name: tok.v }
    if (tok.t === 'op' && tok.v === '(') {
      const e = level(0)
      if (!isOp(')')) throw new Error('missing )')
      i++
      return e
    }
    throw new Error(`unexpected ${tok.v}`)
  }
  if (!toks.length) throw new Error('empty')
  const e = level(0)
  if (i < toks.length) throw new Error(`unexpected ${toks[i].v}`)
  return e
}

/** Names an expression reads. */
export function exprNames(e, out = new Set()) {
  if (!e) return out
  if (e.t === 'id') out.add(e.name)
  if (e.a) exprNames(e.a, out)
  if (e.b) exprNames(e.b, out)
  return out
}

/** Evaluate with ctx.get(name) → value (throws for an unknown name). */
export function evalExpr(e, ctx) {
  switch (e.t) {
    case 'lit':
      return e.v
    case 'id':
      return ctx.get(e.name)
    case 'un': {
      const a = evalExpr(e.a, ctx)
      return e.op === '!' ? !truthy(a) : -num(a)
    }
    default: {
      if (e.op === '&&') return truthy(evalExpr(e.a, ctx)) && truthy(evalExpr(e.b, ctx))
      if (e.op === '||') return truthy(evalExpr(e.a, ctx)) || truthy(evalExpr(e.b, ctx))
      const a = evalExpr(e.a, ctx)
      const b = evalExpr(e.b, ctx)
      switch (e.op) {
        case '==': return a === b || (typeof a !== typeof b && String(a) === String(b))
        case '!=': return !(a === b || (typeof a !== typeof b && String(a) === String(b)))
        case '<': return num(a) < num(b)
        case '>': return num(a) > num(b)
        case '<=': return num(a) <= num(b)
        case '>=': return num(a) >= num(b)
        case '+': return typeof a === 'string' || typeof b === 'string' ? `${show(a)}${show(b)}` : num(a) + num(b)
        case '-': return num(a) - num(b)
        case '*': return num(a) * num(b)
        case '/': return Number.isInteger(num(a)) && Number.isInteger(num(b)) ? Math.trunc(num(a) / (num(b) || 1)) : num(a) / (num(b) || 1)
        case '%': return num(a) % (num(b) || 1)
      }
      throw new Error(`operator ${e.op}`)
    }
  }
}
const truthy = (v) => !!v && v !== 0
const num = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : Number(v) || 0)
/** A value as ink prints it. */
export const show = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v))

/* ======================================================================
 * text with { } (expressions, conditions, variations)
 * ==================================================================== */

/** Split at top-level occurrences of `sep` (not inside { } or "…"). */
function splitTop(s, sep) {
  const out = []
  let depth = 0
  let quote = false
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"' && depth > 0) quote = !quote
    else if (!quote && c === '{') depth++
    else if (!quote && c === '}') depth--
    else if (!quote && depth === 0 && c === sep) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}
/** Index of the top-level `ch` in s, or -1. */
const topIndex = (s, ch) => {
  const parts = splitTop(s, ch)
  return parts.length > 1 ? parts[0].length : -1
}

/**
 * Text → parts: strings and { kind: 'expr' | 'cond' | 'seq' | 'cycle' | 'shuffle' | 'once', … }.
 * Throws { brace: true } when the braces don't match.
 */
export function parseText(s) {
  const parts = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '}') throw Object.assign(new Error('unmatched }'), { brace: true })
    if (c !== '{') {
      buf += c
      continue
    }
    let depth = 1
    let j = i + 1
    for (; j < s.length && depth; j++) {
      if (s[j] === '{') depth++
      else if (s[j] === '}') depth--
    }
    if (depth) throw Object.assign(new Error('unclosed {'), { brace: true })
    if (buf) parts.push(buf)
    buf = ''
    parts.push(braceOf(s.slice(i + 1, j - 1)))
    i = j - 1
  }
  if (buf) parts.push(buf)
  return parts
}

let braceSeq = 0
function braceOf(inner) {
  const id = braceSeq++
  const kinds = { '&': 'cycle', '~': 'shuffle', '!': 'once' }
  if (kinds[inner[0]]) return { kind: kinds[inner[0]], id, options: splitTop(inner.slice(1), '|').map(parseText) }
  const colon = topIndex(inner, ':')
  if (colon >= 0) {
    const [yes, no = ''] = splitTop(inner.slice(colon + 1), '|')
    return { kind: 'cond', id, src: inner.slice(0, colon).trim(), expr: tryExpr(inner.slice(0, colon)), yes: parseText(yes), no: parseText(no) }
  }
  const opts = splitTop(inner, '|')
  if (opts.length > 1) return { kind: 'seq', id, options: opts.map(parseText) }
  return { kind: 'expr', id, src: inner.trim(), expr: tryExpr(inner) }
}
function tryExpr(src) {
  try {
    return parseExpr(src)
  } catch {
    return null
  }
}

/** Every expression and its source in some text parts (for the checker). */
function textExprs(parts, out = []) {
  for (const p of parts) {
    if (typeof p === 'string') continue
    if (p.kind === 'expr' || p.kind === 'cond') out.push({ src: p.src, expr: p.expr })
    if (p.kind === 'cond') textExprs(p.yes, out), textExprs(p.no, out)
    for (const o of p.options || []) textExprs(o, out)
  }
  return out
}
/** A divert written inside { } (played here as text; it works in Inky). */
const divertInBraces = (parts, inside = false) => parts.some((p) => (typeof p === 'string' ? inside && p.includes('->') : divertInBraces(p.yes || [], true) || divertInBraces(p.no || [], true) || (p.options || []).some((o) => divertInBraces(o, true))))
const countConds = (parts) => parts.reduce((n, p) => (typeof p === 'string' ? n : n + (p.kind === 'cond') + countConds(p.yes || []) + countConds(p.no || []) + (p.options || []).reduce((m, o) => m + countConds(o), 0)), 0)
const hasVariation = (parts) => parts.some((p) => typeof p !== 'string' && (['seq', 'cycle', 'shuffle', 'once'].includes(p.kind) || hasVariation(p.yes || []) || hasVariation(p.no || []) || (p.options || []).some(hasVariation)))

/* ======================================================================
 * parsing a script
 * ==================================================================== */

/** Remove comments, keeping line numbers. */
function stripComments(src) {
  let out = ''
  let inBlock = false
  for (let i = 0; i < src.length; i++) {
    if (inBlock) {
      if (src.startsWith('*/', i)) {
        inBlock = false
        i++
      } else if (src[i] === '\n') out += '\n'
      continue
    }
    if (src.startsWith('/*', i)) {
      inBlock = true
      i++
      continue
    }
    if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++
      if (src[i] === '\n') out += '\n'
      continue
    }
    out += src[i]
  }
  return out
}

/** Split `text -> target # tag` into { text, divert, tags }. */
function splitLine(s) {
  const tags = []
  let text = s
  const hash = topIndex(text, '#')
  if (hash >= 0) {
    tags.push(...text.slice(hash + 1).split('#').map((x) => x.trim()).filter(Boolean))
    text = text.slice(0, hash)
  }
  let divert = null
  const parts = splitTop(text, '-')
  // find the last top-level "->"
  let at = -1
  let pos = 0
  for (let k = 0; k < parts.length - 1; k++) {
    pos += parts[k].length
    if (parts[k + 1].startsWith('>')) at = pos
    pos += 1
  }
  if (at >= 0) {
    divert = text.slice(at + 2).trim()
    text = text.slice(0, at)
  }
  return { text, divert, tags }
}

/** A label at the start: "(name) rest" → [name, rest]. */
function takeLabel(s) {
  const m = /^\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*/.exec(s)
  return m ? [m[1], s.slice(m[0].length)] : [null, s]
}

const newScope = (name, line) => ({ name, items: [], labels: new Map(), line })

/**
 * Parse an ink script. Problems found while reading (unreadable lines) are in
 * `problems`; checkInk adds the rest.
 */
export function parseInk(source) {
  braceSeq = 0
  const lines = stripComments(source || '').split('\n')
  const parsed = { vars: [], root: newScope('', 1), knots: new Map(), problems: [], choices: 0, lineCount: lines.length }
  const problem = (line, level, key, params = {}, part = 0) => parsed.problems.push({ line, level, key, params, part })
  let scope = parsed.root
  let knot = null
  let blockDepth = 0 // inside a multi-line { } block (not covered)

  // the flat items of the current scope, then built into a tree at the end of the scope
  let flat = []
  const scopes = [] // [scope, flat]
  const startScope = (sc) => {
    if (flat.length || scope) scopes.push([scope, flat])
    scope = sc
    flat = []
  }

  lines.forEach((raw, i) => {
    const line = i + 1
    const s = raw.trim()
    if (!s) return
    if (blockDepth > 0) {
      blockDepth += (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
      return
    }
    if (/^(INCLUDE|EXTERNAL|LIST)\b/.test(s)) return flat.push({ type: 'unsupported', line, what: s.split(/\s/)[0] })
    let m
    if ((m = /^(VAR|CONST)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(s))) {
      let expr = null
      try {
        expr = parseExpr(m[3])
      } catch {
        problem(line, 'error', 'badValue', { text: m[3].trim() })
      }
      parsed.vars.push({ name: m[2], expr, src: m[3].trim(), line })
      return
    }
    if (/^(VAR|CONST)\b/.test(s)) return problem(line, 'error', 'badVar', { text: s })
    if ((m = /^={2,}\s*(function\s+)?([^=(]*?)\s*(\(.*\))?\s*=*\s*$/.exec(s))) {
      if (m[1]) {
        flat.push({ type: 'unsupported', line, what: 'function' })
        return
      }
      const name = m[2].trim()
      if (!NAME.test(name)) problem(line, 'error', 'badName', { text: name })
      if (parsed.knots.has(name)) problem(line, 'error', 'duplicateKnot', { name })
      knot = { ...newScope(name, line), stitches: new Map() }
      if (!parsed.knots.has(name)) parsed.knots.set(name, knot)
      startScope(knot)
      return
    }
    if ((m = /^=\s*([^=]*?)\s*$/.exec(s)) && !s.startsWith('==')) {
      const name = m[1].trim()
      if (!NAME.test(name)) problem(line, 'error', 'badName', { text: name })
      if (!knot) {
        problem(line, 'error', 'stitchOutside', { name })
        return
      }
      if (knot.stitches.has(name)) problem(line, 'error', 'duplicateStitch', { name })
      const st = newScope(`${knot.name}.${name}`, line)
      st.knot = knot.name
      st.stitch = name
      if (!knot.stitches.has(name)) knot.stitches.set(name, st)
      startScope(st)
      return
    }
    if (s.startsWith('->->') || s.startsWith('<-')) return flat.push({ type: 'unsupported', line, what: s.startsWith('<-') ? 'thread' : 'tunnel' })
    // a multi-line { } block
    const opens = (s.match(/\{/g) || []).length
    const closes = (s.match(/\}/g) || []).length
    if (s.startsWith('{') && opens > closes) {
      blockDepth = opens - closes
      return flat.push({ type: 'unsupported', line, what: 'block' })
    }
    if (s.startsWith('~')) {
      flat.push(logicOf(s.slice(1).trim(), line, problem))
      return
    }
    if ((m = /^((?:[*+]\s*)+)(.*)$/.exec(s))) {
      const bullets = m[1].replace(/\s/g, '')
      if (new Set(bullets).size > 1) problem(line, 'error', 'mixedBullets', {})
      flat.push(choiceOf(m[2], bullets.length, bullets[0] === '+', line, problem))
      parsed.choices++
      return
    }
    if ((m = /^((?:-(?!>)\s*)+)(.*)$/.exec(s))) {
      const level = m[1].replace(/\s/g, '').length
      const [label, rest] = takeLabel(m[2])
      const g = { type: 'gather', level, label, line }
      flat.push(g)
      if (rest.trim()) flat.push(textOf(rest, line, problem))
      return
    }
    flat.push(textOf(s, line, problem))
  })
  if (blockDepth > 0) problem(lines.length, 'error', 'unclosedBlock', {})
  scopes.push([scope, flat])
  for (const [sc, items] of scopes) if (sc) build(sc, items)
  return parsed
}

function textOf(s, line, problem) {
  const glueStart = s.startsWith('<>')
  if (glueStart) s = s.slice(2)
  const { text, divert, tags } = splitLine(s)
  let body = text
  const glueEnd = /<>\s*$/.test(body)
  if (glueEnd) body = body.replace(/<>\s*$/, '')
  let parts = []
  try {
    // spaces next to glue count: "You have <>" + "{gold} coins"
    parts = parseText(glueEnd || glueStart ? body.replace(glueEnd ? /^\s+/ : /\s+$/, '') : body.trim())
  } catch {
    problem(line, 'error', 'brace', {})
  }
  if (!body.trim() && divert !== null) return { type: 'divert', target: divert, line }
  return { type: 'text', parts, divert, tags, glueStart, glueEnd: glueEnd || (divert !== null && /<>\s*$/.test(text)), line }
}

function logicOf(s, line, problem) {
  let m
  if ((m = /^(?:temp\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(\+\+|--)\s*$/.exec(s))) return { type: 'logic', name: m[1], op: m[2] === '++' ? '+=' : '-=', expr: { t: 'lit', v: 1 }, src: s, line, temp: /^temp\s/.test(s) }
  if ((m = /^(temp\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=)(?!=)\s*(.+)$/.exec(s))) {
    let expr = null
    try {
      expr = parseExpr(m[4])
    } catch {
      problem(line, 'error', 'badExpr', { text: m[4].trim() })
    }
    return { type: 'logic', name: m[2], op: m[3], expr, src: s, line, temp: !!m[1] }
  }
  // a function call or anything else: not covered
  return { type: 'unsupported', line, what: 'logic' }
}

function choiceOf(rest, level, sticky, line, problem) {
  let [label, s] = takeLabel(rest.trim())
  const conds = []
  let m
  while ((m = /^\{([^{}]*)\}\s*/.exec(s))) {
    let expr = null
    try {
      expr = parseExpr(m[1])
    } catch {
      problem(line, 'error', 'badExpr', { text: m[1].trim() })
    }
    conds.push({ src: m[1].trim(), expr })
    s = s.slice(m[0].length)
  }
  if (!label) [label, s] = takeLabel(s)
  const { text, divert, tags } = splitLine(s)
  const open = text.indexOf('[')
  const close = open >= 0 ? text.indexOf(']', open) : -1
  let start = text
  let only = ''
  let after = ''
  if (open >= 0 && close > open) {
    start = text.slice(0, open)
    only = text.slice(open + 1, close)
    after = text.slice(close + 1)
  } else if (open >= 0) problem(line, 'error', 'bracket', {})
  // glue at the end of what the choice prints: "You wave <>" + "back."
  const glueEnd = /<>\s*$/.test(open >= 0 && close > open ? after : start)
  if (glueEnd) {
    if (open >= 0 && close > open) after = after.replace(/\s*<>\s*$/, ' ')
    else start = start.replace(/\s*<>\s*$/, ' ')
  }
  const parse = (x) => {
    try {
      return parseText(x)
    } catch {
      problem(line, 'error', 'brace', {})
      return []
    }
  }
  const shown = `${start}${only}`.trim()
  if (!shown && divert === null) problem(line, 'error', 'emptyChoice', {})
  else if (!shown) problem(line, 'info', 'fallbackChoice', {})
  return {
    type: 'choice', level, sticky, label, conds, line, divert, tags,
    start: parse(start), only: parse(only), after: parse(after),
    shownSrc: shown.replace(/\s*<>$/, ''), outputs: !!`${start}${after}`.trim(), glueEnd, body: [],
  }
}

/** Build the weave of a scope from its flat items (choices own the lines below them). */
function build(scope, items) {
  const stack = [{ level: 0, list: scope.items }]
  for (const it of items) {
    if (it.type === 'choice' || it.type === 'gather') {
      while (stack.length > 1 && stack[stack.length - 1].level >= it.level) stack.pop()
    }
    const top = stack[stack.length - 1]
    top.list.push(it)
    if (it.type === 'choice') {
      it.body.parent = { list: top.list, index: top.list.length - 1 }
      stack.push({ level: it.level, list: it.body })
    }
    if ((it.type === 'choice' || it.type === 'gather') && it.label) scope.labels.set(it.label, { list: top.list, index: top.list.length - 1, item: it })
  }
}

/* ======================================================================
 * walking, facts, checks, the map
 * ==================================================================== */

/** All scopes: the root, every knot and its stitches. */
export function scopesOf(parsed) {
  const out = [parsed.root]
  for (const k of parsed.knots.values()) out.push(k, ...k.stitches.values())
  return out
}

/** Visit every item (choices' bodies too): fn(item, { scope, choice }). */
export function walk(parsed, fn) {
  const visit = (list, ctx) => {
    for (const it of list) {
      fn(it, ctx)
      if (it.type === 'choice') visit(it.body, { ...ctx, choice: it })
    }
  }
  for (const sc of scopesOf(parsed)) visit(sc.items, { scope: sc, choice: null })
}

/** The knot a scope belongs to ('' for the root). */
const knotOf = (scope) => scope.knot ?? scope.name

/**
 * Where a divert goes from a scope: { kind: 'end' | 'knot' | 'stitch' | 'label', knot, scope?, label? } or null (missing).
 */
export function resolve(parsed, from, target) {
  const t = (target || '').trim()
  if (t === 'END' || t === 'DONE') return { kind: 'end', knot: null }
  const [a, b, c] = t.split('.')
  const k = parsed.knots.get(a)
  if (k && !b) return { kind: 'knot', knot: a, scope: k }
  if (k && b && k.stitches.has(b) && !c) return { kind: 'stitch', knot: a, scope: k.stitches.get(b) }
  if (k && b && !c && k.labels.has(b)) return { kind: 'label', knot: a, scope: k, label: b }
  if (k && b && c && k.stitches.get(b)?.labels.has(c)) return { kind: 'label', knot: a, scope: k.stitches.get(b), label: c }
  // inside this knot: a stitch, or a label of this stitch / knot
  const here = knotOf(from)
  const hk = parsed.knots.get(here)
  if (!b && from.labels?.has(a)) return { kind: 'label', knot: here, scope: from, label: a }
  if (!b && hk?.stitches.has(a)) return { kind: 'stitch', knot: here, scope: hk.stitches.get(a) }
  if (!b && hk?.labels.has(a)) return { kind: 'label', knot: here, scope: hk, label: a }
  if (k && b && from.knot === a && from.labels?.has(b)) return { kind: 'label', knot: a, scope: from, label: b }
  return null
}

/** Every divert: [{ from: scope, target, line, choice }]. */
function diverts(parsed) {
  const out = []
  walk(parsed, (it, { scope, choice }) => {
    if ((it.type === 'divert' || it.type === 'text' || it.type === 'choice' || it.type === 'gather') && it.divert != null) out.push({ from: scope, target: it.divert, line: it.line, choice: it.type === 'choice' ? it : choice })
    if (it.type === 'divert') out.push({ from: scope, target: it.target, line: it.line, choice })
  })
  return out.filter((d) => d.target !== undefined && d.target !== null)
}

/** Names that count visits (knots, knot.stitch, labels). */
function visitNames(parsed) {
  const names = new Set()
  for (const sc of scopesOf(parsed)) {
    if (sc.name) names.add(sc.name)
    for (const l of sc.labels.keys()) names.add(`${sc.name ? `${sc.name}.` : ''}${l}`), names.add(l)
  }
  for (const k of parsed.knots.values()) for (const s of k.stitches.keys()) names.add(s)
  return names
}

/** The knot a story starts in: the root's first divert target, or the first knot. */
export function startKnot(parsed) {
  for (const it of parsed.root.items) {
    const target = it.type === 'divert' ? it.target : it.divert
    if (target) return resolve(parsed, parsed.root, target)?.knot || null
  }
  return parsed.root.items.length ? null : parsed.knots.keys().next().value ?? null
}

/** The map: knots as boxes, diverts between knots as arrows (labelled with the choice). */
export function graphOf(parsed) {
  const nodes = [...parsed.knots.values()].map((k) => ({ title: k.name, line: k.line }))
  const edges = []
  for (const d of diverts(parsed)) {
    const from = knotOf(d.from)
    if (!from) continue
    const r = resolve(parsed, d.from, d.target)
    if (r?.kind === 'end') continue
    if (!r) {
      edges.push({ from, to: d.target, label: d.choice?.shownSrc || '', line: d.line, missing: true })
      continue
    }
    if (r.knot === from && r.kind !== 'knot') continue // inside the knot
    edges.push({ from, to: r.knot, label: d.choice?.shownSrc || '', line: d.line, missing: false })
  }
  const start = startKnot(parsed)
  const reachable = new Set()
  const todo = start ? [start] : []
  // diverts from the root count as reachable starts too
  for (const d of diverts(parsed)) if (!knotOf(d.from)) { const r = resolve(parsed, d.from, d.target); if (r?.knot) todo.push(r.knot) }
  while (todo.length) {
    const k = todo.pop()
    if (reachable.has(k)) continue
    reachable.add(k)
    edges.filter((e) => e.from === k && !e.missing).forEach((e) => todo.push(e.to))
  }
  return { nodes, edges, start, reachable }
}

/** Facts for the guide's done ticks and goals. */
export function facts(parsed) {
  const f = { knots: parsed.knots.size, stitches: 0, knotDiverts: 0, ends: 0, choiceGroups: 0, maxGroup: 0, choices: 0, sticky: 0, gathers: 0, nested: 0, vars: parsed.vars.length, sets: 0, conditions: 0, variations: 0, visitChecks: 0, hub: false, errors: 0, texts: 0 }
  for (const k of parsed.knots.values()) f.stitches += k.stitches.size
  const visits = visitNames(parsed)
  const varNames = new Set(parsed.vars.map((v) => v.name))
  const countExpr = (e) => {
    for (const n of exprNames(e)) if (visits.has(n) && !varNames.has(n)) f.visitChecks++
  }
  const inbound = {}
  for (const d of diverts(parsed)) {
    const r = resolve(parsed, d.from, d.target)
    if (r?.kind === 'end') f.ends++
    else if (r && (r.kind === 'knot' || r.kind === 'stitch') && r.knot !== knotOf(d.from)) {
      f.knotDiverts++
      inbound[r.knot] = (inbound[r.knot] || 0) + 1
    } else if (r) inbound[r.knot ?? ''] = inbound[r.knot ?? ''] || 0
  }
  f.hub = Object.values(inbound).some((n) => n >= 2)
  const groupWalk = (list, depth) => {
    let run = 0
    for (const it of list) {
      if (it.type === 'choice') {
        run++
        f.choices++
        if (it.sticky) f.sticky++
        if (depth > 0) f.nested++
        f.conditions += it.conds.length
        for (const c of it.conds) countExpr(c.expr)
        groupWalk(it.body, depth + 1)
      } else {
        if (run) f.choiceGroups++, (f.maxGroup = Math.max(f.maxGroup, run))
        run = 0
        if (it.type === 'gather') f.gathers++
      }
    }
    if (run) f.choiceGroups++, (f.maxGroup = Math.max(f.maxGroup, run))
  }
  for (const sc of scopesOf(parsed)) groupWalk(sc.items, 0)
  walk(parsed, (it) => {
    if (it.type === 'logic') f.sets++, countExpr(it.expr)
    const parts = it.type === 'text' ? it.parts : it.type === 'choice' ? [...it.start, ...it.only, ...it.after] : []
    if (it.type === 'text' && it.parts.length) f.texts++
    if (hasVariation(parts)) f.variations++
    f.conditions += countConds(parts)
    for (const x of textExprs(parts)) countExpr(x.expr)
  })
  f.errors = checkInk(parsed).filter((c) => c.level === 'error').length
  return f
}

/**
 * Problems: [{ line, level: 'error' | 'warn' | 'info', key, params, part }]. `part` is the
 * guide part that teaches the thing (warnings and notes show from that part on).
 */
export function checkInk(parsed) {
  const out = [...parsed.problems]
  const add = (line, level, key, params = {}, part = 0) => out.push({ line, level, key, params, part })
  const varNames = new Set(parsed.vars.map((v) => v.name))
  const temps = new Set()
  walk(parsed, (it) => it.type === 'logic' && it.temp && temps.add(it.name))
  const visits = visitNames(parsed)
  const known = (n) => varNames.has(n) || temps.has(n) || visits.has(n) || visits.has(n.split('.').pop())
  const checkExpr = (e, src, line) => {
    if (!e) return add(line, 'error', 'badExpr', { text: src })
    for (const n of exprNames(e)) if (!known(n)) add(line, 'error', 'unknownName', { name: n }, 0)
  }
  // duplicate VAR
  const seenVar = new Set()
  for (const v of parsed.vars) {
    if (seenVar.has(v.name)) add(v.line, 'error', 'duplicateVar', { name: v.name })
    seenVar.add(v.name)
  }
  walk(parsed, (it, { scope }) => {
    if (it.type === 'unsupported') add(it.line, 'info', 'unsupported', { what: UNSUPPORTED[it.what] || it.what })
    if (it.type === 'logic') {
      if (!varNames.has(it.name) && !temps.has(it.name)) add(it.line, 'error', 'undeclared', { name: it.name }, 0)
      if (it.expr) checkExpr(it.expr, it.src, it.line)
    }
    if (it.type === 'choice') for (const c of it.conds) if (c.expr) checkExpr(c.expr, c.src, it.line)
    const parts = it.type === 'text' ? it.parts : it.type === 'choice' ? [...it.start, ...it.only, ...it.after] : []
    for (const x of textExprs(parts)) checkExpr(x.expr, x.src, it.line)
    if (divertInBraces(parts)) add(it.line, 'info', 'unsupported', { what: '{ … -> … }' })
    const target = it.type === 'divert' ? it.target : it.divert
    if (target != null) {
      if (!target) add(it.line, 'error', 'emptyDivert', {})
      else if (!resolve(parsed, scope, target)) add(it.line, 'error', 'missingTarget', { name: target })
    }
  })
  // structure
  const g = graphOf(parsed)
  const hasEnd = diverts(parsed).some((d) => resolve(parsed, d.from, d.target)?.kind === 'end')
  if ((parsed.knots.size || parsed.root.items.length) && !hasEnd) add(1, 'warn', 'noEnd', {}, 1)
  if (parsed.root.items.length === 0 && parsed.knots.size) add(1, 'warn', 'noStart', { name: [...parsed.knots.keys()][0] }, 1)
  for (const k of parsed.knots.values()) {
    if (!g.reachable.has(k.name)) add(k.line, 'warn', 'unreachable', { name: k.name }, 1)
    const empty = !k.items.length && !k.stitches.size
    if (empty) add(k.line, 'warn', 'emptyKnot', { name: k.name }, 1)
  }
  // a choice group with a gather missing, so the story falls off the end: shown at the weave part
  for (const sc of scopesOf(parsed)) {
    const last = sc.items[sc.items.length - 1]
    if (sc !== parsed.root && last && last.type === 'choice') {
      const open = []
      const lacks = (c) => !c.divert && !endsWithDivert(c.body)
      for (let i = sc.items.length - 1; i >= 0 && sc.items[i].type === 'choice'; i--) if (lacks(sc.items[i])) open.push(sc.items[i])
      if (open.length) add(open[open.length - 1].line, 'warn', 'looseEnd', {}, 3)
    }
  }
  return out.sort((a, b) => a.line - b.line)
}
const endsWithDivert = (list) => {
  const last = list[list.length - 1]
  if (!last) return false
  if (last.type === 'divert' || last.divert) return true
  if (last.type === 'choice') return false
  return false
}

/** How the checker names what isn't covered: ink's own syntax, the same in every language. */
const UNSUPPORTED = { function: '=== function', tunnel: '->->', thread: '<-', block: '{ … }', logic: '~ f()' }

/** Starting values of the variables (for the Play panel). */
export function initialValues(parsed) {
  const out = {}
  for (const v of parsed.vars) {
    try {
      out[v.name] = v.expr ? evalExpr(v.expr, { get: (n) => (n in out ? out[n] : 0) }) : 0
    } catch {
      out[v.name] = 0
    }
  }
  return out
}

/* ======================================================================
 * playing a story
 * ==================================================================== */

/**
 * A story player. vars: starting values. story.continue() runs until the next
 * choices or the end: { lines: [{ text, tags }], choices: [{ index, text }] | null,
 * end: bool, error?: { key, params } }. story.choose(index) picks one.
 */
export function createStory(parsed, vars = {}, random = Math.random) {
  const state = { ...initialValues(parsed), ...vars }
  const visits = {}
  const counters = {} // variation id → times shown
  const shuffles = {} // variation id → remaining order
  const chosen = new Set() // once-only choices taken
  let frames = []
  let scope = parsed.root
  let pending = null
  let steps = 0

  const visit = (name) => name && (visits[name] = (visits[name] || 0) + 1)
  const counted = visitNames(parsed)
  const ctx = {
    get(name) {
      if (name in state) return state[name]
      const k = knotOf(scope)
      for (const key of [name, k ? `${k}.${name}` : null, scope.name ? `${scope.name}.${name}` : null]) if (key && key in visits) return visits[key]
      if (counted.has(name) || counted.has(name.split('.').pop())) return 0
      throw new Error(`unknown ${name}`)
    },
  }
  const value = (e) => {
    try {
      return evalExpr(e, ctx)
    } catch {
      return 0
    }
  }

  function render(parts) {
    let out = ''
    for (const p of parts || []) {
      if (typeof p === 'string') {
        out += p
        continue
      }
      if (p.kind === 'expr') out += p.expr ? show(value(p.expr)) : `{${p.src}}`
      else if (p.kind === 'cond') out += render(p.expr && truthy(value(p.expr)) ? p.yes : p.no)
      else {
        const n = counters[p.id] || 0
        counters[p.id] = n + 1
        const k = p.options.length
        let pick
        if (p.kind === 'seq') pick = Math.min(n, k - 1)
        else if (p.kind === 'cycle') pick = n % k
        else if (p.kind === 'once') pick = n < k ? n : -1
        else {
          if (!shuffles[p.id]?.length) shuffles[p.id] = [...Array(k).keys()].sort(() => random() - 0.5)
          pick = shuffles[p.id].pop()
        }
        if (pick >= 0) out += render(p.options[pick])
      }
    }
    return out
  }

  /** Frames that resume at `index` of `list`, going up through the choices that own it. */
  function framesTo(list, index) {
    const fs = [{ list, i: index }]
    let cur = list
    while (cur.parent) {
      const { list: up, index: ci } = cur.parent
      fs.unshift({ list: up, i: afterGroup(up, ci) })
      cur = up
    }
    return fs
  }

  /** Go somewhere. Returns false for a missing target, 'end' for END/DONE. */
  function divert(target) {
    const r = resolve(parsed, scope, target)
    if (!r) return false
    if (r.kind === 'end') return 'end'
    if (r.kind === 'knot') {
      const k = r.scope
      visit(k.name)
      if (!k.items.length && k.stitches.size) {
        const first = k.stitches.values().next().value
        scope = first
        visit(first.name)
      } else scope = k
      frames = [{ list: scope.items, i: 0 }]
    } else if (r.kind === 'stitch') {
      if (r.knot !== knotOf(scope)) visit(r.knot)
      scope = r.scope
      visit(scope.name)
      frames = [{ list: scope.items, i: 0 }]
    } else {
      if (r.knot !== knotOf(scope)) visit(r.knot)
      scope = r.scope
      const at = scope.labels.get(r.label)
      frames = framesTo(at.list, at.index)
    }
    return true
  }

  frames = [{ list: parsed.root.items, i: 0 }]

  function cont(lines = [], glue = false) {
    const emit = (text, tags = [], glueStart = false, glueEnd = false) => {
      const t = text.replace(/\s+/g, ' ')
      if ((glue || glueStart) && lines.length) {
        lines[lines.length - 1].text = `${lines[lines.length - 1].text}${t}`.replace(/\s+/g, ' ')
        lines[lines.length - 1].tags.push(...tags)
      } else if (t.trim() || tags.length) lines.push({ text: t.replace(/^\s+/, ''), tags: [...tags] })
      glue = glueEnd
    }
    const done = (extra) => {
      for (const l of lines) l.text = l.text.trim()
      return { lines: lines.filter((l) => l.text || l.tags.length), choices: null, end: true, ...extra }
    }
    while (steps++ < STEP_LIMIT) {
      const top = frames[frames.length - 1]
      if (!top) return done({ ranOut: scope !== parsed.root || parsed.knots.size > 0 })
      if (top.i >= top.list.length) {
        frames.pop()
        continue
      }
      const it = top.list[top.i]
      if (it.type === 'choice') {
        // the group: this choice and the ones right after it
        let j = top.i
        const group = []
        while (j < top.list.length && top.list[j].type === 'choice') group.push(top.list[j++])
        const open = group.filter((c) => (c.sticky || !chosen.has(c)) && c.conds.every((cd) => cd.expr && truthy(value(cd.expr))))
        const shown = open.filter((c) => c.shownSrc)
        if (!shown.length) {
          // a fallback choice (no text) is taken by itself; none: go on after the group
          const fb = open.find((c) => !c.shownSrc)
          if (fb) {
            const t = takeChoice(top, fb)
            if (t.output || t.tags.length) emit(t.output, t.tags)
            if (t.divert) {
              const r = divert(t.divert)
              if (r === 'end') return done({})
              if (!r) return done({ error: { key: 'missingTarget', params: { name: t.divert } } })
            }
            continue
          }
          top.i = afterGroup(top.list, top.i)
          if (top.i >= top.list.length && !group.some((c) => c.label)) return { ...done({ error: { key: 'noChoices', params: {} } }) }
          continue
        }
        pending = { frame: top, list: shown }
        for (const l of lines) l.text = l.text.trim()
        return { lines: lines.filter((l) => l.text || l.tags.length), choices: shown.map((c, index) => ({ index, text: render([...c.start, ...c.only]).replace(/\s+/g, ' ').trim() })), end: false }
      }
      top.i++
      if (it.type === 'gather') {
        if (it.label) visit(`${scope.name ? `${scope.name}.` : ''}${it.label}`)
        continue
      }
      if (it.type === 'logic') {
        if (it.expr) {
          const v = value(it.expr)
          state[it.name] = it.op === '=' ? v : it.op === '+=' ? num(state[it.name]) + num(v) : num(state[it.name]) - num(v)
        }
        continue
      }
      if (it.type === 'text') emit(render(it.parts), it.tags, it.glueStart, it.glueEnd)
      const target = it.type === 'divert' ? it.target : it.divert
      if (target != null && target !== '') {
        const r = divert(target)
        if (r === 'end') return done({})
        if (!r) return done({ error: { key: 'missingTarget', params: { name: target } } })
      }
    }
    return done({ error: { key: 'loop', params: {} } })
  }

  /** Take a choice: the flow goes on in its body, then after its group. Returns what it prints and where it goes. */
  function takeChoice(frame, c) {
    chosen.add(c)
    if (c.label) visit(`${scope.name ? `${scope.name}.` : ''}${c.label}`)
    frame.i = afterGroup(frame.list, frame.list.indexOf(c))
    frames.push({ list: c.body, i: 0 })
    const output = c.outputs ? render([...c.start, ...c.after]).replace(/\s+/g, ' ') : ''
    return { output: c.glueEnd ? output.replace(/^\s+/, '') : output.trim(), tags: c.tags, divert: c.divert, glue: c.glueEnd }
  }
  let taken = null // what the last choice prints, before the story goes on

  return {
    vars: state,
    visits,
    continue() {
      const pre = []
      const t = taken
      taken = null
      if (t && (t.output || t.tags.length)) pre.push({ text: t.glue ? t.output : t.output.trim(), tags: [...t.tags] })
      const trimmed = () => pre.map((l) => ({ ...l, text: l.text.trim() }))
      if (t?.divert) {
        const d = t.divert
        const r = divert(d)
        if (r === 'end') return { lines: trimmed(), choices: null, end: true }
        if (!r) return { lines: trimmed(), choices: null, end: true, error: { key: 'missingTarget', params: { name: d } } }
      }
      return cont(pre, !!t?.glue && pre.length > 0)
    },
    choose(index) {
      if (!pending) return
      const c = pending.list[index]
      const frame = pending.frame
      pending = null
      if (!c) return
      // the frame must still be on top: drop anything above it
      frames = frames.slice(0, frames.indexOf(frame) + 1)
      taken = takeChoice(frame, c)
    },
  }
}

/** Index right after a group of choices in a list, at its next gather if there is one. */
function afterGroup(list, i) {
  let j = i
  while (j < list.length && list[j].type === 'choice') j++
  return j
}

/** A file name for the .ink download. */
export const fileName = (title) => `${(title || 'story').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'story'}.ink`
