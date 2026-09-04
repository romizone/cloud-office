import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Highlighter, PenLine } from 'lucide-react'
import { EditorChrome, useSavedFlag } from '../components/EditorChrome.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CanvasCopilotChip } from '../components/CopilotBridge.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { PdfIcon } from '../components/MsApps.jsx'
import { parseFontColor } from '../lib/editIntent.js'
import { escapeText } from '../lib/files.js'
import { asFragment, colorPick, isAnalyzeIntent, isReviseIntent, replacePick, useCanvasPick } from '../lib/canvasPick.js'

const PAGES = [
  { heading: 'PERJANJIAN KERJA SAMA', section: 'Para Pihak', body: 'Dokumen ini dibuat dan disepakati oleh para pihak untuk menjelaskan kerja sama secara jelas, transparan, dan saling menguntungkan.' },
  { heading: 'RUANG LINGKUP KERJA', section: 'Pasal 1', body: 'Lingkup mencakup penyediaan ruang kerja dokumen, spreadsheet, dan presentasi, termasuk dukungan agen yang bekerja di dalam file.' },
  { heading: 'KETENTUAN PENUTUP', section: 'Pasal 5', body: 'Perjanjian ini dapat diakhiri secara tertulis. File yang dihasilkan tetap milik pihak yang membuatnya dan dapat diunduh kapan saja.' },
]
const PAGE_COUNT = PAGES.length

function templateHtml(page, notes) {
  const current = PAGES[page - 1]
  return `<span class="pdf-label">NORTHSTAR STUDIO</span>
<h1>${escapeText(current.heading)}</h1>
<p class="pdf-meta">Nomor: NS/2025/${String(page).padStart(2, '0')} · 30 Agustus 2025</p>
<hr />
<h2>${escapeText(current.section)}</h2>
<p>${escapeText(current.body)}</p>
${notes ? `<blockquote>${escapeText(notes)}</blockquote>` : ''}
<p>Isi dokumen dapat diedit langsung. Anotasi, formulir, dan tanda tangan hadir sebagai lapisan di atas file PDF asli pada versi penuh.</p>
<div class="signature-box">
  <span>PIHAK PERTAMA</span>
  <span>PIHAK KEDUA</span>
  <b>________________</b>
  <b>________________</b>
</div>
<span class="pdf-page-number">${page}</span>`
}

function clampPage(value) {
  const n = Number(value) || 1
  return Math.max(1, Math.min(PAGE_COUNT, n))
}

