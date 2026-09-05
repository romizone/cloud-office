import { useEffect, useRef, useState } from 'react'
import {
  ALargeSmall, AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BookOpen, Bookmark, CalendarDays,
  CaseSensitive, CircleHelp, ClipboardCopy, ClipboardPaste, Columns2, Copy, Eye, FileText, Highlighter,
  Image, IndentDecrease, IndentIncrease, Italic, Keyboard, Link2, List, ListOrdered, ListTree, Maximize,
  MessageSquare, MessageSquarePlus, Mic, Minus, Omega, PaintRoller, Palette, PanelLeft, PenLine, Pilcrow,
  Printer, Proportions, Quote, Redo2, RemoveFormatting, Replace, Ruler, Scissors, Search, Smile,
  SpellCheck, Sparkles, SquareDashed, Strikethrough, Subscript, Superscript, Table, TextCursorInput,
  TextSelect, Type, Underline, Undo2, ZoomIn, ZoomOut, Eye as EyeIcon, Baseline
} from 'lucide-react'
import { EditorChrome, useSavedFlag } from '../components/EditorChrome.jsx'
import { EditingMode, RBtn, RColor, RGallery, RGridPick, RMenu, RNum, RPick, RStack, Ribbon } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CanvasCopilotChip, focusCopilotComposer } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { WordIcon } from '../components/MsApps.jsx'
import { exportDoc, exportDocText } from '../lib/export.js'
import { escapeText, newId, sanitizeHtml } from '../lib/files.js'
import { USER } from '../lib/brand.js'
import { paintHtml, parseFontColor } from '../lib/editIntent.js'
import { asFragment, colorPick, isAnalyzeIntent, isReviseIntent, replacePick, useCanvasPick } from '../lib/canvasPick.js'

