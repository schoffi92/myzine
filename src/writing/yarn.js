/*
 * A small Yarn Spinner reader for the Game dialogue practice: parser, checker,
 * expression evaluator and a step-by-step runner. Pure JS, no Vue, no eval.
 *
 * Supported (the part of Yarn a beginner writes):
 *   title: Name / other headers, ---, body, ===      nodes
 *   Speaker: text #tag      a line (no "Name:" → narration); {$var} or {expr} inside
 *   -> Option text <<if expr>> #tag   options; the lines indented under one run when it's chosen
 *   <<jump Node>> <<stop>> <<set $x to expr>> <<declare $x = expr>>
 *   <<if expr>> <<elseif expr>> <<else>> <<endif>>
 *   <<anything else>>       a game command: shown in Play as a stage direction
 *   // comment
 * Expressions: true false numbers "strings" $vars, not ! and && or || xor,
 * == is eq != neq < > <= >= lt gt lte gte, + - * / %, ( ), and the functions
 * visited("Node"), visited_count("Node"), dice(n), random(), random_range(a, b).
 */

/* ---------- expressions ---------- */

const WORD_OPS = { and: '&&', or: '||', not: '!', xor: '^', is: '==', eq: '==', neq: '!=', lt: '<', gt: '>', lte: '<=', gte: '>=' }
const FUNCS = ['visited', 'visited_count', 'dice', 'random', 'random_range']

class ExprError extends Error {}

function tokenize(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    let m
    const rest = src.slice(i)
    if ((m = /^\d+(\.\d+)?/.exec(rest))) out.push({ t: 'num', v: Number(m[0]) })
    else if ((m = /^"((?:[^"\\]|\\.)*)"/.exec(rest))) out.push({ t: 'str', v: m[1].replace(/\\(.)/g, '$1') })
    else if ((m = /^\$[A-Za-z_]\w*/.exec(rest))) out.push({ t: 'var', v: m[0] })
    else if ((m = /^(==|!=|<=|>=|&&|\|\||[<>!+\-*/%(),^])/.exec(rest))) out.push({ t: 'op', v: m[0] })
    else if ((m = /^[A-Za-z_]\w*/.exec(rest))) {
      const w = m[0]
      if (w === 'true' || w === 'false') out.push({ t: 'bool', v: w === 'true' })
      else if (WORD_OPS[w]) out.push({ t: 'op', v: WORD_OPS[w] })
      else out.push({ t: 'name', v: w })
    } else throw new ExprError(c)
    i += m[0].length
  }
  return out
}

/** Parse an expression into a small tree; throws ExprError if it can't be read. */
export function parseExpr(src) {
  const toks = tokenize(src)
  let p = 0
  const peek = () => toks[p]
  const isOp = (...ops) => peek()?.t === 'op' && ops.includes(peek().v)
  const bin = (next, ...ops) => () => {
    let a = next()
    while (isOp(...ops)) {
      const op = toks[p++].v
      a = { t: 'bin', op, a, b: next() }
    }
    return a
  }
  const primary = () => {
    const tk = toks[p++]
    if (!tk) throw new ExprError('end')
    if (tk.t === 'num' || tk.t === 'str' || tk.t === 'bool') return { t: 'lit', v: tk.v }
    if (tk.t === 'var') return { t: 'var', name: tk.v }
    if (tk.t === 'op' && tk.v === '(') {
      const e = or()
      if (!isOp(')')) throw new ExprError(')')
      p++
      return e
    }
    if (tk.t === 'name' && FUNCS.includes(tk.v) && isOp('(')) {
      p++
      const args = []
      if (!isOp(')')) {
        args.push(or())
        while (isOp(',')) p++, args.push(or())
      }
      if (!isOp(')')) throw new ExprError(')')
      p++
      return { t: 'call', name: tk.v, args }
    }
    throw new ExprError(tk.v)
  }
  const unary = () => (isOp('!', '-') ? { t: 'un', op: toks[p++].v, a: unary() } : primary())
  const mul = bin(unary, '*', '/', '%')
  const add = bin(mul, '+', '-')
  const cmp = bin(add, '<', '>', '<=', '>=')
  const eq = bin(cmp, '==', '!=')
  const and = bin(eq, '&&')
  const or = bin(and, '||', '^')
  if (!toks.length) throw new ExprError('empty')
  const e = or()
  if (p < toks.length) throw new ExprError(String(toks[p].v))
  return e
}

