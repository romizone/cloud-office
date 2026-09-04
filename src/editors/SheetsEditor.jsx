import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignCenterVertical, AlignEndVertical, AlignLeft, AlignRight, AlignStartVertical,
  ArrowDownAZ, ArrowUpZA, BadgeDollarSign, Baseline, Bold, ChartBar, ChartColumn, ChartLine, ChartPie,
  CircleHelp, ClipboardPaste, Combine, Copy, Eye, FilePlus2, Filter, FunctionSquare, Grid3X3, Hash,
  Highlighter, Italic, Keyboard, Link2, Lock, LockOpen, MessageSquarePlus, Minus, PaintBucket, PaintRoller,
  Percent, Plus, Redo2, RefreshCw, Rows2, Scissors, Search, Sigma, Snowflake, SpellCheck, Sparkles,
  SquareDashed, Strikethrough, Table, TableProperties, Trash2, Type, Underline, Undo2, WrapText, ZoomIn, ZoomOut, PenLine
} from 'lucide-react'
import { EditorChrome, useSavedFlag } from '../components/EditorChrome.jsx'
import { EditingMode, RBtn, RColor, RGallery, RMenu, RPick, RStack, Ribbon } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CopilotMark, ExcelIcon } from '../components/MsApps.jsx'
import { focusCopilotComposer } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { COLS, ROWS, blankFormats, blankGrid, ensureGrid, newId, parseCsv } from '../lib/files.js'
import { colLabel, displayOf, evaluateGrid, parseA1, rangeStats, todaySerial } from '../lib/formulas.js'
import { exportCsv, exportXlsx } from '../lib/export.js'
import { parseFontColor } from '../lib/editIntent.js'

const FONTS = [
  { value: 'Aptos, "Segoe UI", sans-serif', label: 'Aptos' },
  { value: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24]
const NUM_FORMATS = [
  { value: 'general', label: 'Umum' },
  { value: 'number', label: 'Angka' },
  { value: 'comma', label: 'Angka (pemisah ribuan)' },
  { value: 'currency', label: 'Mata uang (Rp)' },
  { value: 'accounting', label: 'Akuntansi' },
  { value: 'date', label: 'Tanggal pendek' },
  { value: 'longdate', label: 'Tanggal panjang' },
  { value: 'time', label: 'Waktu' },
  { value: 'percent', label: 'Persentase' },
  { value: 'scientific', label: 'Ilmiah' },
  { value: 'text', label: 'Teks' },
]
const FUNCTIONS = {
  Matematika: ['SUM', 'AVERAGE', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'MOD', 'ABS', 'SQRT', 'POWER', 'PRODUCT', 'LOG10', 'LN', 'EXP'],
  Statistik: ['COUNT', 'COUNTA', 'COUNTIF', 'SUMIF', 'MIN', 'MAX', 'MEDIAN', 'STDEV', 'LARGE', 'SMALL', 'RANK'],
  Teks: ['CONCAT', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'SUBSTITUTE', 'SEARCH', 'FIND', 'TEXTJOIN', 'VALUE'],
  Logika: ['IF', 'AND', 'OR', 'NOT', 'IFERROR'],
  Pencarian: ['VLOOKUP', 'INDEX', 'MATCH'],
  Tanggal: ['TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY'],
}
const FN_HELP = {
  SUM: 'SUM(rentang) — jumlah', AVERAGE: 'AVERAGE(rentang) — rata-rata', COUNT: 'COUNT(rentang) — banyak angka', COUNTA: 'COUNTA(rentang) — sel terisi',
  COUNTIF: 'COUNTIF(rentang, kriteria)', SUMIF: 'SUMIF(rentang, kriteria, [rentang_jumlah])', IF: 'IF(uji, jika_benar, jika_salah)',
  VLOOKUP: 'VLOOKUP(nilai, tabel, kolom)', INDEX: 'INDEX(rentang, baris, [kolom])', MATCH: 'MATCH(nilai, rentang)', ROUND: 'ROUND(angka, digit)',
  CONCAT: 'CONCAT(teks1, teks2, …)', LEFT: 'LEFT(teks, n)', RIGHT: 'RIGHT(teks, n)', MID: 'MID(teks, mulai, n)', TODAY: 'TODAY() — tanggal hari ini',
}
const CELL_STYLES = [
  { id: 'normal', label: 'Normal', fmt: {}, preview: { background: '#fff' } },
  { id: 'good', label: 'Baik', fmt: { fill: '#c6efce', color: '#006100' }, preview: { background: '#c6efce', color: '#006100' } },
  { id: 'bad', label: 'Buruk', fmt: { fill: '#ffc7ce', color: '#9c0006' }, preview: { background: '#ffc7ce', color: '#9c0006' } },
  { id: 'neutral', label: 'Netral', fmt: { fill: '#ffeb9c', color: '#9c5700' }, preview: { background: '#ffeb9c', color: '#9c5700' } },
  { id: 'input', label: 'Input', fmt: { fill: '#ffcc99', color: '#3f3f76', border: 'all' }, preview: { background: '#ffcc99', color: '#3f3f76' } },
  { id: 'note', label: 'Catatan', fmt: { fill: '#ffffcc', border: 'all' }, preview: { background: '#ffffcc' } },
  { id: 'h1', label: 'Judul 1', fmt: { bold: true, fontSize: 15, color: '#1f3864', border: 'bottom' }, preview: { fontWeight: 700, color: '#1f3864' } },
  { id: 'title', label: 'Judul', fmt: { bold: true, fontSize: 18, color: '#1f3864' }, preview: { fontWeight: 700, fontSize: 15, color: '#1f3864' } },
  { id: 'total', label: 'Total', fmt: { bold: true, border: 'topbottom' }, preview: { fontWeight: 700, borderTop: '1px solid #242424', borderBottom: '3px double #242424' } },
]
const TABLE_STYLES = [
  { id: 'green', label: 'Hijau sedang', head: '#107c41', band: '#e2efda' },
  { id: 'blue', label: 'Biru sedang', head: '#4472c4', band: '#d9e2f3' },
  { id: 'orange', label: 'Oranye sedang', head: '#ed7d31', band: '#fbe5d5' },
  { id: 'gray', label: 'Abu-abu', head: '#595959', band: '#ededed' },
  { id: 'light', label: 'Terang', head: '#d9e2f3', band: '#f2f2f2', dark: true },
]
const MODES = [
  { id: 'edit', label: 'Mengedit', detail: 'Ubah sel secara langsung', icon: PenLine },
  { id: 'view', label: 'Menampilkan', detail: 'Lembar terkunci, hanya membaca', icon: Eye },
]
const SYMBOLS = ['©', '®', '™', '€', '£', '¥', '±', '×', '÷', '≠', '≤', '≥', '•', '→', '✓']

function cloneTab(tab) {
  const padded = ensureGrid(tab.cells, tab.formats)
  return {
    ...tab,
    cells: padded.cells.map((row) => [...row]),
    formats: padded.formats.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    colWidths: tab.colWidths ? [...tab.colWidths] : undefined,
  }
}

function inSel(sel, r, c) {
  return r >= Math.min(sel.r, sel.r2) && r <= Math.max(sel.r, sel.r2) && c >= Math.min(sel.c, sel.c2) && c <= Math.max(sel.c, sel.c2)
}

function bounds(sel) {
  return { r1: Math.min(sel.r, sel.r2), r2: Math.max(sel.r, sel.r2), c1: Math.min(sel.c, sel.c2), c2: Math.max(sel.c, sel.c2) }
}

function shiftFormula(raw, dr, dc) {
  const text = String(raw ?? '')
  if (!text.startsWith('=')) return text
  return text.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/g, (m, absC, letters, absR, digits) => {
    const ref = parseA1(`${letters}${digits}`)
    if (!ref) return m
    const col = absC ? ref.col : ref.col + dc
    const row = absR ? ref.row : ref.row + dr
    return `${absC}${colLabel(Math.max(0, col))}${absR}${Math.max(0, row) + 1}`
  })
}

