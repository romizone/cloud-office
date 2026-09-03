import { useEffect, useState } from 'react'
import { Bold, Check, FileChartColumn, FileText, Underline } from 'lucide-react'
import { AgentToggle, EditorChrome, useSavedFlag } from '../components/EditorChrome.jsx'
import AgentPanel from '../components/AgentPanel.jsx'

const PAGES = [
  { heading: 'PERJANJIAN KERJA SAMA', section: 'Para Pihak', body: 'Dokumen ini dibuat dan disepakati oleh para pihak untuk menjelaskan kerja sama secara jelas, transparan, dan saling menguntungkan.' },
  { heading: 'RUANG LINGKUP KERJA', section: 'Pasal 1', body: 'Lingkup mencakup penyediaan ruang kerja dokumen, spreadsheet, dan presentasi, termasuk dukungan agen yang bekerja di dalam file.' },
  { heading: 'KETENTUAN PENUTUP', section: 'Pasal 5', body: 'Perjanjian ini dapat diakhiri secara tertulis. File yang dihasilkan tetap milik pihak yang membuatnya dan dapat diunduh kapan saja.' },
]

export default function PdfEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [page, setPage] = useState(file.content?.page || 1)
  const [zoom, setZoom] = useState(100)
  const [showAgent, setShowAgent] = useState(true)
  const [notes, setNotes] = useState('')
  const saved = useSavedFlag(title + page + notes)

  useEffect(() => {
    setTitle(file.name)
    setPage(file.content?.page || 1)
  }, [file.id])

  const persist = (nextTitle = title, nextPage = page) => {
    onChange({ ...file, name: nextTitle, content: { page: nextPage }, updatedAt: new Date().toISOString() })
  }

  const current = PAGES[page - 1]

  const applyCopilot = async (result) => {
    if (result?.notes) {
      setNotes(result.notes)
      return true
    }
    return false
  }

  const getContext = () => ({
    title,
    page,
    heading: current.heading,
    section: current.section,
    body: current.body,
  })

  const askAgent = async (prompt) => {
    setNotes(`Ringkasan lokal: ${current.heading} — ${current.body.slice(0, 140)}… (${prompt})`)
    return { message: 'Saya menulis ringkasan halaman ini di panel copilot. Buka mode penuh untuk markup PDF asli.' }
  }

  return (
    <div className="ed-shell pdf-app">
      <div className="ed-main pdf-editor">
        <EditorChrome
          icon={FileChartColumn}
          tone="red"
          title={title}
          onTitle={(value) => { setTitle(value); persist(value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => onNotify('Tautan PDF siap dibagikan')}
          extra={<AgentToggle onClick={() => setShowAgent((v) => !v)} />}
        />
        <div className="pdf-toolbar">
          <button onClick={() => { const next = Math.max(1, page - 1); setPage(next); persist(title, next) }}>‹</button>
          <span className="page-count">{page} / 3</span>
          <button onClick={() => { const next = Math.min(3, page + 1); setPage(next); persist(title, next) }}>›</button>
          <i />
          <button className="pdf-tool active"><FileText size={15} /> Teks</button>
          <button className="pdf-tool"><Bold size={15} /> Isi formulir</button>
          <button className="pdf-tool"><Underline size={15} /> Tandai</button>
          <span className="toolbar-spacer" />
          <button onClick={() => setZoom(Math.max(60, zoom - 10))}>−</button>
          <span className="zoom-value">{zoom}%</span>
          <button onClick={() => setZoom(Math.min(160, zoom + 10))}>＋</button>
          <button className="pdf-save" onClick={() => { persist(); onNotify('PDF tersimpan') }}><Check size={14} /> Tersimpan</button>
        </div>
        <div className="pdf-workspace">
          <aside className="pdf-thumbs">
            <p>HALAMAN</p>
            {[1, 2, 3].map((number) => (
              <button className={`pdf-thumb ${page === number ? 'active' : ''}`} key={number} onClick={() => { setPage(number); persist(title, number) }}>
                <span>{number}</span>
                <div className="thumb-lines"><i /><i /><i /><i /></div>
              </button>
            ))}
          </aside>
          <main className="pdf-page-wrap">
            <div className="pdf-page" style={{ transform: `scale(${zoom / 100})` }} contentEditable suppressContentEditableWarning>
              <span className="pdf-label">NORTHSTAR STUDIO</span>
              <h1>{current.heading}</h1>
              <p className="pdf-meta">Nomor: NS/2025/{page.toString().padStart(2, '0')} · 30 Agustus 2025</p>
              <hr />
              <h2>{current.section}</h2>
              <p>{current.body}</p>
              {notes && <blockquote>{notes}</blockquote>}
              <p>Isi dokumen dapat diedit langsung. Anotasi, formulir, dan tanda tangan hadir sebagai lapisan di atas file PDF asli pada versi penuh.</p>
              <div className="signature-box">
                <span>PIHAK PERTAMA</span>
                <span>PIHAK KEDUA</span>
                <b>________________</b>
                <b>________________</b>
              </div>
              <span className="pdf-page-number">{page}</span>
            </div>
          </main>
        </div>
      </div>
      {showAgent && (
        <AgentPanel
          kind="pdf"
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
