import { evaluateGrid, parseA1 } from './formulas.js'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportDoc(name, html) {
  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>body{font-family:Georgia,serif;line-height:1.6;color:#223}h1,h2,h3{font-family:Arial,sans-serif}</style>
</head><body>${html}</body></html>`
  downloadBlob(new Blob(['﻿', doc], { type: 'application/msword' }), `${safe(name)}.doc`)
}

export function exportDocText(name, html) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safe(name)}.txt`)
}

/**
 * SpreadsheetML 2003 only accepts R1C1 formulas in ss:Formula.
 * Converts A1 references (relative to the owning cell) and leaves quoted strings
 * and function names such as LOG10( untouched.
 */
export function toR1C1(formula, row, col) {
  return String(formula).split(/("(?:[^"]|"")*")/).map((part, i) => {
    if (i % 2 === 1) return part
    return part.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/g, (match, absCol, letters, absRow, digits) => {
      const ref = parseA1(`${letters}${digits}`)
      if (!ref) return match
      const r = absRow ? `R${ref.row + 1}` : ref.row === row ? 'R' : `R[${ref.row - row}]`
      const c = absCol ? `C${ref.col + 1}` : ref.col === col ? 'C' : `C[${ref.col - col}]`
      return `${r}${c}`
    })
  }).join('')
}

function cellXml(raw, value, r, c) {
  const text = String(raw ?? '')
  if (text.startsWith('=')) {
    const data = value?.t === 'n' && Number.isFinite(value.v)
      ? `<Data ss:Type="Number">${value.v}</Data>`
      : `<Data ss:Type="String">${escapeXml(value?.t === 'e' ? value.v : String(value?.v ?? ''))}</Data>`
    return `<Cell ss:Formula="=${escapeXml(toR1C1(text.slice(1), r, c))}">${data}</Cell>`
  }
  if (value?.t === 'n' && Number.isFinite(value.v)) return `<Cell><Data ss:Type="Number">${value.v}</Data></Cell>`
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`
}

export async function exportXlsx(name, sheets) {
  const body = sheets.map((sheet) => {
    const cells = sheet.cells || []
    const computed = evaluateGrid(cells)
    const last = findLastUsed(cells)
    const rows = cells.slice(0, last.row + 1).map((row, r) => {
      const inner = row.slice(0, last.col + 1).map((cell, c) => cellXml(cell, computed.display[r]?.[c], r, c)).join('')
      return `<Row>${inner}</Row>`
    }).join('')
    return `<Worksheet ss:Name="${escapeXml((sheet.name || 'Sheet').slice(0, 31))}"><Table>${rows}</Table></Worksheet>`
  }).join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${body}
</Workbook>`
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), `${safe(name)}.xls`)
}

