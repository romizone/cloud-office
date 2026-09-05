import { useState } from 'react'
import { Calendar, FileText, Home, Mail, Sparkles } from 'lucide-react'
import FluentShell from '../components/FluentShell.jsx'
import { CopilotMark } from '../components/MsApps.jsx'
import { USER, greeting } from '../lib/brand.js'
import { askCopilot } from '../lib/copilotClient.js'
import { createFile } from '../lib/files.js'

const CHIPS = [
  'Apa yang baru di file saya hari ini?',
  'Buat draf email status untuk tim',
  'Ringkas Rencana Strategis 2025',
  'Siapkan poin rapat budget Q3',
]

export default function CopilotWork({ files, onOpen, onCreate, onNotify }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)

  const nav = [
    { id: 'copilot', label: 'Copilot', icon: <CopilotMark size={16} /> },
    { id: 'home', label: 'Beranda', icon: <Home size={16} /> },
    { id: 'work', label: 'File kerja', icon: <FileText size={16} /> },
    { id: 'mail', label: 'Outlook', icon: <Mail size={16} /> },
    { id: 'cal', label: 'Kalender', icon: <Calendar size={16} /> },
  ]

  const submit = async (text) => {
    const q = (text ?? prompt).trim()
    if (!q || busy) return
    setPrompt('')
    setMessages((list) => [...list, { role: 'user', text: q }])
    setBusy(true)
    let reply = ''
    const lower = q.toLowerCase()
    try {
      const result = await askCopilot({
        kind: 'work',
        prompt: q,
        context: { files: files.filter((f) => !f.trashed).map((f) => ({ name: f.name, type: f.type })) },
        history: messages.slice(-6),
      })
      reply = result.message || ''
    } catch {
      if (lower.includes('email') || lower.includes('draf')) {
        location.hash = '#/outlook'
        reply = 'Saya membuka Outlook untuk menyusun draf. Copilot di panel kanan bisa menulis balasan.'
      } else if (lower.includes('presentasi') || lower.includes('dek')) {
        const file = createFile('slides', 'Outline dari Copilot')
        onCreate(file)
        reply = 'Saya membuat presentasi PowerPoint baru dari briefing Anda.'
      } else if (lower.includes('budget') || lower.includes('excel')) {
        const sheet = files.find((f) => f.type === 'sheet' && !f.trashed)
        if (sheet) { onOpen(sheet); reply = `Membuka ${sheet.name} di Excel for the web.` }
        else reply = 'Tidak ada workbook. Buat Excel baru dari Beranda.'
      } else if (lower.includes('ringkas') || lower.includes('strateg')) {
        const doc = files.find((f) => f.type === 'doc' && !f.trashed)
        if (doc) { onOpen(doc); reply = `Membuka ${doc.name} di Word. Copilot di kanan file bisa merangkum di kanvas.` }
        else reply = 'Buka Word, lalu minta Copilot merangkum dokumen yang terbuka.'
      } else {
        reply = 'Saya Copilot Office Romeo. Minta ringkasan file, draf email, atau buat Word/Excel/PowerPoint baru.'
      }
    }
    if (!reply) reply = 'Siap. Buka file di Word, Excel, atau PowerPoint agar Copilot bisa mengedit di dalam dokumen.'
    setMessages((list) => [...list, { role: 'ai', text: reply }])
    setBusy(false)
  }

  return (
    <FluentShell
      app="copilot"
      nav={nav}
      activeNav="copilot"
      onNav={(item) => {
        if (item.id === 'home' || item.id === 'work') location.hash = '#/'
        if (item.id === 'mail') location.hash = '#/outlook'
        if (item.id === 'cal') location.hash = '#/outlook'
      }}
      search=""
      onSearch={() => {}}
      searchPlaceholder="Cari percakapan Copilot"
      onNotify={onNotify}
    >
      <div className="copilot-work">
        <div className="copilot-hero">
          <CopilotMark size={42} />
          <h1>{greeting()}</h1>
          <p>Copilot untuk Office Romeo F3 · bekerja di Word, Excel, PowerPoint, Outlook, dan Teams</p>
        </div>
        <form className="copilot-composer" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <Sparkles size={18} />
          <textarea
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Tanya Copilot tentang file, email, atau rapat Anda… Enter untuk kirim"
          />
          <button type="submit" className="primary">Kirim</button>
        </form>
        <div className="chip-row">
          {CHIPS.map((item) => <button key={item} onClick={() => submit(item)}>{item}</button>)}
        </div>
        <div className="copilot-thread">
          {messages.map((message, i) => (
            <div key={i} className={`cw-msg ${message.role}`}>{message.text}</div>
          ))}
          {busy && <div className="cw-msg ai">Copilot sedang meninjau file kerja Anda…</div>}
        </div>
      </div>
    </FluentShell>
  )
}
