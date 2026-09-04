import { useEffect, useMemo, useState } from 'react'
import {
  Calendar, Inbox, Paperclip, PenLine, Reply, Send, Trash2
} from 'lucide-react'
import FluentShell from '../components/FluentShell.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CopilotMark, OutlookIcon } from '../components/MsApps.jsx'
import { USER } from '../lib/brand.js'
import { askCopilot } from '../lib/copilotClient.js'
import { newId } from '../lib/files.js'

const FOLDERS = [
  { id: 'inbox', label: 'Kotak masuk', icon: <Inbox size={16} /> },
  { id: 'sent', label: 'Terkirim', icon: <Send size={16} /> },
  { id: 'drafts', label: 'Draf', icon: <PenLine size={16} /> },
  { id: 'calendar', label: 'Kalender', icon: <Calendar size={16} /> },
  { id: 'deleted', label: 'Item dihapus', icon: <Trash2 size={16} /> },
]

const SEED = [
  {
    id: 'm1', folder: 'inbox', unread: true, from: 'Andi Pratama', email: 'andi@northstar.id', initials: 'AP',
    subject: 'Re: Rencana Strategis 2025 — tinjauan Copilot', time: '10:24',
    preview: 'Saya sudah baca draf Word-nya. Bisa minta Copilot merapikan bagian metrik?',
    body: 'Rominur,\n\nSaya sudah baca draf Word-nya. Bagian prioritas kuartal sudah kuat. Bisa minta Copilot merapikan bagian metrik agar lebih ringkas untuk dewan?\n\nAndi',
  },
  {
    id: 'm2', folder: 'inbox', unread: true, from: 'Sari Wijaya', email: 'sari@northstar.id', initials: 'SW',
    subject: 'Budget Operasional Q3 perlu baris total', time: 'Kemarin',
    preview: 'Workbook Excel sudah di OneDrive. Tolong Copilot menambahkan SUM dan format Rupiah.',
    body: 'Halo,\n\nWorkbook Excel Budget Operasional Q3 sudah di OneDrive. Tolong Copilot menambahkan baris total dan format Rupiah sebelum rapat Kamis.\n\nSari',
  },
  {
    id: 'm3', folder: 'inbox', unread: false, from: 'Microsoft 365', email: 'noreply@microsoft.com', initials: 'M3',
    subject: 'Lisensi Microsoft 365 F3 aktif', time: 'Sen',
    preview: 'Word, Excel, PowerPoint, Outlook, dan Teams web sudah siap. OneDrive 2 GB.',
    body: 'Langganan Microsoft 365 F3 Anda aktif.\n\nTermasuk aplikasi web Word, Excel, PowerPoint, Outlook, Teams, dan OneDrive 2 GB. Copilot dapat dipakai di dalam file yang terbuka.',
  },
  {
    id: 'm4', folder: 'sent', unread: false, from: USER.name, email: USER.email, initials: USER.initials,
    subject: 'Dek investor — versi web PowerPoint', time: 'Sen',
    preview: 'Saya unggah presentasi ke OneDrive. Copilot sudah menambahkan slide agenda.',
    body: 'Tim,\n\nPresentasi investor sudah di OneDrive (PowerPoint for the web). Copilot menambahkan slide agenda dan catatan pembicara.\n\nRominur',
  },
]

const EVENTS = [
  { time: '09:00', title: 'Stand-up produk', where: 'Teams' },
  { time: '11:30', title: 'Tinjauan budget Q3', where: 'Excel + Teams' },
  { time: '14:00', title: 'Latihan dek investor', where: 'PowerPoint' },
]

const DRAFT_INTENT = /(draf|balas|tulis|susun|reply|draft)/i

function ownMessage(fields) {
  return {
    id: newId('mail'),
    unread: false,
    from: USER.name,
    email: USER.email,
    initials: USER.initials,
    time: 'Baru saja',
    ...fields,
    preview: String(fields.body || '').replace(/\s+/g, ' ').slice(0, 80),
  }
}