function MiniChart({ labels, values, type }) {
  const max = Math.max(...values, 1)
  const colors = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47']
  if (type === 'pie') {
    const total = values.reduce((a, b) => a + b, 0) || 1
    let acc = 0
    return (
      <svg viewBox="0 0 160 160" className="mini-chart pie">
        {values.map((v, i) => {
          const start = acc / total
          acc += v
          const end = acc / total
          const a1 = start * 2 * Math.PI - Math.PI / 2
          const a2 = end * 2 * Math.PI - Math.PI / 2
          const large = end - start > 0.5 ? 1 : 0
          return <path key={i} d={`M80 80 L${80 + 70 * Math.cos(a1)} ${80 + 70 * Math.sin(a1)} A70 70 0 ${large} 1 ${80 + 70 * Math.cos(a2)} ${80 + 70 * Math.sin(a2)} Z`} fill={colors[i % colors.length]} />
        })}
      </svg>
    )
  }
  if (type === 'bar') {
    const h = Math.max(6, 130 / values.length - 4)
    return (
      <svg viewBox="0 0 320 170" className="mini-chart">
        {values.map((v, i) => (
          <g key={i}>
            <rect x={70} y={10 + i * (130 / values.length)} width={(v / max) * 230} height={h} fill="#4472c4" rx="2" />
            <text x={66} y={10 + i * (130 / values.length) + h / 2 + 3} fontSize="8" textAnchor="end" fill="#616161">{String(labels[i]).slice(0, 10)}</text>
          </g>
        ))}
      </svg>
    )
  }
  const step = 280 / values.length
  const w = Math.max(8, step - 6)
  return (
    <svg viewBox="0 0 320 170" className="mini-chart">
      {type === 'area' && (
        <polygon points={`${20 + w / 2},145 ${values.map((v, i) => `${20 + i * step + w / 2},${145 - (v / max) * 130}`).join(' ')} ${20 + (values.length - 1) * step + w / 2},145`} fill="#4472c455" stroke="#4472c4" />
      )}
      {values.map((v, i) => {
        const h = (v / max) * 130
        const x = 20 + i * step
        if ((type === 'line' || type === 'area') && i > 0) {
          const prev = (values[i - 1] / max) * 130
          return (
            <g key={i}>
              {type === 'line' && <line x1={x - step + w / 2} y1={145 - prev} x2={x + w / 2} y2={145 - h} stroke="#4472c4" strokeWidth="2" />}
              <circle cx={x + w / 2} cy={145 - h} r="3" fill="#4472c4" />
            </g>
          )
        }
        if (type === 'line' || type === 'area') return <circle key={i} cx={x + w / 2} cy={145 - h} r="3" fill="#4472c4" />
        return <rect key={i} x={x} y={145 - h} width={w} height={h} fill="#4472c4" rx="2" />
      })}
      {labels.slice(0, 8).map((label, i) => (
        <text key={label + i} x={20 + i * step + w / 2} y={162} fontSize="8" textAnchor="middle" fill="#616161">{String(label).slice(0, 8)}</text>
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
  const [chart, setChart] = useState(null)
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const [mode, setMode] = useState('edit')
  const [painter, setPainter] = useState(null)
  const [showFormulas, setShowFormulas] = useState(false)
  const [gridlines, setGridlines] = useState(true)
  const [headings, setHeadings] = useState(true)
  const [formulaBar, setFormulaBar] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [freeze, setFreeze] = useState({ rows: 1, cols: 0 })
  const [notesRail, setNotesRail] = useState(false)
  const [fontColor, setFontColor] = useState('#c00000')
  const [fillColor, setFillColor] = useState('#ffff00')
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const dragging = useRef(false)
  const gridRef = useRef(null)
  const fileInput = useRef(null)
  const saved = useSavedFlag(JSON.stringify(content) + title)
  const editable = mode === 'edit' && !content.protected

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
  }, [file.id])

  const tab = useMemo(() => {
    const raw = content.sheets[content.active] || content.sheets[0]
    return { ...raw, ...ensureGrid(raw.cells, raw.formats), colWidths: raw.colWidths || [] }
  }, [content])

  const computed = useMemo(() => evaluateGrid(tab.cells), [tab.cells])
  const stats = useMemo(() => rangeStats(computed.display, sel.r, sel.c, sel.r2, sel.c2), [computed, sel])
  const activeRaw = tab.cells[sel.r]?.[sel.c] ?? ''
  const activeFmt = tab.formats[sel.r]?.[sel.c] || {}
  const nameBox = useMemo(() => {
    const b = bounds(sel)
    const a = `${colLabel(b.c1)}${b.r1 + 1}`
    return b.r1 === b.r2 && b.c1 === b.c2 ? a : `${a}:${colLabel(b.c2)}${b.r2 + 1}`
  }, [sel])
  const notes = useMemo(() => {
    const list = []
    tab.formats.forEach((row, r) => row.forEach((f, c) => { if (f?.note) list.push({ r, c, note: f.note }) }))
    return list
  }, [tab])

  const persist = (nextContent, nextTitle = title, { track = true } = {}) => {
    const payload = nextContent || content
    if (track && nextContent && nextContent !== content) {
      setUndoStack((stack) => [...stack.slice(-40), content])
      setRedoStack([])
    }
    setContent(payload)
    onChange({ ...file, name: nextTitle, content: payload, updatedAt: new Date().toISOString() })
  }

  const guard = () => {
    if (editable) return true
    onNotify(content.protected ? 'Lembar dilindungi. Buka proteksi di Tinjau → Proteksi lembar.' : 'Mode Menampilkan: ganti ke Mengedit untuk mengubah sel')
    return false
  }

  const patchTab = (mutator) => {
    if (!guard()) return
    const sheets = content.sheets.map((item, index) => index === content.active ? mutator(cloneTab(item)) : item)
    persist({ ...content, sheets })
  }

  const undo = () => {
    const prev = undoStack[undoStack.length - 1]
    if (!prev) return onNotify('Tidak ada yang bisa diurungkan')
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, content])
    persist(prev, title, { track: false })
  }
  const redo = () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return onNotify('Tidak ada yang bisa diulangi')
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, content])
    persist(next, title, { track: false })
  }

  const writeCell = (r, c, value) => patchTab((item) => { item.cells[r][c] = value; return item })

  const forEachSel = (item, fn) => {
    const b = bounds(sel)
    for (let r = b.r1; r <= b.r2; r += 1) for (let c = b.c1; c <= b.c2; c += 1) fn(r, c)
    return item
  }

  const applyFormat = (patch) => {
    patchTab((item) => forEachSel(item, (r, c) => { item.formats[r][c] = { ...(item.formats[r][c] || {}), ...patch } }))
  }

  const toggleFormat = (key) => applyFormat({ [key]: !activeFmt[key] })

  const paintFontColor = (color) => { applyFormat({ color }); return true }

  const clearSelection = (what = 'contents') => {
    patchTab((item) => forEachSel(item, (r, c) => {
      if (what === 'contents' || what === 'all') item.cells[r][c] = ''
      if (what === 'formats' || what === 'all') item.formats[r][c] = null
      if (what === 'notes') { const f = item.formats[r][c]; if (f) delete f.note }
    }))
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
    if (!guard()) return
    setDraft(replace ? seed : (seed ?? activeRaw))
    setEditSource(source)
    editingRef.current = true
    setEditing(true)
  }

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true })

  const selectionTsv = () => {
    const b = bounds(sel)
    const lines = []
    for (let r = b.r1; r <= b.r2; r += 1) {
      const row = []
      for (let c = b.c1; c <= b.c2; c += 1) row.push(tab.cells[r][c] ?? '')
      lines.push(row.join('\t'))
    }
    return lines.join('\n')
  }

  const copySelection = async () => {
    try {
      await navigator.clipboard.writeText(selectionTsv())
      onNotify(`Rentang ${nameBox} disalin`)
    } catch {
      onNotify('Browser menolak akses papan klip. Gunakan ⌘C.')
    }
  }

  const cutSelection = async () => {
    if (!guard()) return
    await copySelection()
    clearSelection('contents')
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

  const pasteFromClipboard = async () => {
    if (!guard()) return
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return onNotify('Papan klip kosong')
      pasteTsv(text)
    } catch {
      onNotify('Browser menolak akses papan klip. Gunakan ⌘V di grid.')
    }
  }

  const startPainter = () => {
    const { note, link, span, ...rest } = activeFmt
    setPainter(rest)
    onNotify('Pilih sel tujuan untuk menempelkan format')
  }

  useEffect(() => {
    if (!painter) return
    const fmt = painter
    setPainter(null)
    patchTab((item) => forEachSel(item, (r, c) => { item.formats[r][c] = { ...(item.formats[r][c] || {}), ...fmt } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.r, sel.c, sel.r2, sel.c2])

  const insertRows = (count = 1) => patchTab((item) => {
    for (let i = 0; i < count; i += 1) {
      item.cells.splice(sel.r, 0, Array.from({ length: COLS }, () => ''))
      item.formats.splice(sel.r, 0, Array.from({ length: COLS }, () => null))
      item.cells.pop(); item.formats.pop()
    }
    return item
  })
  const insertCols = (count = 1) => patchTab((item) => {
    for (let i = 0; i < count; i += 1) {
      item.cells.forEach((row) => { row.splice(sel.c, 0, ''); row.pop() })
      item.formats.forEach((row) => { row.splice(sel.c, 0, null); row.pop() })
    }
    return item
  })
  const deleteRows = () => patchTab((item) => {
    const b = bounds(sel)
    const n = b.r2 - b.r1 + 1
    item.cells.splice(b.r1, n); item.formats.splice(b.r1, n)
    for (let i = 0; i < n; i += 1) { item.cells.push(Array.from({ length: COLS }, () => '')); item.formats.push(Array.from({ length: COLS }, () => null)) }
    return item
  })
  const deleteCols = () => patchTab((item) => {
    const b = bounds(sel)
    const n = b.c2 - b.c1 + 1
    item.cells.forEach((row) => { row.splice(b.c1, n); for (let i = 0; i < n; i += 1) row.push('') })
    item.formats.forEach((row) => { row.splice(b.c1, n); for (let i = 0; i < n; i += 1) row.push(null) })
    return item
  })

  const dataRegion = (item = tab) => {
    let last = 0
    item.cells.forEach((row, r) => { if (row.some((v) => String(v || '').trim())) last = r })
    return last
  }

  const sortByCol = (dir = 1, col = sel.c) => {
    const isSummary = (label) => /^(total|rata-rata|rata rata|nilai terbesar|grand total)\b/i.test(String(label || '').trim())
    patchTab((item) => {
      let last = 1
      while (last < ROWS && item.cells[last].some((v) => String(v || '').trim())) {
        if (isSummary(item.cells[last][0])) break
        last += 1
      }
      if (last <= 1) return item
      const body = item.cells.slice(1, last).map((row, i) => ({ row, fmt: item.formats[i + 1] }))
      body.sort((a, b) => dir * String(a.row[col] ?? '').localeCompare(String(b.row[col] ?? ''), 'id', { numeric: true }))
      item.cells = [item.cells[0], ...body.map((x) => x.row), ...item.cells.slice(last)]
      item.formats = [item.formats[0], ...body.map((x) => x.fmt), ...item.formats.slice(last)]
      return item
    })
    onNotify(`Diurutkan berdasarkan kolom ${colLabel(col)}`)
  }

  const removeDuplicates = () => {
    let removed = 0
    patchTab((item) => {
      const last = dataRegion(item)
      const seen = new Set()
      const keep = []
      for (let r = 1; r <= last; r += 1) {
        const key = item.cells[r].join('')
        if (seen.has(key)) { removed += 1; continue }
        seen.add(key)
        keep.push({ row: item.cells[r], fmt: item.formats[r] })
      }
      const rest = item.cells.slice(last + 1)
      const restF = item.formats.slice(last + 1)
      item.cells = [item.cells[0], ...keep.map((k) => k.row), ...Array.from({ length: removed }, () => Array.from({ length: COLS }, () => '')), ...rest]
      item.formats = [item.formats[0], ...keep.map((k) => k.fmt), ...Array.from({ length: removed }, () => Array.from({ length: COLS }, () => null)), ...restF]
      return item
    })
    onNotify(removed ? `${removed} baris duplikat dihapus` : 'Tidak ada duplikat')
  }

  const textToColumns = () => {
    const delim = window.prompt('Pemisah (misal , ; atau ketik spasi)', ',')
    if (delim == null) return
    patchTab((item) => {
      const b = bounds(sel)
      for (let r = b.r1; r <= b.r2; r += 1) {
        const parts = String(item.cells[r][b.c1] || '').split(delim === 'spasi' ? ' ' : delim)
        parts.forEach((p, i) => { if (b.c1 + i < COLS) item.cells[r][b.c1 + i] = p.trim() })
      }
      return item
    })
  }

  const autoSum = (fn = 'SUM') => {
    const b = bounds(sel)
    const multi = b.r1 !== b.r2 || b.c1 !== b.c2
    if (multi) {
      const target = Math.min(ROWS - 1, b.r2 + 1)
      patchTab((item) => {
        for (let c = b.c1; c <= b.c2; c += 1) item.cells[target][c] = `=${fn}(${colLabel(c)}${b.r1 + 1}:${colLabel(c)}${b.r2 + 1})`
        return item
      })
      setSel({ r: target, c: b.c1, r2: target, c2: b.c2 })
      return
    }
    let start = sel.r - 1
    while (start >= 0 && computed.display[start]?.[sel.c]?.t === 'n') start -= 1
    start += 1
    if (start >= sel.r) {
      // no numbers above: try to the left, like Excel
      let left = sel.c - 1
      while (left >= 0 && computed.display[sel.r]?.[left]?.t === 'n') left -= 1
      left += 1
      if (left >= sel.c) return onNotify('Tidak ada angka di atas atau di kiri sel ini')
      writeCell(sel.r, sel.c, `=${fn}(${colLabel(left)}${sel.r + 1}:${colLabel(sel.c - 1)}${sel.r + 1})`)
      return
    }
    writeCell(sel.r, sel.c, `=${fn}(${colLabel(sel.c)}${start + 1}:${colLabel(sel.c)}${sel.r})`)
  }

  const fill = (how) => {
    const b = bounds(sel)
    patchTab((item) => {
      if (how === 'down') {
        for (let c = b.c1; c <= b.c2; c += 1) for (let r = b.r1 + 1; r <= b.r2; r += 1) item.cells[r][c] = shiftFormula(item.cells[b.r1][c], r - b.r1, 0)
      } else if (how === 'right') {
        for (let r = b.r1; r <= b.r2; r += 1) for (let c = b.c1 + 1; c <= b.c2; c += 1) item.cells[r][c] = shiftFormula(item.cells[r][b.c1], 0, c - b.c1)
      } else if (how === 'series') {
        for (let c = b.c1; c <= b.c2; c += 1) {
          const first = Number(item.cells[b.r1][c])
          const secondRaw = String(item.cells[b.r1 + 1]?.[c] ?? '').trim()
          const second = Number(secondRaw)
          const step = secondRaw && Number.isFinite(second) ? second - first : 1
          if (!Number.isFinite(first) || String(item.cells[b.r1][c]).trim() === '') continue
          for (let r = b.r1 + 1; r <= b.r2; r += 1) item.cells[r][c] = String(first + step * (r - b.r1))
        }
      }
      return item
    })
  }

  const buildChart = (type) => {
    const b = bounds(sel)
    const labels = []
    const values = []
    for (let r = b.r1; r <= b.r2; r += 1) {
      const raw = computed.display[r][b.c2]
      if (raw?.t === 'n') {
        labels.push(tab.cells[r][b.c1] || colLabel(b.c1) + (r + 1))
        values.push(raw.v)
      }
    }
    if (!values.length) return onNotify('Pilih label di kolom kiri dan angka di kolom kanan untuk membuat bagan')
    setChart({ type, labels, values, title: tab.cells[0][b.c2] || 'Bagan' })
  }

  const conditional = (rule) => {
    if (!stats && !['dup', 'clear'].includes(rule)) return onNotify('Pilih rentang angka dulu')
    let threshold = 0
    if (rule === 'gt' || rule === 'lt') {
      const v = window.prompt(rule === 'gt' ? 'Sorot sel yang lebih besar dari' : 'Sorot sel yang lebih kecil dari', String(Math.round(stats.avg)))
      if (v == null) return
      threshold = Number(v)
    }
    const b = bounds(sel)
    const nums = []
    for (let r = b.r1; r <= b.r2; r += 1) for (let c = b.c1; c <= b.c2; c += 1) { const v = computed.display[r][c]; if (v?.t === 'n') nums.push(v.v) }
    const sorted = [...nums].sort((a, x) => x - a)
    const top = sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.1) - 1))]
    const seen = new Map()
    for (let r = b.r1; r <= b.r2; r += 1) for (let c = b.c1; c <= b.c2; c += 1) { const k = String(tab.cells[r][c] ?? ''); if (k) seen.set(k, (seen.get(k) || 0) + 1) }
    patchTab((item) => forEachSel(item, (r, c) => {
      const val = computed.display[r][c]
      const f = { ...(item.formats[r][c] || {}) }
      const isNum = val?.t === 'n'
      let paint
      if (rule === 'clear') { delete f.fill; delete f.color; item.formats[r][c] = f; return }
      if (rule === 'gt' && isNum && val.v > threshold) paint = { fill: '#ffc7ce', color: '#9c0006' }
      if (rule === 'lt' && isNum && val.v < threshold) paint = { fill: '#ffc7ce', color: '#9c0006' }
      if (rule === 'avg' && isNum) paint = val.v > stats.avg ? { fill: '#c6efce', color: '#006100' } : { fill: '#ffc7ce', color: '#9c0006' }
      if (rule === 'top' && isNum && val.v >= top) paint = { fill: '#ffeb9c', color: '#9c5700' }
      if (rule === 'dup' && seen.get(String(tab.cells[r][c] ?? '')) > 1) paint = { fill: '#ffc7ce', color: '#9c0006' }
      if (rule === 'scale' && isNum && stats) {
        const t = stats.max === stats.min ? 0.5 : (val.v - stats.min) / (stats.max - stats.min)
        const red = Math.round(248 - t * (248 - 99))
        const green = Math.round(105 + t * (190 - 105))
        paint = { fill: `rgb(${red}, ${green}, ${Math.round(107 - t * 30)})` }
      }
      if (rule === 'bars' && isNum && stats) {
        const t = stats.max ? Math.max(0, val.v / stats.max) : 0
        paint = { fill: `linear-gradient(90deg, #9dc3e6 ${Math.round(t * 100)}%, transparent ${Math.round(t * 100)}%)` }
      }
      item.formats[r][c] = paint ? { ...f, ...paint } : f
    }))
  }

  const formatAsTable = (style) => {
    const b = bounds(sel)
    const single = b.r1 === b.r2 && b.c1 === b.c2
    const lastRow = dataRegion()
    const lastCol = Math.max(0, ...tab.cells.slice(0, lastRow + 1).map((row) => row.reduce((acc, v, i) => (String(v || '').trim() ? i : acc), 0)))
    const region = single ? { r1: 0, r2: lastRow, c1: 0, c2: lastCol } : b
    patchTab((item) => {
      for (let r = region.r1; r <= region.r2; r += 1) {
        for (let c = region.c1; c <= region.c2; c += 1) {
          const f = { ...(item.formats[r][c] || {}) }
          if (r === region.r1) Object.assign(f, { bold: true, fill: style.head, color: style.dark ? '#242424' : '#ffffff' })
          else Object.assign(f, { fill: (r - region.r1) % 2 === 1 ? style.band : '#ffffff', color: undefined })
          f.border = 'all'
          item.formats[r][c] = f
        }
      }
      return item
    })
    setFilter(null)
  }

  const mergeCenter = () => {
    const b = bounds(sel)
    if (b.r1 !== b.r2) return onNotify('Gabungkan hanya sel dalam satu baris')
    if (b.c1 === b.c2) {
      if (activeFmt.span) applyFormat({ span: undefined })
      else onNotify('Pilih beberapa sel di satu baris')
      return
    }
    patchTab((item) => {
      const values = []
      for (let c = b.c1; c <= b.c2; c += 1) { if (String(item.cells[b.r1][c] || '').trim()) values.push(item.cells[b.r1][c]); if (c > b.c1) item.cells[b.r1][c] = '' }
      item.cells[b.r1][b.c1] = values[0] ?? ''
      item.formats[b.r1][b.c1] = { ...(item.formats[b.r1][b.c1] || {}), span: b.c2 - b.c1 + 1, align: 'center' }
      return item
    })
    setSel({ r: b.r1, c: b.c1, r2: b.r1, c2: b.c1 })
  }

  const autofit = () => {
    patchTab((item) => {
      const b = bounds(sel)
      const widths = [...(item.colWidths || [])]
      for (let c = b.c1; c <= b.c2; c += 1) {
        let longest = 4
        item.cells.forEach((row, r) => {
          const val = computed.display[r]?.[c]
          const text = displayOf(val, item.formats[r]?.[c]?.numFmt, { decimals: item.formats[r]?.[c]?.decimals, raw: row[c] })
          longest = Math.max(longest, String(text).length)
        })
        widths[c] = Math.round(Math.max(60, Math.min(420, longest * 7.2 + 18)))
      }
      item.colWidths = widths
      return item
    })
  }

  const setColWidth = () => {
    const v = window.prompt('Lebar kolom (px)', String(tab.colWidths[sel.c] || 118))
    const n = Number(v)
    if (!v || !Number.isFinite(n)) return
    patchTab((item) => {
      const widths = [...(item.colWidths || [])]
      const b = bounds(sel)
      for (let c = b.c1; c <= b.c2; c += 1) widths[c] = Math.max(30, Math.min(600, n))
      item.colWidths = widths
      return item
    })
  }

  const goTo = () => {
    const ref = window.prompt('Ke sel (mis. C7)', nameBox)
    const parsed = ref ? parseA1(ref.trim()) : null
    if (!parsed || parsed.row >= ROWS || parsed.col >= COLS) return ref && onNotify('Referensi tidak valid')
    setSel({ r: parsed.row, c: parsed.col, r2: parsed.row, c2: parsed.col })
  }

  const replaceAll = () => {
    const from = window.prompt('Temukan', find)
    if (!from) return
    const to = window.prompt('Ganti dengan', '')
    if (to == null) return
    let count = 0
    patchTab((item) => {
      item.cells = item.cells.map((row) => row.map((v) => {
        const text = String(v ?? '')
        if (!text.includes(from)) return v
        count += text.split(from).length - 1
        return text.split(from).join(to)
      }))
      return item
    })
    onNotify(count ? `${count} kemunculan diganti` : 'Tidak ditemukan')
  }

  const findNext = () => {
    const needle = find.trim().toLowerCase()
    if (!needle) return
    const startAt = sel.r * COLS + sel.c + 1
    for (let step = 0; step < ROWS * COLS; step += 1) {
      const idx = (startAt + step) % (ROWS * COLS)
      const r = Math.floor(idx / COLS)
      const c = idx % COLS
      if (String(tab.cells[r][c] || '').toLowerCase().includes(needle)) {
        setSel({ r, c, r2: r, c2: c })
        return
      }
    }
    onNotify('Tidak ditemukan')
  }

  const firstError = () => {
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) if (computed.display[r][c]?.t === 'e') { setSel({ r, c, r2: r, c2: c }); return onNotify(`${colLabel(c)}${r + 1}: ${computed.display[r][c].v}`) }
    onNotify('Tidak ada kesalahan rumus')
  }

  const insertFunction = (name) => {
    if (!guard()) return
    const template = `=${name}(${name === 'TODAY' || name === 'NOW' ? ')' : ''}`
    startEdit(template, true, 'bar')
    window.setTimeout(() => document.querySelector('.formula-bar input')?.focus(), 30)
  }

  const appendToCell = (text) => {
    if (!guard()) return
    writeCell(sel.r, sel.c, `${activeRaw}${text}`)
  }

  const noteForm = (close) => (
    <NoteForm initial={activeFmt.note || ''} onSubmit={(text) => { close(); applyFormat({ note: text || undefined }); if (text) setNotesRail(true) }} />
  )

  const linkForm = (close) => (
    <LinkForm initial={activeFmt.link || ''} onSubmit={(url) => { close(); applyFormat({ link: url || undefined }) }} />
  )

  const onGridKey = (event) => {
    if (editing && event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') return
    const meta = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (meta && key === 'b') { event.preventDefault(); toggleFormat('bold'); return }
    if (meta && key === 'i') { event.preventDefault(); toggleFormat('italic'); return }
    if (meta && key === 'u') { event.preventDefault(); toggleFormat('underline'); return }
    if (meta && key === 'c') { copySelection(); return }
    if (meta && key === 'x') { cutSelection(); return }
    if (meta && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
    if (meta && key === 'y') { event.preventDefault(); redo(); return }
    if (meta && key === 'f') { event.preventDefault(); setFindOpen(true); return }
    if (meta && key === 'd') { event.preventDefault(); fill('down'); return }
    if (meta && key === 'a') { event.preventDefault(); setSel({ r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 }); return }
    if (event.key === 'F2') { event.preventDefault(); startEdit(); return }
    if (event.key === 'Enter') { event.preventDefault(); if (editing) commitDraft('down'); else startEdit(); return }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (editing) commitDraft('right')
      else setSel({ r: sel.r, c: Math.min(COLS - 1, sel.c + 1), r2: sel.r, c2: Math.min(COLS - 1, sel.c + 1) })
      return
    }
    if (event.key === 'Escape') { cancelEdit(); return }
    if ((event.key === 'Delete' || event.key === 'Backspace') && !editing) { event.preventDefault(); clearSelection('contents'); return }
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]
    if (delta) {
      event.preventDefault()
      const r = Math.max(0, Math.min(ROWS - 1, (event.shiftKey ? sel.r2 : sel.r) + delta[0]))
      const c = Math.max(0, Math.min(COLS - 1, (event.shiftKey ? sel.c2 : sel.c) + delta[1]))
      if (event.shiftKey) setSel({ ...sel, r2: r, c2: c })
      else setSel({ r, c, r2: r, c2: c })
      return
    }
    if (!editing && event.key.length === 1 && !meta) startEdit(event.key, true, 'cell')
  }

  const addSheet = () => {
    if (!guard()) return
    persist({ ...content, sheets: [...content.sheets, { id: newId('tab'), name: `Sheet ${content.sheets.length + 1}`, cells: blankGrid(), formats: blankFormats() }], active: content.sheets.length })
  }

  const renameSheet = (index = content.active) => {
    const item = content.sheets[index]
    const name = window.prompt('Nama sheet', item.name)?.trim().slice(0, 31)
    if (!name) return
    persist({ ...content, sheets: content.sheets.map((sheet, i) => i === index ? { ...sheet, name } : sheet) })
  }

  const applyCopilot = async (result) => {
    const cells = Array.isArray(result?.cells) ? result.cells : []
    const formats = Array.isArray(result?.formats) ? result.formats : []
    const b = bounds(sel)
    const rangeSelected = b.r1 !== b.r2 || b.c1 !== b.c2
    const inRange = (r, c) => !rangeSelected || (r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2)
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
    if (result?.color) { paintFontColor(result.color); written += 1 }
    return written > 0
  }

  const selectedText = selectionTsv()

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
      return { message: 'Baris Total sudah ada di kanvas. Sel Total dipilih.' }
    }
    const last = dataRegion()
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
      if (!stats) return { message: 'Pilih rentang angka di kanvas, lalu minta analisis lagi.', applied: false }
      return { message: `Dari sel ${nameBox}: jumlah ${displayOf({ t: 'n', v: stats.sum })}, rata-rata ${displayOf({ t: 'n', v: stats.avg })}, ${stats.count} angka.`, applied: false }
    }
    if (q.includes('total') || q.includes('jumlah') || q.includes('sum')) return addTotalRow()
    if (q.includes('rupiah') || q.includes('mata uang')) { applyFormat({ numFmt: 'currency' }); return { message: `Sel ${nameBox} diformat Rupiah.` } }
    if (q.includes('persen')) { applyFormat({ numFmt: 'percent' }); return { message: `Sel ${nameBox} diformat persen.` } }
    if (q.includes('tebal') || q.includes('bold')) { applyFormat({ bold: true }); return { message: `Sel ${nameBox} ditebalkan.` } }
    if (q.includes('bagan') || q.includes('grafik') || q.includes('chart')) { buildChart(q.includes('garis') ? 'line' : q.includes('pie') || q.includes('pai') ? 'pie' : 'column'); return { message: 'Bagan dibuat dari rentang yang dipilih.' } }
    if (q.includes('urut')) { sortByCol(q.includes('z') && q.includes('a') && q.indexOf('z') < q.indexOf('a') ? -1 : 1); return { message: `Data diurutkan berdasarkan kolom ${colLabel(sel.c)}.` } }
    if (q.includes('rata-rata') || q.includes('rata rata') || q.includes('average')) {
      if (!stats) return { message: 'Pilih rentang angka dulu.', applied: false }
      return { message: `Rata-rata ${nameBox}: ${displayOf({ t: 'n', v: stats.avg })}.`, applied: false }
    }
    return { message: 'Copilot siaga: minta baris total, format Rupiah/persen, bagan, urutkan, atau analisis rentang yang dipilih.', applied: false }
  }

  /* ---------- ribbon ---------- */
  const numFmtValue = activeFmt.numFmt || 'general'
  const decimals = activeFmt.decimals ?? (numFmtValue === 'currency' ? 0 : numFmtValue === 'percent' ? 1 : 2)
  const selRows = bounds(sel).r2 - bounds(sel).r1 + 1

  const functionPicker = (close) => <FunctionPicker onPick={(name) => { close(); insertFunction(name) }} />

  const tabs = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        { label: 'Urungkan', items: [
          <RBtn key="u" icon={Undo2} label="Urungkan" title="Urungkan (⌘Z)" onClick={undo} disabled={!undoStack.length} />,
          <RBtn key="r" icon={Redo2} label="Ulangi" title="Ulangi (⌘Y)" onClick={redo} disabled={!redoStack.length} />,
        ] },
        { label: 'Papan klip', items: [
          <RMenu key="p" icon={ClipboardPaste} label="Tempel" big split onClick={pasteFromClipboard} items={[
            { id: 'paste', label: 'Tempel', run: pasteFromClipboard },
            { id: 'values', label: 'Tempel nilai saja', run: pasteFromClipboard },
          ]} />,
          <RStack key="s">
            <RBtn icon={Scissors} label="Potong" onClick={cutSelection} />
            <RBtn icon={Copy} label="Salin" onClick={copySelection} />
            <RBtn icon={PaintRoller} label="Penyalin format" active={Boolean(painter)} onClick={startPainter} />
          </RStack>,
        ] },
        { label: 'Font', items: [
          <RPick key="f" width={118} title="Font" value={activeFmt.fontFamily || FONTS[0].value} onChange={(v) => applyFormat({ fontFamily: v })} options={FONTS} />,
          <RPick key="sz" width={56} title="Ukuran font" value={String(activeFmt.fontSize || 11)} onChange={(v) => applyFormat({ fontSize: Number(v) })} options={SIZES.map((n) => ({ value: String(n), label: String(n) }))} />,
          <RBtn key="gr" icon={ZoomIn} label="Perbesar font" onClick={() => applyFormat({ fontSize: Math.min(36, (activeFmt.fontSize || 11) + 1) })} />,
          <RBtn key="sh" icon={ZoomOut} label="Perkecil font" onClick={() => applyFormat({ fontSize: Math.max(6, (activeFmt.fontSize || 11) - 1) })} />,
          <RBtn key="b" icon={Bold} label="Tebal" title="Tebal (⌘B)" active={Boolean(activeFmt.bold)} onClick={() => toggleFormat('bold')} />,
          <RBtn key="i" icon={Italic} label="Miring" title="Miring (⌘I)" active={Boolean(activeFmt.italic)} onClick={() => toggleFormat('italic')} />,
          <RBtn key="un" icon={Underline} label="Garis bawah" title="Garis bawah (⌘U)" active={Boolean(activeFmt.underline)} onClick={() => toggleFormat('underline')} />,
          <RBtn key="st" icon={Strikethrough} label="Coret" active={Boolean(activeFmt.strike)} onClick={() => toggleFormat('strike')} />,
          <RMenu key="bd" icon={SquareDashed} label="Batas" items={[
            { id: 'bottom', label: 'Batas bawah', run: () => applyFormat({ border: 'bottom' }) },
            { id: 'top', label: 'Batas atas', run: () => applyFormat({ border: 'top' }) },
            { id: 'left', label: 'Batas kiri', run: () => applyFormat({ border: 'left' }) },
            { id: 'right', label: 'Batas kanan', run: () => applyFormat({ border: 'right' }) },
            { id: 'all', label: 'Semua batas', run: () => applyFormat({ border: 'all' }) },
            { id: 'thick', label: 'Batas tebal', run: () => applyFormat({ border: 'thick' }) },
            { id: 'topbottom', label: 'Atas & bawah ganda (total)', run: () => applyFormat({ border: 'topbottom' }) },
            { sep: true },
            { id: 'none', label: 'Tanpa batas', run: () => applyFormat({ border: undefined }) },
          ]} />,
          <RColor key="fill" icon={PaintBucket} label="Warna isian" value={fillColor} autoLabel="Tanpa isian" auto="" onPick={(c) => { if (c) setFillColor(c); applyFormat({ fill: c || undefined }) }} />,
          <RColor key="fc" icon={Baseline} label="Warna font" value={fontColor} auto="" onPick={(c) => { if (c) setFontColor(c); applyFormat({ color: c || undefined }) }} />,
        ] },
        { label: 'Perataan', items: [
          <RBtn key="vt" icon={AlignStartVertical} label="Rata atas" active={activeFmt.valign === 'top'} onClick={() => applyFormat({ valign: 'top' })} />,
          <RBtn key="vm" icon={AlignCenterVertical} label="Rata tengah vertikal" active={!activeFmt.valign || activeFmt.valign === 'middle'} onClick={() => applyFormat({ valign: 'middle' })} />,
          <RBtn key="vb" icon={AlignEndVertical} label="Rata bawah" active={activeFmt.valign === 'bottom'} onClick={() => applyFormat({ valign: 'bottom' })} />,
          <RBtn key="w" icon={WrapText} label="Bungkus teks" active={Boolean(activeFmt.wrap)} onClick={() => toggleFormat('wrap')} />,
          <RBtn key="l" icon={AlignLeft} label="Rata kiri" active={activeFmt.align === 'left'} onClick={() => applyFormat({ align: 'left' })} />,
          <RBtn key="c" icon={AlignCenter} label="Tengah" active={activeFmt.align === 'center'} onClick={() => applyFormat({ align: 'center' })} />,
          <RBtn key="rr" icon={AlignRight} label="Rata kanan" active={activeFmt.align === 'right'} onClick={() => applyFormat({ align: 'right' })} />,
          <RBtn key="ind" icon={Plus} label="Tambah indentasi" onClick={() => applyFormat({ indent: Math.min(6, (activeFmt.indent || 0) + 1) })} />,
          <RBtn key="outd" icon={Minus} label="Kurangi indentasi" onClick={() => applyFormat({ indent: Math.max(0, (activeFmt.indent || 0) - 1) })} />,
          <RMenu key="mg" icon={Combine} label="Gabung & tengah" split onClick={mergeCenter} active={Boolean(activeFmt.span)} items={[
            { id: 'mc', label: 'Gabung & tengah', run: mergeCenter },
            { id: 'um', label: 'Pisahkan sel', run: () => applyFormat({ span: undefined }) },
          ]} />,
        ] },
        { label: 'Angka', items: [
          <RPick key="nf" width={130} title="Format angka" value={numFmtValue} onChange={(v) => applyFormat({ numFmt: v === 'general' ? undefined : v, decimals: undefined })} options={NUM_FORMATS} />,
          <RBtn key="cur" icon={BadgeDollarSign} label="Mata uang" active={numFmtValue === 'currency'} onClick={() => applyFormat({ numFmt: 'currency' })} />,
          <RBtn key="pct" icon={Percent} label="Persen" active={numFmtValue === 'percent'} onClick={() => applyFormat({ numFmt: 'percent' })} />,
          <RBtn key="com" icon={Hash} label="Pemisah ribuan" active={numFmtValue === 'comma'} onClick={() => applyFormat({ numFmt: 'comma' })} />,
          <RBtn key="dplus" label=".00 +" title="Tambah desimal" showLabel onClick={() => applyFormat({ decimals: Math.min(10, decimals + 1) })} />,
          <RBtn key="dminus" label=".00 −" title="Kurangi desimal" showLabel onClick={() => applyFormat({ decimals: Math.max(0, decimals - 1) })} />,
        ] },
        { label: 'Gaya', items: [
          <RMenu key="cf" icon={Highlighter} label="Pemformatan bersyarat" big items={[
            { id: 'gt', label: 'Lebih besar dari…', run: () => conditional('gt') },
            { id: 'lt', label: 'Lebih kecil dari…', run: () => conditional('lt') },
            { id: 'avg', label: 'Di atas / bawah rata-rata', run: () => conditional('avg') },
            { id: 'top', label: '10% teratas', run: () => conditional('top') },
            { id: 'dup', label: 'Nilai duplikat', run: () => conditional('dup') },
            { sep: true },
            { id: 'scale', label: 'Skala warna merah–hijau', run: () => conditional('scale') },
            { id: 'bars', label: 'Bilah data', run: () => conditional('bars') },
            { sep: true },
            { id: 'clear', label: 'Hapus aturan dari pilihan', run: () => conditional('clear') },
          ]} />,
          <RGallery key="ft" icon={Table} label="Format sebagai tabel" big cols={1} width={220} items={TABLE_STYLES.map((s) => ({ id: s.id, label: s.label, preview: <span style={{ display: 'grid', gridTemplateRows: 'repeat(3, 10px)', gap: 1 }}><i style={{ background: s.head }} /><i style={{ background: s.band }} /><i style={{ background: '#fff', border: '1px solid #ddd' }} /></span>, run: () => formatAsTable(s) }))} />,
          <RGallery key="cs" icon={Type} label="Gaya sel" big cols={3} width={330} items={CELL_STYLES.map((s) => ({ id: s.id, label: s.label, preview: <span style={{ display: 'block', padding: '6px 8px', border: '1px solid #ddd', ...s.preview }}>{s.label}</span>, run: () => applyFormat(s.id === 'normal' ? { bold: undefined, italic: undefined, color: undefined, fill: undefined, border: undefined, fontSize: undefined } : s.fmt) }))} />,
        ] },
        { label: 'Sel', items: [
          <RMenu key="ins" icon={Plus} label="Sisipkan" big items={[
            { id: 'r', label: 'Sisipkan baris lembar', run: () => insertRows(1) },
            { id: 'c', label: 'Sisipkan kolom lembar', run: () => insertCols(1) },
            { id: 'rs', label: `Sisipkan ${selRows} baris`, run: () => insertRows(selRows) },
          ]} />,
          <RMenu key="del" icon={Trash2} label="Hapus" big items={[
            { id: 'r', label: 'Hapus baris lembar', run: deleteRows },
            { id: 'c', label: 'Hapus kolom lembar', run: deleteCols },
            { id: 'cl', label: 'Kosongkan sel', run: () => clearSelection('all') },
          ]} />,
          <RMenu key="fmt" icon={TableProperties} label="Format" big items={[
            { id: 'af', label: 'Sesuaikan lebar kolom otomatis', run: autofit },
            { id: 'cw', label: 'Lebar kolom…', run: setColWidth },
            { id: 'dw', label: 'Lebar default', run: () => patchTab((item) => { item.colWidths = []; return item }) },
            { sep: true },
            { id: 'rn', label: 'Ganti nama sheet', run: () => renameSheet() },
            { id: 'prot', label: content.protected ? 'Buka proteksi lembar' : 'Proteksi lembar', run: () => persist({ ...content, protected: !content.protected }) },
          ]} />,
        ] },
        { label: 'Pengeditan', items: [
          <RMenu key="sum" icon={Sigma} label="AutoSum" big split onClick={() => autoSum('SUM')} items={[
            { id: 'sum', label: 'Sum', run: () => autoSum('SUM') },
            { id: 'avg', label: 'Average', run: () => autoSum('AVERAGE') },
            { id: 'cnt', label: 'Count numbers', run: () => autoSum('COUNT') },
            { id: 'max', label: 'Max', run: () => autoSum('MAX') },
            { id: 'min', label: 'Min', run: () => autoSum('MIN') },
          ]} />,
          <RStack key="ed">
            <RMenu icon={Rows2} label="Isi" items={[
              { id: 'd', label: 'Ke bawah', hint: '⌘D', run: () => fill('down') },
              { id: 'r', label: 'Ke kanan', run: () => fill('right') },
              { id: 's', label: 'Deret (1, 2, 3…)', run: () => fill('series') },
            ]} />
            <RMenu icon={Minus} label="Bersihkan" items={[
              { id: 'all', label: 'Bersihkan semua', run: () => clearSelection('all') },
              { id: 'f', label: 'Bersihkan format', run: () => clearSelection('formats') },
              { id: 'c', label: 'Bersihkan isi', run: () => clearSelection('contents') },
              { id: 'n', label: 'Bersihkan catatan', run: () => clearSelection('notes') },
            ]} />
            <RMenu icon={Filter} label="Urutkan & Filter" items={[
              { id: 'az', label: 'Urutkan A ke Z', icon: ArrowDownAZ, run: () => sortByCol(1) },
              { id: 'za', label: 'Urutkan Z ke A', icon: ArrowUpZA, run: () => sortByCol(-1) },
              { sep: true },
              { id: 'fl', label: filter ? 'Hapus filter' : 'Filter kolom ini…', icon: Filter, run: () => { if (filter) setFilter(null); else { const v = window.prompt('Tampilkan hanya baris dengan nilai', String(activeRaw)); if (v != null) setFilter({ col: sel.c, value: v }) } } },
            ]} />
            <RMenu icon={Search} label="Temukan & Pilih" items={[
              { id: 'f', label: 'Temukan…', hint: '⌘F', run: () => setFindOpen(true) },
              { id: 'r', label: 'Ganti…', run: replaceAll },
              { id: 'g', label: 'Ke sel…', run: goTo },
              { id: 'a', label: 'Pilih semua', hint: '⌘A', run: () => setSel({ r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 }) },
              { id: 'e', label: 'Kesalahan rumus', run: firstError },
            ]} />
          </RStack>,
        ] },
        { label: 'Analisis', items: [
          <RBtn key="cp" icon={Sparkles} label="Analisis data" big onClick={() => { setShowAgent(true); window.setTimeout(focusCopilotComposer, 40) }} />,
        ] },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        { label: 'Tabel', items: [
          <RBtn key="tbl" icon={Table} label="Tabel" big onClick={() => formatAsTable(TABLE_STYLES[0])} />,
        ] },
        { label: 'Bagan', items: [
          <RBtn key="col" icon={ChartColumn} label="Kolom" big onClick={() => buildChart('column')} />,
          <RBtn key="bar" icon={ChartBar} label="Batang" big onClick={() => buildChart('bar')} />,
          <RBtn key="line" icon={ChartLine} label="Garis" big onClick={() => buildChart('line')} />,
          <RBtn key="pie" icon={ChartPie} label="Pai" big onClick={() => buildChart('pie')} />,
          <RBtn key="area" icon={ChartLine} label="Area" onClick={() => buildChart('area')} />,
        ] },
        { label: 'Tautan', items: [
          <RMenu key="lk" icon={Link2} label="Tautan" big width={280}>{linkForm}</RMenu>,
        ] },
        { label: 'Komentar', items: [
          <RMenu key="nt" icon={MessageSquarePlus} label="Catatan" big width={280}>{noteForm}</RMenu>,
        ] },
        { label: 'Simbol', items: [
          <RMenu key="sym" icon={Type} label="Simbol" items={SYMBOLS.map((s) => ({ id: s, label: s, run: () => appendToCell(s) }))} />,
        ] },
        { label: 'Fungsi', items: [
          <RMenu key="fx" icon={FunctionSquare} label="Fungsi" big width={300}>{functionPicker}</RMenu>,
        ] },
      ],
    },
    {
      id: 'formulas',
      label: 'Rumus',
      groups: [
        { label: 'Pustaka fungsi', items: [
          <RMenu key="fx" icon={FunctionSquare} label="Sisipkan fungsi" big width={300}>{functionPicker}</RMenu>,
          <RMenu key="sum" icon={Sigma} label="AutoSum" big split onClick={() => autoSum('SUM')} items={['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'].map((fn) => ({ id: fn, label: fn, run: () => autoSum(fn) }))} />,
          ...Object.entries(FUNCTIONS).map(([cat, list]) => (
            <RMenu key={cat} icon={FunctionSquare} label={cat} items={list.map((fn) => ({ id: fn, label: FN_HELP[fn] || `${fn}()`, run: () => insertFunction(fn) }))} />
          )),
        ] },
        { label: 'Audit rumus', items: [
          <RBtn key="sf" icon={Eye} label="Tampilkan rumus" big active={showFormulas} onClick={() => setShowFormulas((v) => !v)} />,
          <RBtn key="err" icon={CircleHelp} label="Periksa kesalahan" onClick={firstError} />,
          <RBtn key="calc" icon={RefreshCw} label="Hitung sekarang" onClick={() => { persist({ ...content }, title, { track: false }); onNotify('Semua rumus dihitung ulang') }} />,
          <RBtn key="today" icon={RefreshCw} label="Tanggal hari ini" onClick={() => { if (guard()) { writeCell(sel.r, sel.c, String(todaySerial())); applyFormat({ numFmt: 'date' }) } }} />,
        ] },
      ],
    },
    {
      id: 'data',
      label: 'Data',
      groups: [
        { label: 'Ambil & ubah data', items: [
          <RBtn key="csv" icon={FilePlus2} label="Dari CSV" big onClick={() => fileInput.current?.click()} />,
          <RBtn key="ref" icon={RefreshCw} label="Segarkan semua" onClick={() => { persist({ ...content }, title, { track: false }); onNotify('Data disegarkan') }} />,
        ] },
        { label: 'Urutkan & filter', items: [
          <RBtn key="az" icon={ArrowDownAZ} label="A→Z" big onClick={() => sortByCol(1)} />,
          <RBtn key="za" icon={ArrowUpZA} label="Z→A" big onClick={() => sortByCol(-1)} />,
          <RBtn key="cs" icon={ArrowDownAZ} label="Urutkan kustom" onClick={() => { const col = window.prompt('Urutkan berdasarkan kolom (huruf)', colLabel(sel.c)); const parsed = col ? parseA1(`${col.trim()}1`) : null; if (parsed) sortByCol(1, parsed.col) }} />,
          <RBtn key="fl" icon={Filter} label="Filter" big active={Boolean(filter)} onClick={() => { if (filter) setFilter(null); else { const v = window.prompt(`Tampilkan baris dengan nilai kolom ${colLabel(sel.c)}`, String(activeRaw)); if (v != null) setFilter({ col: sel.c, value: v }) } }} />,
          <RBtn key="cf" icon={Filter} label="Hapus filter" onClick={() => setFilter(null)} disabled={!filter} />,
        ] },
        { label: 'Alat data', items: [
          <RBtn key="ttc" icon={Grid3X3} label="Teks ke kolom" big onClick={textToColumns} />,
          <RBtn key="dup" icon={Trash2} label="Hapus duplikat" big onClick={removeDuplicates} />,
          <RBtn key="dv" icon={CircleHelp} label="Validasi data" onClick={() => { const bad = []; forEachSel({}, (r, c) => { const v = computed.display[r][c]; if (v && !v.empty && v.t !== 'n') bad.push(`${colLabel(c)}${r + 1}`) }); onNotify(bad.length ? `Bukan angka: ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? '…' : ''}` : 'Semua sel terpilih berisi angka') }} />,
        ] },
        { label: 'Ekspor', items: [
          <RBtn key="xls" icon={Table} label="Unduh Excel" big onClick={async () => { await exportXlsx(title, content.sheets); onNotify('Workbook diunduh') }} />,
          <RBtn key="csvx" icon={FilePlus2} label="Unduh CSV" onClick={() => exportCsv(title, tab.cells)} />,
        ] },
      ],
    },
    {
      id: 'review',
      label: 'Tinjau',
      groups: [
        { label: 'Pemeriksaan', items: [
          <RBtn key="sp" icon={SpellCheck} label="Ejaan" big onClick={() => { const bad = []; tab.cells.forEach((row, r) => row.forEach((v, c) => { if (/\s{2,}|^\s|\s$/.test(String(v || ''))) bad.push(`${colLabel(c)}${r + 1}`) })); onNotify(bad.length ? `Spasi ganda/berlebih di ${bad.slice(0, 5).join(', ')}` : 'Tidak ada masalah ejaan yang terdeteksi') }} />,
          <RBtn key="ac" icon={Eye} label="Aksesibilitas" onClick={() => onNotify(tab.cells[0].some((v) => String(v || '').trim()) ? 'Baris header ada · aksesibilitas baik' : 'Tambahkan baris header agar tabel mudah dibaca')} />,
        ] },
        { label: 'Catatan', items: [
          <RMenu key="nt" icon={MessageSquarePlus} label="Catatan baru" big width={280}>{noteForm}</RMenu>,
          <RStack key="ns">
            <RBtn icon={MessageSquarePlus} label={notesRail ? 'Sembunyikan catatan' : 'Tampilkan semua catatan'} active={notesRail} onClick={() => setNotesRail((v) => !v)} />
            <RBtn icon={Minus} label="Hapus catatan sel" onClick={() => applyFormat({ note: undefined })} />
          </RStack>,
        ] },
        { label: 'Proteksi', items: [
          <RBtn key="pr" icon={content.protected ? Lock : LockOpen} label={content.protected ? 'Buka proteksi' : 'Proteksi lembar'} big active={Boolean(content.protected)} onClick={() => persist({ ...content, protected: !content.protected })} />,
        ] },
      ],
    },
    {
      id: 'view',
      label: 'Tampilan',
      groups: [
        { label: 'Tampilan buku kerja', items: [
          <RBtn key="ev" icon={PenLine} label="Mengedit" big active={mode === 'edit'} onClick={() => setMode('edit')} />,
          <RBtn key="rv" icon={Eye} label="Menampilkan" big active={mode === 'view'} onClick={() => setMode('view')} />,
        ] },
        { label: 'Tampilkan', items: [
          <RStack key="s">
            <RBtn icon={Grid3X3} label="Garis kisi" active={gridlines} onClick={() => setGridlines((v) => !v)} />
            <RBtn icon={Hash} label="Judul baris/kolom" active={headings} onClick={() => setHeadings((v) => !v)} />
            <RBtn icon={FunctionSquare} label="Bilah rumus" active={formulaBar} onClick={() => setFormulaBar((v) => !v)} />
          </RStack>,
          <RBtn key="sf" icon={Eye} label="Tampilkan rumus" active={showFormulas} onClick={() => setShowFormulas((v) => !v)} />,
        ] },
        { label: 'Zoom', items: [
          <RBtn key="zi" icon={ZoomIn} label="Perbesar" onClick={() => setZoom((z) => Math.min(200, z + 10))} />,
          <RBtn key="zo" icon={ZoomOut} label="Perkecil" onClick={() => setZoom((z) => Math.max(50, z - 10))} />,
          <RPick key="z" width={78} title="Zoom" value={String(zoom)} onChange={(v) => setZoom(Number(v))} options={[50, 75, 90, 100, 125, 150, 200].map((n) => ({ value: String(n), label: `${n}%` }))} />,
        ] },
        { label: 'Jendela', items: [
          <RMenu key="fz" icon={Snowflake} label="Bekukan panel" big items={[
            { id: 'top', label: 'Bekukan baris atas', active: freeze.rows === 1 && freeze.cols === 0, run: () => setFreeze({ rows: 1, cols: 0 }) },
            { id: 'first', label: 'Bekukan kolom pertama', active: freeze.rows === 0 && freeze.cols === 1, run: () => setFreeze({ rows: 0, cols: 1 }) },
            { id: 'both', label: 'Bekukan baris & kolom pertama', active: freeze.rows === 1 && freeze.cols === 1, run: () => setFreeze({ rows: 1, cols: 1 }) },
            { id: 'sel', label: `Bekukan hingga ${nameBox}`, run: () => setFreeze({ rows: Math.min(6, sel.r), cols: Math.min(3, sel.c) }) },
            { sep: true },
            { id: 'none', label: 'Lepas bekukan', active: freeze.rows === 0 && freeze.cols === 0, run: () => setFreeze({ rows: 0, cols: 0 }) },
          ]} />,
          <RBtn key="ns" icon={FilePlus2} label="Sheet baru" onClick={addSheet} />,
        ] },
      ],
    },
    {
      id: 'help',
      label: 'Bantuan',
      groups: [
        { label: 'Bantuan', items: [
          <RBtn key="h" icon={CircleHelp} label="Bantuan" big onClick={() => onNotify('Excel for the web · F2 edit sel · Enter turun · Tab kanan · Shift+panah pilih rentang')} />,
          <RBtn key="k" icon={Keyboard} label="Pintasan" big onClick={() => onNotify('⌘B/I/U format · ⌘C/X salin/potong · ⌘Z/Y urungkan/ulangi · ⌘F temukan · ⌘D isi ke bawah · ⌘A pilih semua')} />,
        ] },
      ],
    },
  ]

  const widthFor = (c) => tab.colWidths[c] || 118
  const gridTemplate = `${headings ? '42px' : '0px'} ${Array.from({ length: COLS }, (_, c) => `${widthFor(c)}px`).join(' ')}`
  const leftOffset = (c) => (headings ? 42 : 0) + Array.from({ length: c }, (_, i) => widthFor(i)).reduce((a, b) => a + b, 0)
  const cellBorder = (fmt) => {
    const b = fmt.border
    if (!b) return {}
    if (b === 'all') return { boxShadow: 'inset 0 0 0 1px #242424' }
    if (b === 'thick') return { boxShadow: 'inset 0 0 0 2px #242424' }
    if (b === 'bottom') return { borderBottom: '1px solid #242424' }
    if (b === 'top') return { borderTop: '1px solid #242424' }
    if (b === 'left') return { borderLeft: '1px solid #242424' }
    if (b === 'right') return { borderRight: '1px solid #242424' }
    if (b === 'topbottom') return { borderTop: '1px solid #242424', borderBottom: '3px double #242424' }
    return {}
  }

  return (
    <div className={`ed-shell sheets-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main">
        <EditorChrome
          kind="sheet"
          mark={<ExcelIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value, { track: false }) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onComments={() => setNotesRail((v) => !v)}
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
        <Ribbon tabs={tabs} accent="excel" onFile={() => setBackstage(true)} right={<EditingMode value={mode} onChange={setMode} options={MODES} />} />
        <input ref={fileInput} className="hidden-input" type="file" accept=".csv,text/csv" onChange={(event) => {
          const blob = event.target.files?.[0]
          event.target.value = ''
          if (!blob) return
          blob.text().then((text) => {
            patchTab((item) => { item.cells = parseCsv(text); item.formats = blankFormats(); item.name = (blob.name.replace(/\.csv$/i, '') || item.name).slice(0, 31); return item })
            onNotify(`${blob.name} diimpor`)
          })
        }} />
        {findOpen && (
          <div className="find-bar">
            <Search size={14} />
            <input autoFocus value={find} placeholder="Temukan di sheet" onChange={(event) => setFind(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') findNext(); if (event.key === 'Escape') setFindOpen(false) }} />
            <button onClick={findNext}>Berikutnya</button>
            <button onClick={replaceAll}>Ganti…</button>
            <button onClick={() => setFindOpen(false)}>Tutup</button>
          </div>
        )}
        {formulaBar && (
          <div className="formula-bar">
            <span className="cell-reference" onClick={goTo} title="Ke sel…">{nameBox}</span>
            <button type="button" className="copilot-link-badge" onClick={() => { setShowAgent(true); window.setTimeout(focusCopilotComposer, 40) }}>
              <CopilotMark size={13} /> {nameBox}
            </button>
            <span className="fx">fx</span>
            <input
              value={editing ? draft : activeRaw}
              readOnly={!editable}
              onFocus={() => { if (!editing && editable) startEdit(activeRaw, false, 'bar') }}
              onChange={(event) => { if (!editing) startEdit(event.target.value, true, 'bar'); else setDraft(event.target.value) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); commitDraft('down'); focusGrid() }
                if (event.key === 'Tab') { event.preventDefault(); commitDraft('right'); focusGrid() }
                if (event.key === 'Escape') { cancelEdit(); focusGrid() }
              }}
              placeholder="Nilai atau rumus · SUM AVERAGE IF VLOOKUP INDEX MATCH COUNTIF…"
            />
          </div>
        )}
        <div className="sheet-body">
          <div className="sheet-scroll" ref={gridRef} tabIndex={0} onKeyDown={onGridKey} onPaste={(event) => { if (!editing) { event.preventDefault(); if (guard()) pasteTsv(event.clipboardData.getData('text/plain')) } }} onMouseUp={() => { dragging.current = false }}>
            <div className={`s-grid ${gridlines ? '' : 'no-gridlines'} ${headings ? '' : 'no-headings'} ${showFormulas ? 'show-formulas' : ''}`} style={{ gridTemplateColumns: gridTemplate, zoom: zoom / 100 }}>
              <div className="s-corner" onMouseDown={(event) => { event.preventDefault(); setSel({ r: 0, c: 0, r2: ROWS - 1, c2: COLS - 1 }) }} />
              {Array.from({ length: COLS }, (_, c) => (
                <div
                  className={`s-colh ${c >= Math.min(sel.c, sel.c2) && c <= Math.max(sel.c, sel.c2) ? 'hot' : ''} ${c < freeze.cols ? 'frozen-col' : ''}`}
                  style={c < freeze.cols ? { left: leftOffset(c) } : undefined}
                  key={colLabel(c)}
                  onMouseDown={(event) => { event.preventDefault(); if (editing) commitDraft(); focusGrid(); setSel({ r: 0, c, r2: ROWS - 1, c2: c }) }}
                  onDoubleClick={() => { setSel({ r: 0, c, r2: 0, c2: c }); window.setTimeout(autofit, 0) }}
                >{colLabel(c)}</div>
              ))}
              {tab.cells.map((row, r) => {
                if (filter && r > 0 && String(row[filter.col] ?? '') !== filter.value) return null
                let skip = 0
                return (
                  <div className="s-row" key={r} style={{ display: 'contents' }}>
                    <div
                      className={`s-rowh ${r >= Math.min(sel.r, sel.r2) && r <= Math.max(sel.r, sel.r2) ? 'hot' : ''} ${r < freeze.rows ? 'frozen' : ''}`}
                      style={r < freeze.rows ? { top: 28 + r * 28 } : undefined}
                      onMouseDown={(event) => { event.preventDefault(); if (editing) commitDraft(); focusGrid(); setSel({ r, c: 0, r2: r, c2: COLS - 1 }) }}
                    >{r + 1}</div>
                    {row.map((_, c) => {
                      if (skip > 0) { skip -= 1; return null }
                      const fmt = tab.formats[r][c] || {}
                      if (fmt.span > 1) skip = Math.min(fmt.span, COLS - c) - 1
                      const selected = inSel(sel, r, c)
                      const active = sel.r === r && sel.c === c
                      const val = computed.display[r][c]
                      const raw = tab.cells[r][c]
                      const inCellEdit = editing && active && editSource === 'cell'
                      const show = inCellEdit ? null
                        : editing && active ? draft
                          : showFormulas && String(raw || '').startsWith('=') ? raw
                            : displayOf(val, fmt.numFmt, { decimals: fmt.decimals, raw })
                      const frozenRow = r < freeze.rows
                      const frozenCol = c < freeze.cols
                      const style = {
                        background: fmt.fill || (r === 0 ? '#f5f5f5' : undefined),
                        textAlign: fmt.align || (val?.t === 'n' && !showFormulas ? 'right' : 'left'),
                        color: fmt.color || (fmt.link ? '#0563c1' : undefined),
                        fontFamily: fmt.fontFamily,
                        fontSize: fmt.fontSize ? `${fmt.fontSize}pt` : undefined,
                        paddingLeft: fmt.indent ? 8 + fmt.indent * 10 : undefined,
                        alignItems: fmt.valign === 'top' ? 'flex-start' : fmt.valign === 'bottom' ? 'flex-end' : undefined,
                        gridColumn: fmt.span > 1 ? `span ${Math.min(fmt.span, COLS - c)}` : undefined,
                        ...cellBorder(fmt),
                        ...(frozenRow ? { top: 28 + r * 28 } : {}),
                        ...(frozenCol ? { left: leftOffset(c) } : {}),
                      }
                      return (
                        <div
                          key={`${r}-${c}`}
                          className={`s-cell ${selected ? 'sel' : ''} ${active ? 'active' : ''} ${fmt.bold ? 'b' : ''} ${fmt.italic ? 'i' : ''} ${fmt.underline ? 'u' : ''} ${fmt.strike ? 's' : ''} ${fmt.wrap ? 'wrap' : ''} ${val?.t === 'e' ? 'err' : ''} ${frozenRow ? 'frozen' : ''} ${frozenCol ? 'frozen-col' : ''} ${frozenRow && frozenCol ? 'frozen-both' : ''} ${fmt.note ? 'has-note' : ''} ${fmt.span > 1 ? 'merged' : ''}`}
                          style={style}
                          title={fmt.note || undefined}
                          onMouseDown={(event) => {
                            if (event.target.tagName === 'A') return
                            event.preventDefault()
                            focusGrid()
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
                          {inCellEdit ? (
                            <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (editingRef.current) commitDraft() }} onKeyDown={(event) => {
                              event.stopPropagation()
                              if (event.key === 'Enter') { event.preventDefault(); commitDraft('down'); focusGrid() }
                              else if (event.key === 'Tab') { event.preventDefault(); commitDraft('right'); focusGrid() }
                              else if (event.key === 'Escape') { cancelEdit(); focusGrid() }
                            }} />
                          ) : fmt.link ? <a className="cell-link" href={fmt.link} target="_blank" rel="noopener" onClick={(event) => event.stopPropagation()}>{show || fmt.link}</a> : show}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          {notesRail && (
            <aside className="comment-rail notes-rail">
              <strong>Catatan</strong>
              {notes.length === 0 && <p className="muted">Belum ada catatan. Sisipkan → Catatan.</p>}
              {notes.map((n) => (
                <div className="comment-card" key={`${n.r}-${n.c}`} onClick={() => setSel({ r: n.r, c: n.c, r2: n.r, c2: n.c })}>
                  <small>{colLabel(n.c)}{n.r + 1}</small>
                  <p>{n.note}</p>
                </div>
              ))}
            </aside>
          )}
        </div>
        {chart && (
          <div className="chart-dock">
            <div>
              <strong>{chart.title}</strong>
              <RPick value={chart.type} width={110} title="Jenis bagan" onChange={(v) => setChart({ ...chart, type: v })} options={[{ value: 'column', label: 'Kolom' }, { value: 'bar', label: 'Batang' }, { value: 'line', label: 'Garis' }, { value: 'area', label: 'Area' }, { value: 'pie', label: 'Pai' }]} />
              <button onClick={() => setChart(null)}>Tutup</button>
            </div>
            <MiniChart {...chart} />
          </div>
        )}
        <footer className="sheet-footer">
          <div className="sheet-tabs">
            {content.sheets.map((item, index) => (
              <button key={item.id} className={`sheet-tab ${index === content.active ? 'active' : ''}`} onClick={() => persist({ ...content, active: index }, title, { track: false })} onDoubleClick={() => renameSheet(index)}>{item.name}</button>
            ))}
            <button className="add-sheet" onClick={addSheet} aria-label="Sheet baru"><FilePlus2 size={14} /></button>
            {content.sheets.length > 1 && <button className="add-sheet" aria-label="Hapus sheet" onClick={() => { if (guard() && window.confirm(`Hapus sheet “${tab.name}”?`)) persist({ ...content, sheets: content.sheets.filter((_, i) => i !== content.active), active: Math.max(0, content.active - 1) }) }}><Trash2 size={14} /></button>}
          </div>
          <span>{stats ? `Sum ${displayOf({ t: 'n', v: stats.sum })}  ·  Avg ${displayOf({ t: 'n', v: stats.avg })}  ·  Count ${stats.count}` : 'Pilih rentang untuk Sum / Average'}</span>
          <span>{content.protected ? 'Dilindungi' : editable ? 'Siap' : 'Menampilkan'}</span>
          <span className="zoom-ctl">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Perkecil">−</button>
            <input type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" />
            <button onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Perbesar">+</button>
            <b>{zoom}%</b>
          </span>
        </footer>
      </div>
      {showAgent && <AgentPanel kind="sheet" app="Excel" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={selectedText} selectionLabel={`Sel ${nameBox}`} onBusyChange={setCopilotBusy} />}
      {share && <ShareDialog title={`${title}.xlsx`} onClose={() => setShare(false)} onNotify={onNotify} />}
    </div>
  )
}

function FunctionPicker({ onPick }) {
  const [q, setQ] = useState('')
  const all = Object.entries(FUNCTIONS).flatMap(([cat, list]) => list.map((fn) => ({ fn, cat })))
  const shown = all.filter((item) => !q || item.fn.includes(q.toUpperCase()) || item.cat.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="pop-form">
      <input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Cari fungsi (SUM, IF, VLOOKUP…)" />
      <div className="fn-list">
        {shown.map((item) => (
          <button key={item.fn} type="button" onClick={() => onPick(item.fn)}>
            <b>{item.fn}</b>
            <small>{FN_HELP[item.fn] || item.cat}</small>
          </button>
        ))}
        {shown.length === 0 && <small>Tidak ada fungsi yang cocok.</small>}
      </div>
    </div>
  )
}

function NoteForm({ initial, onSubmit }) {
  const [text, setText] = useState(initial)
  return (
    <form className="pop-form" onSubmit={(event) => { event.preventDefault(); onSubmit(text.trim()) }}>
      <label>Catatan sel<textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Tulis catatan untuk sel ini" /></label>
      <div className="row">
        {initial && <button type="button" className="ghost" onClick={() => onSubmit('')}>Hapus</button>}
        <button type="submit" className="primary">Simpan</button>
      </div>
    </form>
  )
}

function LinkForm({ initial, onSubmit }) {
  const [url, setUrl] = useState(initial || 'https://')
  return (
    <form className="pop-form" onSubmit={(event) => { event.preventDefault(); onSubmit(url === 'https://' ? '' : url.trim()) }}>
      <label>Alamat tautan<input autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
      <div className="row">
        {initial && <button type="button" className="ghost" onClick={() => onSubmit('')}>Hapus tautan</button>}
        <button type="submit" className="primary">Sisipkan</button>
      </div>
    </form>
  )
}