export default function PdfEditor({ file, onChange, onBack, onNotify }) {
  const pageRef = useRef(null)
  const [pick, clearPick, pickRef] = useCanvasPick(pageRef)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const [title, setTitle] = useState(file.name)
  const [page, setPage] = useState(clampPage(file.content?.page))
  const [zoom, setZoom] = useState(100)
  const [showAgent, setShowAgent] = useState(true)
  const [share, setShare] = useState(false)
  const [notes, setNotes] = useState(file.content?.notes || '')
  const [ink, setInk] = useState(file.content?.color || '')
  const [pages, setPages] = useState(file.content?.pages || {})
  const [tool, setTool] = useState('text')
  const [revision, setRevision] = useState(0)
  const saved = useSavedFlag(title + page + notes + ink + JSON.stringify(pages))

  const stateRef = useRef({})
  stateRef.current = { title, page, notes, ink, pages }
  const renderedRef = useRef('')

  useEffect(() => {
    setTitle(file.name)
    setPage(clampPage(file.content?.page))
    setNotes(file.content?.notes || '')
    setInk(file.content?.color || '')
    setPages(file.content?.pages || {})
    setRevision((n) => n + 1)
    clearPick()
  }, [file.id])

  const persist = (patch = {}) => {
    const base = stateRef.current
    const next = {
      title: patch.title ?? base.title,
      page: clampPage(patch.page ?? base.page),
      notes: patch.notes ?? base.notes,
      color: patch.color ?? base.ink,
      pages: patch.pages ?? base.pages,
    }
    if (patch.title !== undefined) setTitle(next.title)
    if (patch.page !== undefined) setPage(next.page)
    if (patch.notes !== undefined) setNotes(next.notes)
    if (patch.color !== undefined) setInk(next.color)
    if (patch.pages !== undefined) setPages(next.pages)
    stateRef.current = { title: next.title, page: next.page, notes: next.notes, ink: next.color, pages: next.pages }
    onChange({
      ...file,
      name: next.title,
      content: { page: next.page, notes: next.notes, color: next.color, pages: next.pages },
      updatedAt: new Date().toISOString(),
    })
  }

  const current = PAGES[page - 1]
  const pageHtml = pages[page] ?? templateHtml(page, notes)

  const savePageEdits = () => {
    const el = pageRef.current
    if (!el) return
    const html = el.innerHTML
    if (html === renderedRef.current) return
    renderedRef.current = html
    persist({ pages: { ...stateRef.current.pages, [page]: html } })
  }

  const writeNotes = (text) => {
    const override = stateRef.current.pages[page]
    if (override) {
      const doc = document.createElement('div')
      doc.innerHTML = override
      const existing = doc.querySelector('blockquote')
      if (existing) existing.textContent = text
      else {
        const quote = document.createElement('blockquote')
        quote.textContent = text
        const anchor = doc.querySelector('h2 + p')
        if (anchor) anchor.after(quote)
        else doc.appendChild(quote)
      }
      persist({ notes: text, pages: { ...stateRef.current.pages, [page]: doc.innerHTML } })
    } else {
      persist({ notes: text })
    }
    setRevision((n) => n + 1)
  }

  const goPage = (next) => {
    savePageEdits()
    persist({ page: next })
    setRevision((n) => n + 1)
    clearPick()
  }

  const applyInk = (color) => {
    if (!color) return false
    if (pickRef.current?.text && pageRef.current && colorPick(pageRef.current, pickRef.current, color)) {
      savePageEdits()
      return true
    }
    persist({ color })
    return true
  }

  const applyCopilot = async (result) => {
    if (pickRef.current?.text && pageRef.current) {
      if (result?.color) applyInk(result.color)
      const frag = result?.selectionHtml || result?.html || result?.appendHtml
      if (frag) {
        replacePick(pageRef.current, pickRef.current, asFragment(frag))
        savePageEdits()
        return true
      }
      return Boolean(result?.color)
    }
    let done = false
    if (result?.color) done = applyInk(result.color)
    if (result?.notes) { writeNotes(String(result.notes)); done = true }
    if (result?.html && pageRef.current) {
      const body = String(result.html)
      persist({ pages: { ...stateRef.current.pages, [page]: body } })
      setRevision((n) => n + 1)
      done = true
    }
    return done
  }

  const getContext = () => ({
    title,
    page,
    pageCount: PAGE_COUNT,
    heading: current.heading,
    section: current.section,
    body: (pageRef.current?.innerText || current.body).slice(0, 4000),
    color: ink,
    notes,
    selection: pickRef.current?.text || '',
    scoped: Boolean(pickRef.current?.text),
  })

  const askAgent = async (prompt) => {
    const color = parseFontColor(prompt)
    const picked = pickRef.current
    if (picked?.text) {
      if (color) {
        applyInk(color.value)
        return { message: `Font pada pilihan PDF diubah menjadi ${color.label}.` }
      }
      if (isAnalyzeIntent(prompt) && !isReviseIntent(prompt)) {
        return { message: `Dari pilihan: “${picked.text.slice(0, 360)}${picked.text.length > 360 ? '…' : ''}”`, applied: false }
      }
      if (isReviseIntent(prompt) && pageRef.current) {
        const cut = picked.text.split(/(?<=[.!?])\s+/)[0] || picked.text
        replacePick(pageRef.current, picked, asFragment(cut))
        savePageEdits()
        return { message: 'Pilihan di halaman PDF diperbarui. Teks lain tidak diubah.' }
      }
      return { message: `Siap bekerja pada pilihan: “${picked.text.slice(0, 160)}${picked.text.length > 160 ? '…' : ''}”`, applied: false }
    }
    if (color) {
      applyInk(color.value)
      return { message: `Font PDF diubah menjadi ${color.label}.` }
    }
    const q = prompt.toLowerCase()
    if (q.includes('ringkas') || q.includes('rangkum')) {
      writeNotes(`Ringkasan: ${current.heading} — ${current.body.slice(0, 140)}…`)
      return { message: 'Ringkasan halaman ini ditulis ke kanvas PDF.' }
    }
    if (q.includes('risiko') || q.includes('kewajiban')) {
      writeNotes(q.includes('risiko')
        ? `Risiko di ${current.section}: pengakhiran tertulis tanpa masa tenggang; kepemilikan file bergantung pada pihak pembuat.`
        : `Kewajiban di ${current.section}: menyediakan ruang kerja dokumen, spreadsheet, presentasi, dan dukungan agen di dalam file.`)
      return { message: 'Catatan ditulis ke halaman PDF.' }
    }
    return { message: 'Copilot siaga lokal: minta ringkasan, daftar risiko atau kewajiban, atau ubah warna font. Seleksi teks untuk merevisi bagian tertentu.', applied: false }
  }

  const highlightSelection = () => {
    const el = pageRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !el.contains(sel.anchorNode)) return onNotify('Seleksi teks di halaman dulu')
    document.execCommand('hiliteColor', false, '#fff3bf')
    savePageEdits()
  }

  const insertField = () => {
    const el = pageRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || !el.contains(sel.anchorNode)) return onNotify('Klik posisi di halaman dulu')
    document.execCommand('insertHTML', false, '<span class="pdf-field" contenteditable="true">&nbsp;</span>&nbsp;')
    savePageEdits()
  }

  return (
    <div className={`ed-shell pdf-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main pdf-editor">
        <EditorChrome
          kind="pdf"
          mark={<PdfIcon size={28} />}
          title={title}
          onTitle={(value) => persist({ title: value })}
          saved={saved}
          onBack={() => { savePageEdits(); onBack() }}
          onShare={() => setShare(true)}
          onCopilot={() => setShowAgent((v) => !v)}
        />
        <div className="pdf-toolbar">
          <button onClick={() => goPage(page - 1)} disabled={page <= 1} aria-label="Halaman sebelumnya">‹</button>
          <span className="page-count">{page} / {PAGE_COUNT}</span>
          <button onClick={() => goPage(page + 1)} disabled={page >= PAGE_COUNT} aria-label="Halaman berikutnya">›</button>
          <i />
          <button className={`pdf-tool ${tool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')}><FileText size={15} /> Teks</button>
          <button className="pdf-tool" onClick={insertField}><PenLine size={15} /> Isi formulir</button>
          <button className="pdf-tool" onClick={highlightSelection}><Highlighter size={15} /> Tandai</button>
          <button className={`pdf-tool ${ink === '#c0392b' ? 'active' : ''}`} onClick={() => applyInk(ink === '#c0392b' && !pickRef.current?.text ? '' : '#c0392b')}>Merah</button>
          <span className="toolbar-spacer" />
          <button onClick={() => setZoom(Math.max(60, zoom - 10))} aria-label="Perkecil">−</button>
          <span className="zoom-value">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(160, zoom + 10))} aria-label="Perbesar">＋</button>
          <button className="pdf-save" onClick={() => { savePageEdits(); persist(); onNotify('PDF tersimpan') }}><Check size={14} /> {saved ? 'Tersimpan' : 'Simpan'}</button>
        </div>
        <div className="pdf-workspace">
          <aside className="pdf-thumbs">
            <p>HALAMAN</p>
            {PAGES.map((_, i) => (
              <button className={`pdf-thumb ${page === i + 1 ? 'active' : ''}`} key={i} onClick={() => goPage(i + 1)}>
                <span>{i + 1}</span>
                <div className="thumb-lines"><i /><i /><i /><i /></div>
              </button>
            ))}
          </aside>
          <main className="pdf-page-wrap">
            <div
              ref={(el) => {
                pageRef.current = el
                const key = `${file.id}:${page}:${revision}`
                if (el && el.getAttribute('data-key') !== key) {
                  el.innerHTML = pageHtml
                  el.setAttribute('data-key', key)
                  renderedRef.current = el.innerHTML
                }
              }}
              className={`pdf-page ${ink ? 'inked' : ''} ${pick?.text ? 'copilot-scoped' : ''}`}
              style={{ transform: `scale(${zoom / 100})`, color: ink || undefined }}
              contentEditable
              suppressContentEditableWarning
              onBlur={savePageEdits}
              onInput={savePageEdits}
            />
          </main>
        </div>
      </div>
      <CanvasCopilotChip pick={pick} onOpen={() => setShowAgent(true)} />
      {showAgent && (
        <AgentPanel
          kind="pdf"
          app="PDF"
          floating
          onClose={() => setShowAgent(false)}
          getContext={getContext}
          onApply={applyCopilot}
          onAsk={askAgent}
          selectionText={pick?.text || ''}
          onClearSelection={clearPick}
          onBusyChange={setCopilotBusy}
        />
      )}
      {share && <ShareDialog title={`${title}.pdf`} onClose={() => setShare(false)} onNotify={onNotify} />}
    </div>
  )
}
