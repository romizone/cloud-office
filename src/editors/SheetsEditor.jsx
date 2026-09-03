import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold, Check, FilePlus2, Italic, Table2, Trash2, Underline
} from 'lucide-react'
import { AgentToggle, EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { COLS, ROWS, blankFormats, blankGrid, newId, parseCsv } from '../lib/files.js'
import { colLabel, displayOf, evaluateGrid, rangeStats } from '../lib/formulas.js'
import { exportCsv, exportXlsx } from '../lib/export.js'

const FILLS = ['transparent', '#eef8f4', '#fff3bf', '#d0ebff', '#ffe3e3', '#f3e8ff']

function cloneTab(tab) {
  return {
    ...tab,
    cells: tab.cells.map((row) => [...row]),
    formats: tab.formats.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
  }
}

function inSel(sel, r, c) {
  const r1 = Math.min(sel.r, sel.r2)
  const r2 = Math.max(sel.r, sel.r2)
  const c1 = Math.min(sel.c, sel.c2)
  const c2 = Math.max(sel.c, sel.c2)
  return r >= r1 && r <= r2 && c >= c1 && c <= c2
}

export default function SheetsEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [content, setContent] = useState(file.content)
  const [sel, setSel] = useState({ r: 1, c: 0, r2: 1, c2: 0 })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [showAgent, setShowAgent] = useState(true)
  const dragging = useRef(false)
  const gridRef = useRef(null)
  const saved = useSavedFlag(JSON.stringify(content) + title)
  const fileInput = useRef(null)

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
  }, [file.id])

  const tab = content.sheets[content.active] || content.sheets[0]
  const computed = useMemo(() => evaluateGrid(tab.cells), [tab.cells])
  const stats = useMemo(() => rangeStats(computed.display, sel.r, sel.c, sel.r2, sel.c2), [computed, sel])
  const activeRaw = tab.cells[sel.r]?.[sel.c] ?? ''
  const nameBox = useMemo(() => {
    const r1 = Math.min(sel.r, sel.r2)
    const r2 = Math.max(sel.r, sel.r2)
    const c1 = Math.min(sel.c, sel.c2)
    const c2 = Math.max(sel.c, sel.c2)
    const a = `${colLabel(c1)}${r1 + 1}`
    if (r1 === r2 && c1 === c2) return a
    return `${a}:${colLabel(c2)}${r2 + 1}`
  }, [sel])

  const persist = (nextContent, nextTitle = title) => {
    const payload = nextContent || content
    setContent(payload)
    onChange({ ...file, name: nextTitle, content: payload, updatedAt: new Date().toISOString() })
  }

  const patchTab = (mutator) => {
    const sheets = content.sheets.map((item, index) => {
      if (index !== content.active) return item
      return mutator(cloneTab(item))
    })
    persist({ ...content, sheets })
  }

  const writeCell = (r, c, value) => {
    patchTab((item) => {
      item.cells[r][c] = value
      return item
    })
  }

  const applyFormat = (patch) => {
    patchTab((item) => {
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) {
          item.formats[r][c] = { ...(item.formats[r][c] || {}), ...patch }
        }
      }
      return item
    })
  }

  const clearSelection = () => {
    patchTab((item) => {
      for (let r = Math.min(sel.r, sel.r2); r <= Math.max(sel.r, sel.r2); r += 1) {
        for (let c = Math.min(sel.c, sel.c2); c <= Math.max(sel.c, sel.c2); c += 1) {
          item.cells[r][c] = ''
        }
      }
      return item
    })
  }

  const commitDraft = (move) => {
    if (editing) writeCell(sel.r, sel.c, draft)
    setEditing(false)
    if (move === 'down') setSel({ r: Math.min(ROWS - 1, sel.r + 1), c: sel.c, r2: Math.min(ROWS - 1, sel.r + 1), c2: sel.c })
    if (move === 'right') setSel({ r: sel.r, c: Math.min(COLS - 1, sel.c + 1), r2: sel.r, c2: Math.min(COLS - 1, sel.c + 1) })
  }

  const startEdit = (seed = activeRaw, replace = false) => {
    setDraft(replace ? seed : (seed ?? activeRaw))
    setEditing(true)
  }

  const onGridKey = (event) => {
    if (editing && event.key !== 'Enter' && event.key !== 'Tab' && event.key !== 'Escape') return
    const meta = event.metaKey || event.ctrlKey
    if (meta && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      applyFormat({ bold: !(tab.formats[sel.r]?.[sel.c]?.bold) })
      return
    }
    if (meta && event.key.toLowerCase() === 'c') {
      copySelection()
      return
    }
    if (meta && event.key.toLowerCase() === 'v') return
    if (event.key === 'F2') {
      event.preventDefault()
      startEdit()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (editing) commitDraft('down')
      else startEdit()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      if (editing) commitDraft('right')
      else setSel({ r: sel.r, c: Math.min(COLS - 1, sel.c + 1), r2: sel.r, c2: Math.min(COLS - 1, sel.c + 1) })
      return
    }
    if (event.key === 'Escape') {
      setEditing(false)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!editing) {
        event.preventDefault()
        clearSelection()
      }
      return
    }
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]
    if (delta) {
      event.preventDefault()
      const r = Math.max(0, Math.min(ROWS - 1, sel.r + delta[0]))
      const c = Math.max(0, Math.min(COLS - 1, sel.c + delta[1]))
      if (event.shiftKey) setSel({ ...sel, r2: r, c2: c })
      else setSel({ r, c, r2: r, c2: c })
      return
    }
    if (!editing && event.key.length === 1 && !meta) {
      startEdit(event.key, true)
    }
  }

  const copySelection = () => {
    const r1 = Math.min(sel.r, sel.r2)
    const r2 = Math.max(sel.r, sel.r2)
    const c1 = Math.min(sel.c, sel.c2)
    const c2 = Math.max(sel.c, sel.c2)
    const lines = []
    for (let r = r1; r <= r2; r += 1) {
      const row = []
      for (let c = c1; c <= c2; c += 1) row.push(tab.cells[r][c] ?? '')
      lines.push(row.join('\t'))
    }
    navigator.clipboard?.writeText(lines.join('\n'))
    onNotify('Rentang disalin')
  }

  const pasteTsv = (text) => {
    const rows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'))
    patchTab((item) => {
      rows.forEach((line, ri) => {
        line.forEach((value, ci) => {
          const r = sel.r + ri
          const c = sel.c + ci
          if (r < ROWS && c < COLS) item.cells[r][c] = value
        })
      })
      return item
    })
  }

  const addSheet = () => {
    const next = {
      id: newId('tab'),
      name: `Sheet ${content.sheets.length + 1}`,
      cells: blankGrid(),
      formats: blankFormats(),
    }
    persist({ ...content, sheets: [...content.sheets, next], active: content.sheets.length })
  }

  const applyCopilot = async (result) => {
    if (Array.isArray(result?.cells) && result.cells.length) {
      patchTab((item) => {
        result.cells.forEach((cell) => {
          const r = Number(cell.r)
          const c = Number(cell.c)
          if (Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            item.cells[r][c] = String(cell.v ?? '')
          }
        })
        return item
      })
    }
  }

  const getContext = () => ({
    title,
    sheet: tab.name,
    used: tab.cells.slice(0, 16).map((row) => row.slice(0, 8)),
    selection: nameBox,
  })

  const askAgent = async (prompt) => {
    const q = prompt.toLowerCase()
    if (q.includes('total') || q.includes('sum') || q.includes('jumlah')) {
      patchTab((item) => {
        item.cells[7][0] = 'Total (agen)'
        item.cells[7][1] = '=SUM(B2:B6)'
        item.cells[7][3] = '=SUM(D2:D6)'
        item.formats[7][0] = { bold: true }
        item.formats[7][3] = { bold: true, numFmt: 'currency', fill: '#e7f4f0' }
        return item
      })
      return { message: 'Saya menambahkan baris total di baris 8 dengan SUM untuk unit dan penjualan.' }
    }
    if (q.includes('rupiah') || q.includes('currency') || q.includes('format')) {
      applyFormat({ numFmt: 'currency' })
      return { message: 'Sel yang dipilih diformat sebagai Rupiah.' }
    }
    if (q.includes('jelas') || q.includes('analisis') || q.includes('insight')) {
      const sum = computed.get(6, 3)
      const value = displayOf(sum, 'currency') || displayOf(sum)
      patchTab((item) => {
        item.cells[11][0] = 'Catatan agen'
        item.cells[12][0] = `Penjualan terhitung ${value}. Fokus restock pada SKU dengan status Habis atau Pre-order.`
        return item
      })
      return { message: `Saya menulis catatan analisis di bawah tabel. Total penjualan saat ini ${value}.` }
    }
    patchTab((item) => {
      item.cells[14][0] = 'Briefing agen'
      item.cells[15][0] = prompt
      return item
    })
    return { message: 'Briefing Anda saya tulis ke dalam sheet, di baris 15–16.' }
  }

  const menus = [
    {
      label: 'File',
      actions: [
        { id: 'xlsx', label: 'Unduh Excel (.xls)', run: async () => { await exportXlsx(title, content.sheets); onNotify('Workbook diunduh') } },
        { id: 'csv', label: 'Unduh CSV', run: () => exportCsv(title, tab.cells) },
        { id: 'import', label: 'Impor CSV…', run: () => fileInput.current?.click() },
      ],
    },
    {
      label: 'Sunting',
      actions: [
        { id: 'copy', label: 'Salin', hint: '⌘C', run: copySelection },
        { id: 'clear', label: 'Hapus isi', run: clearSelection },
        { id: 'bold', label: 'Tebal', hint: '⌘B', run: () => applyFormat({ bold: true }) },
      ],
    },
    {
      label: 'Format',
      actions: [
        { id: 'gen', label: 'Umum', run: () => applyFormat({ numFmt: 'general' }) },
        { id: 'num', label: 'Angka', run: () => applyFormat({ numFmt: 'number' }) },
        { id: 'idr', label: 'Mata uang Rupiah', run: () => applyFormat({ numFmt: 'currency' }) },
        { id: 'pct', label: 'Persen', run: () => applyFormat({ numFmt: 'percent' }) },
      ],
    },
  ]

  return (
    <div className="ed-shell sheets-app">
      <div className="ed-main">
        <EditorChrome
          icon={Table2}
          tone="green"
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => onNotify('Tautan spreadsheet siap dibagikan')}
          extra={<AgentToggle onClick={() => setShowAgent((v) => !v)} />}
        />
        <MenuBar items={menus} />
        <input ref={fileInput} className="hidden-input" type="file" accept=".csv,text/csv" onChange={(event) => {
          const blob = event.target.files?.[0]
          if (!blob) return
          blob.text().then((text) => {
            patchTab((item) => {
              item.cells = parseCsv(text)
              item.name = blob.name.replace(/\.csv$/i, '') || item.name
              return item
            })
            onNotify(`${blob.name} diimpor`)
          })
          event.target.value = ''
        }} />
        <div className="editor-toolbar">
          <button className="toolbar-select" onClick={() => applyFormat({ bold: true })}><Bold size={15} /></button>
          <button className="tool-button" onClick={() => applyFormat({ italic: true })}><Italic size={15} /></button>
          <button className="tool-button" onClick={() => applyFormat({ underline: true })}><Underline size={15} /></button>
          <span className="tool-divider" />
          <select className="toolbar-select" onChange={(event) => applyFormat({ numFmt: event.target.value })} defaultValue="general">
            <option value="general">Umum</option>
            <option value="number">Angka</option>
            <option value="currency">Rupiah</option>
            <option value="percent">Persen</option>
          </select>
          <span className="tool-divider" />
          <span className="swatches">
            {FILLS.map((color) => (
              <button key={color} className="swatch" style={{ background: color === 'transparent' ? '#fff' : color }} onClick={() => applyFormat({ fill: color === 'transparent' ? undefined : color })} />
            ))}
          </span>
          <span className="toolbar-spacer" />
          <button className="save-button" onClick={() => { persist(); onNotify('Spreadsheet tersimpan') }}><Check size={14} /> Tersimpan</button>
        </div>
        <div className="formula-bar">
          <span className="cell-reference">{nameBox}</span>
          <span className="fx">fx</span>
          <input
            value={editing && sel.r === sel.r2 && sel.c === sel.c2 ? draft : activeRaw}
            onFocus={() => startEdit(activeRaw)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft('down')
              }
            }}
            placeholder="Masukkan nilai atau formula, misalnya =SUM(B2:B6)"
          />
        </div>
        <div
          className="sheet-scroll"
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKey}
          onPaste={(event) => {
            event.preventDefault()
            pasteTsv(event.clipboardData.getData('text/plain'))
          }}
          onMouseUp={() => { dragging.current = false }}
        >
          <div className="s-grid" style={{ '--cols': COLS }}>
            <div className="s-corner" />
            {Array.from({ length: COLS }, (_, c) => (
              <div className={`s-colh ${c >= Math.min(sel.c, sel.c2) && c <= Math.max(sel.c, sel.c2) ? 'hot' : ''}`} key={colLabel(c)}>{colLabel(c)}</div>
            ))}
            {tab.cells.map((row, r) => (
              <div className="s-row" key={r} style={{ display: 'contents' }}>
                <div className={`s-rowh ${r >= Math.min(sel.r, sel.r2) && r <= Math.max(sel.r, sel.r2) ? 'hot' : ''}`}>{r + 1}</div>
                {row.map((_, c) => {
                  const fmt = tab.formats[r][c] || {}
                  const selected = inSel(sel, r, c)
                  const active = sel.r === r && sel.c === c
                  const val = computed.display[r][c]
                  const show = editing && active ? draft : displayOf(val, fmt.numFmt)
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`s-cell ${selected ? 'sel' : ''} ${active ? 'active' : ''} ${fmt.bold ? 'b' : ''} ${val?.t === 'e' ? 'err' : ''}`}
                      style={{ background: fmt.fill || (r === 0 ? '#eef8f4' : undefined), textAlign: fmt.align || (val?.t === 'n' ? 'right' : 'left') }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        gridRef.current?.focus()
                        dragging.current = true
                        if (event.shiftKey) setSel({ ...sel, r2: r, c2: c })
                        else {
                          if (editing) commitDraft()
                          setSel({ r, c, r2: r, c2: c })
                        }
                      }}
                      onMouseEnter={() => {
                        if (dragging.current) setSel((s) => ({ ...s, r2: r, c2: c }))
                      }}
                      onDoubleClick={() => startEdit()}
                    >
                      {editing && active ? (
                        <input
                          autoFocus
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => commitDraft()}
                          onKeyDown={(event) => {
                            event.stopPropagation()
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitDraft('down')
                            } else if (event.key === 'Tab') {
                              event.preventDefault()
                              commitDraft('right')
                            } else if (event.key === 'Escape') {
                              setEditing(false)
                            }
                          }}
                        />
                      ) : show}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <footer className="sheet-footer">
          <div className="sheet-tabs">
            {content.sheets.map((item, index) => (
              <button
                key={item.id}
                className={`sheet-tab ${index === content.active ? 'active' : ''}`}
                onClick={() => persist({ ...content, active: index })}
                onDoubleClick={() => {
                  const name = window.prompt('Nama sheet', item.name)
                  if (!name) return
                  persist({
                    ...content,
                    sheets: content.sheets.map((sheet, i) => i === index ? { ...sheet, name } : sheet),
                  })
                }}
              >
                {item.name}
              </button>
            ))}
            <button className="add-sheet" onClick={addSheet}><FilePlus2 size={14} /></button>
            {content.sheets.length > 1 && (
              <button className="add-sheet" onClick={() => persist({
                ...content,
                sheets: content.sheets.filter((_, i) => i !== content.active),
                active: Math.max(0, content.active - 1),
              })}><Trash2 size={14} /></button>
            )}
          </div>
          <span>
            {stats
              ? `Sum ${displayOf({ t: 'n', v: stats.sum })}  ·  Avg ${displayOf({ t: 'n', v: stats.avg })}  ·  Count ${stats.count}`
              : 'Pilih rentang untuk melihat Sum / Average'}
          </span>
          <span>100%</span>
        </footer>
      </div>
      {showAgent && (
        <AgentPanel
          kind="sheet"
          floating
          onClose={() => setShowAgent(false)}
          getContext={getContext}
          onApply={applyCopilot}
          onAsk={askAgent}
        />
      )}
    </div>
  )
}
