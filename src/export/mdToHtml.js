/*
 * A small Markdown → HTML renderer for the Markdown that src/export/markdown.js
 * writes (headings, paragraphs, forced line breaks, > quotes, - lists, ---, ``` code blocks,
 * **bold**, *italic*, backslash escapes). Not a general Markdown parser.
 * Everything is HTML-escaped first, so user text can't inject markup.
 */

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(text) {
  const keep = []
  // backslash escapes → placeholders, so "\*" stays a literal star
  let s = text.replace(/\\([\\`*_{}[\]()#+\-.!>=~|])/g, (_, ch) => `\u0000${keep.push(ch) - 1}\u0000`)
  s = escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => escHtml(keep[i]))
}

/** Lines of one paragraph: "two trailing spaces" means a line break. */
const para = (ls) => ls.map((l, i) => inline(l.replace(/ {2,}$/, '')) + (i < ls.length - 1 ? (/ {2,}$/.test(l) ? '<br>' : ' ') : '')).join('')

export function mdToHtml(md) {
  // ``` fenced blocks (the screenplay) are kept exactly, blank lines and spaces included
  return md
    .replace(/\r\n/g, '\n')
    .split(/^```\n([\s\S]*?)\n```$/m)
    .map((part, i) => (i % 2 ? `<pre>${escHtml(part)}</pre>` : textToHtml(part)))
    .filter(Boolean)
    .join('\n')
}

function textToHtml(md) {
  const blocks = md.split(/\n{2,}/)
  const out = []
  for (const block of blocks) {
    const ls = block.split('\n').filter((l) => l.length)
    if (!ls.length) continue
    const h = /^(#{1,6}) (.*)$/.exec(ls[0])
    if (h && ls.length === 1) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    else if (ls.length === 1 && /^-{3,}$/.test(ls[0])) out.push('<hr>')
    else if (ls.every((l) => l.startsWith('> ') || l === '>')) out.push(`<blockquote><p>${para(ls.map((l) => l.replace(/^> ?/, '')))}</p></blockquote>`)
    else if (ls.every((l) => l.startsWith('- '))) out.push(`<ul>${ls.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`)
    else out.push(`<p>${para(ls)}</p>`)
  }
  return out.join('\n')
}
