<script setup>
import { computed } from 'vue'
import { t } from '../i18n'
import { edges, reachable, startNode } from '../writing/yarn'

/*
 * Map of a Yarn conversation: one box per node, in columns by how many jumps
 * it is from the start node; arrows for jumps, labelled with the option that
 * leads there. A jump to a missing node points to a dashed red box; a node
 * nothing leads to is greyed out in the last column. Clicking a box emits
 * `goto` with its title line.
 * Other story formats (ink) pass a ready `graph` instead of a parsed Yarn script:
 * { nodes: [{ title, line }], edges: [{ from, to, label, line, missing }], start, reachable: Set }.
 */
const props = defineProps({ parsed: { type: Object, default: null }, graph: { type: Object, default: null } })
const emit = defineEmits(['goto'])

const W = 150
const H = 38
const GAP_X = 140
const GAP_Y = 26
const PAD = 22

/** A point on a cubic Bézier curve at t (0–1). */
const cubic = (t, p0, p1, p2, p3) => [0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k])

const short = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

const layout = computed(() => {
  const g = props.graph
  const nodes = g ? g.nodes : props.parsed.nodes.filter((n) => n.title)
  const es = g ? g.edges : edges(props.parsed)
  const start = g ? g.start : startNode(props.parsed)?.title
  const reach = g ? g.reachable : reachable(props.parsed)

  // depth: breadth-first from the start node
  const depth = new Map()
  if (start) {
    depth.set(start, 0)
    const queue = [start]
    while (queue.length) {
      const cur = queue.shift()
      for (const e of es) {
        if (e.from === cur && !e.missing && !depth.has(e.to)) {
          depth.set(e.to, depth.get(cur) + 1)
          queue.push(e.to)
        }
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values())
  const boxes = []
  const byKey = new Map()
  const place = (key, title, col, kind, line) => {
    if (byKey.has(key)) return
    const b = { key, title, col, kind, line }
    byKey.set(key, b)
    boxes.push(b)
  }
  const seenTitles = new Set()
  for (const n of nodes) {
    if (seenTitles.has(n.title)) continue
    seenTitles.add(n.title)
    const reached = reach.has(n.title)
    place(n.title, n.title, reached ? depth.get(n.title) : maxDepth + 1, n.title === start ? 'start' : reached ? 'node' : 'lost', n.titleLine || n.line)
  }
  for (const e of es) {
    if (!e.missing) continue
    const from = byKey.get(e.from)
    place(`missing:${e.to}`, e.to, (from?.col ?? 0) + 1, 'missing', e.line)
  }
  // rows within each column
  const rows = {}
  for (const b of boxes) {
    b.row = rows[b.col] = (rows[b.col] ?? -1) + 1
    b.x = PAD + b.col * (W + GAP_X)
    b.y = PAD + b.row * (H + GAP_Y)
  }
  const maxY = Math.max(0, ...boxes.map((b) => b.y + H))

  // arrows
  const arrows = []
  es.forEach((e, i) => {
    const a = byKey.get(e.from)
    const b = byKey.get(e.missing ? `missing:${e.to}` : e.to)
    if (!a || !b) return
    let d
    let lx
    let ly
    if (a === b) {
      // a node that jumps to itself: a small loop on the right
      const x = a.x + W
      const y = a.y + H / 2
      d = `M ${x} ${y - 8} C ${x + 40} ${y - 30}, ${x + 40} ${y + 30}, ${x} ${y + 8}`
      // label above the box, so it doesn't sit on the arrows leaving to the right
      lx = a.x + W / 2
      ly = a.y - 2
    } else if (b.col > a.col) {
      const x1 = a.x + W
      const y1 = a.y + H / 2
      const x2 = b.x
      const y2 = b.y + H / 2
      const dx = (x2 - x1) / 2
      d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
      // label at 65% of the curve: arrows from the same node have split apart by then
      const p = cubic(0.65, [x1, y1], [x1 + dx, y1], [x2 - dx, y2], [x2, y2])
      lx = p[0]
      ly = p[1]
    } else {
      // back to an earlier (or the same) column: go round underneath
      const x1 = a.x + W / 2 + 12
      const y1 = a.y + H
      const x2 = b.x + W / 2 - 12
      const y2 = b.y + H
      const low = maxY + 18 + (i % 4) * 10
      d = `M ${x1} ${y1} C ${x1} ${low}, ${x2} ${low}, ${x2} ${y2}`
      lx = (x1 + x2) / 2
      ly = low - 6
    }
    arrows.push({ key: `${i}`, d, missing: e.missing, label: e.label ? short(e.label, 16) : '', full: e.label, lx, ly })
  })
  const cols = Math.max(0, ...boxes.map((b) => b.col)) + 1
  const hasBack = arrows.some((a) => a.ly > maxY)
  return {
    boxes,
    arrows,
    width: PAD * 2 + cols * W + (cols - 1) * GAP_X + 40,
    height: maxY + PAD + (hasBack ? 60 : 0),
  }
})
</script>

<template>
  <div class="yarn-map">
    <p v-if="!layout.boxes.length" class="muted">{{ t('writing.game.mapEmpty') }}</p>
    <svg v-else :style="{ width: `${layout.width}px`, minWidth: `${Math.min(layout.width, 560)}px` }" class="fit" :viewBox="`0 0 ${layout.width} ${layout.height}`" role="img" :aria-label="t('writing.game.mapLabel', { n: layout.boxes.length })">
      <defs>
        <marker id="yarn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-head" />
        </marker>
        <marker id="yarn-arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" class="arrow-head bad" />
        </marker>
      </defs>
      <g v-for="a in layout.arrows" :key="a.key">
        <path :d="a.d" class="edge" :class="{ bad: a.missing }" :marker-end="a.missing ? 'url(#yarn-arrow-bad)' : 'url(#yarn-arrow)'" />
        <text v-if="a.label" :x="a.lx" :y="a.ly - 4" class="edge-label" text-anchor="middle"><title>{{ a.full }}</title>{{ a.label }}</text>
      </g>
      <g
        v-for="b in layout.boxes"
        :key="b.key"
        class="box"
        :class="`k-${b.kind}`"
        role="button"
        tabindex="0"
        :aria-label="t(`writing.game.mapKinds.${b.kind}`, { title: b.title })"
        @click="emit('goto', b.line)"
        @keydown.enter.prevent="emit('goto', b.line)"
        @keydown.space.prevent="emit('goto', b.line)"
      >
        <title>{{ t(`writing.game.mapKinds.${b.kind}`, { title: b.title }) }}</title>
        <rect :x="b.x" :y="b.y" :width="W" :height="H" rx="8" />
        <text :x="b.x + W / 2" :y="b.y + H / 2 + 5" text-anchor="middle">{{ b.kind === 'start' ? '▶ ' : '' }}{{ short(b.title, 17) }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.yarn-map { overflow-x: auto; padding-bottom: 0.25rem; }
/* shrink to fit the column (down to 560px wide), scroll beyond that */
svg.fit { max-width: 100%; }
svg { display: block; height: auto; font: 13px ui-monospace, 'Cascadia Code', Consolas, monospace; font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }
.edge { fill: none; stroke: var(--muted); stroke-width: 1.6; }
.edge.bad { stroke: var(--danger, #c0392b); stroke-dasharray: 5 4; }
.arrow-head { fill: var(--muted); }
.arrow-head.bad { fill: var(--danger, #c0392b); }
.edge-label { font-size: 11px; fill: var(--text); paint-order: stroke; stroke: var(--surface); stroke-width: 4px; stroke-linejoin: round; }
.box { cursor: pointer; }
.box rect { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
.box text { fill: var(--text); }
.box:hover rect, .box:focus-visible rect { stroke: var(--accent); stroke-width: 2.5; }
.box:focus { outline: none; }
.k-start rect { stroke: var(--accent); stroke-width: 2.5; }
.k-start text { font-weight: 700; }
.k-lost { opacity: 0.55; }
.k-lost rect { stroke-dasharray: 4 3; }
.k-missing rect { fill: color-mix(in srgb, var(--danger, #c0392b) 10%, var(--surface)); stroke: var(--danger, #c0392b); stroke-dasharray: 5 4; }
.k-missing text { fill: var(--danger, #c0392b); }
</style>
