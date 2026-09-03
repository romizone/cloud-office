import { useRef, useState } from 'react'
import {
  Archive, ArrowUpRight, Bell, Check, ChevronDown, Cloud, Copy,
  FileChartColumn, FilePlus2, FileText, Grid2X2, LayoutDashboard, Library, Menu,
  MoreHorizontal, Presentation, Search, Settings, Sparkles, Star, Table2, Upload,
  Users, Zap
} from 'lucide-react'
import AgentPanel from './components/AgentPanel.jsx'
import { blankFormats, createFile, fileHash, formatRelative, parseCsv, typeLabel } from './lib/files.js'

const templates = [
  { type: 'doc', title: 'Dokumen kosong', detail: 'Mulai menulis dari awal', icon: FileText },
  { type: 'sheet', title: 'Spreadsheet kosong', detail: 'Hitung di sel, unduh Excel', icon: Table2 },
  { type: 'slides', title: 'Presentasi kosong', detail: 'Susun cerita visual', icon: Presentation },
  { type: 'pdf', title: 'PDF kosong', detail: 'Baca, tandai, isi formulir', icon: FileChartColumn },
]

const icons = { doc: FileText, sheet: Table2, slides: Presentation, pdf: FileChartColumn }
const tones = { doc: 'blue', sheet: 'green', slides: 'orange', pdf: 'red' }

