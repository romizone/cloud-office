import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Sparkles, Users } from 'lucide-react'

export function EditorChrome({ icon: Icon, tone = 'blue', title, onTitle, saved, onBack, onShare, extra, children }) {
  return (
    <>
      <header className="ed-top">
        <button className="ed-back" onClick={onBack}><ArrowLeft size={17} /> <span>Drive</span></button>
        <div className="ed-file">
          <span className={`ed-file-icon ${tone}`}><Icon size={17} /></span>
          <div>
            <input value={title} onChange={(event) => onTitle(event.target.value)} aria-label="Nama file" />
            <small>{saved ? 'Tersimpan di Cloud Office' : 'Menyimpan perubahan…'}</small>
          </div>
        </div>
        <div className="ed-actions">
          {extra}
          <button className="share-button" onClick={onShare}><Users size={15} /> Bagikan</button>
          <div className="user-avatar">RS</div>
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
            {item.label} {item.chevron && <ChevronDown size={12} />}
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
      <Sparkles size={15} /> Copilot
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
