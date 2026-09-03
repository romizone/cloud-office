import { useEffect, useState } from 'react'
import { Bot, Check, Send, Sparkles, X } from 'lucide-react'
import { askCopilot, copilotHealth } from '../lib/copilotClient.js'

const SUGGESTIONS = {
  doc: [
    'Ringkas dokumen ini',
    'Tambahkan kesimpulan',
    'Sisipkan tabel prioritas',
  ],
  sheet: [
    'Tambahkan baris total',
    'Format kolom sebagai Rupiah',
    'Jelaskan apa yang ditunjukkan data ini',
  ],
  slides: [
    'Tambahkan slide agenda',
    'Buat catatan pembicara',
    'Tambahkan slide penutup',
  ],
  pdf: [
    'Ringkas halaman ini',
    'Tandai risiko di kontrak',
    'Buatkan daftar kewajiban',
  ],
  home: [
    'Ringkas dokumen terakhir saya',
    'Buat outline presentasi',
    'Analisis spreadsheet saya',
  ],
}

export default function AgentPanel({ kind = 'home', onClose, onAsk, onApply, getContext, floating = false }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [configured, setConfigured] = useState(null)

  useEffect(() => {
    copilotHealth().then((info) => setConfigured(Boolean(info.configured)))
  }, [])

  const submit = async (text) => {
    const q = (text ?? prompt).trim()
    if (!q || busy) return
    setPrompt('')
    setMessages((list) => [...list, { role: 'user', text: q }])
    setBusy(true)
    let message = 'Siap. Perubahan diterapkan ke file yang terbuka.'
    try {
      const result = await askCopilot({
        kind,
        prompt: q,
        context: getContext?.() || {},
        history: messages.slice(-6),
      })
      await onApply?.(result)
      if (result?.message) message = result.message
    } catch {
      try {
        const fallback = await onAsk?.(q)
        if (fallback?.message) message = `${fallback.message} (mode lokal)`
      } catch {
        message = 'Copilot tidak bisa menerapkan perubahan itu. Coba briefing yang lebih spesifik.'
      }
    }
    setMessages((list) => [...list, { role: 'ai', text: message }])
    setBusy(false)
  }

  return (
    <aside className={`ai-panel ${floating ? 'in-editor' : ''}`}>
      <div className="ai-header">
        <div className="ai-title">
          <span className="ai-orb"><Sparkles size={17} /></span>
          <span>
            <strong>DeepSeek V4 Flash Vision</strong>
            <small>Copilot di dalam file · {configured ? 'gateway server' : 'siap siaga lokal'}</small>
          </span>
        </div>
        {onClose && <button onClick={onClose} aria-label="Tutup copilot"><X size={17} /></button>}
      </div>
      <div className="ai-body">
        <div className="ai-intro">
          <span className="ai-big-orb"><Bot size={23} /></span>
          <h3>Briefing, bukan obrolan</h3>
          <p>Minta ringkasan, rumus, tabel, atau slide. Model bekerja di dokumen yang terbuka.</p>
        </div>
        <div className="suggestion-list">
          {(SUGGESTIONS[kind] || SUGGESTIONS.home).map((item) => (
            <button key={item} onClick={() => submit(item)}>{item}</button>
          ))}
        </div>
        {messages.map((message, index) => (
          <div className="message-pair" key={index}>
            {message.role === 'user' ? (
              <div className="user-message">{message.text}</div>
            ) : (
              <div className="ai-message"><span className="tiny-orb"><Sparkles size={12} /></span>{message.text}</div>
            )}
          </div>
        ))}
        {busy && <div className="ai-message typing">DeepSeek sedang bekerja di file…</div>}
      </div>
      <form className="ai-input" onSubmit={(event) => { event.preventDefault(); submit() }}>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Briefing untuk Copilot…" rows="2" />
        <div>
          <small>Powered by DeepSeek V4 Flash Vision <Check size={12} /></small>
          <button type="submit" aria-label="Kirim"><Send size={16} /></button>
        </div>
      </form>
    </aside>
  )
}