export default function OutlookApp({ onNotify }) {
  const [folder, setFolder] = useState('inbox')
  const [selected, setSelected] = useState('m1')
  const [query, setQuery] = useState('')
  const [compose, setCompose] = useState(null)
  const [showCopilot, setShowCopilot] = useState(true)
  const [items, setItems] = useState(SEED)

  const q = query.trim().toLowerCase()
  const list = useMemo(() => items.filter((m) => m.folder === folder
    && (!q || m.subject.toLowerCase().includes(q) || m.from.toLowerCase().includes(q) || m.body.toLowerCase().includes(q))), [items, folder, q])
  const mail = list.find((m) => m.id === selected) || null

  useEffect(() => {
    if (folder === 'calendar') return
    if (!list.some((m) => m.id === selected)) setSelected(list[0]?.id ?? null)
  }, [folder, list, selected])

  const nav = FOLDERS.map((item) => ({
    ...item,
    badge: item.id === 'inbox' ? (items.filter((m) => m.folder === 'inbox' && m.unread).length || undefined) : undefined,
  }))

  const openMail = (item) => {
    if (item.folder === 'drafts') {
      setCompose({ id: item.id, to: item.to || '', subject: item.subject === '(Tanpa subjek)' ? '' : item.subject, body: item.body })
      return
    }
    setSelected(item.id)
    if (item.unread) setItems((all) => all.map((m) => m.id === item.id ? { ...m, unread: false } : m))
  }

  const closeCompose = () => {
    if (!compose) return
    const hasContent = compose.subject.trim() || compose.body.trim() || compose.to.trim()
    if (hasContent) {
      const draft = ownMessage({ id: compose.id || newId('mail'), folder: 'drafts', to: compose.to, subject: compose.subject.trim() || '(Tanpa subjek)', body: compose.body })
      setItems((all) => [draft, ...all.filter((m) => m.id !== draft.id)])
      onNotify?.('Disimpan ke Draf')
    } else if (compose.id) {
      setItems((all) => all.filter((m) => m.id !== compose.id))
    }
    setCompose(null)
  }

  const sendCompose = () => {
    if (!compose) return
    const sent = ownMessage({ folder: 'sent', to: compose.to, subject: compose.subject.trim() || '(Tanpa subjek)', body: compose.body })
    setItems((all) => [sent, ...all.filter((m) => m.id !== compose.id)])
    setCompose(null)
    onNotify?.('Pesan terkirim')
  }

  const moveMail = (item, target) => {
    setItems((all) => all.map((m) => m.id === item.id ? { ...m, folder: target, restoreTo: target === 'deleted' ? item.folder : undefined } : m))
    onNotify?.(target === 'deleted' ? 'Dipindahkan ke Item dihapus' : 'Pesan dipulihkan')
  }

  const localDraft = () => `Terima kasih atas pesannya.\n\nSaya akan menindaklanjuti di Word/Excel yang terkait dan mengirim pembaruan setelah Copilot merapikan file.\n\nSalam,\n${USER.short}`

  const ask = async (prompt) => {
    if (mail && /ringkas|summar|rekap/i.test(prompt)) {
      return { message: `Ringkasan utas: ${mail.from} meminta tindak lanjut pada “${mail.subject}”. ${mail.preview}`, applied: false }
    }
    if (compose && DRAFT_INTENT.test(prompt)) {
      setCompose((c) => ({ ...c, body: localDraft() }))
      return { message: 'Draf balasan ditulis ke jendela susun.' }
    }
    if (mail && DRAFT_INTENT.test(prompt)) {
      setCompose({ to: mail.email, subject: `Re: ${mail.subject}`, body: localDraft() })
      return { message: 'Jendela balasan dibuka dengan draf dari Copilot.' }
    }
    return { message: 'Buka pesan, lalu minta Copilot merangkum atau menyusun balasan.', applied: false }
  }

  const applyCopilot = async (result) => {
    if (!result?.message || !DRAFT_INTENT.test(result.prompt || '')) return false
    if (compose) {
      setCompose((c) => ({ ...c, body: result.message }))
      return true
    }
    if (mail) {
      setCompose({ to: mail.email, subject: `Re: ${mail.subject}`, body: result.message })
      return true
    }
    return false
  }

  return (
    <FluentShell
      app="outlook"
      nav={nav}
      activeNav={folder}
      onNav={(item) => setFolder(item.id)}
      search={query}
      onSearch={setQuery}
      searchPlaceholder="Cari email"
      onNotify={onNotify}
      right={showCopilot ? (
        <AgentPanel kind="outlook" app="Outlook" floating={false} onClose={() => setShowCopilot(false)} getContext={() => ({ folder, subject: mail?.subject, from: mail?.from, body: mail?.body, compose: compose ? { to: compose.to, subject: compose.subject } : null })} onAsk={ask} onApply={applyCopilot} />
      ) : null}
    >
      {folder === 'calendar' ? (
        <div className="outlook-cal">
          <header className="app-page-head">
            <OutlookIcon size={28} />
            <div><h1>Kalender</h1><p>Hari ini · Microsoft 365 F3</p></div>
          </header>
          {EVENTS.map((event) => (
            <div className="cal-row" key={event.title}>
              <strong>{event.time}</strong>
              <div><b>{event.title}</b><small>{event.where}</small></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="outlook-split">
          <section className="mail-list">
            <div className="mail-list-head">
              <button className="primary" onClick={() => setCompose({ to: '', subject: '', body: '' })}>Email baru</button>
              <button className="ghost" onClick={() => setShowCopilot(true)}><CopilotMark size={16} /> Copilot</button>
            </div>
            {list.length === 0 && <p className="muted" style={{ padding: 16 }}>{q ? 'Tidak ada email yang cocok.' : 'Folder ini kosong.'}</p>}
            {list.map((item) => (
              <button key={item.id} className={`mail-item ${selected === item.id ? 'on' : ''} ${item.unread ? 'unread' : ''}`} onClick={() => openMail(item)}>
                <span className="ms-avatar sm">{item.initials}</span>
                <span>
                  <b>{folder === 'drafts' ? `Draf ke: ${item.to || '—'}` : item.from}</b>
                  <strong>{item.subject}</strong>
                  <small>{item.preview}</small>
                </span>
                <em>{item.time}</em>
              </button>
            ))}
          </section>
          <article className="mail-read">
            {compose ? (
              <form className="compose" onSubmit={(event) => { event.preventDefault(); sendCompose() }}>
                <header>
                  <strong>{compose.id ? 'Draf' : 'Pesan baru'}</strong>
                  <button type="button" onClick={closeCompose}>Tutup</button>
                </header>
                <input value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} placeholder="Kepada" />
                <input value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} placeholder="Subjek" />
                <textarea value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} placeholder="Tulis pesan atau minta Copilot menyusun draf" />
                <div className="compose-bar">
                  <button type="submit" className="primary"><Send size={14} /> Kirim</button>
                  <button type="button" className="ghost" onClick={async () => {
                    try {
                      const result = await askCopilot({ kind: 'outlook', prompt: `Susun draf email: ${compose.subject || 'balasan profesional'}`, context: { to: compose.to, subject: compose.subject, replyTo: mail?.body } })
                      setCompose((c) => ({ ...c, body: result.message || c.body }))
                    } catch {
                      setCompose((c) => ({ ...c, body: localDraft() }))
                    }
                  }}><CopilotMark size={16} /> Draf dengan Copilot</button>
                  <button type="button" className="ghost" onClick={() => onNotify?.('Lampiran dari OneDrive: pilih file di Beranda')} aria-label="Lampiran"><Paperclip size={16} /></button>
                </div>
              </form>
            ) : mail ? (
              <>
                <h1>{mail.subject}</h1>
                <div className="mail-meta">
                  <span className="ms-avatar">{mail.initials}</span>
                  <div>
                    <b>{mail.from}</b>
                    <small>{mail.email} · {mail.time}</small>
                  </div>
                  <div className="mail-tools">
                    {folder !== 'deleted' && <button onClick={() => setCompose({ to: mail.email, subject: `Re: ${mail.subject}`, body: '' })}><Reply size={15} /> Balas</button>}
                    <button onClick={async () => {
                      const summary = await ask('ringkas')
                      onNotify?.(summary.message)
                    }}><CopilotMark size={16} /> Ringkas</button>
                    {folder === 'deleted'
                      ? <button onClick={() => moveMail(mail, mail.restoreTo || 'inbox')}>Pulihkan</button>
                      : <button onClick={() => moveMail(mail, 'deleted')}><Trash2 size={15} /> Hapus</button>}
                  </div>
                </div>
                <pre className="mail-body">{mail.body}</pre>
              </>
            ) : <p className="muted">Pilih pesan</p>}
          </article>
        </div>
      )}
    </FluentShell>
  )
}
