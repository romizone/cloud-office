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
  downloadBlob(new Blob(['\ufeff', doc], { type: 'application/msword' }), `${safe(name)}.doc`)
}

export function exportDocText(name, html) {
  const text = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safe(name)}.txt`)
}

export async function exportXlsx(name, sheets) {
  const body = sheets.map((sheet) => {
    const rows = sheet.cells.map((row) => `<Row>${row.map((cell) => {
      const raw = String(cell ?? '')
      const n = Number(raw.replace(/,/g, ''))
      if (raw !== '' && !Number.isNaN(n) && !raw.startsWith('=') && !/^0\d+/.test(raw)) {
        return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`
      }
      if (raw.startsWith('=')) {
        return `<Cell ss:Formula="=${escapeXml(raw.slice(1))}"><Data ss:Type="Number">0</Data></Cell>`
      }
      return `<Cell><Data ss:Type="String">${escapeXml(raw)}</Data></Cell>`
    }).join('')}</Row>`).join('')
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
  const last = findLastUsed(cells)
  const lines = cells.slice(0, last.row + 1).map((row) => row.slice(0, last.col + 1).map(csvCell).join(','))
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${safe(name)}.csv`)
}

export async function exportPptx(name, deck) {
  const theme = themes[deck.theme] || themes.northstar
  const slides = deck.slides.map((slide, index) => `
    <section class="slide ${slide.layout}" style="background:${theme.bg}">
      <div class="kicker" style="color:${theme.kicker}">${escapeHtml(slide.kicker || '')}</div>
      <h1 style="color:${theme.title}">${escapeHtml(slide.title || '')}</h1>
      ${slide.subtitle ? `<p class="sub" style="color:${theme.body}">${escapeHtml(slide.subtitle)}</p>` : ''}
      ${slide.layout === 'split' ? `<div class="split"><div>${toList(slide.body)}</div><div>${toList(slide.extra)}</div></div>` : ''}
      ${slide.layout === 'content' ? toList(slide.body) : ''}
      ${slide.layout === 'blank' ? `<p>${escapeHtml(slide.body || '')}</p>` : ''}
      <span class="num">${index + 1} / ${deck.slides.length}</span>
    </section>`).join('')

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:Arial,sans-serif;background:#0c1416;color:#fff}
  .slide{min-height:100vh;padding:8vh 10vw;position:relative;page-break-after:always}
  h1{font-size:48px;line-height:1.1;margin:16px 0}
  .kicker{letter-spacing:2px;font-size:13px;font-weight:700}
  .sub,.slide li,.slide p{font-size:22px;line-height:1.45;max-width:720px}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:32px}
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
</script></body></html>`
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safe(name)}.html`)
}

const themes = {
  northstar: { bg: '#183c3e', kicker: '#81d0be', title: '#ffffff', body: '#b8ded4' },
  ink: { bg: '#14181b', kicker: '#9aa7ad', title: '#f4f7f7', body: '#c5d0d4' },
  dawn: { bg: '#2b221c', kicker: '#e0b089', title: '#fff6ea', body: '#ead7c4' },
  ocean: { bg: '#12344c', kicker: '#8ec8e8', title: '#f3fbff', body: '#c5e1f2' },
}

function toList(text) {
  const items = String(text || '').split('\n').filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join('')
  return items ? `<ul>${items}</ul>` : ''
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