const FONTS = [
  { value: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri' },
  { value: 'Aptos, "Segoe UI", sans-serif', label: 'Aptos' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Plus Jakarta Sans", sans-serif', label: 'Jakarta Sans' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
]
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72]
const SYMBOLS = ['©', '®', '™', '€', '£', '¥', '§', '¶', '•', '…', '–', '—', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∑', 'π', 'α', 'β', 'µ', 'Ω', '→', '←', '↑', '↓', '✓', '✗', '★', '☆', '♥', '♦', '♣', '♠']
const EMOJIS = ['😀', '😊', '😂', '🙂', '😎', '🤔', '👍', '👏', '🙏', '💡', '🔥', '⭐', '✅', '❌', '⚠️', '📌', '📈', '📉', '📅', '💼', '📝', '🎯', '🚀', '❤️']
const STYLES = [
  { id: 'normal', label: 'Normal', tag: 'p', cls: '', preview: <span>Normal</span> },
  { id: 'nospace', label: 'Tanpa spasi', tag: 'p', cls: 'no-spacing', preview: <span style={{ lineHeight: 1 }}>Tanpa spasi</span> },
  { id: 'h1', label: 'Judul 1', tag: 'h1', cls: '', preview: <b style={{ fontSize: 18, color: '#2f5496' }}>Judul 1</b> },
  { id: 'h2', label: 'Judul 2', tag: 'h2', cls: '', preview: <b style={{ fontSize: 15, color: '#2f5496' }}>Judul 2</b> },
  { id: 'h3', label: 'Judul 3', tag: 'h3', cls: '', preview: <b style={{ fontSize: 13, color: '#1f3763' }}>Judul 3</b> },
  { id: 'title', label: 'Judul dokumen', tag: 'h1', cls: 'doc-title', preview: <span style={{ fontSize: 20, letterSpacing: -0.5 }}>Judul</span> },
  { id: 'subtitle', label: 'Subjudul', tag: 'p', cls: 'paper-subtitle', preview: <span style={{ color: '#5a5a5a' }}>Subjudul</span> },
  { id: 'quote', label: 'Kutipan', tag: 'blockquote', cls: '', preview: <i>Kutipan</i> },
  { id: 'intense', label: 'Kutipan kuat', tag: 'blockquote', cls: 'intense', preview: <i style={{ color: '#2f5496', fontWeight: 600 }}>Kutipan kuat</i> },
  { id: 'code', label: 'Kode', tag: 'pre', cls: '', preview: <code>kode()</code> },
]
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,div.text-box,td,th'
const MODES = [
  { id: 'edit', label: 'Mengedit', detail: 'Ubah dokumen secara langsung', icon: PenLine },
  { id: 'review', label: 'Meninjau', detail: 'Hanya komentar, teks terkunci', icon: MessageSquare },
  { id: 'view', label: 'Menampilkan', detail: 'Baca tanpa mengubah apa pun', icon: EyeIcon },
]

function run(command, value = null) {
  document.execCommand(command, false, value)
}

function pxToPt(px) {
  return Math.round(parseFloat(px) * 0.75)
}

export default function DocsEditor({ file, onChange, onBack, onNotify }) {
  const paper = useRef(null)
  const workspace = useRef(null)
  const [pick, clearPick, pickRef] = useCanvasPick(paper)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const [title, setTitle] = useState(file.name)
  const [html, setHtml] = useState(file.content.html)
  const [header, setHeader] = useState(file.content.header || 'Northstar Studio')
  const [footer, setFooter] = useState(file.content.footer || '')
  const [comments, setComments] = useState(file.content.comments || [])
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [showAgent, setShowAgent] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const [zoom, setZoom] = useState(file.content.zoom || 100)
  const [columns, setColumns] = useState(file.content.columns || 1)
  const [pageColor, setPageColor] = useState(file.content.pageColor || '#ffffff')
  const [lineHeight, setLineHeight] = useState(file.content.lineHeight || '1.75')
  const [margin, setMargin] = useState(file.content.margin || 'normal')
  const [orientation, setOrientation] = useState(file.content.orientation || 'portrait')
  const [pageSize, setPageSize] = useState(file.content.pageSize || 'a4')
  const [counts, setCounts] = useState({ words: 0, chars: 0, paras: 0 })
  const [fontName, setFontName] = useState(FONTS[0].value)
  const [fontSize, setFontSize] = useState('12')
  const [fontColor, setFontColor] = useState('#c00000')
  const [hilite, setHilite] = useState('#ffff00')
  const [shade, setShade] = useState('#d9e2f3')
  const [mode, setMode] = useState('edit')
  const [marks, setMarks] = useState(false)
  const [navPane, setNavPane] = useState(false)
  const [ruler, setRuler] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [spell, setSpell] = useState(true)
  const [painter, setPainter] = useState(null)
  const [dictating, setDictating] = useState(false)
  const [headings, setHeadings] = useState([])
  const [showHeaderFooter, setShowHeaderFooter] = useState(true)
  const [paraBefore, setParaBefore] = useState(0)
  const [paraAfter, setParaAfter] = useState(8)
  const [indentLeft, setIndentLeft] = useState(0)
  const recognition = useRef(null)
  const lastRange = useRef(null)
  const saved = useSavedFlag(html + title + header + footer + JSON.stringify(comments) + zoom + orientation + pageSize)
  const editable = mode === 'edit'

  useEffect(() => {
    setTitle(file.name)
    setHtml(file.content.html)
    setHeader(file.content.header || 'Northstar Studio')
    setFooter(file.content.footer || '')
    setComments(file.content.comments || [])
    setZoom(file.content.zoom || 100)
    setColumns(file.content.columns || 1)
    setPageColor(file.content.pageColor || '#ffffff')
    setLineHeight(file.content.lineHeight || '1.75')
    setMargin(file.content.margin || 'normal')
    setOrientation(file.content.orientation || 'portrait')
    setPageSize(file.content.pageSize || 'a4')
    clearPick()
  }, [file.id])

  const persist = (patch = {}) => {
    const nextHtml = patch.html ?? paper.current?.innerHTML ?? html
    const next = {
      html: nextHtml,
      header: patch.header ?? header,
      footer: patch.footer ?? footer,
      comments: patch.comments ?? comments,
      zoom: patch.zoom ?? zoom,
      columns: patch.columns ?? columns,
      pageColor: patch.pageColor ?? pageColor,
      lineHeight: patch.lineHeight ?? lineHeight,
      margin: patch.margin ?? margin,
      orientation: patch.orientation ?? orientation,
      pageSize: patch.pageSize ?? pageSize,
    }
    setHtml(nextHtml)
    onChange({ ...file, name: patch.title ?? title, content: next, updatedAt: new Date().toISOString() })
    recount()
  }

  const recount = () => {
    const text = paper.current?.innerText || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const paras = text.split(/\n+/).filter((p) => p.trim()).length
    setCounts({ words, chars: text.length, paras })
    setHeadings([...(paper.current?.querySelectorAll('h1,h2,h3') || [])].map((el, i) => ({ id: i, level: Number(el.tagName[1]), text: el.innerText.trim() || '(tanpa judul)', el })))
  }

  const guard = () => {
    if (editable) return true
    onNotify(mode === 'view' ? 'Mode Menampilkan: ganti ke Mengedit untuk mengubah teks' : 'Mode Meninjau: hanya komentar yang bisa ditambahkan')
    return false
  }

  const apply = (command, value) => {
    if (!guard()) return
    if (!selectionInPaper()) restoreRange()
    paper.current?.focus({ preventScroll: true })
    run(command, value)
    persist()
  }

  const insertHtml = (snippet) => {
    if (!guard()) return
    paper.current?.focus({ preventScroll: true })
    const before = paper.current?.innerHTML || html
    run('insertHTML', snippet)
    if ((paper.current?.innerHTML || before) === before) {
      const next = `${before}${snippet}`
      if (paper.current) paper.current.innerHTML = next
    }
    persist()
  }

  const insertText = (text) => {
    if (!guard()) return
    paper.current?.focus({ preventScroll: true })
    run('insertText', text)
    persist()
  }

  const writePaper = (nextHtml) => {
    const clean = sanitizeHtml(nextHtml)
    if (!clean) return false
    if (paper.current) paper.current.innerHTML = clean
    persist({ html: clean })
    return true
  }

  const selectionInPaper = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const node = sel.getRangeAt(0).commonAncestorContainer
    const el = node.nodeType === 1 ? node : node.parentElement
    return paper.current?.contains(el) ? sel : null
  }

  // Keep the last caret position inside the paper: ribbon inputs (steppers, selects) steal the DOM selection.
  useEffect(() => {
    const remember = () => {
      const sel = selectionInPaper()
      if (sel) lastRange.current = sel.getRangeAt(0).cloneRange()
    }
    document.addEventListener('selectionchange', remember)
    return () => document.removeEventListener('selectionchange', remember)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restoreRange = () => {
    const range = lastRange.current
    if (!range || !paper.current?.contains(range.commonAncestorContainer)) return false
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }

  const selectedBlocks = (retry = true) => {
    let sel = selectionInPaper()
    if (!sel && restoreRange()) sel = selectionInPaper()
    if (!sel || !paper.current) return []
    const range = sel.getRangeAt(0)
    const toBlock = (node) => {
      const el = node.nodeType === 1 ? node : node.parentElement
      return el?.closest(BLOCKS) && paper.current.contains(el.closest(BLOCKS)) ? el.closest(BLOCKS) : null
    }
    const start = toBlock(range.startContainer)
    const end = toBlock(range.endContainer)
    if (!start) {
      // caret directly inside the paper: wrap loose text into a paragraph (once)
      if (!retry) return []
      run('formatBlock', 'p')
      return selectedBlocks(false)
    }
    const all = [...paper.current.querySelectorAll(BLOCKS)]
    const a = all.indexOf(start)
    const b = end ? all.indexOf(end) : a
    return all.slice(Math.min(a, b), Math.max(a, b) + 1).filter((el) => !all.some((other) => other !== el && other.contains(el) && all.indexOf(other) >= Math.min(a, b) && all.indexOf(other) <= Math.max(a, b)))
  }

  const styleBlocks = (styles) => {
    if (!guard()) return
    // Restore the caret before focusing: focusing the paper with the selection elsewhere resets it to the top.
    if (!selectionInPaper()) restoreRange()
    paper.current?.focus({ preventScroll: true })
    if (!selectionInPaper()) restoreRange()
    const blocks = selectedBlocks()
    if (!blocks.length) return onNotify('Letakkan kursor di paragraf dulu')
    blocks.forEach((el) => Object.assign(el.style, styles))
    persist()
  }

  const setFontSizePt = (pt) => {
    if (!guard()) return
    setFontSize(String(pt))
    paper.current?.focus({ preventScroll: true })
    run('fontSize', '7')
    paper.current?.querySelectorAll('font[size="7"]').forEach((el) => { el.removeAttribute('size'); el.style.fontSize = `${pt}pt` })
    persist()
  }

  const currentFontPt = () => {
    const sel = selectionInPaper()
    const node = sel?.anchorNode
    const el = node ? (node.nodeType === 1 ? node : node.parentElement) : paper.current
    return pxToPt(getComputedStyle(el || paper.current).fontSize) || 12
  }

  const growShrink = (dir) => {
    const now = currentFontPt()
    const idx = SIZES.findIndex((n) => n >= now)
    const next = dir > 0 ? SIZES[Math.min(SIZES.length - 1, (idx < 0 ? SIZES.length - 1 : idx) + 1)] : SIZES[Math.max(0, (idx < 0 ? SIZES.length : idx) - 1)]
    setFontSizePt(next)
  }

  const changeCase = (kind) => {
    const sel = selectionInPaper()
    const text = sel?.toString() || ''
    if (!text) return onNotify('Seleksi teks yang ingin diubah hurufnya')
    const out = kind === 'upper' ? text.toUpperCase()
      : kind === 'lower' ? text.toLowerCase()
        : kind === 'title' ? text.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())
          : kind === 'toggle' ? [...text].map((ch) => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()).join('')
            : text.toLowerCase().replace(/(^\s*\S|[.!?]\s+\S)/g, (m) => m.toUpperCase())
    insertText(out)
  }

  const clipboard = async (action) => {
    if (action === 'paste') {
      if (!guard()) return
      try {
        const text = await navigator.clipboard.readText()
        if (!text) return onNotify('Papan klip kosong')
        insertText(text)
      } catch {
        onNotify('Browser menolak akses papan klip. Gunakan Ctrl+V / ⌘V.')
      }
      return
    }
    if (!selectionInPaper() || window.getSelection().isCollapsed) return onNotify('Seleksi teks dulu')
    if (action === 'cut' && !guard()) return
    paper.current?.focus({ preventScroll: true })
    const ok = document.execCommand(action)
    if (!ok) onNotify(`Gunakan pintasan keyboard untuk ${action === 'cut' ? 'potong' : 'salin'}`)
    if (action === 'cut') persist()
  }

  const startPainter = () => {
    const sel = selectionInPaper()
    const node = sel?.anchorNode
    const el = node ? (node.nodeType === 1 ? node : node.parentElement) : null
    if (!el) return onNotify('Klik teks yang formatnya ingin disalin')
    const cs = getComputedStyle(el)
    setPainter({
      bold: Number(cs.fontWeight) >= 600 || cs.fontWeight === 'bold',
      italic: cs.fontStyle === 'italic',
      underline: cs.textDecorationLine.includes('underline'),
      strike: cs.textDecorationLine.includes('line-through'),
      color: cs.color,
      background: cs.backgroundColor,
      family: cs.fontFamily,
      pt: pxToPt(cs.fontSize),
    })
    onNotify('Seleksi teks tujuan untuk menempelkan format')
  }

  const applyPainter = () => {
    if (!painter || !selectionInPaper() || window.getSelection().isCollapsed) return
    paper.current?.focus({ preventScroll: true })
    const want = (cmd, on) => { if (document.queryCommandState(cmd) !== on) run(cmd) }
    want('bold', painter.bold)
    want('italic', painter.italic)
    want('underline', painter.underline)
    want('strikeThrough', painter.strike)
    run('foreColor', painter.color)
    if (painter.background && painter.background !== 'rgba(0, 0, 0, 0)') run('hiliteColor', painter.background)
    run('fontName', painter.family)
    run('fontSize', '7')
    paper.current?.querySelectorAll('font[size="7"]').forEach((f) => { f.removeAttribute('size'); f.style.fontSize = `${painter.pt}pt` })
    setPainter(null)
    persist()
  }

  const applyStyle = (style) => {
    if (!guard()) return
    paper.current?.focus({ preventScroll: true })
    run('formatBlock', style.tag)
    selectedBlocks().forEach((el) => {
      el.className = style.cls
      if (style.id === 'normal') el.removeAttribute('style')
    })
    persist()
  }

  const applyTextColor = (color) => {
    const el = paper.current
    if (!el || !color) return false
    if (pickRef.current?.text && colorPick(el, pickRef.current, color)) {
      persist()
      return true
    }
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.removeAllRanges()
    selection.addRange(range)
    run('foreColor', color)
    selection.removeAllRanges()
    paintHtml(el, color)
    persist()
    return true
  }

  const applyToPick = (fragment) => {
    if (!pickRef.current?.text || !paper.current) return false
    const ok = replacePick(paper.current, pickRef.current, fragment)
    if (ok) persist()
    return ok
  }

  const applyCopilot = async (result) => {
    if (pickRef.current?.text) {
      if (result?.color) applyTextColor(result.color)
      const frag = result?.selectionHtml || result?.appendHtml || (result?.html && !/<h1[\s>]/i.test(result.html) ? result.html : null)
      if (frag) return applyToPick(asFragment(sanitizeHtml(frag)))
      return Boolean(result?.color)
    }
    if (result?.html) writePaper(result.html)
    else if (result?.appendHtml) writePaper(`${paper.current?.innerHTML || html}${result.appendHtml}`)
    if (result?.color) return applyTextColor(result.color)
    return Boolean(result?.html || result?.appendHtml)
  }

  const insertImage = () => {
    if (!guard()) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const blob = input.files?.[0]
      if (!blob) return
      if (blob.size > 2_000_000) return onNotify('Gambar terlalu besar (maks 2 MB) untuk disimpan di browser')
      const reader = new FileReader()
      reader.onload = () => insertHtml(`<img src="${reader.result}" alt="${escapeText(blob.name)}" />`)
      reader.readAsDataURL(blob)
    }
    input.click()
  }

  const insertTable = (rows = 3, cols = 3) => {
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>Kolom ${i + 1}</th>`).join('')}</tr>`
    const body = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`).join('')
    insertHtml(`<table class="doc-table"><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`)
  }

  const addComment = () => {
    if (mode === 'view') return onNotify('Ganti ke Mengedit atau Meninjau untuk berkomentar')
    const quote = window.getSelection()?.toString().trim() || 'Pilihan'
    const text = window.prompt('Komentar', '')
    if (!text) return
    const next = [...comments, { id: newId('c'), quote: quote.slice(0, 160), text, author: USER.initials, at: new Date().toISOString() }]
    setComments(next)
    setShowComments(true)
    persist({ comments: next })
  }

  const replaceAll = () => {
    if (!find || !paper.current || !guard()) return
    let count = 0
    const walker = document.createTreeWalker(paper.current, NodeFilter.SHOW_TEXT)
    const nodes = []
    let node
    while ((node = walker.nextNode())) nodes.push(node)
    nodes.forEach((textNode) => {
      if (!textNode.nodeValue.includes(find)) return
      count += textNode.nodeValue.split(find).length - 1
      textNode.nodeValue = textNode.nodeValue.split(find).join(replace)
    })
    if (!count) return onNotify('Teks tidak ditemukan')
    persist()
    onNotify(`${count} kemunculan diganti`)
  }

  const findNext = (backwards = false) => {
    if (!find) return
    if (!window.find?.(find, false, backwards, true)) onNotify('Teks tidak ditemukan')
  }

  const insertToc = (update = false) => {
    const heads = [...(paper.current?.querySelectorAll('h1,h2,h3') || [])].filter((el) => !el.closest('.toc-block')).map((el) => ({ level: Number(el.tagName[1]), text: el.innerText.trim() })).filter((h) => h.text)
    if (!heads.length) return onNotify('Tambahkan Judul 1–3 dulu untuk membuat daftar isi')
    const listHtml = `<div class="toc-block" contenteditable="false"><h2>Daftar isi</h2><ol class="toc">${heads.map((h) => `<li class="lv${h.level}">${escapeText(h.text)}</li>`).join('')}</ol></div><p><br></p>`
    const existing = paper.current?.querySelector('.toc-block')
    if (existing) {
      existing.outerHTML = listHtml
      persist()
      onNotify('Daftar isi diperbarui')
      return
    }
    if (update) return onNotify('Belum ada daftar isi. Sisipkan dulu dari Referensi.')
    insertHtml(listHtml)
  }

  const insertFootnote = (kind = 'footnote') => {
    if (!guard()) return
    const text = window.prompt(kind === 'footnote' ? 'Teks catatan kaki' : 'Teks catatan akhir', '')
    if (!text) return
    const list = paper.current?.querySelector(`.${kind}s`)
    const n = (list?.querySelectorAll('li').length || 0) + 1
    insertHtml(`<sup class="fn-ref">${n}</sup>`)
    if (list) list.insertAdjacentHTML('beforeend', `<li>${escapeText(text)}</li>`)
    else if (paper.current) paper.current.insertAdjacentHTML('beforeend', `<hr class="fn-rule"><ol class="${kind}s"><li>${escapeText(text)}</li></ol>`)
    persist()
  }

  const insertCaption = () => {
    const n = (paper.current?.querySelectorAll('.caption').length || 0) + 1
    const text = window.prompt('Keterangan', `Gambar ${n}: `)
    if (text) insertHtml(`<p class="caption">${escapeText(text)}</p>`)
  }

  const insertCitation = () => {
    const src = window.prompt('Sumber (Penulis, Tahun)', 'Northstar Studio, 2025')
    if (!src) return
    insertText(`(${src})`)
  }

  const insertBibliography = () => {
    const cites = [...(paper.current?.innerText.matchAll(/\(([^()]+?, \d{4})\)/g) || [])].map((m) => m[1])
    const unique = [...new Set(cites)]
    if (!unique.length) return onNotify('Belum ada sitasi (Penulis, Tahun) di dokumen')
    insertHtml(`<h2>Daftar pustaka</h2><ul class="bibliography">${unique.map((c) => `<li>${escapeText(c)}.</li>`).join('')}</ul>`)
  }

  const insertLinkForm = (close) => (
    <LinkForm onSubmit={(text, url) => { close(); if (!guard()) return; insertHtml(`<a href="${escapeText(url)}" target="_blank" rel="noopener">${escapeText(text || url)}</a>`) }} initialText={window.getSelection()?.toString() || ''} />
  )

  const toggleDictation = () => {
    if (dictating) {
      recognition.current?.stop()
      setDictating(false)
      return
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Speech) return onNotify('Dikte membutuhkan browser dengan Web Speech API (Chrome/Edge)')
    if (!guard()) return
    const rec = new Speech()
    rec.lang = 'id-ID'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (event) => {
      const text = [...event.results].slice(event.resultIndex).map((r) => r[0].transcript).join(' ')
      if (text) insertText(`${text} `)
    }
    rec.onerror = () => { setDictating(false); onNotify('Dikte dihentikan') }
    rec.onend = () => setDictating(false)
    recognition.current = rec
    rec.start()
    setDictating(true)
    onNotify('Dikte aktif: bicara, teks masuk ke kursor')
  }

  const readAloud = () => {
    if (!('speechSynthesis' in window)) return onNotify('Baca nyaring tidak didukung browser ini')
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return onNotify('Baca nyaring dihentikan') }
    const text = selectionInPaper()?.toString() || paper.current?.innerText || ''
    if (!text.trim()) return
    const utter = new SpeechSynthesisUtterance(text.slice(0, 4000))
    utter.lang = 'id-ID'
    speechSynthesis.speak(utter)
  }

  const accessibilityCheck = () => {
    const imgs = [...(paper.current?.querySelectorAll('img') || [])]
    const noAlt = imgs.filter((img) => !img.getAttribute('alt')).length
    const heads = headings.map((h) => h.level)
    let skips = 0
    heads.forEach((lv, i) => { if (i > 0 && lv - heads[i - 1] > 1) skips += 1 })
    const issues = []
    if (noAlt) issues.push(`${noAlt} gambar tanpa teks alternatif`)
    if (skips) issues.push(`${skips} lompatan tingkat judul`)
    if (!headings.length) issues.push('dokumen tanpa judul')
    onNotify(issues.length ? `Aksesibilitas: ${issues.join(', ')}` : 'Aksesibilitas: tidak ada masalah ditemukan')
  }

  const printDoc = () => window.print()

  const scrollToHeading = (h) => {
    h.el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getContext = () => ({
    title,
    html: (paper.current?.innerHTML || html).slice(0, 10000),
    header,
    footer,
    selection: pickRef.current?.text || '',
    scoped: Boolean(pickRef.current?.text),
  })

  const askAgent = async (prompt) => {
    const color = parseFontColor(prompt)
    const picked = pickRef.current
    if (picked?.text) {
      if (color) {
        applyTextColor(color.value)
        return { message: `Font pada pilihan diubah menjadi ${color.label}.` }
      }
      if (isAnalyzeIntent(prompt) && !isReviseIntent(prompt)) {
        return { message: `Dari pilihan: “${picked.text.slice(0, 360)}${picked.text.length > 360 ? '…' : ''}”`, applied: false }
      }
      if (isReviseIntent(prompt) || /tulis ulang|buat draf/i.test(prompt)) {
        const cut = picked.text.split(/(?<=[.!?])\s+/)[0] || picked.text
        applyToPick(`<span>${escapeText(cut)}</span>`)
        return { message: 'Pilihan di kanvas diperbarui. Teks lain tidak diubah.' }
      }
      return { message: `Siap bekerja pada pilihan: “${picked.text.slice(0, 160)}${picked.text.length > 160 ? '…' : ''}”`, applied: false }
    }
    if (color) {
      applyTextColor(color.value)
      return { message: `Font di kanvas diubah menjadi ${color.label}.` }
    }
    const q = prompt.toLowerCase()
    const current = paper.current?.innerHTML || html
    const text = paper.current?.innerText || ''
    if (q.includes('ringkas') || q.includes('rangkum')) {
      const firstLines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 40).slice(0, 2).join(' ')
      const summary = firstLines || 'dokumen ini menetapkan arah, prioritas, dan cara mengukur kemajuan.'
      const block = `<blockquote>Ringkasan: ${escapeText(summary)}</blockquote>`
      writePaper(/<\/h1>/i.test(current) ? current.replace(/<\/h1>/i, `</h1>${block}`) : `${block}${current}`)
      return { message: 'Ringkasan ditulis di kanvas, di bawah judul.' }
    }
    if (q.includes('kesimpulan') || q.includes('penutup')) {
      writePaper(`${current}<h2>Kesimpulan</h2><p>Langkah berikutnya adalah mengeksekusi prioritas kuartal ini dan meninjau progres setiap dua minggu.</p>`)
      return { message: 'Bagian kesimpulan ditambahkan di kanvas.' }
    }
    if (q.includes('tabel')) {
      insertTable()
      return { message: 'Tabel disisipkan ke kanvas dokumen.' }
    }
    if (q.includes('daftar isi')) {
      insertToc()
      return { message: 'Daftar isi disisipkan dari judul yang ada.' }
    }
    if (q.includes('berapa') || q.includes('jumlah kata') || q.includes('hitung')) {
      return { message: `Dokumen ini ${counts.words} kata, ${counts.chars} karakter, ${counts.paras} paragraf.`, applied: false }
    }
    return { message: 'Copilot siaga lokal: minta ringkasan, kesimpulan, tabel, daftar isi, atau warna font. Seleksi teks untuk merevisi bagian tertentu.', applied: false }
  }

  /* ---------- ribbon ---------- */
  const dateItems = [
    { id: 'long', label: new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }), run: () => insertText(new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })) },
    { id: 'short', label: new Date().toLocaleDateString('id-ID'), run: () => insertText(new Date().toLocaleDateString('id-ID')) },
    { id: 'full', label: new Date().toLocaleDateString('id-ID', { dateStyle: 'full' }), run: () => insertText(new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })) },
    { id: 'time', label: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), run: () => insertText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) },
  ]

  const tabs = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        { label: 'Urungkan', items: [
          <RBtn key="u" icon={Undo2} label="Urungkan" title="Urungkan (⌘Z)" onClick={() => apply('undo')} />,
          <RBtn key="r" icon={Redo2} label="Ulangi" title="Ulangi (⌘Y)" onClick={() => apply('redo')} />,
        ] },
        { label: 'Papan klip', items: [
          <RMenu key="p" icon={ClipboardPaste} label="Tempel" big split onClick={() => clipboard('paste')} items={[
            { id: 'paste', label: 'Tempel', icon: ClipboardPaste, run: () => clipboard('paste') },
            { id: 'plain', label: 'Tempel teks saja', run: () => clipboard('paste') },
          ]} />,
          <RStack key="s">
            <RBtn icon={Scissors} label="Potong" onClick={() => clipboard('cut')} />
            <RBtn icon={Copy} label="Salin" onClick={() => clipboard('copy')} />
            <RBtn icon={PaintRoller} label="Penyalin format" active={Boolean(painter)} onClick={startPainter} />
          </RStack>,
        ] },
        { label: 'Font', items: [
          <RPick key="f" width={128} title="Font" value={fontName} onChange={(v) => { setFontName(v); apply('fontName', v) }} options={FONTS} />,
          <RPick key="sz" width={58} title="Ukuran font" value={fontSize} onChange={(v) => setFontSizePt(Number(v))} options={SIZES.map((n) => ({ value: String(n), label: String(n) }))} />,
          <RBtn key="gr" icon={ZoomIn} label="Perbesar font" onClick={() => growShrink(1)} />,
          <RBtn key="sh" icon={ZoomOut} label="Perkecil font" onClick={() => growShrink(-1)} />,
          <RMenu key="case" icon={CaseSensitive} label="Ubah huruf" items={[
            { id: 'sentence', label: 'Huruf kalimat.', run: () => changeCase('sentence') },
            { id: 'lower', label: 'huruf kecil', run: () => changeCase('lower') },
            { id: 'upper', label: 'HURUF BESAR', run: () => changeCase('upper') },
            { id: 'title', label: 'Kapital Tiap Kata', run: () => changeCase('title') },
            { id: 'toggle', label: 'bALIK hURUF', run: () => changeCase('toggle') },
          ]} />,
          <RBtn key="clr" icon={RemoveFormatting} label="Hapus semua format" onClick={() => { apply('removeFormat'); apply('formatBlock', 'p') }} />,
          <RBtn key="b" icon={Bold} label="Tebal" title="Tebal (⌘B)" onClick={() => apply('bold')} />,
          <RBtn key="i" icon={Italic} label="Miring" title="Miring (⌘I)" onClick={() => apply('italic')} />,
          <RBtn key="un" icon={Underline} label="Garis bawah" title="Garis bawah (⌘U)" onClick={() => apply('underline')} />,
          <RBtn key="st" icon={Strikethrough} label="Coret" onClick={() => apply('strikeThrough')} />,
          <RBtn key="sub" icon={Subscript} label="Subskrip" onClick={() => apply('subscript')} />,
          <RBtn key="sup" icon={Superscript} label="Superskrip" onClick={() => apply('superscript')} />,
          <RColor key="hl" icon={Highlighter} label="Warna sorotan teks" highlight value={hilite} autoLabel="Tanpa warna" auto="transparent" onPick={(c) => { setHilite(c); apply('hiliteColor', c || 'transparent') }} />,
          <RColor key="fc" icon={Baseline} label="Warna font" value={fontColor} auto="#242424" onPick={(c) => { setFontColor(c); apply('foreColor', c || '#242424') }} />,
        ] },
        { label: 'Paragraf', items: [
          <RMenu key="ul" icon={List} label="Poin" split onClick={() => apply('insertUnorderedList')} items={[
            { id: 'disc', label: '● Bulatan', run: () => { apply('insertUnorderedList'); styleBlocks({ listStyleType: 'disc' }) } },
            { id: 'circle', label: '○ Lingkaran', run: () => { apply('insertUnorderedList'); styleBlocks({ listStyleType: 'circle' }) } },
            { id: 'square', label: '■ Kotak', run: () => { apply('insertUnorderedList'); styleBlocks({ listStyleType: 'square' }) } },
            { id: 'check', label: '✓ Centang', run: () => { apply('insertUnorderedList'); styleBlocks({ listStyleType: '"✓ "' }) } },
          ]} />,
          <RMenu key="ol" icon={ListOrdered} label="Penomoran" split onClick={() => apply('insertOrderedList')} items={[
            { id: 'dec', label: '1. 2. 3.', run: () => { apply('insertOrderedList'); styleBlocks({ listStyleType: 'decimal' }) } },
            { id: 'alpha', label: 'a. b. c.', run: () => { apply('insertOrderedList'); styleBlocks({ listStyleType: 'lower-alpha' }) } },
            { id: 'roman', label: 'i. ii. iii.', run: () => { apply('insertOrderedList'); styleBlocks({ listStyleType: 'lower-roman' }) } },
            { id: 'ualpha', label: 'A. B. C.', run: () => { apply('insertOrderedList'); styleBlocks({ listStyleType: 'upper-alpha' }) } },
          ]} />,
          <RBtn key="ml" icon={ListTree} label="Daftar bertingkat" onClick={() => apply('indent')} />,
          <RBtn key="out" icon={IndentDecrease} label="Kurangi indentasi" onClick={() => apply('outdent')} />,
          <RBtn key="in" icon={IndentIncrease} label="Tambah indentasi" onClick={() => apply('indent')} />,
          <RBtn key="pm" icon={Pilcrow} label="Tampilkan tanda paragraf" active={marks} onClick={() => setMarks((v) => !v)} />,
          <RBtn key="l" icon={AlignLeft} label="Rata kiri" onClick={() => apply('justifyLeft')} />,
          <RBtn key="c" icon={AlignCenter} label="Tengah" onClick={() => apply('justifyCenter')} />,
          <RBtn key="rr" icon={AlignRight} label="Rata kanan" onClick={() => apply('justifyRight')} />,
          <RBtn key="j" icon={AlignJustify} label="Rata kiri-kanan" onClick={() => apply('justifyFull')} />,
          <RMenu key="ls" icon={ALargeSmall} label="Spasi baris" items={[
            ...['1', '1.15', '1.5', '2', '2.5', '3'].map((v) => ({ id: v, label: v.replace('.', ','), active: lineHeight === v, run: () => { setLineHeight(v); persist({ lineHeight: v }) } })),
            { sep: true },
            { id: 'sel', label: 'Spasi paragraf terpilih 1,5', run: () => styleBlocks({ lineHeight: '1.5' }) },
            { id: 'before', label: 'Tambah spasi sebelum paragraf', run: () => styleBlocks({ marginTop: '12pt' }) },
            { id: 'after', label: 'Tambah spasi setelah paragraf', run: () => styleBlocks({ marginBottom: '12pt' }) },
            { id: 'none', label: 'Hapus spasi paragraf', run: () => styleBlocks({ marginTop: '0', marginBottom: '0' }) },
          ]} />,
          <RColor key="shade" icon={PaintRoller} label="Bayangan paragraf" value={shade} autoLabel="Tanpa warna" auto="" onPick={(c) => { setShade(c); styleBlocks({ backgroundColor: c || 'transparent' }) }} />,
          <RMenu key="bd" icon={SquareDashed} label="Batas" items={[
            { id: 'bottom', label: 'Batas bawah', run: () => styleBlocks({ borderBottom: '1px solid #242424' }) },
            { id: 'top', label: 'Batas atas', run: () => styleBlocks({ borderTop: '1px solid #242424' }) },
            { id: 'left', label: 'Batas kiri', run: () => styleBlocks({ borderLeft: '3px solid #242424', paddingLeft: '10px' }) },
            { id: 'all', label: 'Semua batas', run: () => styleBlocks({ border: '1px solid #242424', padding: '8px' }) },
            { id: 'none', label: 'Tanpa batas', run: () => styleBlocks({ border: 'none', padding: '0' }) },
            { sep: true },
            { id: 'hr', label: 'Garis horizontal', run: () => apply('insertHorizontalRule') },
          ]} />,
        ] },
        { label: 'Gaya', items: [
          <RGallery key="st" icon={Type} label="Gaya" big cols={2} width={360} items={STYLES.map((s) => ({ id: s.id, label: s.label, preview: s.preview, run: () => applyStyle(s) }))} />,
        ] },
        { label: 'Pengeditan', items: [
          <RMenu key="fd" icon={Search} label="Temukan" big split onClick={() => setFindOpen(true)} items={[
            { id: 'find', label: 'Temukan', hint: '⌘F', run: () => setFindOpen(true) },
            { id: 'replace', label: 'Ganti', hint: '⌘H', run: () => setFindOpen(true) },
            { id: 'goto', label: 'Ke judul…', run: () => setNavPane(true) },
          ]} />,
          <RStack key="es">
            <RBtn icon={Replace} label="Ganti" onClick={() => setFindOpen(true)} />
            <RBtn icon={TextSelect} label="Pilih semua" onClick={() => apply('selectAll')} />
          </RStack>,
        ] },
        { label: 'Suara', items: [
          <RBtn key="dic" icon={Mic} label={dictating ? 'Berhenti dikte' : 'Dikte'} big active={dictating} onClick={toggleDictation} />,
        ] },
        { label: 'Editor', items: [
          <RBtn key="ed" icon={SpellCheck} label="Editor" big active={spell} onClick={() => { setSpell((v) => !v); onNotify(spell ? 'Pemeriksaan ejaan dimatikan' : 'Pemeriksaan ejaan aktif · kata bergaris merah perlu ditinjau') }} />,
          <RBtn key="cp" icon={Sparkles} label="Copilot" big onClick={() => { setShowAgent(true); window.setTimeout(focusCopilotComposer, 40) }} />,
        ] },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        { label: 'Halaman', items: [
          <RMenu key="pb" icon={FileText} label="Ganti halaman" big split onClick={() => insertHtml('<div class="page-break"></div><p><br></p>')} items={[
            { id: 'page', label: 'Ganti halaman', run: () => insertHtml('<div class="page-break"></div><p><br></p>') },
            { id: 'col', label: 'Ganti kolom', run: () => styleBlocks({ breakBefore: 'column' }) },
            { id: 'section', label: 'Ganti bagian', run: () => insertHtml('<hr class="section-break"><p><br></p>') },
          ]} />,
        ] },
        { label: 'Tabel', items: [
          <RGridPick key="tbl" icon={Table} label="Tabel" big onPick={(r, c) => insertTable(r, c)} />,
        ] },
        { label: 'Ilustrasi', items: [
          <RBtn key="img" icon={Image} label="Gambar" big onClick={insertImage} />,
          <RMenu key="tb" icon={SquareDashed} label="Kotak teks" items={[
            { id: 'simple', label: 'Kotak teks sederhana', run: () => insertHtml('<div class="text-box">Ketik teks di sini</div><p><br></p>') },
            { id: 'side', label: 'Bilah samping', run: () => insertHtml('<div class="text-box sidebar">Sorotan penting</div><p><br></p>') },
            { id: 'call', label: 'Kutipan sorot', run: () => insertHtml('<div class="text-box callout">“Kutipan sorot”</div><p><br></p>') },
          ]} />,
        ] },
        { label: 'Tautan', items: [
          <RMenu key="lk" icon={Link2} label="Tautan" big width={280}>{insertLinkForm}</RMenu>,
          <RBtn key="bm" icon={Bookmark} label="Penanda" onClick={() => { const name = window.prompt('Nama penanda', `bagian-${Date.now().toString(36).slice(-4)}`); if (name) insertHtml(`<a id="${escapeText(name)}" class="bookmark"></a>`) }} />,
        ] },
        { label: 'Komentar', items: [
          <RBtn key="cm" icon={MessageSquarePlus} label="Komentar" big onClick={addComment} />,
        ] },
        { label: 'Header & Footer', items: [
          <RMenu key="hf" icon={Proportions} label="Header & Footer" big items={[
            { id: 'h', label: 'Edit header', run: () => { setShowHeaderFooter(true); window.setTimeout(() => document.querySelector('.page-header')?.focus(), 30) } },
            { id: 'f', label: 'Edit footer', run: () => { setShowHeaderFooter(true); window.setTimeout(() => document.querySelector('.page-footer span')?.focus(), 30) } },
            { id: 'pn', label: 'Nomor halaman di footer', run: () => { setFooter('Halaman 1'); persist({ footer: 'Halaman 1' }) } },
            { id: 'clear', label: 'Kosongkan header & footer', run: () => { setHeader(''); setFooter(''); persist({ header: '', footer: '' }) } },
          ]} />,
        ] },
        { label: 'Teks', items: [
          <RMenu key="dt" icon={CalendarDays} label="Tanggal & waktu" items={dateItems} />,
          <RBtn key="dc" icon={Type} label="Drop cap" onClick={() => {
            const block = selectedBlocks()[0]
            if (!block || !block.innerText.trim()) return onNotify('Letakkan kursor di paragraf yang punya teks')
            block.classList.toggle('has-dropcap')
            persist()
          }} />,
        ] },
        { label: 'Simbol', items: [
          <RMenu key="sym" icon={Omega} label="Simbol" big>
            {(close) => (
              <div className="symbol-grid">{SYMBOLS.map((s) => <button key={s} type="button" onClick={() => { close(); insertText(s) }}>{s}</button>)}</div>
            )}
          </RMenu>,
          <RMenu key="emo" icon={Smile} label="Emoji">
            {(close) => (
              <div className="symbol-grid">{EMOJIS.map((s) => <button key={s} type="button" onClick={() => { close(); insertText(s) }}>{s}</button>)}</div>
            )}
          </RMenu>,
          <RBtn key="eq" icon={Omega} label="Persamaan" onClick={() => insertHtml('<span class="equation">E = mc<sup>2</sup></span>&nbsp;')} />,
        ] },
      ],
    },
    {
      id: 'layout',
      label: 'Tata Letak',
      groups: [
        { label: 'Penyiapan halaman', items: [
          <RMenu key="m" icon={SquareDashed} label="Margin" big items={[
            { id: 'normal', label: 'Normal · 2,54 cm', active: margin === 'normal', run: () => { setMargin('normal'); persist({ margin: 'normal' }) } },
            { id: 'narrow', label: 'Sempit · 1,27 cm', active: margin === 'narrow', run: () => { setMargin('narrow'); persist({ margin: 'narrow' }) } },
            { id: 'moderate', label: 'Sedang · 1,91 cm', active: margin === 'moderate', run: () => { setMargin('moderate'); persist({ margin: 'moderate' }) } },
            { id: 'wide', label: 'Lebar · 5,08 cm', active: margin === 'wide', run: () => { setMargin('wide'); persist({ margin: 'wide' }) } },
          ]} />,
          <RMenu key="o" icon={Proportions} label="Orientasi" big items={[
            { id: 'portrait', label: 'Potret', active: orientation === 'portrait', run: () => { setOrientation('portrait'); persist({ orientation: 'portrait' }) } },
            { id: 'landscape', label: 'Lanskap', active: orientation === 'landscape', run: () => { setOrientation('landscape'); persist({ orientation: 'landscape' }) } },
          ]} />,
          <RMenu key="sz" icon={Maximize} label="Ukuran" big items={[
            { id: 'a4', label: 'A4 · 21 × 29,7 cm', active: pageSize === 'a4', run: () => { setPageSize('a4'); persist({ pageSize: 'a4' }) } },
            { id: 'letter', label: 'Letter · 21,6 × 27,9 cm', active: pageSize === 'letter', run: () => { setPageSize('letter'); persist({ pageSize: 'letter' }) } },
            { id: 'legal', label: 'Legal · 21,6 × 35,6 cm', active: pageSize === 'legal', run: () => { setPageSize('legal'); persist({ pageSize: 'legal' }) } },
            { id: 'a5', label: 'A5 · 14,8 × 21 cm', active: pageSize === 'a5', run: () => { setPageSize('a5'); persist({ pageSize: 'a5' }) } },
          ]} />,
          <RMenu key="col" icon={Columns2} label="Kolom" big items={[1, 2, 3].map((n) => ({ id: String(n), label: n === 1 ? 'Satu' : n === 2 ? 'Dua' : 'Tiga', active: columns === n, run: () => { setColumns(n); persist({ columns: n }) } }))} />,
          <RMenu key="brk" icon={FileText} label="Pemisah" items={[
            { id: 'page', label: 'Halaman', run: () => insertHtml('<div class="page-break"></div><p><br></p>') },
            { id: 'section', label: 'Bagian', run: () => insertHtml('<hr class="section-break"><p><br></p>') },
          ]} />,
          <RMenu key="dir" icon={AlignLeft} label="Arah teks" items={[
            { id: 'ltr', label: 'Kiri ke kanan', run: () => styleBlocks({ direction: 'ltr' }) },
            { id: 'rtl', label: 'Kanan ke kiri', run: () => styleBlocks({ direction: 'rtl' }) },
          ]} />,
        ] },
        { label: 'Indentasi', items: [
          <RNum key="il" title="Indentasi kiri (pt)" value={indentLeft} min={0} max={200} step={6} suffix="pt kiri" onChange={(v) => { setIndentLeft(v); styleBlocks({ marginLeft: `${v}pt` }) }} />,
        ] },
        { label: 'Spasi', items: [
          <RNum key="sb" title="Spasi sebelum (pt)" value={paraBefore} min={0} max={72} step={2} suffix="pt sebelum" onChange={(v) => { setParaBefore(v); styleBlocks({ marginTop: `${v}pt` }) }} />,
          <RNum key="sa" title="Spasi setelah (pt)" value={paraAfter} min={0} max={72} step={2} suffix="pt setelah" onChange={(v) => { setParaAfter(v); styleBlocks({ marginBottom: `${v}pt` }) }} />,
        ] },
        { label: 'Halaman', items: [
          <RColor key="pc" icon={Palette} label="Warna halaman" value={pageColor} auto="#ffffff" autoLabel="Putih" onPick={(c) => { const v = c || '#ffffff'; setPageColor(v); persist({ pageColor: v }) }} />,
        ] },
      ],
    },
    {
      id: 'refs',
      label: 'Referensi',
      groups: [
        { label: 'Daftar isi', items: [
          <RMenu key="toc" icon={BookOpen} label="Daftar isi" big split onClick={() => insertToc()} items={[
            { id: 'insert', label: 'Sisipkan daftar isi', run: () => insertToc() },
            { id: 'update', label: 'Perbarui daftar isi', run: () => insertToc(true) },
            { id: 'remove', label: 'Hapus daftar isi', run: () => { const el = paper.current?.querySelector('.toc-block'); if (el) { el.remove(); persist() } } },
          ]} />,
        ] },
        { label: 'Catatan kaki', items: [
          <RBtn key="fn" icon={Superscript} label="Catatan kaki" big onClick={() => insertFootnote('footnote')} />,
          <RBtn key="en" icon={Subscript} label="Catatan akhir" onClick={() => insertFootnote('endnote')} />,
        ] },
        { label: 'Sitasi & bibliografi', items: [
          <RBtn key="cit" icon={Quote} label="Sisipkan sitasi" big onClick={insertCitation} />,
          <RBtn key="bib" icon={BookOpen} label="Bibliografi" onClick={insertBibliography} />,
        ] },
        { label: 'Keterangan', items: [
          <RBtn key="cap" icon={TextCursorInput} label="Sisipkan keterangan" big onClick={insertCaption} />,
        ] },
      ],
    },
    {
      id: 'review',
      label: 'Tinjau',
      groups: [
        { label: 'Pemeriksaan', items: [
          <RBtn key="sp" icon={SpellCheck} label="Ejaan" big active={spell} onClick={() => setSpell((v) => !v)} />,
          <RBtn key="wc" icon={Type} label="Hitung kata" onClick={() => onNotify(`${counts.words} kata · ${counts.chars} karakter · ${counts.paras} paragraf`)} />,
          <RBtn key="ra" icon={Mic} label="Baca nyaring" onClick={readAloud} />,
          <RBtn key="ac" icon={EyeIcon} label="Periksa aksesibilitas" onClick={accessibilityCheck} />,
        ] },
        { label: 'Komentar', items: [
          <RBtn key="cm" icon={MessageSquarePlus} label="Komentar baru" big onClick={addComment} />,
          <RStack key="cs">
            <RBtn icon={MessageSquare} label={showComments ? 'Sembunyikan komentar' : 'Tampilkan komentar'} active={showComments} onClick={() => setShowComments((v) => !v)} />
            <RBtn icon={Minus} label="Hapus semua komentar" onClick={() => { if (comments.length && window.confirm('Hapus semua komentar?')) { setComments([]); persist({ comments: [] }) } }} />
          </RStack>,
        ] },
        { label: 'Perlindungan', items: [
          <RMenu key="prot" icon={PenLine} label="Batasi pengeditan" items={MODES.map((m) => ({ id: m.id, label: m.label, icon: m.icon, active: mode === m.id, run: () => setMode(m.id) }))} />,
        ] },
      ],
    },
    {
      id: 'view',
      label: 'Tampilan',
      groups: [
        { label: 'Tampilan', items: [
          <RBtn key="ev" icon={PenLine} label="Tampilan edit" big active={mode === 'edit' && !immersive} onClick={() => { setMode('edit'); setImmersive(false) }} />,
          <RBtn key="rv" icon={BookOpen} label="Tampilan baca" big active={mode === 'view' && !immersive} onClick={() => { setMode('view'); setImmersive(false) }} />,
          <RBtn key="ir" icon={EyeIcon} label="Pembaca imersif" big active={immersive} onClick={() => setImmersive((v) => !v)} />,
        ] },
        { label: 'Tampilkan', items: [
          <RStack key="sh">
            <RBtn icon={PanelLeft} label="Panel navigasi" active={navPane} onClick={() => setNavPane((v) => !v)} />
            <RBtn icon={Ruler} label="Penggaris" active={ruler} onClick={() => setRuler((v) => !v)} />
            <RBtn icon={Proportions} label="Header & footer" active={showHeaderFooter} onClick={() => setShowHeaderFooter((v) => !v)} />
          </RStack>,
        ] },
        { label: 'Zoom', items: [
          <RBtn key="zi" icon={ZoomIn} label="Perbesar" onClick={() => { const z = Math.min(200, zoom + 10); setZoom(z); persist({ zoom: z }) }} />,
          <RBtn key="zo" icon={ZoomOut} label="Perkecil" onClick={() => { const z = Math.max(50, zoom - 10); setZoom(z); persist({ zoom: z }) }} />,
          <RPick key="z" width={78} title="Zoom" value={String(zoom)} onChange={(v) => { const n = Number(v); setZoom(n); persist({ zoom: n }) }} options={[50, 75, 90, 100, 110, 125, 150, 200].map((n) => ({ value: String(n), label: `${n}%` }))} />,
          <RBtn key="zw" icon={Maximize} label="Lebar halaman" onClick={() => {
            const w = workspace.current?.clientWidth || 900
            const z = Math.max(50, Math.min(200, Math.floor(((w - 48) / 820) * 100)))
            setZoom(z)
            persist({ zoom: z })
          }} />,
        ] },
        { label: 'Fokus', items: [
          <RBtn key="fo" icon={Maximize} label="Fokus" big active={!showAgent && !showComments} onClick={() => { setShowAgent(false); setShowComments(false); setNavPane(false) }} />,
        ] },
      ],
    },
    {
      id: 'help',
      label: 'Bantuan',
      groups: [
        { label: 'Bantuan', items: [
          <RBtn key="h" icon={CircleHelp} label="Bantuan" big onClick={() => onNotify('Word for the web · Office Romeo · Ribbon sederhana/klasik lewat panah di kanan ribbon')} />,
          <RBtn key="k" icon={Keyboard} label="Pintasan" big onClick={() => onNotify('⌘B tebal · ⌘I miring · ⌘U garis bawah · ⌘F temukan · ⌘P cetak · ⌘Z urungkan · ⌘K Copilot')} />,
          <RBtn key="ab" icon={FileText} label="Tentang" onClick={() => onNotify('Office Romeo · Word for the web · OneDrive 2 GB')} />,
        ] },
      ],
    },
  ]

  useEffect(() => {
    const onKey = (event) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === 'f' || key === 'h') { event.preventDefault(); setFindOpen(true) }
      if (key === 'p') { event.preventDefault(); printDoc() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => { recognition.current?.stop(); if ('speechSynthesis' in window) speechSynthesis.cancel() }, [])

  const paperClass = [
    'paper',
    `cols-${columns}`,
    `margin-${margin}`,
    `size-${pageSize}`,
    orientation === 'landscape' ? 'landscape' : '',
    pick?.text ? 'copilot-scoped' : '',
    marks ? 'show-marks' : '',
    immersive ? 'immersive' : '',
    painter ? 'painting' : '',
    mode !== 'edit' ? 'readonly' : '',
  ].join(' ')

  return (
    <div className={`ed-shell docs-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main">
        <EditorChrome
          kind="doc"
          mark={<WordIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist({ title: value }) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onComments={() => setShowComments((v) => !v)}
          onCopilot={() => setShowAgent((v) => !v)}
        />
        {backstage && (
          <FileBackstage
            kind="doc"
            title={title}
            onClose={() => setBackstage(false)}
            onHome={onBack}
            onPrint={printDoc}
            onExport={() => exportDoc(title, paper.current?.innerHTML || html)}
            onNotify={onNotify}
          />
        )}
        <Ribbon
          tabs={tabs}
          accent="word"
          onFile={() => setBackstage(true)}
          right={<EditingMode value={mode} onChange={setMode} options={MODES} />}
        />
        {findOpen && (
          <div className="find-bar">
            <Search size={14} />
            <input autoFocus value={find} placeholder="Temukan" onChange={(event) => setFind(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') findNext(event.shiftKey)
              if (event.key === 'Escape') setFindOpen(false)
            }} />
            <Replace size={14} />
            <input value={replace} placeholder="Ganti dengan" onChange={(event) => setReplace(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') replaceAll() }} />
            <button onClick={() => findNext(false)}>Berikutnya</button>
            <button onClick={replaceAll}>Ganti semua</button>
            <button onClick={() => setFindOpen(false)}>Tutup</button>
          </div>
        )}
        <div className="paper-workspace" ref={workspace}>
          {navPane && (
            <aside className="nav-pane">
              <strong>Navigasi</strong>
              {headings.length === 0 && <p className="muted">Belum ada judul. Gunakan Gaya → Judul 1–3.</p>}
              {headings.map((h) => (
                <button key={h.id} className={`lv${h.level}`} onClick={() => scrollToHeading(h)}>{h.text}</button>
              ))}
            </aside>
          )}
          <main className="paper-wrap" onMouseUp={applyPainter}>
            {ruler && <div className="doc-ruler" aria-hidden>{Array.from({ length: 17 }, (_, i) => <i key={i}><b>{i + 1}</b></i>)}</div>}
            <div className={`page-stack ${orientation === 'landscape' ? 'landscape' : ''} size-${pageSize}`} style={{ transform: `scale(${zoom / 100})` }}>
              {showHeaderFooter && <div className="page-header" contentEditable={editable} suppressContentEditableWarning onBlur={(event) => { const v = event.currentTarget.innerText; setHeader(v); persist({ header: v }) }}>{header}</div>}
              <article
                className={paperClass}
                style={{ background: pageColor, lineHeight }}
                ref={(el) => {
                  paper.current = el
                  if (el && el.getAttribute('data-id') !== file.id) {
                    el.innerHTML = file.content.html
                    el.setAttribute('data-id', file.id)
                    recount()
                  }
                }}
                contentEditable={editable}
                suppressContentEditableWarning
                onInput={() => persist()}
                onBlur={() => persist()}
                onClick={(event) => {
                  const link = event.target.closest?.('a[href]')
                  if (link && (event.metaKey || event.ctrlKey || !editable)) { event.preventDefault(); window.open(link.href, '_blank', 'noopener') }
                }}
                spellCheck={spell}
              />
              {showHeaderFooter && (
                <div className="page-footer">
                  <span contentEditable={editable} suppressContentEditableWarning onBlur={(event) => { const v = event.currentTarget.innerText; setFooter(v); persist({ footer: v }) }}>{footer || (editable ? 'Kaki halaman — klik untuk mengedit' : '')}</span>
                  <em>{counts.words} kata</em>
                </div>
              )}
            </div>
          </main>
          {showComments && (
            <aside className="comment-rail">
              <strong>Komentar</strong>
              {comments.length === 0 && <p className="muted">Belum ada komentar. Pilih teks, lalu Tinjau → Komentar baru.</p>}
              {comments.map((item) => (
                <div className="comment-card" key={item.id}>
                  <small>{item.author} · {new Date(item.at).toLocaleDateString('id-ID')}</small>
                  <b>“{item.quote}”</b>
                  <p>{item.text}</p>
                  <button onClick={() => { const next = comments.filter((c) => c.id !== item.id); setComments(next); persist({ comments: next }) }}>Selesaikan</button>
                </div>
              ))}
            </aside>
          )}
        </div>
        <footer className="ed-status">
          <span>Halaman 1 dari 1</span>
          <span>{counts.words} kata</span>
          <span>{counts.chars} karakter</span>
          <span>{spell ? 'Bahasa Indonesia' : 'Ejaan nonaktif'}</span>
          <span>{MODES.find((m) => m.id === mode)?.label}</span>
          {showAgent && <span className="copilot-link-badge">Copilot terhubung{pick?.text ? ' · pilihan' : ''}</span>}
          <span className="zoom-ctl">
            <button onClick={() => { const z = Math.max(50, zoom - 10); setZoom(z); persist({ zoom: z }) }} aria-label="Perkecil">−</button>
            <input type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => { const z = Number(event.target.value); setZoom(z); persist({ zoom: z }) }} aria-label="Zoom" />
            <button onClick={() => { const z = Math.min(200, zoom + 10); setZoom(z); persist({ zoom: z }) }} aria-label="Perbesar">+</button>
            <b>{zoom}%</b>
          </span>
          <button onClick={printDoc}><Printer size={13} /> Cetak</button>
        </footer>
      </div>
      <CanvasCopilotChip pick={pick} onOpen={() => setShowAgent(true)} />
      {showAgent && (
        <AgentPanel kind="doc" app="Word" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={pick?.text || ''} onClearSelection={clearPick} onBusyChange={setCopilotBusy} />
      )}
      {share && <ShareDialog title={`${title}.docx`} onClose={() => setShare(false)} onNotify={onNotify} />}
    </div>
  )
}

function LinkForm({ onSubmit, initialText }) {
  const [text, setText] = useState(initialText)
  const [url, setUrl] = useState('https://')
  return (
    <form className="pop-form" onSubmit={(event) => { event.preventDefault(); if (url && url !== 'https://') onSubmit(text, url) }}>
      <label>Teks tampilan<input value={text} onChange={(event) => setText(event.target.value)} placeholder="Teks tautan" /></label>
      <label>Alamat<input autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
      <div className="row"><button type="submit" className="primary">Sisipkan</button></div>
    </form>
  )
}
