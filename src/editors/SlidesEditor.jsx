import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, BringToFront, Circle, CircleHelp, ClipboardPaste, Columns2,
  Copy, Diamond, Eye, EyeOff, FilePlus2, Grid3X3, Highlighter, Image, Italic, Keyboard, LayoutGrid, LayoutList,
  LayoutTemplate, Link2, List, ListOrdered, Maximize, MessageSquare, MessageSquarePlus, Monitor, NotebookPen,
  PaintRoller, Palette, PenLine, Play, Presentation, Proportions, RectangleHorizontal, Redo2, RefreshCw, Scissors,
  SendToBack, Shapes, Smile, Sparkles, SpellCheck, Square, SquareDashed, Star, Strikethrough, Table2, Timer,
  Trash2, Triangle, Type, Underline, Undo2, ZoomIn, ZoomOut, ArrowRight, Minus, Omega, ALargeSmall
} from 'lucide-react'
import { EditorChrome, useSavedFlag } from '../components/EditorChrome.jsx'
import { EditingMode, RBtn, RColor, RGallery, RMenu, RNum, RPick, RStack, Ribbon } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CanvasCopilotChip, focusCopilotComposer } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { PowerPointIcon } from '../components/MsApps.jsx'
import { escapeText, newId, sanitizeHtml } from '../lib/files.js'
import { USER } from '../lib/brand.js'
import { exportPptx } from '../lib/export.js'
import { asFragment, isAnalyzeIntent, isReviseIntent, replacePick, useCanvasPick } from '../lib/canvasPick.js'

