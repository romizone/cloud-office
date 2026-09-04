import { useState } from 'react'
import { Calendar, Hash, Phone, Pin, Plus, Send, Users, Video } from 'lucide-react'
import FluentShell from '../components/FluentShell.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CopilotMark, TeamsIcon } from '../components/MsApps.jsx'
import { USER } from '../lib/brand.js'

const CHANNELS = [
  { id: 'general', label: 'Umum', kind: 'channel' },
  { id: 'produk', label: 'Produk', kind: 'channel' },
  { id: 'ops', label: 'Operasi', kind: 'channel' },
]

const CHATS = [
  { id: 'andi', label: 'Andi Pratama', initials: 'AP' },
  { id: 'sari', label: 'Sari Wijaya', initials: 'SW' },
  { id: 'finance', label: 'Tim Finance', initials: 'TF' },
]

const THREADS = {
  general: [
    { who: 'Andi Pratama', initials: 'AP', text: 'Dek investor sudah di OneDrive. Copilot menambahkan slide agenda.', time: '09:12' },
    { who: USER.name, initials: USER.initials, text: 'Saya buka di PowerPoint for the web. Catatan pembicara sudah rapi.', time: '09:18' },
    { who: 'Sari Wijaya', initials: 'SW', text: 'Budget Q3 perlu baris total sebelum rapat 11:30.', time: '09:41' },
  ],
  produk: [
    { who: 'Andi Pratama', initials: 'AP', text: 'Word Online F3 cukup untuk naskah. Jangan unduh desktop — SKU kita web-only.', time: 'Kemarin' },
  ],
  ops: [
    { who: 'Budi Hartono', initials: 'BH', text: 'OneDrive F3 2 GB. Jangan unggah rekaman rapat mentah.', time: 'Sen' },
  ],
  andi: [
    { who: 'Andi Pratama', initials: 'AP', text: 'Bisa minta Copilot merangkum utas Umum sebelum stand-up?', time: '08:55' },
  ],
  sari: [
    { who: 'Sari Wijaya', initials: 'SW', text: 'Saya pin workbook Excel di chat ini.', time: 'Kemarin' },
  ],
  finance: [
    { who: 'Sari Wijaya', initials: 'SW', text: 'Format Rupiah di kolom D, lalu kirim tautan OneDrive.', time: 'Sen' },
  ],
}

export default function TeamsApp({ onNotify }) {
  const [section, setSection] = useState('chat')
  const [room, setRoom] = useState('general')
  const [draft, setDraft] = useState('')
  const [threads, setThreads] = useState(THREADS)
  const [showCopilot, setShowCopilot] = useState(true)

  const nav = [
    { id: 'activity', label: 'Aktivitas', icon: <Pin size={16} /> },
    { id: 'chat', label: 'Obrolan', icon: <Users size={16} /> },
    { id: 'teams', label: 'Tim', icon: <Hash size={16} /> },
    { id: 'calendar', label: 'Kalender', icon: <Calendar size={16} /> },
    { id: 'calls', label: 'Panggilan', icon: <Phone size={16} /> },
  ]

  const posts = threads[room] || []
  const title = [...CHANNELS, ...CHATS].find((item) => item.id === room)?.label || room

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setThreads((all) => ({
      ...all,
      [room]: [...(all[room] || []), { who: USER.name, initials: USER.initials, text, time: 'Baru saja' }],
    }))
    setDraft('')
  }

  const DRAFT_INTENT = /(draf|tulis|balas|susun|draft|reply)/i

  const ask = async (prompt) => {
    if (/ringkas|recap|rangkum|rekap/i.test(prompt)) {
      if (!posts.length) return { message: `Belum ada pesan di ${title}.`, applied: false }
      const recap = posts.map((p) => `${p.who}: ${p.text}`).join(' ')
      return { message: `Rekap ${title}: ${recap.slice(0, 280)}${recap.length > 280 ? '…' : ''}`, applied: false }
    }
    if (/stand-?up/i.test(prompt)) {
      const points = posts.slice(-3).map((p) => `• ${p.text}`).join('\n')
      return { message: points ? `Poin stand-up dari ${title}:\n${points}` : 'Belum ada bahan stand-up di utas ini.', applied: false }
    }
    if (DRAFT_INTENT.test(prompt)) {
      setDraft('Terima kasih — saya tindak lanjuti di file OneDrive dan kabari di utas ini.')
      return { message: 'Draf pesan ditulis ke kotak obrolan.' }
    }
    return { message: 'Minta Copilot merangkum rapat, menyusun draf, atau menyiapkan poin stand-up.', applied: false }
  }

  const applyCopilot = async (result) => {
    if (!result?.message || !DRAFT_INTENT.test(result.prompt || '')) return false
    setDraft(result.message)
    return true
  }

  return (
    <FluentShell
      app="teams"
      nav={nav}
      activeNav={section}
      onNav={(item) => setSection(item.id)}
      search=""
      onSearch={() => {}}
      searchPlaceholder="Cari di Teams"
      onNotify={onNotify}
      right={showCopilot ? (
        <AgentPanel kind="teams" app="Teams" onClose={() => setShowCopilot(false)} getContext={() => ({ room, title, posts })} onAsk={ask} onApply={applyCopilot} />
      ) : null}
    >
      <div className="teams-split">
        <aside className="teams-rooms">
          <div className="app-page-head compact">
            <TeamsIcon size={26} />
            <div><h1>Teams</h1><p>Northstar Studio</p></div>
          </div>
          <p className="nav-label">Saluran</p>
          {CHANNELS.map((item) => (
            <button key={item.id} className={room === item.id ? 'on' : ''} onClick={() => { setRoom(item.id); setSection('teams') }}>
              <Hash size={14} /> {item.label}
            </button>
          ))}
          <p className="nav-label">Obrolan</p>
          {CHATS.map((item) => (
            <button key={item.id} className={room === item.id ? 'on' : ''} onClick={() => { setRoom(item.id); setSection('chat') }}>
              <span className="ms-avatar sm">{item.initials}</span> {item.label}
            </button>
          ))}
        </aside>
        <section className="teams-thread">
          {section === 'calendar' || section === 'calls' ? (
            <div className="teams-empty">
              <Video size={28} />
              <h2>{section === 'calls' ? 'Panggilan Teams' : 'Rapat hari ini'}</h2>
              <p>F3 mendukung rapat dan panggilan di browser. Jadwal tersinkron dengan Outlook.</p>
              <button className="primary" onClick={() => onNotify?.('Tautan rapat Teams disalin')}><Video size={15} /> Gabung rapat</button>
            </div>
          ) : (
            <>
              <header className="thread-head">
                <div>
                  <strong>{CHANNELS.some((c) => c.id === room) ? `# ${title}` : title}</strong>
                  <small>Copilot in Teams · Microsoft 365 F3</small>
                </div>
                <button className="ghost" onClick={() => setShowCopilot(true)}><CopilotMark size={16} /> Copilot</button>
              </header>
              <div className="thread-posts">
                {posts.map((post, i) => (
                  <div className="post" key={i}>
                    <span className="ms-avatar sm">{post.initials}</span>
                    <div>
                      <b>{post.who} <em>{post.time}</em></b>
                      <p>{post.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form className="thread-compose" onSubmit={(event) => { event.preventDefault(); send() }}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Pesan ${title}`} />
                <button type="button" className="fluent-icon" onClick={() => setDraft((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}@`)} aria-label="Sebut orang"><Plus size={16} /></button>
                <button type="submit" className="primary"><Send size={14} /></button>
              </form>
            </>
          )}
        </section>
      </div>
    </FluentShell>
  )
}