export function exportCsv(name, cells) {
  const computed = evaluateGrid(cells)
  const last = findLastUsed(cells)
  const lines = cells.slice(0, last.row + 1).map((row, r) => row.slice(0, last.col + 1).map((raw, c) => {
    const text = String(raw ?? '')
    if (!text.startsWith('=')) return csvCell(text)
    const value = computed.display[r]?.[c]
    if (value?.t === 'n') return csvCell(value.v)
    if (value?.t === 'b') return csvCell(value.v ? 'TRUE' : 'FALSE')
    return csvCell(value?.v ?? '')
  }).join(','))
  downloadBlob(new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${safe(name)}.csv`)
}

export async function exportPptx(name, deck) {
  const theme = themes[deck.theme] || themes.northstar
  const visible = (deck.slides || []).filter((slide) => !slide.hidden)
  const slides = visible.map((slide, index) => `
    <section class="slide ${slide.layout}" style="background:${theme.bg};color:${theme.body}">
      ${slide.layout !== 'blank' ? `<div class="kicker" style="color:${theme.kicker}">${escapeHtml(plain(slide.kicker))}</div>` : ''}
      <h1 style="color:${theme.title}">${escapeHtml(plain(slide.title))}</h1>
      ${slide.subtitle && ['title', 'section', 'picture'].includes(slide.layout) ? `<p class="sub">${escapeHtml(plain(slide.subtitle))}</p>` : ''}
      ${slide.layout === 'split' ? `<div class="split"><div>${toList(slide.body)}</div><div>${toList(slide.extra)}</div></div>` : ''}
      ${slide.layout === 'content' ? toList(slide.body) : ''}
      ${slide.layout === 'blank' ? `<p class="free">${escapeHtml(plain(slide.body))}</p>` : ''}
      ${slide.layout === 'picture' && slide.image ? `<img src="${slide.image}" alt="" />` : ''}
      ${slide.layout === 'table' ? toTable(slide.table) : ''}
      ${slide.notes ? `<aside class="notes">${escapeHtml(slide.notes)}</aside>` : ''}
      <span class="num">${index + 1} / ${visible.length}</span>
    </section>`).join('')

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#0c1416;color:#fff}
  .slide{min-height:100vh;padding:8vh 10vw;position:relative;page-break-after:always}
  h1{font-size:48px;line-height:1.1;margin:16px 0}
  .kicker{letter-spacing:2px;font-size:13px;font-weight:700}
  .sub,.slide li,.slide p{font-size:22px;line-height:1.45;max-width:720px}
  .free{white-space:pre-wrap}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:32px}
  img{max-width:100%;max-height:55vh;border-radius:8px;margin-top:12px}
  table{border-collapse:collapse;margin-top:16px;font-size:18px}
  td{border:1px solid rgba(255,255,255,.3);padding:8px 12px;min-width:80px}
  .notes{display:none}
  .num{position:absolute;right:8vw;bottom:6vh;opacity:.6}
  @media print {.slide{min-height:auto;height:100vh}}
</style></head><body>${slides}
<script>
  let i=0; const s=[...document.querySelectorAll('.slide')];
  const show=n=>{s.forEach((el,idx)=>el.style.display=idx===n?'block':'none')};
  show(0);
  addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key===' ') show(i=Math.min(s.length-1,i+1));
    if(e.key==='ArrowLeft') show(i=Math.max(0,i-1));
  });
  addEventListener('beforeprint',()=>s.forEach(el=>el.style.display='block'));
  addEventListener('afterprint',()=>show(i));
</script></body></html>`
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safe(name)}.html`)
}

const themes = {
  northstar: { bg: '#183c3e', kicker: '#81d0be', title: '#ffffff', body: '#b8ded4' },
  ink: { bg: '#14181b', kicker: '#9aa7ad', title: '#f4f7f7', body: '#c5d0d4' },
  dawn: { bg: '#2b221c', kicker: '#e0b089', title: '#fff6ea', body: '#ead7c4' },
  ocean: { bg: '#12344c', kicker: '#8ec8e8', title: '#f3fbff', body: '#c5e1f2' },
  paper: { bg: '#f7f1e6', kicker: '#9a6a3a', title: '#2b221c', body: '#5a4638' },
  rose: { bg: '#3a1824', kicker: '#f0b7c9', title: '#fff5f8', body: '#efd3dc' },
}

function plain(text) {
  return String(text || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function toList(text) {
  const items = plain(text).split('\n').filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join('')
  return items ? `<ul>${items}</ul>` : ''
}

function toTable(table) {
  if (!Array.isArray(table) || !table.length) return ''
  const rows = table.map((row) => `<tr>${(row || []).map((cell) => `<td>${escapeHtml(cell || '')}</td>`).join('')}</tr>`).join('')
  return `<table>${rows}</table>`
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function findLastUsed(cells) {
  let row = 0
  let col = 0
  cells.forEach((line, r) => {
    line.forEach((value, c) => {
      if (String(value ?? '').trim() !== '') {
        row = Math.max(row, r)
        col = Math.max(col, c)
      }
    })
  })
  return { row, col }
}

function safe(name) {
  return String(name || 'untitled').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'untitled'
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

function escapeXml(value) {
  return escapeHtml(value)
}
