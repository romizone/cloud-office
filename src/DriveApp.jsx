import { useEffect, useRef, useState } from 'react'
import {
  Archive, Copy, Home, MoreHorizontal, Share2, Star, Upload, Users
} from 'lucide-react'
import FluentShell from './components/FluentShell.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import ShareDialog from './components/ShareDialog.jsx'
import { AppIcon, CopilotMark, ExcelIcon, OneDriveIcon, PowerPointIcon, WordIcon } from './components/MsApps.jsx'
import { APP_NAME, EXT, USER, greeting } from './lib/brand.js'
import { createFile, escapeText, fileHash, formatRelative, parseCsv, blankFormats, textToHtml } from './lib/files.js'

const CREATE = [
  { type: 'doc', title: 'Dokumen Word', detail: 'Word for the web', icon: WordIcon },
  { type: 'sheet', title: 'Buku kerja Excel', detail: 'Excel for the web', icon: ExcelIcon },
  { type: 'slides', title: 'Presentasi PowerPoint', detail: 'PowerPoint for the web', icon: PowerPointIcon },
  { type: 'pdf', title: 'PDF', detail: 'Baca dan tandai di browser', icon: null },
]

const BINARY_TYPES = { doc: 'doc', docx: 'doc', xls: 'sheet', xlsx: 'sheet', ppt: 'slides', pptx: 'slides', pdf: 'pdf' }

