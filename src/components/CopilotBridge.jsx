import { useLayoutEffect, useState } from 'react'
import { CopilotMark } from './MsApps.jsx'

export function focusCopilotComposer() {
  const el = document.getElementById('copilot-composer')
  if (!el) return
  el.focus()
  const end = el.value?.length || 0
  try { el.setSelectionRange(end, end) } catch { /* not all inputs */ }
}

export function CanvasCopilotChip({ pick, anchor, label = 'Tanya Copilot', onOpen }) {
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      let rect = null
      if (pick?.range) {
        try { rect = pick.range.getBoundingClientRect() } catch { rect = null }
      }
      if ((!rect || (!rect.width && !rect.height)) && anchor) {
        const node = typeof anchor === 'string' ? document.querySelector(anchor) : anchor
        rect = node?.getBoundingClientRect() || null
      }
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setPos(null)
        return
      }
      const panel = document.querySelector('.ai-panel.in-editor')
      const panelLeft = panel?.getBoundingClientRect().left ?? window.innerWidth
      setPos({
        top: Math.min(rect.bottom + 8, window.innerHeight - 44),
        left: Math.max(12, Math.min(rect.left, panelLeft - 168)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [pick, anchor])

  if (!pos) return null
  return (
    <button
      type="button"
      className="canvas-copilot-chip"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onOpen?.()
        window.setTimeout(focusCopilotComposer, 40)
      }}
    >
      <CopilotMark size={14} /> {label}
    </button>
  )
}