/** The $variables an expression reads. */
export function exprVars(e, out = new Set()) {
  if (!e) return out
  if (e.t === 'var') out.add(e.name)
  if (e.a) exprVars(e.a, out)
  if (e.b) exprVars(e.b, out)
  if (e.args) e.args.forEach((x) => exprVars(x, out))
  return out
}

/** Evaluate an expression tree. ctx: { get(name), visits(node) }. */
export function evalExpr(e, ctx) {
  switch (e.t) {
    case 'lit': return e.v
    case 'var': return ctx.get(e.name)
    case 'un': {
      const a = evalExpr(e.a, ctx)
      return e.op === '!' ? !a : -a
    }
    case 'call': {
      const args = e.args.map((x) => evalExpr(x, ctx))
      if (e.name === 'visited') return ctx.visits(String(args[0])) > 0
      if (e.name === 'visited_count') return ctx.visits(String(args[0]))
      if (e.name === 'dice') return 1 + Math.floor(Math.random() * Math.max(1, Number(args[0]) || 1))
      if (e.name === 'random') return Math.random()
      const [lo, hi] = args.map(Number)
      return lo + Math.floor(Math.random() * (hi - lo + 1))
    }
    case 'bin': {
      if (e.op === '&&') return !!evalExpr(e.a, ctx) && !!evalExpr(e.b, ctx)
      if (e.op === '||') return !!evalExpr(e.a, ctx) || !!evalExpr(e.b, ctx)
      const a = evalExpr(e.a, ctx)
      const b = evalExpr(e.b, ctx)
      switch (e.op) {
        case '^': return !!a !== !!b
        case '==': return a === b
        case '!=': return a !== b
        case '<': return a < b
        case '>': return a > b
        case '<=': return a <= b
        case '>=': return a >= b
        case '+': return typeof a === 'string' || typeof b === 'string' ? `${a}${b}` : a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return b ? a / b : 0
        case '%': return b ? a % b : 0
      }
    }
  }
  return undefined
}

/* ---------- parsing ---------- */

const indentOf = (raw) => raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length

/** Remove a // comment (at the start, or after a space, so "http://" in text survives). */
const stripComment = (s) => s.replace(/(^|\s)\/\/.*$/, '').trimEnd()