export default function DriveApp({ files, onOpen, onCreate, onPatch, onNotify }) {
  const [activeNav, setActiveNav] = useState('Beranda')
  const [query, setQuery] = useState('')
  const [showAssistant, setShowAssistant] = useState(true)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [selectedFile, setSelectedFile] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const fileInput = useRef(null)

  const filtered = files.filter((file) => {
    if (activeNav === 'Sampah') return file.trashed
    if (file.trashed) return false
    if (activeNav === 'Favorit') return file.favorite
    if (query && !file.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const uploadFile = async (event) => {
    const blob = event.target.files?.[0]
    if (!blob) return
    const name = blob.name.replace(/\.[^.]+$/, '')
    const ext = blob.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      const text = await blob.text()
      const file = createFile('sheet', name)
      file.content.sheets[0].cells = parseCsv(text)
      file.content.sheets[0].name = name
      file.content.sheets[0].formats = blankFormats()
      onCreate(file)
    } else if (['txt', 'html', 'htm', 'md'].includes(ext)) {
      const text = await blob.text()
      const file = createFile('doc', name)
      file.content.html = ext === 'html' || ext === 'htm' ? text : `<h1>${name}</h1><p>${text.replace(/\n/g, '</p><p>')}</p>`
      onCreate(file)
    } else {
      onNotify(`${blob.name} ditambahkan ke Drive`)
    }
    event.target.value = ''
  }

  const getHomeContext = () => ({
    files: files.filter((f) => !f.trashed).map((f) => ({ name: f.name, type: f.type })),
  })

  const applyHome = async () => {}

  const askHome = async (prompt) => {
    const q = prompt.toLowerCase()
    if (q.includes('presentasi') || q.includes('outline') || q.includes('dek')) {
      const file = createFile('slides', 'Outline presentasi')
      file.content.slides = [
        { ...file.content.slides[0], title: 'Outline dari agen', subtitle: prompt, kicker: 'AGEN' },
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
      return { message: 'Saya membuat presentasi baru berisi kerangka dek. Silakan buka dan lanjutkan dari sana.' }
    }
    if (q.includes('analisis') || q.includes('spreadsheet') || q.includes('angka')) {
      const sheet = files.find((f) => f.type === 'sheet' && !f.trashed)
      if (sheet) {
        onOpen(sheet)
        return { message: `Membuka ${sheet.name}. Minta agen di dalam spreadsheet untuk menulis catatan analisis.` }
      }
    }
    const doc = files.find((f) => f.type === 'doc' && !f.trashed)
    if (doc) {
      onOpen(doc)
      return { message: `Membuka ${doc.name} agar agen bisa bekerja di dalam dokumen.` }
    }
    return { message: 'Buat Docs, Sheets, atau Slides baru, lalu brief agen di samping file itu.' }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Cloud size={18} strokeWidth={2.5} /></span>
          <span>cloud<span className="brand-light">office</span></span>
        </div>
        <div className="workspace-wrap">
          <button className="workspace-switcher" onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}>
            <span className="workspace-avatar">N</span>
            <span><strong>Northstar Studio</strong><small>Workspace pribadi</small></span>
            <ChevronDown size={15} />
          </button>
          {showWorkspaceMenu && (
            <div className="workspace-menu">
              <button onClick={() => { setShowWorkspaceMenu(false); onNotify('Northstar Studio dipilih') }}>
                <span className="workspace-avatar">N</span>
                <span><strong>Northstar Studio</strong><small>Workspace pribadi</small></span>
                <Check size={14} />
              </button>
              <button onClick={() => { setShowWorkspaceMenu(false); onNotify('Fitur membuat workspace segera hadir') }}>
                <FilePlus2 size={15} /> Buat workspace baru
              </button>
            </div>
          )}
        </div>
        <nav className="nav-list">
          <p className="nav-label">Workspace</p>
          {[['Beranda', LayoutDashboard], ['Drive saya', Library], ['Dibagikan', Users], ['Favorit', Star], ['Sampah', Archive]].map(([label, Icon]) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMobileMenu(false) }}>
              <Icon size={17} /><span>{label}</span>
              {label === 'Favorit' && <em>{files.filter((f) => f.favorite && !f.trashed).length}</em>}
            </button>
          ))}
          <p className="nav-label second">Aplikasi</p>
          <button className="nav-item" onClick={() => onCreate(createFile('doc'))}><FileText size={17} /><span>Docs</span></button>
          <button className="nav-item" onClick={() => onCreate(createFile('sheet'))}><Table2 size={17} /><span>Sheets</span></button>
          <button className="nav-item" onClick={() => onCreate(createFile('slides'))}><Presentation size={17} /><span>Slides</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-label"><span><Cloud size={15} /> Penyimpanan</span><strong>12%</strong></div>
          <div className="storage-bar"><i style={{ width: '12%' }} /></div>
          <small>File tersimpan di perangkat Anda</small>
          <button className="upgrade"><Zap size={14} fill="currentColor" /> Empat aplikasi, satu workspace <ArrowUpRight size={14} /></button>
          <button className="settings" onClick={() => onNotify('Pengaturan workspace segera hadir')}><Settings size={16} /> Pengaturan</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>{activeNav}</span><span className="slash">/</span><strong>Overview</strong></div>
          <div className="top-actions">
            <div className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari dokumen…" />
              <kbd>⌘ K</kbd>
            </div>
            <div className="notification-wrap">
              <button className="icon-button" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18} /><i /></button>
              {showNotifications && (
                <div className="notification-popover">
                  <strong>Notifikasi</strong>
                  <p><span className="dot" /> File tersimpan secara lokal di browser ini</p>
                  <p><span className="dot" /> Agen mengedit di dalam Docs, Sheets, dan Slides</p>
                  <button onClick={() => { setShowNotifications(false); onNotify('Semua notifikasi ditandai sudah dibaca') }}>Tandai sudah dibaca</button>
                </div>
              )}
            </div>
            <div className="user-avatar">RS</div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome">
            <div>
              <p className="eyebrow">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</p>
              <h1>Selamat datang, Rominur<span>.</span></h1>
              <p className="welcome-copy">Docs, Sheets, dan Slides di browser — agen bekerja di dalam file, bukan di jendela obrolan.</p>
            </div>
            <div className="welcome-actions">
              <input ref={fileInput} className="hidden-input" type="file" accept=".doc,.docx,.txt,.html,.xls,.xlsx,.csv,.ppt,.pptx,.pdf" onChange={uploadFile} />
              <button className="outline-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Unggah file</button>
              <div className="create-wrap">
                <button className="primary-button" onClick={() => setShowCreateMenu(!showCreateMenu)}>
                  <FilePlus2 size={17} /> Buat baru <ChevronDown size={15} />
                </button>
                {showCreateMenu && (
                  <div className="create-menu">
                    {templates.map(({ title, type, icon: Icon }) => (
                      <button key={type} onClick={() => { setShowCreateMenu(false); onCreate(createFile(type)) }}>
                        <Icon size={15} /> {title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {activeNav !== 'Sampah' && activeNav !== 'Aktivitas' && (
            <section className="quick-create">
              <div className="section-heading">
                <div>
                  <h2>Empat aplikasi, bukan empat kotak chat</h2>
                  <p>Buka file asli. Brief agen. Dapatkan dokumen jadi.</p>
                </div>
              </div>
              <div className="template-grid">
                {templates.map(({ type, title, detail, icon: Icon }) => (
                  <button key={type} className={`template-card ${type}`} onClick={() => onCreate(createFile(type))}>
                    <span className="template-icon"><Icon size={21} /></span>
                    <span className="template-copy"><strong>{title}</strong><small>{detail}</small></span>
                    <span className="card-arrow"><ArrowUpRight size={15} /></span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="files-section">
            <div className="section-heading">
              <div>
                <h2>{activeNav === 'Sampah' ? 'Sampah' : activeNav === 'Favorit' ? 'Favorit' : 'File di workspace'}</h2>
                <p>{activeNav === 'Sampah' ? 'Pulihkan atau biarkan di sini' : 'Klik untuk membuka di Docs, Sheets, atau Slides'}</p>
              </div>
              <div className="view-toggle">
                <button className={viewMode === 'grid' ? 'selected' : ''} onClick={() => setViewMode('grid')}><Grid2X2 size={15} /></button>
                <button className={viewMode === 'list' ? 'selected' : ''} onClick={() => setViewMode('list')}><FileText size={15} /></button>
              </div>
            </div>
            <div className={`file-table ${viewMode === 'grid' ? 'grid-view' : ''}`}>
              <div className="table-head"><span>Nama</span><span>Pemilik</span><span>Terakhir diedit</span><span></span></div>
              {filtered.map((file) => {
                const Icon = icons[file.type]
                return (
                  <div className="file-row" key={file.id} onClick={() => !file.trashed && onOpen(file)}>
                    <div className="file-name">
                      <span className={`file-icon ${tones[file.type]}`}><Icon size={18} /></span>
                      <span>
                        <strong>{file.name}</strong>
                        <small>{typeLabel(file.type)}</small>
                      </span>
                    </div>
                    <div className="owner"><span className="mini-avatar">{file.owner}</span> Rominur</div>
                    <span className="edited">{formatRelative(file.updatedAt)}</span>
                    <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button onClick={() => onPatch({ ...file, favorite: !file.favorite })}>
                        <Star size={15} fill={file.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => setSelectedFile(selectedFile === file.id ? null : file.id)}><MoreHorizontal size={17} /></button>
                      {selectedFile === file.id && (
                        <div className="file-menu">
                          {!file.trashed && <button onClick={() => { setSelectedFile(null); onOpen(file) }}><FileText size={14} /> Buka</button>}
                          <button onClick={() => { setSelectedFile(null); onNotify('Tautan berhasil disalin'); navigator.clipboard?.writeText(`${location.origin}${location.pathname}${fileHash(file)}`) }}><Copy size={14} /> Salin tautan</button>
                          <button onClick={() => { setSelectedFile(null); onPatch({ ...file, trashed: !file.trashed }) }}>
                            <Archive size={14} /> {file.trashed ? 'Pulihkan' : 'Pindahkan ke sampah'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && <div className="empty-state">Tidak ada file di sini.</div>}
            </div>
          </section>

          <section className="bottom-grid">
            <div className="activity-card">
              <div className="section-heading">
                <div><h2>Aktivitas terbaru</h2><p>Jejak kerja di workspace ini</p></div>
              </div>
              {files.filter((f) => !f.trashed).slice(0, 3).map((file) => (
                <div className="activity-item" key={file.id}>
                  <span className="activity-avatar teal">{file.owner}</span>
                  <p><strong>Anda</strong> menyimpan <b>{file.name}</b><small>{formatRelative(file.updatedAt)}</small></p>
                </div>
              ))}
            </div>
            <div className="tip-card">
              <div className="tip-icon"><Sparkles size={19} /></div>
              <p className="eyebrow">DEEPSEEK V4 FLASH VISION</p>
              <h3>Brief sekali. Dapatkan file jadi.</h3>
              <p>Buka Docs, Sheets, atau Slides. Copilot di kanan file merangkum, menghitung, atau menambah slide — di dalam dokumen yang terbuka.</p>
              <button onClick={() => setShowAssistant(true)}>Buka Copilot <ArrowUpRight size={15} /></button>
            </div>
          </section>
        </div>
      </main>

      {showAssistant && (
        <AgentPanel
          kind="home"
          onClose={() => setShowAssistant(false)}
          getContext={getHomeContext}
          onApply={applyHome}
          onAsk={askHome}
        />
      )}
      {!showAssistant && (
        <button className="ai-fab" onClick={() => setShowAssistant(true)}><Sparkles size={19} /> Copilot</button>
      )}
    </div>
  )
}
