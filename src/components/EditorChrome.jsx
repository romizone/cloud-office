import { useEffect, useRef, useState } from 'react'
import { Cloud, MessageSquare } from 'lucide-react'
import { CopilotMark } from './MsApps.jsx'
import { APP_NAME, EXT, USER } from '../lib/brand.js'

export function EditorChrome({
  kind = 'doc',
  mark,
  title,
  onTitle,
  saved,
  onBack,
  onShare,
  onComments,
  extra,
  children,
  onCopilot,
}) {
  const app = APP_NAME[kind] || 'Office'
  const ext = EXT[kind] || 'docx'
  return (
    <>
      <header className={`ed-top accent-${kind}`}>
        <button className="ed-appmark" onClick={onBack} title="Office Romeo">
          {mark}
        </button>
        <div className="ed-file">
          <div>
            <span className="ed-name-row">
              <input value={title} onChange={(event) => onTitle(event.target.value)} aria-label="Nama file" />
              <em>.{ext}</em>
            </span>
            <small>
              <Cloud size={11} />
              {saved ? `Simpan otomatis · OneDrive · ${app}` : 'Menyimpan ke OneDrive…'}
            </small>
          </div>
        </div>
        <div className="ed-actions">
          {extra}
          {onComments && (
            <button className="ghost" onClick={onComments}><MessageSquare size={14} /> Komentar</button>
          )}
          <button className="share-button" onClick={onShare}>Bagikan</button>
          {onCopilot && (
            <button className="agent-toggle" onClick={onCopilot}>
              <CopilotMark size={16} /> Copilot
            </button>
          )}
          <div className="ms-avatar sm" title={USER.email}>{USER.initials}</div>
        </div>
      </header>
      {children}
    </>
  )
}

export function MenuBar({ items }) {
  const [open, setOpen] = useState(null)
  const wrap = useRef(null)

  useEffect(() => {
    const close = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="ed-menubar" ref={wrap}>
      {items.map((item) => (
        <div className="ed-menu" key={item.label}>
          <button className={open === item.label ? 'on' : ''} onClick={() => setOpen(open === item.label ? null : item.label)}>
            {item.label}
          </button>
          {open === item.label && (
            <div className="ed-menu-pop">
              {item.actions.map((action) => action.sep ? (
                <hr key={action.id} />
              ) : (
                <button key={action.id} onClick={() => { setOpen(null); action.run() }}>
                  {action.label}
                  {action.hint && <kbd>{action.hint}</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function AgentToggle({ onClick }) {
  return (
    <button className="agent-toggle" onClick={onClick}>
      <CopilotMark size={16} /> Copilot
    </button>
  )
}

export function useSavedFlag(value) {
  const [saved, setSaved] = useState(true)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaved(false)
    const timer = window.setTimeout(() => setSaved(true), 700)
    return () => window.clearTimeout(timer)
  }, [value])
  return saved
}