/** Split off trailing #tags: "Hi there #gruff #line:12" → { text: 'Hi there', tags: ['gruff', 'line:12'] }. */
function splitTags(s) {
  const m = /((?:\s+#[^\s#]+)+)\s*$/.exec(` ${s}`)
  if (!m) return { text: s.trim(), tags: [] }
  return { text: ` ${s}`.slice(0, m.index).trim(), tags: m[1].trim().split(/\s+/).map((x) => x.slice(1)) }
}

/** One body line → a token, or null for an empty line. errors gets { line, key, params }. */
function tokenLine(raw, line, errors) {
  const s = stripComment(raw)
  const t = s.trim()
  if (!t) return null
  const indent = indentOf(s)
  const expr = (src, key) => {
    try {
      return parseExpr(src)
    } catch (e) {
      errors.push({ line, key, params: { text: src.trim() || '…' } })
      return null
    }
  }

  if (t.startsWith('->')) {
    let { text, tags } = splitTags(t.slice(2))
    let cond = null
    let condSrc = ''
    const m = /<<\s*if\s+(.*?)\s*>>\s*$/.exec(text)
    if (m) {
      condSrc = m[1]
      cond = expr(m[1], 'badExpr')
      text = text.slice(0, m.index).trim()
    }
    if (!text) errors.push({ line, key: 'emptyOption' })
    return { kind: 'option', indent, line, text, tags, cond, condSrc }
  }

  const cmd = /^<<\s*(.*?)\s*>>$/.exec(t)
  if (cmd) {
    const inner = cmd[1]
    const word = inner.split(/\s+/)[0]
    const rest = inner.slice(word.length).trim()
    switch (word) {
      case 'jump':
        if (!/^[A-Za-z_][\w.]*$/.test(rest)) errors.push({ line, key: 'badJump', params: { text: rest || '…' } })
        return { kind: 'jump', indent, line, target: rest }
      case 'stop':
        return { kind: 'stop', indent, line }
      case 'set':
      case 'declare': {
        const m = /^(\$[A-Za-z_]\w*)\s*(?:to|=)\s*(.+)$/.exec(rest)
        if (!m) {
          errors.push({ line, key: word === 'set' ? 'badSet' : 'badDeclare', params: { text: rest || '…' } })
          return null
        }
        return { kind: word, indent, line, name: m[1], expr: expr(m[2], 'badExpr'), src: m[2] }
      }
      case 'if':
      case 'elseif':
        return { kind: word, indent, line, cond: expr(rest, 'badExpr'), condSrc: rest }
      case 'else':
      case 'endif':
        return { kind: word, indent, line }
      default:
        return { kind: 'command', indent, line, text: inner }
    }
  }
  if (t.startsWith('<<')) errors.push({ line, key: 'badCommand', params: { text: t } })

  const { text, tags } = splitTags(t)
  const sp = /^([^:{}<>#]{1,40}?):\s*(.*)$/.exec(text)
  return sp && sp[2]
    ? { kind: 'line', indent, line, speaker: sp[1].trim(), text: sp[2], tags }
    : { kind: 'line', indent, line, speaker: null, text, tags }
}

/** Tokens of a body → statements, following option indentation and if/endif. */
function buildBlock(toks, errors) {
  let p = 0
  function block(inIf) {
    const out = []
    while (p < toks.length) {
      const tk = toks[p]
      if (tk.kind === 'elseif' || tk.kind === 'else' || tk.kind === 'endif') {
        if (inIf) return out
        errors.push({ line: tk.line, key: 'strayEndif', params: { text: `<<${tk.kind}>>` } })
        p++
        continue
      }
      if (tk.kind === 'option') {
        const indent = tk.indent
        const options = []
        while (p < toks.length && toks[p].kind === 'option' && toks[p].indent === indent) {
          const o = toks[p++]
          const sub = []
          while (p < toks.length && toks[p].indent > indent) sub.push(toks[p++])
          options.push({ text: o.text, tags: o.tags, cond: o.cond, condSrc: o.condSrc, line: o.line, body: buildBlock(sub, errors) })
        }
        out.push({ type: 'options', line: tk.line, options })
        continue
      }
      if (tk.kind === 'if') {
        p++
        const branches = [{ cond: tk.cond, condSrc: tk.condSrc, line: tk.line, body: block(true) }]
        let closed = false
        while (p < toks.length) {
          const k = toks[p]
          if (k.kind === 'endif') {
            p++
            closed = true
            break
          }
          p++
          branches.push({ cond: k.kind === 'elseif' ? k.cond : null, condSrc: k.condSrc || '', line: k.line, else: k.kind === 'else', body: block(true) })
        }
        if (!closed) errors.push({ line: tk.line, key: 'unclosedIf' })
        out.push({ type: 'if', line: tk.line, branches })
        continue
      }
      p++
      const { kind, ...rest } = tk
      out.push({ type: kind, ...rest })
    }
    return out
  }
  return block(false)
}

/**
 * Parse Yarn source: { nodes: [{ title, line, endLine, headers, body }], errors }.
 * Line numbers are 1-based.
 */
export function parseYarn(src) {
  const lines = (src || '').split(/\r?\n/)
  const nodes = []
  const errors = []
  let node = null // node being read
  let mode = 'out' // out | header | body
  let toks = []

  const finish = (endLine) => {
    node.endLine = endLine
    node.body = buildBlock(toks, errors)
    if (!node.title) errors.push({ line: node.line, key: 'noTitle' })
    nodes.push(node)
    node = null
    toks = []
    mode = 'out'
  }

  lines.forEach((raw, i) => {
    const line = i + 1
    const t = stripComment(raw).trim()
    if (mode === 'body') {
      if (t === '===') return finish(line)
      if (t === '---') return errors.push({ line, key: 'extraStart' })
      if (/^title\s*:\s*\S/.test(t) && !raw.startsWith(' ')) {
        // a new node starts: this one is missing its ===
        errors.push({ line: node.line, key: 'noEnd', params: { title: node.title || '…' } })
        finish(line - 1)
        node = { title: '', line, headers: {} }
        mode = 'header'
        const title = t.replace(/^title\s*:\s*/, '').trim()
        node.title = title
        node.titleLine = line
        return
      }
      const tk = tokenLine(raw, line, errors)
      if (tk) toks.push(tk)
      return
    }
    if (!t) return
    if (mode === 'out') {
      node = { title: '', line, headers: {} }
      mode = 'header'
    }
    if (t === '---') {
      mode = 'body'
      return
    }
    if (t === '===') {
      errors.push({ line, key: 'noStart' })
      return finish(line)
    }
    const h = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(t)
    if (!h) return errors.push({ line, key: 'badHeader', params: { text: t } })
    if (h[1] === 'title') {
      if (node.title) {
        // a second title: the previous node is missing its ---/===
        errors.push({ line: node.line, key: 'noStart' })
        finish(line - 1)
        node = { title: '', line, headers: {} }
        mode = 'header'
      }
      node.title = h[2].trim()
      node.titleLine = line
      if (!/^[A-Za-z_][\w.]*$/.test(node.title)) errors.push({ line, key: 'badTitle', params: { text: node.title || '…' } })
    } else node.headers[h[1]] = h[2]
  })
  if (node) {
    errors.push({ line: node.line, key: mode === 'body' ? 'noEnd' : 'noStart', params: { title: node.title || '…' } })
    finish(lines.length)
  }
  return { nodes, errors }
}

/* ---------- walking the tree ---------- */

/** Call fn(stmt, ctx) for every statement; ctx.option is the option it's under, if any. */
export function walk(stmts, fn, option = null) {
  for (const s of stmts || []) {
    fn(s, { option })
    if (s.type === 'options') s.options.forEach((o) => walk(o.body, fn, o))
    if (s.type === 'if') s.branches.forEach((b) => walk(b.body, fn, option))
  }
}

/** The node the conversation starts at: "Start" if there is one, else the first. */
export const startNode = (parsed) => parsed.nodes.find((n) => n.title === 'Start') || parsed.nodes[0] || null

/** Jumps between nodes: [{ from, to, label, line, missing }]. */
export function edges(parsed) {
  const titles = new Set(parsed.nodes.map((n) => n.title))
  const out = []
  for (const n of parsed.nodes) {
    walk(n.body, (s, { option }) => {
      if (s.type === 'jump' && s.target) out.push({ from: n.title, to: s.target, label: option?.text || '', line: s.line, missing: !titles.has(s.target) })
    })
  }
  return out
}

/** Titles reachable from the start node through jumps. */
export function reachable(parsed) {
  const start = startNode(parsed)
  const seen = new Set()
  if (!start) return seen
  const es = edges(parsed)
  const todo = [start.title]
  while (todo.length) {
    const t = todo.pop()
    if (seen.has(t)) continue
    seen.add(t)
    es.filter((e) => e.from === t && !e.missing).forEach((e) => todo.push(e.to))
  }
  return seen
}

/** A value of the type an expression gives (for guessing a variable's starting value). */
function sampleOf(e) {
  if (!e) return undefined
  if (e.t === 'lit') return e.v
  if (e.t === 'bin' && ['+', '-', '*', '/', '%'].includes(e.op)) return sampleOf(e.a) ?? sampleOf(e.b) ?? 0
  if (e.t === 'un' && e.op === '-') return 0
  if (e.t === 'bin' || (e.t === 'un' && e.op === '!')) return false
  if (e.t === 'call') return e.name === 'visited' ? false : 0
  return undefined
}

/** Variables: { name: { declared, initial, set, used } }. */
export function variables(parsed) {
  const vars = {}
  const v = (name) => (vars[name] ||= { declared: false, initial: undefined, set: false, used: false, sample: undefined })
  const readText = (text) => {
    for (const m of (text || '').matchAll(/\{([^}]*)\}/g)) {
      try {
        exprVars(parseExpr(m[1])).forEach((n) => (v(n).used = true))
      } catch { /* not an expression */ }
    }
  }
  for (const n of parsed.nodes) {
    walk(n.body, (s) => {
      if (s.type === 'declare') {
        const x = v(s.name)
        x.declared = true
        if (s.expr?.t === 'lit') x.initial = s.expr.v
      }
      if (s.type === 'set') {
        const x = v(s.name)
        x.set = true
        if (x.sample === undefined) x.sample = sampleOf(s.expr)
        if (s.expr) exprVars(s.expr).forEach((k) => (v(k).used = true))
      }
      if (s.type === 'if') s.branches.forEach((b) => b.cond && exprVars(b.cond).forEach((k) => (v(k).used = true)))
      if (s.type === 'options') s.options.forEach((o) => {
        if (o.cond) exprVars(o.cond).forEach((k) => (v(k).used = true))
        readText(o.text)
      })
      if (s.type === 'line') readText(s.text)
    })
  }
  return vars
}

/** Starting value of each variable: the declared one, else false / 0 / "" by what is set. */
export function initialValues(parsed) {
  const out = {}
  for (const [name, x] of Object.entries(variables(parsed))) {
    if (x.initial !== undefined) out[name] = x.initial
    else if (typeof x.sample === 'number') out[name] = 0
    else if (typeof x.sample === 'string') out[name] = ''
    else out[name] = false
  }
  return out
}

/* ---------- checks ---------- */

/**
 * Problems in a script: [{ line, level, key, params, part }]. `part` is the
 * guide part that teaches the thing, so the page can hold back warnings
 * about what the writer hasn't learnt yet. Errors are always shown.
 */
export function checkYarn(parsed) {
  const PART = { noTitle: 1, badTitle: 1, noStart: 1, noEnd: 1, extraStart: 1, badHeader: 1, duplicate: 1, emptyNode: 1, badCommand: 2, emptyOption: 2, badJump: 2, missingNode: 2, unreachable: 2, endNode: 2, badSet: 3, badDeclare: 3, undeclaredVar: 3, badExpr: 4, unclosedIf: 4, strayEndif: 4 }
  const out = parsed.errors.map((e) => ({ ...e, level: 'error', part: PART[e.key] || 1 }))
  const add = (level, key, line, params) => out.push({ level, key, line, params, part: PART[key] })

  const seen = new Map()
  for (const n of parsed.nodes) {
    if (!n.title) continue
    if (seen.has(n.title)) add('error', 'duplicate', n.titleLine || n.line, { title: n.title })
    else seen.set(n.title, n)
    if (!n.body.length) add('warn', 'emptyNode', n.line, { title: n.title })
  }
  for (const e of edges(parsed)) if (e.missing) add('error', 'missingNode', e.line, { title: e.to })

  const reach = reachable(parsed)
  const es = edges(parsed)
  for (const n of parsed.nodes) {
    if (!n.title) continue
    if (!reach.has(n.title)) add('warn', 'unreachable', n.titleLine || n.line, { title: n.title })
    else if (!es.some((e) => e.from === n.title)) add('info', 'endNode', n.titleLine || n.line, { title: n.title })
  }
  for (const [name, x] of Object.entries(variables(parsed))) {
    if (x.used && !x.declared && !x.set) {
      const where = firstUse(parsed, name)
      add('warn', 'undeclaredVar', where, { name })
    }
  }
  return out.sort((a, b) => a.line - b.line)
}

function firstUse(parsed, name) {
  let line = 1
  let found = false
  for (const n of parsed.nodes) {
    walk(n.body, (s) => {
      if (found) return
      const exprs = [s.expr, ...(s.branches || []).map((b) => b.cond), ...(s.options || []).map((o) => o.cond)].filter(Boolean)
      if (exprs.some((e) => exprVars(e).has(name)) || (s.type === 'line' && s.text.includes(name))) {
        line = s.line
        found = true
      }
    })
  }
  return line
}

/* ---------- running ---------- */

const STEP_LIMIT = 2000

/**
 * Play a conversation step by step.
 *   const r = createRunner(parsed, { $gold: 5 }, 'Start')
 *   r.next() → { type: 'line', speaker, text, tags } | { type: 'command', text }
 *            | { type: 'options', options: [{ text, available, condSrc, tags }] }
 *            | { type: 'end' } | { type: 'error', key, params }
 *   r.choose(i) after 'options'; r.vars holds the current values.
 */
export function createRunner(parsed, vars = {}, startTitle) {
  const byTitle = new Map(parsed.nodes.filter((n) => n.title).map((n) => [n.title, n]))
  const state = { ...vars }
  const visits = {}
  let stack = []
  let pending = null // options waiting for a choice
  let steps = 0

  const ctx = { get: (name) => (name in state ? state[name] : false), visits: (t) => visits[t] || 0 }
  const enter = (title) => {
    const n = byTitle.get(title)
    if (!n) return false
    visits[title] = (visits[title] || 0) + 1
    stack = [{ stmts: n.body, i: 0 }]
    return true
  }
  const safe = (e, fallback) => {
    try {
      return e ? evalExpr(e, ctx) : fallback
    } catch {
      return fallback
    }
  }
  const interpolate = (text) =>
    text.replace(/\{([^}]*)\}/g, (all, src) => {
      try {
        const v = evalExpr(parseExpr(src), ctx)
        return typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v)
      } catch {
        return all
      }
    })

  const start = startTitle && byTitle.has(startTitle) ? startTitle : startNode(parsed)?.title
  if (!start || !enter(start)) stack = []

  function next() {
    if (pending) return pending
    while (steps++ < STEP_LIMIT) {
      const top = stack[stack.length - 1]
      if (!top) return { type: 'end' }
      if (top.i >= top.stmts.length) {
        stack.pop()
        continue
      }
      const s = top.stmts[top.i++]
      switch (s.type) {
        case 'line':
          return { type: 'line', speaker: s.speaker, text: interpolate(s.text), tags: s.tags, line: s.line }
        case 'command':
          return { type: 'command', text: interpolate(s.text), line: s.line }
        case 'set':
          if (s.expr) state[s.name] = safe(s.expr, state[s.name])
          break
        case 'declare':
          if (!(s.name in state) && s.expr) state[s.name] = safe(s.expr, false)
          break
        case 'jump':
          if (!enter(s.target)) return { type: 'error', key: 'missingNode', params: { title: s.target } }
          break
        case 'stop':
          stack = []
          return { type: 'end' }
        case 'if': {
          const b = s.branches.find((x) => x.else || safe(x.cond, false))
          if (b) stack.push({ stmts: b.body, i: 0 })
          break
        }
        case 'options':
          pending = {
            type: 'options',
            line: s.line,
            options: s.options.map((o) => ({ text: interpolate(o.text), tags: o.tags, condSrc: o.condSrc, available: o.cond ? !!safe(o.cond, false) : true, body: o.body })),
          }
          return pending
      }
    }
    return { type: 'error', key: 'loop' }
  }

  function choose(i) {
    const o = pending?.options[i]
    if (!o || !o.available) return
    pending = null
    stack.push({ stmts: o.body, i: 0 })
  }

  return { next, choose, vars: state, visits }
}