const THEMES = [
  { id: 'northstar', label: 'Northstar', bg: 'linear-gradient(120deg, #183c3e, #286a60)', accent: '#81d0be' },
  { id: 'ink', label: 'Ink', bg: '#14181b', accent: '#9aa7ad' },
  { id: 'dawn', label: 'Dawn', bg: 'linear-gradient(140deg, #3a2c24, #6a4c38)', accent: '#e0b089' },
  { id: 'ocean', label: 'Ocean', bg: 'linear-gradient(120deg, #12344c, #1e5678)', accent: '#8ec8e8' },
  { id: 'paper', label: 'Paper', bg: 'linear-gradient(140deg, #f7f1e6, #e7d7c3)', accent: '#9a6a3a' },
  { id: 'rose', label: 'Rose', bg: 'linear-gradient(120deg, #3a1824, #7a3048)', accent: '#f0b7c9' },
]
const VARIANTS = ['#81d0be', '#ffc000', '#5b9bd5', '#ed7d31', '#a5d8a5', '#f0b7c9', '#ffffff']
const LAYOUTS = [
  { id: 'title', label: 'Slide judul' },
  { id: 'content', label: 'Judul dan konten' },
  { id: 'section', label: 'Header bagian' },
  { id: 'split', label: 'Dua konten' },
  { id: 'picture', label: 'Gambar dengan keterangan' },
  { id: 'table', label: 'Tabel' },
  { id: 'blank', label: 'Kosong' },
]
const TRANSITIONS = [
  { id: 'none', label: 'Tanpa' },
  { id: 'fade', label: 'Pudar' },
  { id: 'push', label: 'Dorong' },
  { id: 'wipe', label: 'Sapu' },
  { id: 'zoom', label: 'Zoom' },
]
const ANIMATIONS = [
  { id: 'none', label: 'Tanpa' },
  { id: 'appear', label: 'Muncul' },
  { id: 'fade', label: 'Pudar masuk' },
  { id: 'fly', label: 'Terbang masuk' },
]
const SHAPES = [
  { id: 'rect', label: 'Persegi', icon: Square },
  { id: 'rounded', label: 'Persegi bulat', icon: RectangleHorizontal },
  { id: 'circle', label: 'Lingkaran', icon: Circle },
  { id: 'triangle', label: 'Segitiga', icon: Triangle },
  { id: 'diamond', label: 'Belah ketupat', icon: Diamond },
  { id: 'arrow', label: 'Panah', icon: ArrowRight },
  { id: 'star', label: 'Bintang', icon: Star },
  { id: 'line', label: 'Garis', icon: Minus },
]
const FONTS = [
  { value: '', label: 'Tema (Jakarta Sans)' },
  { value: 'Aptos, "Segoe UI", sans-serif', label: 'Aptos' },
  { value: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]
const SYMBOLS = ['©', '®', '™', '€', '→', '←', '↑', '↓', '✓', '✗', '★', '•', '…', '—', '≈', '∞']
const EMOJIS = ['😀', '🚀', '💡', '📈', '✅', '⚠️', '🎯', '🔥', '👍', '❤️', '📌', '💼']
const MODES = [
  { id: 'edit', label: 'Mengedit', detail: 'Ubah slide secara langsung', icon: PenLine },
  { id: 'view', label: 'Menampilkan', detail: 'Baca tanpa mengubah', icon: Eye },
]

function blankSlide(layout = 'content') {
  return {
    id: newId('s'),
    layout,
    kicker: 'OFFICE ROMEO',
    title: layout === 'section' ? 'Bagian baru' : layout === 'title' ? 'Judul presentasi' : 'Judul slide',
    subtitle: 'Subtitel',
    body: 'Poin pertama\nPoin kedua\nPoin ketiga',
    extra: 'Kolom kanan',
    notes: '',
    hidden: false,
    image: '',
    table: [['', '', ''], ['', '', ''], ['', '', '']],
    style: {},
    shapes: [],
    comments: [],
  }
}

function plain(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

function SlideCanvas({ slide, theme, onChange, present, transition, size, variant, showNumbers, footerText, index, total, step = Infinity, selectedShape, onSelectShape, showGrid, spell = true, editable = true }) {
  const canvasRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const set = (patch) => onChange({ ...slide, ...patch })
  const style = slide.style || {}
  const bullets = (text) => String(text || '').split('\n')
  const canEdit = !present && editable
  const field = (value, key, className, tag = 'div') => {
    const Tag = tag
    if (!canEdit) return <Tag className={className} dangerouslySetInnerHTML={{ __html: value || '' }} />
    return (
      <Tag className={className} contentEditable suppressContentEditableWarning spellCheck={spell} dangerouslySetInnerHTML={{ __html: value || '' }} onBlur={(event) => { if (event.currentTarget.innerHTML !== (value || '')) set({ [key]: event.currentTarget.innerHTML }) }} />
    )
  }
  const focusLine = (key, i) => window.setTimeout(() => {
    const el = canvasRef.current?.querySelectorAll(`[data-line="${key}"]`)[i]
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }, 30)
  const lines = (text, key, Tag = 'p') => bullets(text).map((line, i) => {
    const visible = !present || slide.animation === 'none' || !slide.animation || i < step
    const anim = present && slide.animation && slide.animation !== 'none' && i === step - 1 ? `anim-${slide.animation}` : ''
    if (!canEdit) return <Tag key={i} className={`${visible ? '' : 'anim-hidden'} ${anim}`} dangerouslySetInnerHTML={{ __html: line }} />
    return (
      <Tag
        key={i}
        data-line={key}
        contentEditable
        suppressContentEditableWarning
        spellCheck={spell}
        dangerouslySetInnerHTML={{ __html: line }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            // Enter starts a new bullet, like PowerPoint; Shift+Enter keeps a soft line break.
            event.preventDefault()
            const next = bullets(slide[key])
            next[i] = event.currentTarget.innerHTML
            next.splice(i + 1, 0, '')
            set({ [key]: next.join('\n') })
            focusLine(key, i + 1)
          } else if (event.key === 'Backspace' && !plain(event.currentTarget.innerHTML).trim() && bullets(slide[key]).length > 1) {
            event.preventDefault()
            const next = bullets(slide[key])
            next.splice(i, 1)
            set({ [key]: next.join('\n') })
            focusLine(key, Math.max(0, i - 1))
          }
        }}
        onBlur={(event) => {
          const next = bullets(slide[key])
          if (next[i] === undefined || next[i] === event.currentTarget.innerHTML) return
          next[i] = event.currentTarget.innerHTML
          set({ [key]: next.join('\n') })
        }}
      />
    )
  })

  const startDrag = (event, shape) => {
    if (!canEdit || event.target.isContentEditable) return
    event.preventDefault()
    onSelectShape?.(shape.id)
    const rect = canvasRef.current.getBoundingClientRect()
    setDrag({ id: shape.id, dx: event.clientX - rect.left - (shape.x / 100) * rect.width, dy: event.clientY - rect.top - (shape.y / 100) * rect.height, x: shape.x, y: shape.y })
  }

  useEffect(() => {
    if (!drag) return undefined
    const move = (event) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = Math.max(0, Math.min(95, ((event.clientX - rect.left - drag.dx) / rect.width) * 100))
      const y = Math.max(0, Math.min(95, ((event.clientY - rect.top - drag.dy) / rect.height) * 100))
      setDrag((d) => ({ ...d, x, y }))
    }
    const up = () => {
      setDrag((d) => {
        if (d) set({ shapes: (slide.shapes || []).map((s) => s.id === d.id ? { ...s, x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10 } : s) })
        return null
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id])

  const canvasStyle = {
    background: slide.background || undefined,
    '--sl-accent': variant || undefined,
    fontFamily: style.fontFamily || undefined,
    '--sl-scale': style.fontScale ? style.fontScale / 100 : undefined,
    textAlign: style.align || undefined,
    color: style.color || undefined,
    lineHeight: style.lineHeight || undefined,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: style.underline ? 'underline' : undefined,
  }

  return (
    <div
      ref={canvasRef}
      className={`sl-canvas th-${theme || 'northstar'} ${slide.layout} ${present ? 'presenting' : ''} trans-${transition || 'none'} ${size === '4:3' ? 'size-4-3' : ''} ${showGrid && !present ? 'show-grid' : ''} ${style.color ? 'has-color' : ''} ${style.lineHeight ? 'has-lh' : ''} ${style.fontFamily ? 'has-font' : ''}`}
      style={canvasStyle}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onSelectShape?.(null) }}
    >
      {slide.layout !== 'blank' && field(slide.kicker, 'kicker', 'sl-kicker')}
      {field(slide.title, 'title', 'sl-title', 'h1')}
      {(slide.layout === 'title' || slide.layout === 'section') && field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
      {slide.layout === 'content' && (
        <ul className={`sl-body ${style.bullets || ''} ${style.columns === 2 ? 'cols-2' : ''}`}>
          {lines(slide.body, 'body', 'li')}
        </ul>
      )}
      {slide.layout === 'split' && (
        <div className="sl-split">
          <div>{lines(slide.body, 'body')}</div>
          <div>{lines(slide.extra, 'extra')}</div>
        </div>
      )}
      {slide.layout === 'picture' && (
        <div className="sl-picture">
          {slide.image ? <img src={slide.image} alt={plain(slide.subtitle) || ''} /> : <div className="sl-ph">Sisipkan → Gambar</div>}
          {field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
        </div>
      )}
      {slide.layout === 'table' && (
        <table className="sl-table">
          <tbody>
            {(slide.table || [['', ''], ['', '']]).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} contentEditable={canEdit} suppressContentEditableWarning onBlur={(event) => {
                    if (!canEdit) return
                    const table = (slide.table || []).map((line) => [...line])
                    if (table[ri][ci] === event.currentTarget.innerText) return
                    table[ri][ci] = event.currentTarget.innerText
                    set({ table })
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {slide.layout === 'blank' && field(slide.body, 'body', 'sl-free')}
      {(slide.shapes || []).map((shape) => {
        const pos = drag?.id === shape.id ? { x: drag.x, y: drag.y } : shape
        return (
          <div
            key={shape.id}
            className={`sl-shape ${shape.type} ${selectedShape === shape.id && !present ? 'selected' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${shape.w}%`, height: shape.type === 'line' ? 3 : `${shape.h}%`, background: shape.type === 'text' ? undefined : shape.fill, color: shape.type === 'line' ? shape.fill : shape.textColor || '#fff', border: shape.stroke ? `2px solid ${shape.stroke}` : undefined }}
            onMouseDown={(event) => startDrag(event, shape)}
          >
            {shape.type !== 'line' && (
              <span contentEditable={canEdit} suppressContentEditableWarning onMouseDown={(event) => { if (canEdit) { event.stopPropagation(); onSelectShape?.(shape.id) } }} onBlur={(event) => { if (canEdit && event.currentTarget.innerText !== (shape.text || '')) set({ shapes: (slide.shapes || []).map((s) => s.id === shape.id ? { ...s, text: event.currentTarget.innerText } : s) }) }}>{shape.text || ''}</span>
            )}
          </div>
        )
      })}
      {footerText && <span className="sl-footer-text">{footerText}</span>}
      {showNumbers && index != null && <span className="sl-number">{index + 1}{total ? ` / ${total}` : ''}</span>}
    </div>
  )
}

export default function SlidesEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [content, setContent] = useState(file.content)
  const [index, setIndex] = useState(0)
  const [present, setPresent] = useState(false)
  const [presenter, setPresenter] = useState(false)
  const [rehearse, setRehearse] = useState(false)
  const [step, setStep] = useState(0)
  const [view, setView] = useState('normal')
  const [showAgent, setShowAgent] = useState(true)
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [mode, setMode] = useState('edit')
  const [selectedShape, setSelectedShape] = useState(null)
  const [showNotes, setShowNotes] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [spell, setSpell] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [commentsRail, setCommentsRail] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [fontColor, setFontColor] = useState('#ffc000')
  const [shapeFill, setShapeFill] = useState('#5b9bd5')
  const [painter, setPainter] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const timer = useRef(null)
  const stageRef = useRef(null)
  const [pick, clearPick, pickRef] = useCanvasPick(stageRef)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const indexRef = useRef(0)
  indexRef.current = index
  const contentRef = useRef(content)
  contentRef.current = content
  const saved = useSavedFlag(JSON.stringify(content) + title)
  const slide = content.slides[index] || content.slides[0]
  const transition = slide.transition || content.transition || 'fade'
  const editable = mode === 'edit'
  const themeInfo = THEMES.find((t) => t.id === content.theme) || THEMES[0]
  const bulletCount = String(slide.body || '').split('\n').filter(Boolean).length

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
    setIndex(0)
    clearPick()
  }, [file.id])

  useEffect(() => { setStep(0); setSelectedShape(null) }, [index])

  useEffect(() => {
    if (!present) {
      window.clearInterval(timer.current)
      setElapsed(0)
      return undefined
    }
    timer.current = window.setInterval(() => setElapsed((n) => n + 1), 1000)
    const onKey = (event) => {
      if (event.key === 'Escape') { setPresent(false); setPresenter(false); setRehearse(false) }
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') advance(1)
      if (event.key === 'ArrowLeft' || event.key === 'Backspace') advance(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present])

  const persist = (next, nextTitle = title, { track = true } = {}) => {
    if (track && next !== content) {
      setUndoStack((stack) => [...stack.slice(-40), content])
      setRedoStack([])
    }
    setContent(next)
    onChange({ ...file, name: nextTitle, content: next, updatedAt: new Date().toISOString() })
  }

  const guard = () => {
    if (editable) return true
    onNotify('Mode Menampilkan: ganti ke Mengedit untuk mengubah slide')
    return false
  }

  const undo = () => {
    const prev = undoStack[undoStack.length - 1]
    if (!prev) return onNotify('Tidak ada yang bisa diurungkan')
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, content])
    persist(prev, title, { track: false })
    setIndex((i) => Math.min(i, prev.slides.length - 1))
  }
  const redo = () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return onNotify('Tidak ada yang bisa diulangi')
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, content])
    persist(next, title, { track: false })
    setIndex((i) => Math.min(i, next.slides.length - 1))
  }

  const updateSlide = (nextSlide, at = index) => {
    if (!guard()) return
    persist({ ...content, slides: content.slides.map((item, i) => i === at ? nextSlide : item) })
  }

  const patchAll = (fn) => {
    if (!guard()) return
    persist({ ...content, slides: content.slides.map(fn) })
  }

  const setStyle = (patch) => updateSlide({ ...slide, style: { ...(slide.style || {}), ...patch } })

  const addSlide = (layout, at = index + 1) => {
    if (!guard()) return
    const next = [...content.slides]
    next.splice(at, 0, blankSlide(layout))
    persist({ ...content, slides: next })
    setIndex(at)
  }

  const duplicateSlide = () => {
    if (!guard()) return
    const slides = [...content.slides]
    slides.splice(index + 1, 0, { ...slide, id: newId('s'), shapes: (slide.shapes || []).map((s) => ({ ...s, id: newId('sh') })) })
    persist({ ...content, slides })
    setIndex(index + 1)
  }

  const deleteSlide = () => {
    if (!guard()) return
    if (content.slides.length < 2) return onNotify('Minimal satu slide')
    persist({ ...content, slides: content.slides.filter((_, i) => i !== index) })
    setIndex(Math.min(index, content.slides.length - 2))
  }

  const move = (dir) => {
    const to = index + dir
    if (to < 0 || to >= content.slides.length || !guard()) return
    const slides = [...content.slides]
    const [item] = slides.splice(index, 1)
    slides.splice(to, 0, item)
    persist({ ...content, slides })
    setIndex(to)
  }

  const visibleIds = () => contentRef.current.slides.map((item, i) => (!present || !item.hidden ? i : -1)).filter((i) => i >= 0)

  const go = (dir) => {
    const ids = visibleIds()
    const at = ids.indexOf(indexRef.current)
    const next = ids[Math.max(0, Math.min(ids.length - 1, at + dir))]
    if (next != null) setIndex(next)
  }

  const advance = (dir) => {
    const current = contentRef.current.slides[indexRef.current]
    const count = String(current?.body || '').split('\n').filter(Boolean).length
    const animated = current?.animation && current.animation !== 'none' && current.layout === 'content'
    setStep((s) => {
      if (dir > 0 && animated && s < count) return s + 1
      if (dir < 0 && animated && s > 0) return s - 1
      go(dir)
      return dir > 0 ? 0 : (animated ? count : 0)
    })
  }

  const startShow = (from = 'begin', mode = 'normal') => {
    const first = Math.max(0, content.slides.findIndex((item) => !item.hidden))
    if (from === 'begin') setIndex(first)
    setStep(0)
    setPresenter(mode === 'presenter')
    setRehearse(mode === 'rehearse')
    setPresent(true)
  }

  const selectionInStage = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
    const node = sel.getRangeAt(0).commonAncestorContainer
    const el = node.nodeType === 1 ? node : node.parentElement
    return stageRef.current?.contains(el) ? sel : null
  }

  const commitActiveField = () => {
    const active = document.activeElement
    if (active && stageRef.current?.contains(active) && active.isContentEditable) active.blur()
  }

  const format = (command, value, styleKey, styleValue) => {
    if (!guard()) return
    if (selectionInStage()) {
      document.execCommand(command, false, value ?? null)
      commitActiveField()
      return
    }
    if (styleKey) setStyle({ [styleKey]: styleValue ?? !(slide.style || {})[styleKey] })
  }

  const clipboard = async (action) => {
    if (action === 'paste') {
      if (!guard()) return
      const active = document.activeElement
      if (!active?.isContentEditable || !stageRef.current?.contains(active)) return onNotify('Klik ke dalam teks slide, lalu Tempel')
      try {
        const text = await navigator.clipboard.readText()
        document.execCommand('insertText', false, text)
        commitActiveField()
      } catch {
        onNotify('Browser menolak akses papan klip. Gunakan ⌘V.')
      }
      return
    }
    if (!selectionInStage()) return onNotify('Seleksi teks di slide dulu')
    document.execCommand(action)
    if (action === 'cut') commitActiveField()
  }

  const startPainter = () => {
    setPainter({ ...(slide.style || {}) })
    onNotify('Pilih slide tujuan untuk menempelkan format')
  }

  useEffect(() => {
    if (!painter) return
    const fmt = painter
    setPainter(null)
    updateSlide({ ...slide, style: { ...(slide.style || {}), ...fmt } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const addShape = (type) => {
    if (!guard()) return
    const shape = { id: newId('sh'), type, x: 30 + Math.random() * 10, y: 30 + Math.random() * 10, w: type === 'text' ? 40 : 22, h: type === 'text' ? 12 : 18, fill: shapeFill, text: type === 'text' ? 'Ketik teks di sini' : '' }
    updateSlide({ ...slide, shapes: [...(slide.shapes || []), shape] })
    setSelectedShape(shape.id)
  }

  const patchShape = (patch) => {
    if (!selectedShape) return onNotify('Pilih bentuk di slide dulu')
    updateSlide({ ...slide, shapes: (slide.shapes || []).map((s) => s.id === selectedShape ? { ...s, ...patch } : s) })
  }

  const arrange = (how) => {
    if (!selectedShape) return onNotify('Pilih bentuk di slide dulu')
    const shapes = [...(slide.shapes || [])]
    const i = shapes.findIndex((s) => s.id === selectedShape)
    if (i < 0) return
    const [item] = shapes.splice(i, 1)
    if (how === 'front') shapes.push(item)
    else if (how === 'back') shapes.unshift(item)
    else if (how === 'delete') { updateSlide({ ...slide, shapes }); setSelectedShape(null); return }
    else if (how === 'dup') { shapes.splice(i, 0, item); shapes.push({ ...item, id: newId('sh'), x: item.x + 4, y: item.y + 4 }) }
    updateSlide({ ...slide, shapes })
  }

  const pickImage = () => {
    if (!guard()) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const blob = input.files?.[0]
      if (!blob) return
      if (blob.size > 2_000_000) return onNotify('Gambar terlalu besar (maks 2 MB)')
      const reader = new FileReader()
      reader.onload = () => updateSlide({ ...slide, layout: 'picture', image: reader.result })
      reader.readAsDataURL(blob)
    }
    input.click()
  }

  const insertText = (text) => {
    if (!guard()) return
    const active = document.activeElement
    if (active?.isContentEditable && stageRef.current?.contains(active)) {
      document.execCommand('insertText', false, text)
      commitActiveField()
    } else {
      updateSlide({ ...slide, title: `${slide.title || ''} ${text}`.trim() })
    }
  }

  const insertLink = () => {
    if (!selectionInStage()) return onNotify('Seleksi teks di slide dulu')
    const url = window.prompt('Alamat tautan', 'https://')
    if (!url || url === 'https://') return
    document.execCommand('createLink', false, url)
    commitActiveField()
  }

  const addComment = () => {
    const text = window.prompt('Komentar untuk slide ini', '')
    if (!text) return
    persist({ ...content, slides: content.slides.map((item, i) => i === index ? { ...item, comments: [...(item.comments || []), { id: newId('c'), text, author: USER.initials, at: new Date().toISOString() }] } : item) })
    setCommentsRail(true)
  }

  const accessibility = () => {
    const issues = []
    content.slides.forEach((item, i) => {
      if (!plain(item.title).trim()) issues.push(`slide ${i + 1} tanpa judul`)
      if (item.layout === 'picture' && item.image && !plain(item.subtitle).trim()) issues.push(`slide ${i + 1} gambar tanpa keterangan`)
    })
    onNotify(issues.length ? `Aksesibilitas: ${issues.slice(0, 4).join(', ')}` : 'Aksesibilitas: tidak ada masalah')
  }

  const designIdeas = () => {
    if (!guard()) return
    const ideas = [
      { theme: 'ocean', layout: slide.layout === 'content' ? 'split' : slide.layout },
      { theme: 'dawn', layout: slide.layout },
      { theme: 'paper', layout: slide.layout === 'title' ? 'section' : slide.layout },
    ]
    const idea = ideas[Math.floor(Math.random() * ideas.length)]
    persist({ ...content, theme: idea.theme, slides: content.slides.map((item, i) => i === index ? { ...item, layout: idea.layout } : item) })
    onNotify(`Ide desain diterapkan: tema ${idea.theme}`)
  }

  const applyCopilot = async (result) => {
    if (pickRef.current?.text && stageRef.current) {
      const frag = result?.selectionHtml || result?.html
      if (frag) {
        replacePick(stageRef.current, pickRef.current, asFragment(sanitizeHtml(typeof frag === 'string' ? frag : JSON.stringify(frag))))
        commitActiveField()
        return true
      }
    }
    if (Array.isArray(result?.slides) && result.slides.length) {
      persist({
        ...content,
        slides: result.slides.map((item, i) => ({ ...blankSlide(item.layout || 'content'), ...item, id: item.id || newId('s'), title: item.title || `Slide ${i + 1}` })),
      })
      setIndex(0)
      return true
    }
    if (result?.addSlide) {
      const next = [...content.slides, { ...blankSlide(result.addSlide.layout || 'content'), ...result.addSlide, id: newId('s') }]
      persist({ ...content, slides: next })
      setIndex(next.length - 1)
      return true
    }
    if (result?.updateSlide) {
      const patch = { ...result.updateSlide }
      ;['title', 'kicker', 'subtitle', 'body', 'extra'].forEach((k) => { if (typeof patch[k] === 'string') patch[k] = sanitizeHtml(patch[k]) })
      updateSlide({ ...slide, ...patch })
      return true
    }
    if (result?.notes) {
      updateSlide({ ...slide, notes: result.notes })
      return true
    }
    if (result?.color) {
      setStyle({ color: result.color })
      return true
    }
    return false
  }

  const getContext = () => ({
    title,
    theme: content.theme,
    index,
    selection: pickRef.current?.text || '',
    scoped: Boolean(pickRef.current?.text),
    slides: content.slides.map((item) => ({ layout: item.layout, kicker: plain(item.kicker), title: plain(item.title), subtitle: plain(item.subtitle), body: plain(item.body), extra: plain(item.extra), notes: item.notes, hidden: item.hidden })),
  })

  const askAgent = async (prompt) => {
    const picked = pickRef.current
    if (picked?.text) {
      if (isAnalyzeIntent(prompt) && !isReviseIntent(prompt)) {
        return { message: `Dari pilihan slide: “${picked.text.slice(0, 360)}${picked.text.length > 360 ? '…' : ''}”`, applied: false }
      }
      if (isReviseIntent(prompt) && stageRef.current) {
        const cut = picked.text.split(/(?<=[.!?])\s+/)[0] || picked.text
        replacePick(stageRef.current, picked, asFragment(cut))
        commitActiveField()
        return { message: 'Pilihan di slide diperbarui. Teks lain tidak diubah.' }
      }
      return { message: `Siap bekerja pada pilihan: “${picked.text.slice(0, 160)}${picked.text.length > 160 ? '…' : ''}”`, applied: false }
    }
    const q = prompt.toLowerCase()
    if (q.includes('agenda')) {
      const slides = [...content.slides]
      slides.splice(1, 0, { ...blankSlide('content'), kicker: 'AGENDA', title: 'Yang akan kita bahas', body: 'Konteks\nProduk\nBukti\nLangkah berikutnya' })
      persist({ ...content, slides })
      setIndex(1)
      return { message: 'Slide agenda disisipkan ke kanvas.' }
    }
    if (q.includes('penutup')) {
      const slides = [...content.slides, { ...blankSlide('section'), kicker: 'TERIMA KASIH', title: 'Mari selesaikan pekerjaan yang membosankan.' }]
      persist({ ...content, slides })
      setIndex(slides.length - 1)
      return { message: 'Slide penutup ditambahkan ke kanvas.' }
    }
    if (q.includes('catatan')) {
      const points = String(slide.body || '').split('\n').filter(Boolean).map(plain)
      const notes = points.length ? `Buka dengan “${plain(slide.title)}”. Bahas: ${points.join('; ')}.` : `Buka dengan “${plain(slide.title)}”. ${plain(slide.subtitle)}`.trim()
      updateSlide({ ...slide, notes })
      return { message: 'Catatan pembicara ditulis untuk slide ini.' }
    }
    if (q.includes('slide baru') || q.includes('tambah slide')) {
      addSlide('content')
      return { message: 'Slide baru ditambahkan setelah slide ini.' }
    }
    if (q.includes('presentasi dari') || q.includes('buat presentasi')) {
      const topic = prompt.replace(/.*?(dari|tentang)\s*/i, '').trim() || 'briefing ini'
      const slides = [
        { ...blankSlide('title'), kicker: 'OFFICE ROMEO', title: escapeText(topic), subtitle: 'Disusun oleh Copilot' },
        { ...blankSlide('content'), kicker: 'AGENDA', title: 'Yang akan kita bahas', body: 'Konteks\nPendekatan\nBukti\nLangkah berikutnya' },
        { ...blankSlide('content'), kicker: 'KONTEKS', title: 'Masalah yang kita selesaikan', body: 'Situasi saat ini\nDampak bagi tim\nPeluang' },
        { ...blankSlide('section'), kicker: 'BERIKUTNYA', title: 'Langkah berikutnya', subtitle: 'Keputusan yang dibutuhkan dan pemiliknya' },
      ]
      persist({ ...content, slides })
      setIndex(0)
      return { message: `Presentasi ${slides.length} slide dibuat dari briefing.` }
    }
    return { message: 'Copilot siaga: minta slide agenda, slide penutup, catatan pembicara, atau presentasi baru dari briefing. Seleksi teks untuk merevisi bagian tertentu.', applied: false }
  }

  /* ---------- ribbon ---------- */
  const layoutGallery = (run) => LAYOUTS.map((l) => ({
    id: l.id,
    label: l.label,
    active: slide.layout === l.id,
    preview: <span className={`layout-preview lp-${l.id}`}><i /><b /><b /></span>,
    run: () => run(l.id),
  }))
  const themeGallery = THEMES.map((t) => ({ id: t.id, label: t.label, active: content.theme === t.id, preview: <span style={{ display: 'block', height: 44, background: t.bg, borderRadius: 4, borderBottom: `4px solid ${t.accent}` }} />, run: () => { if (guard()) persist({ ...content, theme: t.id }) } }))

  const tabs = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        { label: 'Urungkan', items: [
          <RBtn key="u" icon={Undo2} label="Urungkan" onClick={undo} disabled={!undoStack.length} />,
          <RBtn key="r" icon={Redo2} label="Ulangi" onClick={redo} disabled={!redoStack.length} />,
        ] },
        { label: 'Papan klip', items: [
          <RBtn key="p" icon={ClipboardPaste} label="Tempel" big onClick={() => clipboard('paste')} />,
          <RStack key="s">
            <RBtn icon={Scissors} label="Potong" onClick={() => clipboard('cut')} />
            <RBtn icon={Copy} label="Salin" onClick={() => clipboard('copy')} />
            <RBtn icon={PaintRoller} label="Penyalin format" active={Boolean(painter)} onClick={startPainter} />
          </RStack>,
        ] },
        { label: 'Slide', items: [
          <RGallery key="new" icon={FilePlus2} label="Slide baru" big cols={2} width={340} items={layoutGallery((id) => addSlide(id))} />,
          <RStack key="ss">
            <RGallery icon={LayoutTemplate} label="Tata letak" cols={2} width={340} items={layoutGallery((id) => updateSlide({ ...slide, layout: id }))} />
            <RBtn icon={RefreshCw} label="Atur ulang" onClick={() => updateSlide({ ...slide, style: {}, background: undefined })} />
            <RMenu icon={LayoutList} label="Lainnya" items={[
              { id: 'dup', label: 'Duplikat slide', icon: Copy, run: duplicateSlide },
              { id: 'del', label: 'Hapus slide', icon: Trash2, run: deleteSlide, danger: true },
              { id: 'hide', label: slide.hidden ? 'Tampilkan slide' : 'Sembunyikan slide', icon: slide.hidden ? Eye : EyeOff, run: () => updateSlide({ ...slide, hidden: !slide.hidden }) },
            ]} />
          </RStack>,
        ] },
        { label: 'Font', items: [
          <RPick key="f" width={128} title="Font" value={(slide.style || {}).fontFamily || ''} onChange={(v) => setStyle({ fontFamily: v || undefined })} options={FONTS} />,
          <RPick key="sz" width={64} title="Ukuran" value={String((slide.style || {}).fontScale || 100)} onChange={(v) => setStyle({ fontScale: Number(v) })} options={[70, 85, 100, 115, 130, 150].map((n) => ({ value: String(n), label: `${n}%` }))} />,
          <RBtn key="gr" icon={ZoomIn} label="Perbesar font" onClick={() => setStyle({ fontScale: Math.min(180, ((slide.style || {}).fontScale || 100) + 10) })} />,
          <RBtn key="sh" icon={ZoomOut} label="Perkecil font" onClick={() => setStyle({ fontScale: Math.max(60, ((slide.style || {}).fontScale || 100) - 10) })} />,
          <RBtn key="b" icon={Bold} label="Tebal" active={Boolean((slide.style || {}).bold)} onClick={() => format('bold', null, 'bold')} />,
          <RBtn key="i" icon={Italic} label="Miring" active={Boolean((slide.style || {}).italic)} onClick={() => format('italic', null, 'italic')} />,
          <RBtn key="un" icon={Underline} label="Garis bawah" active={Boolean((slide.style || {}).underline)} onClick={() => format('underline', null, 'underline')} />,
          <RBtn key="st" icon={Strikethrough} label="Coret" onClick={() => format('strikeThrough')} />,
          <RColor key="hl" icon={Highlighter} label="Sorotan" highlight value="#ffff00" autoLabel="Tanpa" auto="transparent" onPick={(c) => { if (!selectionInStage()) return onNotify('Seleksi teks di slide dulu'); format('hiliteColor', c || 'transparent') }} />,
          <RColor key="fc" icon={Baseline} label="Warna font" value={fontColor} auto="" autoLabel="Warna tema" onPick={(c) => { if (c) setFontColor(c); if (selectionInStage()) format('foreColor', c || '#ffffff'); else setStyle({ color: c || undefined }) }} />,
          <RBtn key="clr" icon={ALargeSmall} label="Hapus format" onClick={() => { if (selectionInStage()) format('removeFormat'); else setStyle({ bold: undefined, italic: undefined, underline: undefined, color: undefined, fontFamily: undefined, fontScale: undefined }) }} />,
        ] },
        { label: 'Paragraf', items: [
          <RBtn key="ul" icon={List} label="Poin" active={!(slide.style || {}).bullets || (slide.style || {}).bullets === 'disc'} onClick={() => setStyle({ bullets: (slide.style || {}).bullets === 'none' ? 'disc' : (slide.style || {}).bullets === 'disc' || !(slide.style || {}).bullets ? 'none' : 'disc' })} />,
          <RBtn key="ol" icon={ListOrdered} label="Penomoran" active={(slide.style || {}).bullets === 'numbers'} onClick={() => setStyle({ bullets: (slide.style || {}).bullets === 'numbers' ? 'disc' : 'numbers' })} />,
          <RBtn key="l" icon={AlignLeft} label="Rata kiri" active={!(slide.style || {}).align || (slide.style || {}).align === 'left'} onClick={() => setStyle({ align: 'left' })} />,
          <RBtn key="c" icon={AlignCenter} label="Tengah" active={(slide.style || {}).align === 'center'} onClick={() => setStyle({ align: 'center' })} />,
          <RBtn key="rr" icon={AlignRight} label="Rata kanan" active={(slide.style || {}).align === 'right'} onClick={() => setStyle({ align: 'right' })} />,
          <RMenu key="ls" icon={ALargeSmall} label="Spasi baris" items={['1', '1.2', '1.5', '2'].map((v) => ({ id: v, label: v.replace('.', ','), active: ((slide.style || {}).lineHeight || '1.5') === v, run: () => setStyle({ lineHeight: v }) }))} />,
          <RBtn key="col" icon={Columns2} label="Kolom" active={(slide.style || {}).columns === 2} onClick={() => setStyle({ columns: (slide.style || {}).columns === 2 ? 1 : 2 })} />,
        ] },
        { label: 'Gambar', items: [
          <RMenu key="sh" icon={Shapes} label="Bentuk" big items={[...SHAPES.map((s) => ({ id: s.id, label: s.label, icon: s.icon, run: () => addShape(s.id) })), { sep: true }, { id: 'text', label: 'Kotak teks', icon: Type, run: () => addShape('text') }]} />,
          <RStack key="ar">
            <RMenu icon={BringToFront} label="Atur" items={[
              { id: 'front', label: 'Bawa ke depan', icon: BringToFront, run: () => arrange('front') },
              { id: 'back', label: 'Kirim ke belakang', icon: SendToBack, run: () => arrange('back') },
              { id: 'dup', label: 'Duplikat bentuk', icon: Copy, run: () => arrange('dup') },
              { id: 'del', label: 'Hapus bentuk', icon: Trash2, run: () => arrange('delete'), danger: true },
            ]} />
            <RColor icon={Palette} label="Isian bentuk" value={shapeFill} auto="transparent" autoLabel="Tanpa isian" onPick={(c) => { if (c && c !== 'transparent') setShapeFill(c); patchShape({ fill: c || 'transparent' }) }} />
            <RColor icon={SquareDashed} label="Garis bentuk" value="#ffffff" auto="" autoLabel="Tanpa garis" onPick={(c) => patchShape({ stroke: c || undefined })} />
          </RStack>,
        ] },
        { label: 'Desainer', items: [
          <RBtn key="ds" icon={Sparkles} label="Desainer" big onClick={designIdeas} />,
        ] },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        { label: 'Slide', items: [
          <RGallery key="new" icon={FilePlus2} label="Slide baru" big cols={2} width={340} items={layoutGallery((id) => addSlide(id))} />,
        ] },
        { label: 'Tabel', items: [
          <RBtn key="tbl" icon={Table2} label="Tabel" big onClick={() => updateSlide({ ...slide, layout: 'table', table: slide.table?.some((row) => row.some(Boolean)) ? slide.table : [['Kolom 1', 'Kolom 2', 'Kolom 3'], ['', '', ''], ['', '', '']] })} />,
        ] },
        { label: 'Gambar', items: [
          <RBtn key="img" icon={Image} label="Gambar" big onClick={pickImage} />,
          <RMenu key="sh" icon={Shapes} label="Bentuk" big items={SHAPES.map((s) => ({ id: s.id, label: s.label, icon: s.icon, run: () => addShape(s.id) }))} />,
          <RMenu key="ico" icon={Smile} label="Ikon" big>
            {(close) => <div className="symbol-grid">{EMOJIS.map((s) => <button key={s} type="button" onClick={() => { close(); addShape('text'); window.setTimeout(() => patchShapeLast(s), 0) }}>{s}</button>)}</div>}
          </RMenu>,
        ] },
        { label: 'Teks', items: [
          <RBtn key="tb" icon={Type} label="Kotak teks" big onClick={() => addShape('text')} />,
          <RMenu key="hf" icon={Proportions} label="Header & footer" items={[
            { id: 'num', label: content.showNumbers ? 'Sembunyikan nomor slide' : 'Tampilkan nomor slide', run: () => guard() && persist({ ...content, showNumbers: !content.showNumbers }) },
            { id: 'ft', label: 'Teks footer…', run: () => { const t = window.prompt('Teks footer', content.footerText || 'Northstar Studio'); if (t != null && guard()) persist({ ...content, footerText: t }) } },
            { id: 'date', label: 'Tanggal di footer', run: () => guard() && persist({ ...content, footerText: new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }) }) },
          ]} />,
        ] },
        { label: 'Tautan', items: [
          <RBtn key="lk" icon={Link2} label="Tautan" big onClick={insertLink} />,
        ] },
        { label: 'Komentar', items: [
          <RBtn key="cm" icon={MessageSquarePlus} label="Komentar" big onClick={addComment} />,
        ] },
        { label: 'Simbol', items: [
          <RMenu key="sym" icon={Omega} label="Simbol">
            {(close) => <div className="symbol-grid">{SYMBOLS.map((s) => <button key={s} type="button" onClick={() => { close(); insertText(s) }}>{s}</button>)}</div>}
          </RMenu>,
        ] },
      ],
    },
    {
      id: 'design',
      label: 'Desain',
      groups: [
        { label: 'Tema', items: [
          <RGallery key="th" icon={Palette} label="Tema" big cols={3} width={420} items={themeGallery} />,
        ] },
        { label: 'Varian', items: [
          <RMenu key="va" icon={Palette} label="Varian" big items={VARIANTS.map((c) => ({ id: c, label: c === themeInfo.accent ? 'Aksen tema' : c, swatch: c, active: (content.variant || themeInfo.accent) === c, run: () => guard() && persist({ ...content, variant: c }) }))} />,
        ] },
        { label: 'Kustomisasi', items: [
          <RMenu key="sz" icon={Proportions} label="Ukuran slide" big items={[
            { id: '16:9', label: 'Layar lebar (16:9)', active: (content.size || '16:9') === '16:9', run: () => guard() && persist({ ...content, size: '16:9' }) },
            { id: '4:3', label: 'Standar (4:3)', active: content.size === '4:3', run: () => guard() && persist({ ...content, size: '4:3' }) },
          ]} />,
          <RColor key="bg" icon={PaintRoller} label="Format latar" big value={slide.background || ''} auto="" autoLabel="Latar tema" onPick={(c) => updateSlide({ ...slide, background: c || undefined })} />,
          <RBtn key="bga" icon={PaintRoller} label="Terapkan latar ke semua" onClick={() => patchAll((item) => ({ ...item, background: slide.background }))} />,
        ] },
        { label: 'Desainer', items: [
          <RBtn key="ds" icon={Sparkles} label="Ide desain" big onClick={designIdeas} />,
        ] },
      ],
    },
    {
      id: 'transitions',
      label: 'Transisi',
      groups: [
        { label: 'Pratinjau', items: [
          <RBtn key="pv" icon={Play} label="Pratinjau" big onClick={() => setPreviewKey((k) => k + 1)} />,
        ] },
        { label: 'Transisi ke slide ini', items: TRANSITIONS.map((t) => (
          <RBtn key={t.id} icon={Presentation} label={t.label} big active={transition === t.id} onClick={() => { updateSlide({ ...slide, transition: t.id }); setPreviewKey((k) => k + 1) }} />
        )) },
        { label: 'Pengaturan waktu', items: [
          <RNum key="dur" title="Durasi (detik)" value={(content.transitionMs || 350) / 1000} min={0.1} max={3} step={0.1} suffix="dtk" onChange={(v) => guard() && persist({ ...content, transitionMs: Math.round(v * 1000) })} />,
          <RBtn key="all" icon={RefreshCw} label="Terapkan ke semua" onClick={() => { if (guard()) persist({ ...content, transition, slides: content.slides.map((item) => ({ ...item, transition })) }) }} />,
        ] },
      ],
    },
    {
      id: 'animations',
      label: 'Animasi',
      groups: [
        { label: 'Pratinjau', items: [
          <RBtn key="pv" icon={Play} label="Pratinjau" big onClick={() => { setPreviewKey((k) => k + 1) }} />,
        ] },
        { label: 'Animasi poin', items: ANIMATIONS.map((a) => (
          <RBtn key={a.id} icon={Sparkles} label={a.label} big active={(slide.animation || 'none') === a.id} onClick={() => updateSlide({ ...slide, animation: a.id })} />
        )) },
        { label: 'Lanjutan', items: [
          <RBtn key="all" icon={RefreshCw} label="Terapkan ke semua" onClick={() => patchAll((item) => ({ ...item, animation: slide.animation || 'none' }))} />,
          <RBtn key="info" icon={CircleHelp} label="Cara kerja" onClick={() => onNotify('Saat slide show, poin muncul satu per klik/panah kanan pada slide dengan animasi.')} />,
        ] },
      ],
    },
    {
      id: 'show',
      label: 'Slide Show',
      groups: [
        { label: 'Mulai slide show', items: [
          <RBtn key="b" icon={Play} label="Dari awal" big onClick={() => startShow('begin')} />,
          <RBtn key="c" icon={Play} label="Dari slide ini" big onClick={() => startShow('current')} />,
          <RBtn key="p" icon={Monitor} label="Tampilan presenter" big onClick={() => startShow('current', 'presenter')} />,
        ] },
        { label: 'Persiapan', items: [
          <RBtn key="rh" icon={Timer} label="Latih waktu" big onClick={() => startShow('begin', 'rehearse')} />,
          <RBtn key="hd" icon={slide.hidden ? Eye : EyeOff} label={slide.hidden ? 'Tampilkan slide' : 'Sembunyikan slide'} active={Boolean(slide.hidden)} onClick={() => updateSlide({ ...slide, hidden: !slide.hidden })} />,
        ] },
      ],
    },
    {
      id: 'review',
      label: 'Tinjau',
      groups: [
        { label: 'Pemeriksaan', items: [
          <RBtn key="sp" icon={SpellCheck} label="Ejaan" big active={spell} onClick={() => setSpell((v) => !v)} />,
          <RBtn key="ac" icon={Eye} label="Aksesibilitas" onClick={accessibility} />,
        ] },
        { label: 'Komentar', items: [
          <RBtn key="cm" icon={MessageSquarePlus} label="Komentar baru" big onClick={addComment} />,
          <RStack key="cs">
            <RBtn icon={MessageSquare} label={commentsRail ? 'Sembunyikan komentar' : 'Tampilkan komentar'} active={commentsRail} onClick={() => setCommentsRail((v) => !v)} />
            <RBtn icon={Trash2} label="Hapus komentar slide" onClick={() => updateSlide({ ...slide, comments: [] })} />
          </RStack>,
        ] },
        { label: 'Perlindungan', items: [
          <RBtn key="pr" icon={editable ? PenLine : Eye} label={editable ? 'Kunci (Menampilkan)' : 'Buka (Mengedit)'} onClick={() => setMode(editable ? 'view' : 'edit')} />,
        ] },
      ],
    },
    {
      id: 'view',
      label: 'Tampilan',
      groups: [
        { label: 'Tampilan presentasi', items: [
          <RBtn key="n" icon={LayoutList} label="Normal" big active={view === 'normal'} onClick={() => setView('normal')} />,
          <RBtn key="o" icon={NotebookPen} label="Kerangka" big active={view === 'outline'} onClick={() => setView('outline')} />,
          <RBtn key="s" icon={LayoutGrid} label="Pengurut slide" big active={view === 'sorter'} onClick={() => setView('sorter')} />,
          <RBtn key="r" icon={Presentation} label="Tampilan baca" big onClick={() => startShow('current')} />,
        ] },
        { label: 'Tampilkan', items: [
          <RStack key="sh">
            <RBtn icon={NotebookPen} label="Catatan" active={showNotes} onClick={() => setShowNotes((v) => !v)} />
            <RBtn icon={Grid3X3} label="Garis kisi" active={showGrid} onClick={() => setShowGrid((v) => !v)} />
            <RBtn icon={MessageSquare} label="Komentar" active={commentsRail} onClick={() => setCommentsRail((v) => !v)} />
          </RStack>,
        ] },
        { label: 'Zoom', items: [
          <RBtn key="zi" icon={ZoomIn} label="Perbesar" onClick={() => setZoom((z) => Math.min(200, z + 10))} />,
          <RBtn key="zo" icon={ZoomOut} label="Perkecil" onClick={() => setZoom((z) => Math.max(50, z - 10))} />,
          <RBtn key="fit" icon={Maximize} label="Pas jendela" onClick={() => setZoom(100)} />,
        ] },
      ],
    },
    {
      id: 'help',
      label: 'Bantuan',
      groups: [
        { label: 'Bantuan', items: [
          <RBtn key="h" icon={CircleHelp} label="Bantuan" big onClick={() => onNotify('PowerPoint for the web · klik teks untuk mengedit · seret bentuk untuk memindahkan · Esc keluar slide show')} />,
          <RBtn key="k" icon={Keyboard} label="Pintasan" big onClick={() => onNotify('Panah kanan/kiri pindah slide · Enter/Spasi poin berikutnya · Esc keluar · ⌘Z urungkan')} />,
        ] },
      ],
    },
  ]

  const patchShapeLast = (text) => {
    const shapes = contentRef.current.slides[indexRef.current]?.shapes || []
    const last = shapes[shapes.length - 1]
    if (last) updateSlide({ ...contentRef.current.slides[indexRef.current], shapes: shapes.map((s) => s.id === last.id ? { ...s, text, w: 12, h: 14 } : s) })
  }

  useEffect(() => {
    const onKey = (event) => {
      if (present || !selectedShape) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && !document.activeElement?.isContentEditable && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault()
        arrange('delete')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShape, present, slide])

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const nextVisible = content.slides.find((item, i) => i > index && !item.hidden)
  const canvasProps = { theme: content.theme, size: content.size, variant: content.variant, showNumbers: content.showNumbers, footerText: content.footerText, total: content.slides.length }
  const transitionStyle = { '--trans-ms': `${content.transitionMs || 350}ms` }

  return (
    <div className={`ed-shell slides-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`} style={transitionStyle}>
      <div className="ed-main">
        <EditorChrome
          kind="slides"
          mark={<PowerPointIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value, { track: false }) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onComments={() => setCommentsRail((v) => !v)}
          onCopilot={() => setShowAgent((v) => !v)}
          extra={(
            <button className="present-btn" onClick={() => startShow('begin')}><Play size={14} /> Mulai</button>
          )}
        />
        {backstage && (
          <FileBackstage
            kind="slides"
            title={title}
            onClose={() => setBackstage(false)}
            onHome={onBack}
            onPrint={() => window.print()}
            onExport={async () => { await exportPptx(title, content); onNotify('Dek diunduh') }}
            onNotify={onNotify}
          />
        )}
        <Ribbon tabs={tabs} accent="ppt" onFile={() => setBackstage(true)} right={<EditingMode value={mode} onChange={setMode} options={MODES} />} />
        {view === 'sorter' ? (
          <div className="sl-sorter">
            {content.slides.map((item, i) => (
              <button key={item.id} className={`${i === index ? 'on' : ''} ${item.hidden ? 'dim' : ''}`} onClick={() => setIndex(i)} onDoubleClick={() => { setView('normal'); setIndex(i) }}>
                <SlideCanvas slide={item} {...canvasProps} index={i} onChange={() => {}} present />
                <span>{i + 1}. {plain(item.title)}</span>
              </button>
            ))}
          </div>
        ) : view === 'outline' ? (
          <div className="sl-outline">
            {content.slides.map((item, i) => (
              <label key={item.id}>
                <b>{i + 1}</b>
                <textarea
                  value={`${plain(item.title)}\n${plain(item.body)}`}
                  onChange={(event) => {
                    const [first, ...rest] = event.target.value.split('\n')
                    updateSlide({ ...item, title: escapeText(first), body: rest.map(escapeText).join('\n') }, i)
                  }}
                  onFocus={() => setIndex(i)}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className="sl-body-wrap">
            <aside className="sl-strip">
              <button className="new-slide" onClick={() => addSlide('content')}><FilePlus2 size={14} /> Slide baru</button>
              {content.slides.map((item, i) => (
                <button key={item.id} className={`slide-thumb ${i === index ? 'active' : ''} ${item.hidden ? 'dim' : ''}`} onClick={() => setIndex(i)}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{plain(item.title) || 'Tanpa judul'}</b>
                    <small>{LAYOUTS.find((l) => l.id === item.layout)?.label}{item.hidden ? ' · tersembunyi' : ''}</small>
                  </div>
                </button>
              ))}
              <div className="sl-reorder">
                <button onClick={() => move(-1)} aria-label="Naik">↑</button>
                <button onClick={() => move(1)} aria-label="Turun">↓</button>
                <button onClick={duplicateSlide} aria-label="Duplikat"><Copy size={14} /></button>
                <button onClick={deleteSlide} aria-label="Hapus slide"><Trash2 size={14} /></button>
              </div>
            </aside>
            <main className={`sl-stage ${pick?.text ? 'copilot-scoped' : ''} ${zoom !== 100 ? 'zoomed' : ''}`} ref={stageRef}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', zoom: zoom / 100 }}>
                <SlideCanvas key={`${slide.id}-${slide.layout}-${previewKey}`} slide={slide} {...canvasProps} index={index} onChange={updateSlide} transition={transition} selectedShape={selectedShape} onSelectShape={setSelectedShape} showGrid={showGrid} spell={spell} editable={editable} step={previewKey ? Infinity : Infinity} />
              </div>
              <div className="slide-controls">
                <button onClick={() => go(-1)} aria-label="Sebelumnya">←</button>
                <span>Slide {index + 1} dari {content.slides.length}{slide.transition ? ` · ${TRANSITIONS.find((t) => t.id === transition)?.label}` : ''}{slide.animation && slide.animation !== 'none' ? ` · animasi ${ANIMATIONS.find((a) => a.id === slide.animation)?.label}` : ''}</span>
                <button onClick={() => go(1)} aria-label="Berikutnya">→</button>
              </div>
              {showNotes && (
                <label className="sl-notes">
                  <span>Catatan pembicara</span>
                  <textarea value={slide.notes || ''} readOnly={!editable} onChange={(event) => updateSlide({ ...slide, notes: event.target.value })} placeholder="Yang akan Anda katakan, bukan yang tertulis di slide." />
                </label>
              )}
            </main>
            {commentsRail && (
              <aside className="comment-rail sl-comments">
                <strong>Komentar · slide {index + 1}</strong>
                {(slide.comments || []).length === 0 && <p className="muted">Belum ada komentar. Sisipkan → Komentar.</p>}
                {(slide.comments || []).map((c) => (
                  <div className="comment-card" key={c.id}>
                    <small>{c.author} · {new Date(c.at).toLocaleDateString('id-ID')}</small>
                    <p>{c.text}</p>
                    <button onClick={() => updateSlide({ ...slide, comments: slide.comments.filter((x) => x.id !== c.id) })}>Selesaikan</button>
                  </div>
                ))}
              </aside>
            )}
          </div>
        )}
        <footer className="ed-status">
          <span>Slide {index + 1} dari {content.slides.length}</span>
          <span>Tema {themeInfo.label}</span>
          <span>{spell ? 'Bahasa Indonesia' : 'Ejaan nonaktif'}</span>
          {showAgent && <span className="copilot-link-badge">Copilot terhubung{pick?.text ? ' · pilihan' : ''}</span>}
          <span className="zoom-ctl">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Perkecil">−</button>
            <input type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" />
            <button onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Perbesar">+</button>
            <b>{zoom}%</b>
          </span>
          <button onClick={() => startShow('current')}><Play size={13} /> Slide show</button>
        </footer>
      </div>
      <CanvasCopilotChip pick={pick} onOpen={() => setShowAgent(true)} />
      {showAgent && <AgentPanel kind="slides" app="PowerPoint" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={pick?.text || ''} onClearSelection={clearPick} onBusyChange={setCopilotBusy} />}
      {share && <ShareDialog title={`${title}.pptx`} onClose={() => setShare(false)} onNotify={onNotify} />}
      {present && !presenter && (
        <div className="sl-present" onClick={() => advance(1)} style={transitionStyle}>
          <SlideCanvas key={`${slide.id}-show`} slide={slide} {...canvasProps} index={index} onChange={() => {}} present transition={transition} step={step} />
          <div className="sl-present-bar" onClick={(event) => event.stopPropagation()}>
            <span>{index + 1} / {content.slides.length}{slide.animation && slide.animation !== 'none' ? ` · poin ${Math.min(step, bulletCount)}/${bulletCount}` : ''}</span>
            <span>{slide.notes}</span>
            <span>{rehearse ? `Latihan ${clock}` : clock}</span>
            <button onClick={() => advance(-1)}>←</button>
            <button onClick={() => advance(1)}>→</button>
            <button onClick={() => { setPresent(false); setRehearse(false); if (rehearse) onNotify(`Durasi latihan: ${clock}`) }}><Square size={13} /> Keluar</button>
          </div>
        </div>
      )}
      {present && presenter && (
        <div className="sl-presenter" style={transitionStyle}>
          <div className="now"><SlideCanvas key={`${slide.id}-pv`} slide={slide} {...canvasProps} index={index} onChange={() => {}} present step={step} /></div>
          <aside>
            <p>Berikutnya</p>
            {nextVisible ? <SlideCanvas slide={nextVisible} {...canvasProps} onChange={() => {}} present /> : <em>Slide terakhir</em>}
            <p>Catatan</p>
            <div className="pv-notes">{slide.notes || '—'}</div>
            <div className="pv-bar">
              <span>{clock}</span>
              <button onClick={() => advance(-1)}>←</button>
              <button onClick={() => advance(1)}>→</button>
              <button onClick={() => { setPresent(false); setPresenter(false) }}>Keluar</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