function stripScripts(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function copyText(text, onNotify, okText) {
  if (!navigator.clipboard?.writeText) {
    onNotify('Tautan tidak dapat disalin di browser ini')
    return
  }
  navigator.clipboard.writeText(text).then(() => onNotify(okText), () => onNotify('Tautan tidak dapat disalin'))
}

export default function DriveApp({ files, onOpen, onCreate, onPatch, onNotify, view = 'home' }) {
  const [activeNav, setActiveNav] = useState(view === 'onedrive' || view === 'sharepoint' ? view : 'home')
  const [query, setQuery] = useState('')
  const [showAssistant, setShowAssistant] = useState(view === 'home')
  const [viewMode] = useState('list')
  const [selectedFile, setSelectedFile] = useState(null)
  const [shareFile, setShareFile] = useState(null)
  const fileInput = useRef(null)
  const tableRef = useRef(null)

  useEffect(() => {
    if (view === 'onedrive' || view === 'sharepoint') setActiveNav(view)
    if (view === 'home' || view === 'apps') setActiveNav('home')
  }, [view])

  useEffect(() => {
    if (!selectedFile) return undefined
    const close = (event) => {
      if (!event.target.closest?.('.row-actions')) setSelectedFile(null)
    }
    const onKey = (event) => { if (event.key === 'Escape') setSelectedFile(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [selectedFile])

  const q = query.trim().toLowerCase()
  const filtered = files.filter((file) => {
    if (activeNav === 'trash' ? !file.trashed : file.trashed) return false
    if (activeNav === 'fav' && !file.favorite) return false
    if (activeNav === 'shared' && !file.shared) return false
    if (q && !`${file.name}.${EXT[file.type]}`.toLowerCase().includes(q)) return false
    return true
  })

  const uploadFile = async (event) => {
    const blob = event.target.files?.[0]
    event.target.value = ''
    if (!blob) return
    const name = blob.name.replace(/\.[^.]+$/, '') || 'Unggahan'
    const ext = blob.name.split('.').pop()?.toLowerCase()
    try {
      if (ext === 'csv' || ext === 'tsv') {
        const text = await blob.text()
        const file = createFile('sheet', name)
        file.content.sheets[0].cells = parseCsv(ext === 'tsv' ? text.replace(/\t/g, ',') : text)
        file.content.sheets[0].name = name.slice(0, 31)
        file.content.sheets[0].formats = blankFormats()
        onCreate(file)
      } else if (['txt', 'md', 'markdown'].includes(ext)) {
        const text = await blob.text()
        const file = createFile('doc', name)
        file.content.html = textToHtml(name, text)
        onCreate(file)
      } else if (['html', 'htm'].includes(ext)) {
        const text = await blob.text()
        const body = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? text
        const file = createFile('doc', name)
        file.content.html = stripScripts(body)
        onCreate(file)
      } else if (BINARY_TYPES[ext]) {
        const type = BINARY_TYPES[ext]
        const file = createFile(type, name)
        if (type === 'doc') {
          file.content.html = `<h1>${escapeText(name)}</h1><p>File <b>${escapeText(blob.name)}</b> diunggah ke OneDrive. Isi biner .${ext} belum bisa dibaca di browser ini; tulis ulang isinya di sini atau unggah versi .txt/.html.</p>`
        }
        onCreate(file)
        onNotify(`${blob.name} ditambahkan ke OneDrive sebagai ${APP_NAME[type]}`)
      } else {
        onNotify(`Format .${ext || '?'} belum didukung. Unggah .txt, .md, .html, .csv, atau file Office.`)
      }
    } catch {
      onNotify(`${blob.name} tidak dapat dibaca`)
    }
  }

  const nav = [
    { id: 'home', label: 'Beranda', icon: <Home size={16} /> },
    { id: 'copilot', label: 'Copilot', icon: <CopilotMark size={16} /> },
    { id: 'onedrive', label: 'OneDrive', icon: <OneDriveIcon size={18} /> },
    { id: 'shared', label: 'Dibagikan', icon: <Users size={16} /> },
    { id: 'fav', label: 'Favorit', icon: <Star size={16} /> },
    { id: 'trash', label: 'Sampah', icon: <Archive size={16} /> },
  ]

  const onNav = (item) => {
    if (item.id === 'copilot') { location.hash = '#/copilot'; return }
    setActiveNav(item.id)
  }

  const askHome = async (prompt) => {
    const lower = prompt.toLowerCase()
    if (lower.includes('presentasi') || lower.includes('outline') || lower.includes('dek')) {
      const file = createFile('slides', 'Outline presentasi')
      file.content.slides = [
        { ...file.content.slides[0], title: 'Outline dari Copilot', subtitle: prompt, kicker: 'OFFICE ROMEO' },
        {
          id: 'agenda-home',
          layout: 'content',
          kicker: 'AGENDA',
          title: 'Kerangka dek',
          body: 'Konteks dan masalah\nPendekatan produk\nBukti dan metrik\nPermintaan dan langkah berikutnya',
          notes: 'Isi tiap slide dengan bukti, bukan slogan.',
        },
      ]
      onCreate(file)
      return { message: 'Saya membuat presentasi PowerPoint baru. Buka file, lalu lanjutkan dengan Copilot di kanan.' }
    }
    if (lower.includes('analisis') || lower.includes('spreadsheet') || lower.includes('angka') || lower.includes('excel')) {
      const sheet = files.find((f) => f.type === 'sheet' && !f.trashed)
      if (sheet) {
        onOpen(sheet)
        return { message: `Membuka ${sheet.name} di Excel. Minta Copilot menulis rumus di dalam workbook.` }
      }
    }
    if (lower.includes('baru') || lower.includes('terbaru') || lower.includes('apa yang')) {
      const recent = files.filter((f) => !f.trashed).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3)
      if (recent.length) {
        return { message: `Terbaru: ${recent.map((f) => `${f.name} (${APP_NAME[f.type]}, ${formatRelative(f.updatedAt).toLowerCase()})`).join('; ')}.`, applied: false }
      }
    }
    const doc = files.find((f) => f.type === 'doc' && !f.trashed)
    if (doc) {
      onOpen(doc)
      return { message: `Membuka ${doc.name} di Word agar Copilot bisa mengedit di kanvas.` }
    }
    return { message: 'Buat Word, Excel, atau PowerPoint, lalu brief Copilot di samping file itu.', applied: false }
  }

  const heading = {
    home: ['Beranda Office Romeo', 'Aplikasi web · Word, Excel, PowerPoint, PDF'],
    onedrive: ['File saya', 'OneDrive · 2 GB · Office Romeo F3'],
    sharepoint: ['Situs tim', 'SharePoint · Pustaka dokumen Northstar'],
    shared: ['Dibagikan', 'File yang Anda bagikan ke orang lain'],
    fav: ['Favorit', 'File yang Anda sematkan'],
    trash: ['Sampah', 'Pulihkan atau biarkan di sini'],
  }[activeNav] || ['Beranda Office Romeo', '']

  const linkFor = (file) => `${location.origin}${location.pathname}${fileHash(file)}`

  return (
    <FluentShell
      app="home"
      nav={nav}
      activeNav={activeNav === 'sharepoint' ? 'onedrive' : activeNav}
      onNav={onNav}
      search={query}
      onSearch={setQuery}
      onCreate={onCreate}
      onNotify={onNotify}
      right={showAssistant ? (
        <AgentPanel kind="home" app="Office Romeo" onClose={() => setShowAssistant(false)} getContext={() => ({ files: files.filter((f) => !f.trashed).map((f) => ({ name: f.name, type: f.type, updatedAt: f.updatedAt })) })} onApply={async () => false} onAsk={askHome} />
      ) : null}
    >
      <div className="m365-home">
        {activeNav === 'home' && (
          <>
            <section className="m365-welcome">
              <div>
                <p className="eyebrow">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <h1>{greeting()}, {USER.short}</h1>
                <p>Office Romeo · aplikasi web Word, Excel, PowerPoint, dan PDF. Copilot bekerja di dalam file.</p>
              </div>
              <button className="copilot-cta" onClick={() => { location.hash = '#/copilot' }}>
                <CopilotMark size={22} /> Tanya Copilot
              </button>
            </section>
            <section>
              <div className="section-heading"><h2>Buat baru</h2></div>
              <div className="create-row">
                {CREATE.map((item) => (
                  <button key={item.type} className="create-tile" onClick={() => onCreate(createFile(item.type))}>
                    {item.icon ? <item.icon size={36} /> : <AppIcon app="pdf" size={36} />}
                    <span><b>{item.title}</b><small>{item.detail}</small></span>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="section-heading"><h2>Aplikasi</h2></div>
              <div className="apps-row">
                {[
                  ['word', 'Word', () => onCreate(createFile('doc'))],
                  ['excel', 'Excel', () => onCreate(createFile('sheet'))],
                  ['powerpoint', 'PowerPoint', () => onCreate(createFile('slides'))],
                  ['pdf', 'PDF', () => onCreate(createFile('pdf'))],
                ].map(([id, label, run]) => (
                  <button key={id} className="app-tile" onClick={run}>
                    <AppIcon app={id} size={40} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {activeNav === 'sharepoint' && (
          <section className="sp-banner">
            <div>
              <p className="eyebrow">SHAREPOINT</p>
              <h1>Situs tim Northstar</h1>
              <p>Pustaka dokumen terhubung ke OneDrive F3. Buka file di Word, Excel, atau PowerPoint for the web.</p>
            </div>
          </section>
        )}

        <section className="files-section">
          <div className="section-heading">
            <div>
              <h2>{activeNav === 'home' ? 'Terbaru' : heading[0]}</h2>
              <p>{heading[1]}</p>
            </div>
            <div className="file-tools">
              <input ref={fileInput} className="hidden-input" type="file" accept=".doc,.docx,.txt,.md,.html,.htm,.xls,.xlsx,.csv,.tsv,.ppt,.pptx,.pdf" onChange={uploadFile} />
              <button className="ghost" onClick={() => fileInput.current?.click()}><Upload size={15} /> Unggah</button>
            </div>
          </div>
          <div className={`file-table ${viewMode === 'grid' ? 'grid-view' : ''}`} ref={tableRef}>
            <div className="table-head"><span>Nama</span><span>Aplikasi</span><span>Diubah</span><span /></div>
            {filtered.map((file) => (
              <div
                className="file-row"
                key={file.id}
                role="button"
                tabIndex={0}
                onClick={() => !file.trashed && onOpen(file)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !file.trashed) onOpen(file) }}
              >
                <div className="file-name">
                  <AppIcon app={file.type} size={28} />
                  <span>
                    <strong>{file.name}.{EXT[file.type]}</strong>
                    <small>{APP_NAME[file.type]} · {USER.name}{file.shared ? ' · dibagikan' : ''}</small>
                  </span>
                </div>
                <div className="owner">{APP_NAME[file.type]}</div>
                <span className="edited">{formatRelative(file.updatedAt)}</span>
                <div className="row-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <button onClick={() => onPatch({ ...file, favorite: !file.favorite })} aria-label={file.favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}><Star size={15} fill={file.favorite ? 'currentColor' : 'none'} /></button>
                  <button onClick={() => setShareFile(file)} aria-label="Bagikan"><Share2 size={15} /></button>
                  <button onClick={() => setSelectedFile(selectedFile === file.id ? null : file.id)} aria-label="Menu lainnya" aria-expanded={selectedFile === file.id}><MoreHorizontal size={17} /></button>
                  {selectedFile === file.id && (
                    <div className="file-menu">
                      {!file.trashed && <button onClick={() => { setSelectedFile(null); onOpen(file) }}>Buka</button>}
                      <button onClick={() => { setSelectedFile(null); copyText(linkFor(file), onNotify, 'Tautan disalin') }}><Copy size={14} /> Salin tautan</button>
                      <button onClick={() => { setSelectedFile(null); onPatch({ ...file, trashed: !file.trashed }); onNotify(file.trashed ? 'File dipulihkan' : 'Dipindahkan ke sampah') }}>
                        {file.trashed ? 'Pulihkan' : 'Pindahkan ke sampah'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="empty-state">{q ? `Tidak ada file yang cocok dengan “${query.trim()}”.` : 'Tidak ada file di sini.'}</div>}
          </div>
        </section>
      </div>
      {shareFile && (
        <ShareDialog
          title={`${shareFile.name}.${EXT[shareFile.type]}`}
          link={linkFor(shareFile)}
          onClose={() => setShareFile(null)}
          onNotify={onNotify}
          onShared={() => onPatch({ ...shareFile, shared: true })}
        />
      )}
      {!showAssistant && <button className="ai-fab" onClick={() => setShowAssistant(true)}><CopilotMark size={18} /> Copilot</button>}
    </FluentShell>
  )
}
