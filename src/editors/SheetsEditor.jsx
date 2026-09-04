import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, BarChart3, Bold, FilePlus2, Filter,
  Italic, PaintBucket, Plus, Search, Sigma, Trash2, Type, Underline
} from 'lucide-react'
import { EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import { Ribbon, RibbonBtn, RibbonPick } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { focusCopilotComposer } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { CopilotMark, ExcelIcon } from '../components/MsApps.jsx'
import { COLS, ROWS, blankFormats, blankGrid, ensureGrid, newId, parseCsv } from '../lib/files.js'
import { colLabel, displayOf, evaluateGrid, rangeStats } from '../lib/formulas.js'
import { exportCsv, exportXlsx } from '../lib/export.js'
import { parseFontColor } from '../lib/editIntent.js'

const FILLS = ['transparent', '#eef8f4', '#fff3bf', '#d0ebff', '#ffe3e3', '#f3e8ff', '#217346']
const FONT_COLORS = ['#17232d', '#c0392b', '#1f6f5b', '#1d4e89', '#b86a1c', '#6b4ea2']

function cloneTab(tab) {
  const padded = ensureGrid(tab.cells, tab.formats)
  return {
    ...tab,
    cells: padded.cells.map((row) => [...row]),
    formats: padded.formats.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
  }
}

function inSel(sel, r, c) {
  return r >= Math.min(sel.r, sel.r2) && r <= Math.max(sel.r, sel.r2) && c >= Math.min(sel.c, sel.c2) && c <= Math.max(sel.c, sel.c2)
}

function MiniChart({ labels, values, type }) {
  const max = Math.max(...values, 1)
  if (type === 'pie') {
    const total = values.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    const colors = ['#5db7a5', '#e59551', '#5d9fdf', '#d87373', '#6b4ea2', '#2a5e56']
    return (
      <svg viewBox="0 0 160 160" className="mini-chart pie">
        {values.map((v, i) => {
          const start = acc / total
          acc += v
          const end = acc / total
          const a1 = start * 2 * Math.PI - Math.PI / 2
          const a2 = end * 2 * Math.PI - Math.PI / 2
          const x1 = 80 + 70 * Math.cos(a1)
          const y1 = 80 + 70 * Math.sin(a1)
          const x2 = 80 + 70 * Math.cos(a2)
          const y2 = 80 + 70 * Math.sin(a2)
          const large = end - start > 0.5 ? 1 : 0
          return <path key={i} d={`M80 80 L${x1} ${y1} A70 70 0 ${large} 1 ${x2} ${y2} Z`} fill={colors[i % colors.length]} />
        })}
      </svg>
    )
  }
  const w = Math.max(8, 280 / values.length - 6)
  return (
    <svg viewBox="0 0 320 170" className="mini-chart">
      {values.map((v, i) => {
        const h = (v / max) * 130
        const x = 20 + i * (280 / values.length)
        if (type === 'line' && i > 0) {
          const prev = (values[i - 1] / max) * 130
          return (
            <g key={i}>
              <line x1={x - 280 / values.length + w / 2} y1={145 - prev} x2={x + w / 2} y2={145 - h} stroke="#2a5e56" strokeWidth="2" />
              <circle cx={x + w / 2} cy={145 - h} r="3" fill="#5db7a5" />
            </g>
          )
        }
        return <rect key={i} x={x} y={145 - h} width={w} height={h} fill="#5db7a5" rx="2" />
      })}
      {labels.slice(0, 8).map((label, i) => (
        <text key={label + i} x={20 + i * (280 / values.length) + w / 2} y={162} fontSize="8" textAnchor="middle" fill="#6a7c79">{String(label).slice(0, 8)}</text>
      ))}
    </svg>
  )
}

export default function SheetsEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [content, setContent] = useState(file.content)
  const [sel, setSel] = useState({ r: 1, c: 0, r2: 1, c2: 0 })
  const [editing, setEditing] = useState(false)
  const [editSource, setEditSource] = useState('cell')
  const [draft, setDraft] = useState('')
  const editingRef = useRef(false)
  const [showAgent, setShowAgent] = useState(true)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const [filter, setFilter] = useState(null)
  const [freeze, setFreeze] = useState(true)
  const [chart, setChart] = useState(null)
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const dragging = useRef(false)
  const gridRef = useRef(null)
  const fileInput = useRef(null)
  const saved = useSavedFlag(JSON.stringify(content) + title)

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
  }, [file.id])

  const tab = useMemo(() => {
    const raw = content.sheets[content.active] || content.sheets[0]
    return { ...raw, ...ensureGrid(raw.cells, raw.formats) }
  }, [content])

  const computed = useMemo(() => evaluateGrid(tab.cells), [tab.cells])
  const stats = useMemo(() => rangeStats(computed.display, sel.r, sel.c, sel.r2, sel.c2), [computed, sel])
  const activeRaw = tab.cells[sel.r]?.[sel.c] ?? ''
  const nameBox = useMemo(() => {
    const r1 = Math.min(sel.r, sel.r2)
    const r2 = Math.max(sel.r, sel.r2)
    const c1 = Math.min(sel.c, sel.c2)
    const c2 = Math.max(sel.c, sel.c2)
    const a = `${colLabel(c1)}${r1 + 1}`
    return r1 === r2 && c1 === c2 ? a : `${a}:${colLabel(c2)}${r2 + 1}`
  }, [sel])

  const persist = (nextContent, nextTitle = title) => {
    const payload = nextContent || content
    setContent(payload)
    onChange({ ...file, name: nextTitle, content: payload, updatedAt: new Date().toISOString() })
  }

  const patchTab = (mutator) => {
    const sheets = content.sheets.map((item, index) => index === content.active ? mutator(cloneTab(item)) : item)
    persist({ ...content, sheets })
  }

  const writeCell = (r, c, value) => {
    patchTab((item) => { item.cells[r][c] = value; return item })
  }

  const applyFormat = (patch, allUsed = false) => {
    patchTab((item) => {
      if (allUsed) {
        item.cells.forEach((row, r) => {
          row.forEach((value, c) => {
            if (!String(value || '').trim()) return
            item.formats[r][c] = { ...(item.formats[r][c] || {}), ...patch }
          })
        })
        return item
      }
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) {
          item.formats[r][c] = { ...(item.formats[r][c] || {}), ...patch }
        }
      }
      return item
    })
  }

  const paintFontColor = (color) => {
    applyFormat({ color }, false)
    return true
  }

  const clearSelection = () => {
    patchTab((item) => {
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) item.cells[r][c] = ''
      }
      return item
    })
  }

  const commitDraft = (move) => {
    if (editingRef.current && draft !== activeRaw) writeCell(sel.r, sel.c, draft)
    editingRef.current = false
    setEditing(false)
    if (move === 'down') setSel({ r: Math.min(ROWS - 1, sel.r + 1), c: sel.c, r2: Math.min(ROWS - 1, sel.r + 1), c2: sel.c })
    if (move === 'right') setSel({ r: sel.r, c: Math.min(COLS - 1, sel.c + 1), r2: sel.r, c2: Math.min(COLS - 1, sel.c + 1) })
  }

  const cancelEdit = () => {
    editingRef.current = false
    setEditing(false)
  }

  const startEdit = (seed = activeRaw, replace = false, source = 'cell') => {
    setDraft(replace ? seed : (seed ?? activeRaw))
    setEditSource(source)
    editingRef.current = true
    setEditing(true)
  }

  const copySelection = () => {
    const lines = []
    for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
      const row = []
      for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) row.push(tab.cells[r][c] ?? '')
      lines.push(row.join('\t'))
    }
    navigator.clipboard?.writeText(lines.join('\n'))
    onNotify('Rentang disalin')
  }

  const pasteTsv = (text) => {
    const rows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'))
    patchTab((item) => {
      rows.forEach((line, ri) => line.forEach((value, ci) => {
        const r = sel.r + ri
        const c = sel.c + ci
        if (r < ROWS && c < COLS) item.cells[r][c] = value
      }))
      return item
    })
  }

  const insertRow = () => {
    patchTab((item) => {
      item.cells.splice(sel.r, 0, Array.from({ length: COLS }, () => ''))
      item.formats.splice(sel.r, 0, Array.from({ length: COLS }, () => null))
      if (item.cells.length > ROWS) { item.cells.pop(); item.formats.pop() }
      return item
    })
  }

  const insertCol = () => {
    patchTab((item) => {
      item.cells.forEach((row) => row.splice(sel.c, 0, ''))
      item.formats.forEach((row) => row.splice(sel.c, 0, null))
      item.cells.forEach((row) => { if (row.length > COLS) row.pop() })
      item.formats.forEach((row) => { if (row.length > COLS) row.pop() })
      return item
    })
  }

  const deleteRow = () => {
    patchTab((item) => {
      item.cells.splice(sel.r, 1)
      item.formats.splice(sel.r, 1)
      item.cells.push(Array.from({ length: COLS }, () => ''))
      item.formats.push(Array.from({ length: COLS }, () => null))
      return item
    })
  }

  const sortByCol = (dir = 1) => {
    const col = sel.c
    const isSummary = (label) => /^(total|rata-rata|rata rata|nilai terbesar|grand total)\b/i.test(String(label || '').trim())
    patchTab((item) => {
      let last = 1
      while (last < ROWS && item.cells[last].some((v) => String(v || '').trim())) {
        if (isSummary(item.cells[last][0])) break
        last += 1
      }
      if (last <= 1) return item
      const head = item.cells[0]
      const headF = item.formats[0]
      const body = item.cells.slice(1, last).map((row, i) => ({ row, fmt: item.formats[i + 1] }))
      body.sort((a, b) => dir * String(a.row[col] ?? '').localeCompare(String(b.row[col] ?? ''), 'id', { numeric: true }))
      item.cells = [head, ...body.map((x) => x.row), ...item.cells.slice(last)]
      item.formats = [headF, ...body.map((x) => x.fmt), ...item.formats.slice(last)]
      return item
    })
    onNotify('Data diurutkan')
  }

  const autoSum = () => {
    const current = String(tab.cells[sel.r]?.[sel.c] || '').trim()
    if (current && !current.startsWith('=')) return addTotalRow()
    let start = sel.r - 1
    while (start >= 0 && String(tab.cells[start][sel.c] || '').trim()) start -= 1
    start += 1
    if (start >= sel.r) return onNotify('Tidak ada angka di atas sel ini')
    writeCell(sel.r, sel.c, `=SUM(${colLabel(sel.c)}${start + 1}:${colLabel(sel.c)}${sel.r})`)
  }

  const fillDown = () => {
    const value = tab.cells[Math.min(sel.r, sel.r2)][Math.min(sel.c, sel.c2)]
    patchTab((item) => {
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) item.cells[r][c] = value
      }
      return item
    })
  }

  const buildChart = (type) => {
    const c1 = Math.min(sel.c, sel.c2)
    const c2 = Math.max(sel.c, sel.c2)
    const r1 = Math.min(sel.r, sel.r2)
    const r2 = Math.max(sel.r, sel.r2)
    const labels = []
    const values = []
    for (let r = r1; r <= r2; r += 1) {
      const label = tab.cells[r][c1]
      const raw = computed.display[r][c2]
      if (raw?.t === 'n') {
        labels.push(label || colLabel(c1) + (r + 1))
        values.push(raw.v)
      }
    }
    if (!values.length) return onNotify('Pilih label dan angka untuk membuat bagan')
    setChart({ type, labels, values, title: tab.cells[0][c2] || 'Bagan' })
  }

  const highlightAboveAvg = () => {
    if (!stats) return
    patchTab((item) => {
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) {
          const val = computed.display[r][c]
          if (val?.t === 'n' && val.v > stats.avg) item.formats[r][c] = { ...(item.formats[r][c] || {}), fill: '#d3f9d8' }
          else if (val?.t === 'n') item.formats[r][c] = { ...(item.formats[r][c] || {}), fill: '#ffe3e3' }
        }
      }
      return item
    })
  }

  const filterValues = useMemo(() => {
    const col = sel.c
    return [...new Set(tab.cells.slice(1).map((row) => String(row[col] ?? '')).filter(Boolean))]
  }, [tab, sel.c])

  const onGridKey = (event) => {
    if (editing && event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') return
    const meta = event.metaKey || event.ctrlKey
    if (meta && event.key.toLowerCase() === 'b') { event.preventDefault(); applyFormat({ bold: !tab.formats[sel.r]?.[sel.c]?.bold }); return }
    if (meta && event.key.toLowerCase() === 'c') { copySelection(); return }
    if (event.key === 'F2') { event.preventDefault(); startEdit(); return }
    if (event.key === 'Enter') { event.preventDefault(); editing ? commitDraft('down') : startEdit(); return }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (editing) commitDraft('right')
      else setSel({ r: sel.r, c: Math.min(COLS - 1, sel.c + 1), r2: sel.r, c2: Math.min(COLS - 1, sel.c + 1) })
      return
    }
    if (event.key === 'Escape') { cancelEdit(); return }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !editing) { event.preventDefault(); clearSelection(); return }
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]
    if (delta) {
      event.preventDefault()
      const r = Math.max(0, Math.min(ROWS - 1, sel.r + delta[0]))
      const c = Math.max(0, Math.min(COLS - 1, sel.c + delta[1]))
      if (event.shiftKey) setSel({ ...sel, r2: r, c2: c })
      else setSel({ r, c, r2: r, c2: c })
      return
    }
    if (!editing && event.key.length === 1 && !meta) startEdit(event.key, true, 'cell')
  }

  const addSheet = () => {
    persist({ ...content, sheets: [...content.sheets, { id: newId('tab'), name: `Sheet ${content.sheets.length + 1}`, cells: blankGrid(), formats: blankFormats() }], active: content.sheets.length })
  }

  const applyCopilot = async (result) => {
    const cells = Array.isArray(result?.cells) ? result.cells : []
    const formats = Array.isArray(result?.formats) ? result.formats : []
    const r1 = Math.min(sel.r, sel.r2)
    const r2 = Math.max(sel.r, sel.r2)
    const c1 = Math.min(sel.c, sel.c2)
    const c2 = Math.max(sel.c, sel.c2)
    const rangeSelected = r1 !== r2 || c1 !== c2
    const inRange = (r, c) => !rangeSelected || (r >= r1 && r <= r2 && c >= c1 && c <= c2)
    let written = 0
    if (cells.length || formats.length) {
      patchTab((item) => {
        cells.forEach((cell) => {
          const r = Number(cell.r)
          const c = Number(cell.c)
          if (Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < ROWS && c >= 0 && c < COLS && inRange(r, c)) {
            item.cells[r][c] = String(cell.v ?? '')
            written += 1
          }
        })
        formats.forEach((cell) => {
          const r = Number(cell.r)
          const c = Number(cell.c)
          if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= ROWS || c < 0 || c >= COLS || !inRange(r, c)) return
          const patch = { ...cell }
          delete patch.r
          delete patch.c
          item.formats[r][c] = { ...(item.formats[r][c] || {}), ...patch }
          written += 1
        })
        return item
      })
    }
    if (result?.color) {
      paintFontColor(result.color)
      written += 1
    }
    return written > 0
  }

  const selectedText = (() => {
    const rows = []
    for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
      const cols = []
      for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) {
        cols.push(String(tab.cells[r]?.[c] ?? ''))
      }
      rows.push(cols.join('\t'))
    }
    return rows.join('\n')
  })()

  const getContext = () => ({
    title,
    sheet: tab.name,
    selection: selectedText,
    selectionRange: nameBox,
    scoped: true,
    used: tab.cells.slice(0, 24).map((row, r) => {
      const cells = row.slice(0, 8)
      if (cells.every((value) => !String(value || '').trim())) return null
      return { r, cells }
    }).filter(Boolean),
  })

  const addTotalRow = () => {
    const existing = tab.cells.findIndex((row) => String(row[0] || '').trim().toLowerCase() === 'total')
    if (existing >= 0) {
      setSel({ r: existing, c: 0, r2: existing, c2: 0 })
      onNotify('Baris Total sudah ada')
      return { message: 'Baris Total sudah ada di kanvas. Sel Total dipilih.' }
    }
    let last = 0
    tab.cells.forEach((row, r) => {
      if (row.some((value) => String(value || '').trim())) last = r
    })
    const r = Math.min(ROWS - 1, last + 1)
    patchTab((item) => {
      item.cells[r][0] = 'Total'
      item.formats[r][0] = { bold: true, fill: '#e7f4f0' }
      for (let c = 1; c < Math.min(COLS, 8); c += 1) {
        const filled = item.cells.slice(1, last + 1).some((row) => String(row[c] || '').trim())
        if (!filled) continue
        item.cells[r][c] = `=SUM(${colLabel(c)}2:${colLabel(c)}${last + 1})`
        item.formats[r][c] = { ...(item.formats[r][c] || {}), bold: true, fill: '#e7f4f0' }
      }
      return item
    })
    setSel({ r, c: 0, r2: r, c2: 0 })
    return { message: 'Baris Total ditulis ke kanvas spreadsheet.' }
  }

  const askAgent = async (prompt) => {
    const color = parseFontColor(prompt)
    if (color) {
      paintFontColor(color.value)
      return { message: `Font spreadsheet diubah menjadi ${color.label}.` }
    }
    const q = prompt.toLowerCase()
    if (q.includes('jelas') || q.includes('analisis') || q.includes('tunjuk')) {
      if (!stats) return { message: 'Pilih rentang angka di kanvas, lalu minta analisis lagi.' }
      return { message: `Dari sel ${nameBox}: jumlah ${displayOf({ t: 'n', v: stats.sum })}, rata-rata ${displayOf({ t: 'n', v: stats.avg })}, ${stats.count} angka.` }
    }
    if (q.includes('total') || q.includes('jumlah') || q.includes('sum')) return addTotalRow()
    if (q.includes('rupiah') || q.includes('mata uang')) {
      applyFormat({ numFmt: 'currency' })
      return { message: `Sel ${nameBox} diformat Rupiah.` }
    }
    if (q.includes('persen')) {
      applyFormat({ numFmt: 'percent' })
      return { message: `Sel ${nameBox} diformat persen.` }
    }
    if (q.includes('tebal') || q.includes('bold')) {
      applyFormat({ bold: true })
      return { message: `Sel ${nameBox} ditebalkan.` }
    }
    if (q.includes('bagan') || q.includes('grafik') || q.includes('chart')) {
      buildChart(q.includes('garis') ? 'line' : q.includes('pie') ? 'pie' : 'bar')
      return { message: 'Bagan dibuat dari rentang yang dipilih.' }
    }
    if (q.includes('urut')) {
      sortByCol(q.includes('z') && q.includes('a') && q.indexOf('z') < q.indexOf('a') ? -1 : 1)
      return { message: `Data diurutkan berdasarkan kolom ${colLabel(sel.c)}.` }
    }
    if (q.includes('rata-rata') || q.includes('rata rata') || q.includes('average')) {
      if (!stats) return { message: 'Pilih rentang angka dulu.', applied: false }
      return { message: `Rata-rata ${nameBox}: ${displayOf({ t: 'n', v: stats.avg })}.`, applied: false }
    }
    return { message: 'Copilot siaga lokal: minta baris total, format Rupiah/persen, bagan, urutkan, atau analisis rentang yang dipilih.', applied: false }
  }

  const ribbon = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        {
          label: 'Font',
          items: [
            <RibbonBtn key="b" icon={Bold} label="Tebal" onClick={() => applyFormat({ bold: true })} />,
            <RibbonBtn key="i" icon={Italic} label="Miring" onClick={() => applyFormat({ italic: true })} />,
            <RibbonBtn key="u" icon={Underline} label="Garis" onClick={() => applyFormat({ underline: true })} />,
            <span key="ink" className="swatches"><Type size={12} />{FONT_COLORS.map((color) => <button key={color} className="swatch" style={{ background: color }} onClick={() => applyFormat({ color })} />)}</span>,
            <span key="f" className="swatches"><PaintBucket size={12} />{FILLS.map((color) => <button key={color} className="swatch" style={{ background: color === 'transparent' ? '#fff' : color }} onClick={() => applyFormat({ fill: color === 'transparent' ? undefined : color })} />)}</span>,
          ],
        },
        {
          label: 'Perataan',
          items: [
            <RibbonBtn key="l" icon={AlignLeft} label="Kiri" onClick={() => applyFormat({ align: 'left' })} />,
            <RibbonBtn key="c" icon={AlignCenter} label="Tengah" onClick={() => applyFormat({ align: 'center' })} />,
            <RibbonBtn key="r" icon={AlignRight} label="Kanan" onClick={() => applyFormat({ align: 'right' })} />,
            <RibbonBtn key="w" label="Bungkus" onClick={() => applyFormat({ wrap: true })} />,
          ],
        },
        {
          label: 'Angka',
          items: [
            <RibbonPick key="n" width={120} value="general" onChange={(v) => applyFormat({ numFmt: v })} options={[
              { value: 'general', label: 'Umum' },
              { value: 'number', label: 'Angka' },
              { value: 'currency', label: 'Rupiah' },
              { value: 'accounting', label: 'Akuntansi' },
              { value: 'percent', label: 'Persen' },
            ]} />,
            <RibbonBtn key="sum" icon={Sigma} label="AutoSum" onClick={autoSum} />,
          ],
        },
        {
          label: 'Sel',
          items: [
            <RibbonBtn key="fd" label="Isi ke bawah" onClick={fillDown} />,
            <RibbonBtn key="cl" label="Hapus isi" onClick={clearSelection} />,
            <RibbonBtn key="cf" label="> rata-rata" onClick={highlightAboveAvg} />,
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        {
          label: 'Sel',
          items: [
            <RibbonBtn key="ir" icon={Plus} label="Sisip baris" onClick={insertRow} />,
            <RibbonBtn key="ic" icon={Plus} label="Sisip kolom" onClick={insertCol} />,
            <RibbonBtn key="dr" icon={Trash2} label="Hapus baris" onClick={deleteRow} />,
            <RibbonBtn key="sh" icon={FilePlus2} label="Sheet baru" onClick={addSheet} />,
          ],
        },
        {
          label: 'Bagan',
          items: [
            <RibbonBtn key="bar" icon={BarChart3} label="Kolom" onClick={() => buildChart('bar')} />,
            <RibbonBtn key="line" icon={BarChart3} label="Garis" onClick={() => buildChart('line')} />,
            <RibbonBtn key="pie" icon={BarChart3} label="Pie" onClick={() => buildChart('pie')} />,
          ],
        },
      ],
    },
    {
      id: 'data',
      label: 'Data',
      groups: [
        {
          label: 'Urutkan & filter',
          items: [
            <RibbonBtn key="az" label="Urut A→Z" onClick={() => sortByCol(1)} />,
            <RibbonBtn key="za" label="Urut Z→A" onClick={() => sortByCol(-1)} />,
            <RibbonPick key="fl" width={140} value={filter?.value || ''} onChange={(v) => setFilter(v ? { col: sel.c, value: v } : null)} options={[{ value: '', label: 'Semua' }, ...filterValues.map((v) => ({ value: v, label: v }))]} />,
            <RibbonBtn key="cf" icon={Filter} label="Hapus filter" onClick={() => setFilter(null)} />,
          ],
        },
        {
          label: 'Impor',
          items: [
            <RibbonBtn key="csv" label="Impor CSV" onClick={() => fileInput.current?.click()} />,
            <RibbonBtn key="xls" label="Unduh Excel" onClick={async () => { await exportXlsx(title, content.sheets); onNotify('Workbook diunduh') }} />,
          ],
        },
      ],
    },
    {
      id: 'view',
      label: 'Tampilan',
      groups: [
        {
          label: 'Jendela',
          items: [
            <RibbonBtn key="fz" label={freeze ? 'Lepas bekukan' : 'Bekukan baris 1'} onClick={() => setFreeze((v) => !v)} />,
            <RibbonBtn key="fnd" icon={Search} label="Temukan" onClick={() => setFindOpen(true)} />,
          ],
        },
      ],
    },
  ]

  return (
    <div className={`ed-shell sheets-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main">
        <EditorChrome
          kind="sheet"
          mark={<ExcelIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onCopilot={() => setShowAgent((v) => !v)}
        />
        {backstage && (
          <FileBackstage
            kind="sheet"
            title={title}
            onClose={() => setBackstage(false)}
            onHome={onBack}
            onPrint={() => window.print()}
            onExport={async () => { await exportXlsx(title, content.sheets); onNotify('Workbook diunduh') }}
            onNotify={onNotify}
          />
        )}
        <MenuBar items={[{
          label: 'File',
          actions: [
            { id: 'xls', label: 'Unduh Excel (.xls)', run: async () => { await exportXlsx(title, content.sheets); onNotify('Workbook diunduh') } },
            { id: 'csv', label: 'Unduh CSV', run: () => exportCsv(title, tab.cells) },
          ],
        }]} />
        <Ribbon tabs={ribbon} accent="excel" onFile={() => setBackstage(true)} />
        <input ref={fileInput} className="hidden-input" type="file" accept=".csv,text/csv" onChange={(event) => {
          const blob = event.target.files?.[0]
          if (!blob) return
          blob.text().then((text) => {
            patchTab((item) => { item.cells = parseCsv(text); item.formats = blankFormats(); item.name = (blob.name.replace(/\.csv$/i, '') || item.name).slice(0, 31); return item })
            onNotify(`${blob.name} diimpor`)
          })
          event.target.value = ''
        }} />
        {findOpen && (
          <div className="find-bar">
            <Search size={14} />
            <input autoFocus value={find} placeholder="Temukan di sheet" onChange={(event) => setFind(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setFindOpen(false) }} />
            <button onClick={() => {
              const needle = find.trim().toLowerCase()
              if (!needle) return
              const startAt = sel.r * COLS + sel.c + 1
              for (let step = 0; step < ROWS * COLS; step += 1) {
                const idx = (startAt + step) % (ROWS * COLS)
                const r = Math.floor(idx / COLS)
                const c = idx % COLS
                if (String(tab.cells[r][c] || '').toLowerCase().includes(needle)) {
                  setSel({ r, c, r2: r, c2: c })
                  onNotify(`${colLabel(c)}${r + 1}`)
                  return
                }
              }
              onNotify('Tidak ditemukan')
            }}>Cari</button>
            <button onClick={() => setFindOpen(false)}>Tutup</button>
          </div>
        )}
        <div className="formula-bar">
          <span className="cell-reference">{nameBox}</span>
          <button
            type="button"
            className="copilot-link-badge"
            onClick={() => { setShowAgent(true); window.setTimeout(focusCopilotComposer, 40) }}
          >
            <CopilotMark size={13} /> {nameBox}
          </button>
          <span className="fx">fx</span>
          <input
            value={editing ? draft : activeRaw}
            onFocus={() => { if (!editing) startEdit(activeRaw, false, 'bar') }}
            onChange={(event) => { if (!editing) startEdit(event.target.value, true, 'bar'); else setDraft(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitDraft('down'); gridRef.current?.focus({ preventScroll: true }) }
              if (event.key === 'Tab') { event.preventDefault(); commitDraft('right'); gridRef.current?.focus({ preventScroll: true }) }
              if (event.key === 'Escape') { cancelEdit(); gridRef.current?.focus({ preventScroll: true }) }
            }}
            placeholder="Nilai atau rumus · SUM AVERAGE IF VLOOKUP INDEX MATCH COUNTIF…"
          />
        </div>
        <div className="sheet-scroll" ref={gridRef} tabIndex={0} onKeyDown={onGridKey} onPaste={(event) => { event.preventDefault(); pasteTsv(event.clipboardData.getData('text/plain')) }} onMouseUp={() => { dragging.current = false }}>
          <div className={`s-grid ${freeze ? 'freeze' : ''}`} style={{ '--cols': COLS }}>
            <div className="s-corner" />
            {Array.from({ length: COLS }, (_, c) => (
              <div className={`s-colh ${c >= Math.min(sel.c, sel.c2) && c <= Math.max(sel.c, sel.c2) ? 'hot' : ''}`} key={colLabel(c)} onMouseDown={(event) => { event.preventDefault(); if (editing) commitDraft(); gridRef.current?.focus({ preventScroll: true }); setSel({ r: 0, c, r2: ROWS - 1, c2: c }) }}>{colLabel(c)}</div>
            ))}
            {tab.cells.map((row, r) => {
              if (filter && r > 0 && String(row[filter.col] ?? '') !== filter.value) return null
              return (
                <div className="s-row" key={r} style={{ display: 'contents' }}>
                  <div className={`s-rowh ${r >= Math.min(sel.r, sel.r2) && r <= Math.max(sel.r, sel.r2) ? 'hot' : ''} ${freeze && r === 0 ? 'frozen' : ''}`} onMouseDown={(event) => { event.preventDefault(); if (editing) commitDraft(); gridRef.current?.focus({ preventScroll: true }); setSel({ r, c: 0, r2: r, c2: COLS - 1 }) }}>{r + 1}</div>
                  {row.map((_, c) => {
                    const fmt = tab.formats[r][c] || {}
                    const selected = inSel(sel, r, c)
                    const active = sel.r === r && sel.c === c
                    const val = computed.display[r][c]
                    const show = editing && active ? draft : displayOf(val, fmt.numFmt)
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`s-cell ${selected ? 'sel' : ''} ${active ? 'active' : ''} ${fmt.bold ? 'b' : ''} ${fmt.italic ? 'i' : ''} ${fmt.underline ? 'u' : ''} ${fmt.wrap ? 'wrap' : ''} ${val?.t === 'e' ? 'err' : ''} ${freeze && r === 0 ? 'frozen' : ''}`}
                        style={{ background: fmt.fill || (r === 0 ? '#eef8f4' : undefined), textAlign: fmt.align || (val?.t === 'n' ? 'right' : 'left'), color: fmt.color || undefined }}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          gridRef.current?.focus({ preventScroll: true })
                          dragging.current = true
                          if (event.shiftKey) setSel({ ...sel, r2: r, c2: c })
                          else {
                            if (editing) commitDraft()
                            setSel({ r, c, r2: r, c2: c })
                          }
                        }}
                        onMouseEnter={() => { if (dragging.current) setSel((s) => ({ ...s, r2: r, c2: c })) }}
                        onDoubleClick={() => startEdit(activeRaw, false, 'cell')}
                      >
                        {editing && active && editSource === 'cell' ? (
                          <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (editingRef.current) commitDraft() }} onKeyDown={(event) => {
                            event.stopPropagation()
                            if (event.key === 'Enter') { event.preventDefault(); commitDraft('down'); gridRef.current?.focus({ preventScroll: true }) }
                            else if (event.key === 'Tab') { event.preventDefault(); commitDraft('right'); gridRef.current?.focus({ preventScroll: true }) }
                            else if (event.key === 'Escape') { cancelEdit(); gridRef.current?.focus({ preventScroll: true }) }
                          }} />
                        ) : show}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        {chart && (
          <div className="chart-dock">
            <div>
              <strong>{chart.title}</strong>
              <button onClick={() => setChart(null)}>Tutup</button>
            </div>
            <MiniChart {...chart} />
          </div>
        )}
        <footer className="sheet-footer">
          <div className="sheet-tabs">
            {content.sheets.map((item, index) => (
              <button key={item.id} className={`sheet-tab ${index === content.active ? 'active' : ''}`} onClick={() => persist({ ...content, active: index })} onDoubleClick={() => {
                const name = window.prompt('Nama sheet', item.name)?.trim().slice(0, 31)
                if (!name) return
                persist({ ...content, sheets: content.sheets.map((sheet, i) => i === index ? { ...sheet, name } : sheet) })
              }}>{item.name}</button>
            ))}
            <button className="add-sheet" onClick={addSheet}><FilePlus2 size={14} /></button>
            {content.sheets.length > 1 && <button className="add-sheet" aria-label="Hapus sheet" onClick={() => { if (window.confirm(`Hapus sheet “${tab.name}”?`)) persist({ ...content, sheets: content.sheets.filter((_, i) => i !== content.active), active: Math.max(0, content.active - 1) }) }}><Trash2 size={14} /></button>}
          </div>
          <span>{stats ? `Sum ${displayOf({ t: 'n', v: stats.sum })}  ·  Avg ${displayOf({ t: 'n', v: stats.avg })}  ·  Count ${stats.count}` : 'Pilih rentang untuk Sum / Average'}</span>
          <span>Siap</span>
        </footer>
      </div>
      {showAgent && <AgentPanel kind="sheet" app="Excel" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={selectedText} selectionLabel={`Sel ${nameBox}`} onBusyChange={setCopilotBusy} />}
      {share && <ShareDialog title={`${title}.xlsx`} onClose={() => setShare(false)} onNotify={onNotify} />}
    </div>
  )
}
