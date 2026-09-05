import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { askCopilot, copilotHealth, didPatchCanvas } from '../lib/copilotClient.js'
import { looksLikeRefusal, parseFontColor } from '../lib/editIntent.js'
import { CopilotMark } from './MsApps.jsx'

const APP_LABEL = {
  doc: 'Word',
  sheet: 'Excel',
  slides: 'PowerPoint',
  pdf: 'PDF',
  home: 'Office Romeo',
  outlook: 'Outlook',
  teams: 'Teams',
  work: 'Office Romeo',
}

const SUGGESTIONS = {
  doc: [
    'Tulis draf dari catatan ini',
    'Ringkas dokumen ini',
    'Tulis ulang agar lebih ringkas',
    'Ubah nada menjadi formal',
  ],
  sheet: [
    'Analisis data ini',
    'Tambahkan baris total',
    'Format kolom sebagai Rupiah',
    'Buat bagan dari pilihan',
  ],
  slides: [
    'Buat presentasi dari briefing ini',
    'Tambahkan slide agenda',
    'Tulis catatan pembicara',
    'Tambahkan slide penutup',
  ],
  pdf: [
    'Ringkas halaman ini',
    'Tandai risiko di kontrak',
    'Buatkan daftar kewajiban',
  ],
  home: [
    'Apa yang baru di file saya?',
    'Buat outline presentasi',
    'Analisis spreadsheet saya',
  ],
  outlook: [
    'Ringkas utas ini',
    'Susun draf balasan',
    'Ubah nada menjadi formal',
  ],
  teams: [
    'Rekap percakapan ini',
    'Susun draf pesan',
    'Siapkan poin stand-up',
  ],
}

const MODES = [
  { id: 'ask', label: 'Tanya' },
  { id: 'draft', label: 'Draf' },
  { id: 'rewrite', label: 'Tulis ulang' },
]

// Kinds whose "patch" is the message itself (a draft or a recap written into the app).
const MESSAGE_KINDS = ['outlook', 'teams']

export default function AgentPanel({ kind = 'home', app, onClose, onAsk, onApply, getContext, floating = false, selectionText = '', selectionLabel = '', onClearSelection, onBusyChange }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('ask')
  const configuredRef = useRef(null)
  const bodyRef = useRef(null)
  const label = app || APP_LABEL[kind] || 'Office Romeo'

  useEffect(() => {
    let alive = true
    copilotHealth().then((info) => {
      if (!alive) return
      configuredRef.current = Boolean(info.configured)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const runLocal = async (brief) => {
    if (!onAsk) return null
    try {
      return (await onAsk(brief)) || {}
    } catch {
      return { message: 'Copilot tidak bisa menerapkan perubahan itu. Coba briefing yang lebih spesifik.' }
    }
  }

  const submit = async (text) => {
    const q = (text ?? prompt).trim()
    if (!q || busy) return
    const brief = mode === 'rewrite' ? `Tulis ulang: ${q}` : mode === 'draft' ? `Buat draf: ${q}` : q
    setPrompt('')
    setMessages((list) => [...list, { role: 'user', text: q }])
    setBusy(true)

    let message = ''
    let applied = false
    let handled = false

    // Health probe runs at mount; if it has not answered yet, try the gateway anyway (it fails fast when unconfigured).
    if (configuredRef.current !== false) {
      try {
        const result = await askCopilot({
          kind,
          prompt: brief,
          context: {
            ...(getContext?.() || {}),
            ...(selectionText ? { selection: selectionText, scoped: true } : {}),
          },
          history: messages.slice(-6),
        })
        const intent = parseFontColor(q)
        if (intent && !result.color) result.color = intent.value
        const refusal = looksLikeRefusal(result?.message)
        const patched = didPatchCanvas(kind, result)
        if (patched || (MESSAGE_KINDS.includes(kind) && result?.message)) {
          const ok = await onApply?.({ ...result, prompt: brief })
          applied = ok !== false
          handled = true
        }
        if (result?.message && !refusal) {
          message = result.message
          handled = true
        }
      } catch {
        handled = false
      }
    }

    if (!handled) {
      const fallback = await runLocal(brief)
      if (fallback) {
        applied = fallback.applied ?? Boolean(fallback.message)
        if (fallback.message) message = fallback.message
      }
    }

    if (!message) {
      message = applied
        ? 'Perubahan diterapkan ke file yang terbuka.'
        : 'Tidak ada perubahan di kanvas. Coba briefing yang lebih spesifik.'
    }
    setMessages((list) => [...list, { role: 'ai', text: message }])
    setBusy(false)
  }

  return (
    <aside className={`ai-panel ${floating ? 'in-editor' : ''} ${selectionText ? 'has-pick' : ''} ${busy ? 'is-busy' : ''}`}>
      <div className="ai-header">
        <div className="ai-title">
          <CopilotMark size={22} />
          <span>
            <strong>Copilot</strong>
            <small>
              <i className="copilot-live" />
              {busy ? `menulis di kanvas ${label}` : `terhubung ke kanvas ${label}`}
            </small>
          </span>
        </div>
        {onClose && <button onClick={onClose} aria-label="Tutup Copilot"><X size={16} /></button>}
      </div>
      <div className="copilot-modes">
        {MODES.map((item) => (
          <button key={item.id} className={mode === item.id ? 'on' : ''} onClick={() => setMode(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="ai-body" ref={bodyRef}>
        {messages.length === 0 && (
          <>
            <div className="ai-intro">
              <CopilotMark size={36} />
              <h3>Hai, saya Copilot</h3>
              <p>Saya terhubung ke kanvas {label}. Seleksi teks di tengah, lalu Enter untuk merevisi atau menganalisis pilihan itu.</p>
            </div>
            <div className="suggestion-list">
              {(SUGGESTIONS[kind] || SUGGESTIONS.home).map((item) => (
                <button key={item} onClick={() => submit(item)}>{item}</button>
              ))}
            </div>
          </>
        )}
        {messages.map((message, index) => (
          <div className="message-pair" key={index}>
            {message.role === 'user' ? (
              <div className="user-message">{message.text}</div>
            ) : (
              <div className="ai-message"><CopilotMark size={16} />{message.text}</div>
            )}
          </div>
        ))}
        {busy && <div className="ai-message typing">Copilot sedang menulis di kanvas {label}…</div>}
      </div>
      <form className="ai-input" onSubmit={(event) => { event.preventDefault(); submit() }}>
        {selectionText ? (
          <div className="copilot-pick">
            <span>Pilihan: {selectionLabel || `“${selectionText.slice(0, 72)}${selectionText.length > 72 ? '…' : ''}”`}</span>
            {onClearSelection && <button type="button" onClick={onClearSelection} aria-label="Hapus pilihan">×</button>}
          </div>
        ) : null}
        <textarea
          id="copilot-composer"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={selectionText ? 'Enter untuk merevisi atau menganalisis pilihan…' : `Tanya Copilot di kanvas ${label}…`}
          rows="2"
        />
        <div>
          <small>Enter kirim · Shift+Enter baris baru</small>
          <button type="submit" aria-label="Kirim" disabled={busy}><Send size={14} /></button>
        </div>
      </form>
    </aside>
  )
}
