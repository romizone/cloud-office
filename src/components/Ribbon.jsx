import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Office 365 (web) style ribbon.
 * - Tab row with the app accent underline and a right-side slot (editing mode, etc).
 * - "Simplified" single-line ribbon (Office web default) or the classic grouped ribbon.
 * - Items adapt to the mode through RibbonContext.
 */
const RibbonContext = createContext({ simplified: true })
const StackContext = createContext(false)
const MODE_KEY = 'office-ribbon-mode'

function readMode() {
  try { return localStorage.getItem(MODE_KEY) !== 'classic' } catch { return true }
}

export function Ribbon({ tabs, accent = 'word', activeTab, onTab, onFile, right, defaultTab }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id)
  const [simplified, setSimplified] = useState(readMode)
  const currentId = activeTab ?? active
  const current = tabs.find((tab) => tab.id === currentId) || tabs[0]

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, simplified ? 'simple' : 'classic') } catch { /* ignore */ }
  }, [simplified])

  const pick = (id) => {
    setActive(id)
    onTab?.(id)
  }

  return (
    <RibbonContext.Provider value={{ simplified }}>
      <div className={`ribbon ribbon-${accent} ${simplified ? 'ribbon-simple' : 'ribbon-classic'}`}>
        <div className="ribbon-tabs" role="tablist">
          <button className="ribbon-tab file-tab" type="button" onClick={() => onFile?.()}>File</button>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === current.id}
              className={`ribbon-tab ${tab.id === current.id ? 'on' : ''}`}
              onClick={() => pick(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <div className="ribbon-tabs-right">{right}</div>
        </div>
        <div className="ribbon-body">
          <div className="ribbon-groups">
            {current.groups.map((group, index) => (
              <div className="ribbon-group" key={group.id || group.label || index}>
                <div className="ribbon-controls">{group.items}</div>
                {!simplified && <span className="ribbon-group-label">{group.label}</span>}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ribbon-mode"
            onClick={() => setSimplified((v) => !v)}
            title={simplified ? 'Ganti ke ribbon klasik' : 'Ganti ke ribbon sederhana'}
            aria-label="Tata letak ribbon"
          >
            {simplified ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
    </RibbonContext.Provider>
  )
}

export function useRibbonMode() {
  return useContext(RibbonContext)
}

/* ---------- dropdown plumbing ---------- */

function useDropdown() {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const pop = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchor.current) return
    const rect = anchor.current.getBoundingClientRect()
    const width = pop.current?.offsetWidth || 220
    const height = pop.current?.offsetHeight || 200
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const top = rect.bottom + 4 + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (anchor.current?.contains(event.target) || pop.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return { open, setOpen, anchor, pop, pos }
}

function Pop({ dd, className = '', children, width }) {
  if (!dd.open) return null
  return (
    <div ref={dd.pop} className={`ribbon-pop ${className}`} style={{ top: dd.pos.top, left: dd.pos.left, width }} onMouseDown={(event) => event.stopPropagation()}>
      {children}
    </div>
  )
}

/* ---------- buttons ---------- */

function Face({ icon: Icon, label, showLabel, big, simplified, caret }) {
  return (
    <>
      {Icon && <Icon size={big && !simplified ? 22 : 16} />}
      {(showLabel || (big && !simplified)) && <em>{label}</em>}
      {caret && <ChevronDown size={11} className="rb-caret" />}
    </>
  )
}

export function RBtn({ icon, label, onClick, title, big = false, active = false, disabled = false, showLabel, className = '' }) {
  const { simplified } = useRibbonMode()
  const inStack = useContext(StackContext)
  const labelVisible = showLabel ?? (!simplified && !big && inStack)
  return (
    <button
      type="button"
      className={`rb ${big && !simplified ? 'big' : 'small'} ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      title={title || label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
    >
      <Face icon={icon} label={label} showLabel={labelVisible} big={big} simplified={simplified} />
    </button>
  )
}

/** Dropdown menu button. `items`: {id,label,icon,run,active,sep,hint,disabled}. `split` adds a primary action. */
export function RMenu({ icon, label, title, big = false, items = [], children, width, split, onClick, active, showLabel, className = '' }) {
  const { simplified } = useRibbonMode()
  const inStack = useContext(StackContext)
  const dd = useDropdown()
  const labelVisible = showLabel ?? (!simplified && !big && inStack)
  const face = <Face icon={icon} label={label} showLabel={labelVisible} big={big} simplified={simplified} caret={!split} />
  return (
    <div className={`rb-wrap ${split ? 'split' : ''} ${big && !simplified ? 'big' : ''} ${className}`} ref={dd.anchor}>
      {split ? (
        <>
          <button type="button" className={`rb ${big && !simplified ? 'big' : 'small'} ${active ? 'active' : ''}`} onClick={onClick} title={title || label} aria-label={label} onMouseDown={(event) => event.preventDefault()}>
            {face}
          </button>
          <button type="button" className={`rb rb-split-caret ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} aria-label={`${label}: opsi`} onMouseDown={(event) => event.preventDefault()}>
            <ChevronDown size={11} />
          </button>
        </>
      ) : (
        <button type="button" className={`rb ${big && !simplified ? 'big' : 'small'} ${active ? 'active' : ''} ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} title={title || label} aria-label={label} aria-expanded={dd.open} onMouseDown={(event) => event.preventDefault()}>
          {face}
        </button>
      )}
      <Pop dd={dd} width={width}>
        {children ? (typeof children === 'function' ? children(() => dd.setOpen(false)) : children) : (
          <div className="ribbon-menu">
            {items.map((item, index) => item.sep ? <hr key={`sep-${index}`} /> : (
              <button
                key={item.id || item.label}
                type="button"
                className={`${item.active ? 'active' : ''} ${item.danger ? 'danger' : ''}`}
                disabled={item.disabled}
                onClick={() => { dd.setOpen(false); item.run?.() }}
              >
                {item.icon ? <item.icon size={15} /> : <span className="menu-ico">{item.active ? <Check size={14} /> : null}</span>}
                <span>{item.label}</span>
                {item.hint && <kbd>{item.hint}</kbd>}
                {item.swatch && <i className="menu-swatch" style={{ background: item.swatch }} />}
              </button>
            ))}
          </div>
        )}
      </Pop>
    </div>
  )
}

const THEME_COLORS = [
  '#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47',
  '#f2f2f2', '#7f7f7f', '#d0cece', '#d6dce4', '#d9e2f3', '#fbe5d5', '#ededed', '#fff2cc', '#deebf6', '#e2efd9',
  '#d8d8d8', '#595959', '#aeaaaa', '#adb9ca', '#b4c6e7', '#f7cbac', '#dbdbdb', '#fee599', '#bdd7ee', '#c5e0b3',
  '#bfbfbf', '#3f3f3f', '#757070', '#8496b0', '#8eaadb', '#f4b183', '#c9c9c9', '#ffd965', '#9dc3e6', '#a8d08d',
  '#a5a5a5', '#262626', '#3a3838', '#323f4f', '#2f5496', '#c55a11', '#7b7b7b', '#bf9000', '#2e75b5', '#538135',
  '#7f7f7f', '#0c0c0c', '#171616', '#222a35', '#1f3864', '#833c0b', '#525252', '#7f6000', '#1e4e79', '#375623',
]
const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0']

/** Color picker (font color, highlight, fill). Keeps the last color on the split face like Office. */
export function RColor({ icon, label, title, value, onPick, big = false, autoLabel = 'Otomatis', auto = '', highlight = false, showLabel }) {
  const { simplified } = useRibbonMode()
  const inStack = useContext(StackContext)
  const dd = useDropdown()
  const labelVisible = showLabel ?? (!simplified && !big && inStack)
  const palette = highlight ? ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000'] : null
  const pick = (color) => { dd.setOpen(false); onPick(color) }
  return (
    <div className={`rb-wrap split ${big && !simplified ? 'big' : ''}`} ref={dd.anchor}>
      <button type="button" className={`rb ${big && !simplified ? 'big' : 'small'} rb-color`} onClick={() => onPick(value)} title={title || label} aria-label={label} onMouseDown={(event) => event.preventDefault()}>
        <span className="rb-color-face">
          <Face icon={icon} label={label} showLabel={labelVisible} big={big} simplified={simplified} />
          <i className="rb-color-bar" style={{ background: value || (highlight ? 'transparent' : '#242424') }} />
        </span>
      </button>
      <button type="button" className={`rb rb-split-caret ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} aria-label={`${label}: pilih warna`} onMouseDown={(event) => event.preventDefault()}>
        <ChevronDown size={11} />
      </button>
      <Pop dd={dd} className="ribbon-colors">
        <button type="button" className="color-auto" onClick={() => pick(auto)}>
          <i style={{ background: auto || (highlight ? 'transparent' : '#242424') }} /> {autoLabel}
        </button>
        {palette ? (
          <>
            <p>Warna sorotan</p>
            <div className="color-grid cols-5">{palette.map((c) => <button key={c} type="button" style={{ background: c }} title={c} className={value === c ? 'on' : ''} onClick={() => pick(c)} />)}</div>
          </>
        ) : (
          <>
            <p>Warna tema</p>
            <div className="color-grid">{THEME_COLORS.map((c, i) => <button key={`${c}-${i}`} type="button" style={{ background: c }} title={c} className={value === c ? 'on' : ''} onClick={() => pick(c)} />)}</div>
            <p>Warna standar</p>
            <div className="color-grid">{STANDARD_COLORS.map((c) => <button key={c} type="button" style={{ background: c }} title={c} className={value === c ? 'on' : ''} onClick={() => pick(c)} />)}</div>
          </>
        )}
        <label className="color-custom">
          Warna lainnya…
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#242424'} onChange={(event) => pick(event.target.value)} />
        </label>
      </Pop>
    </div>
  )
}

/** Office-style combobox (font, size, number format, ...). */
export function RPick({ value, onChange, options, width, title, className = '' }) {
  return (
    <select className={`rp ${className}`} style={width ? { width } : undefined} value={value} onChange={(event) => onChange(event.target.value)} title={title} aria-label={title}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

/** Small numeric stepper (zoom, spacing, decimals). */
export function RNum({ value, onChange, min = 0, max = 999, step = 1, suffix = '', title, width = 64 }) {
  return (
    <span className="rnum" title={title}>
      <input type="number" value={value} min={min} max={max} step={step} style={{ width }} aria-label={title} onChange={(event) => onChange(Number(event.target.value))} />
      {suffix && <em>{suffix}</em>}
    </span>
  )
}

/** Table size grid picker (Insert → Table). */
export function RGridPick({ icon, label, title, big = false, onPick, rows = 8, cols = 10 }) {
  const { simplified } = useRibbonMode()
  const dd = useDropdown()
  const [hover, setHover] = useState({ r: 0, c: 0 })
  return (
    <div className={`rb-wrap ${big && !simplified ? 'big' : ''}`} ref={dd.anchor}>
      <button type="button" className={`rb ${big && !simplified ? 'big' : 'small'} ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} title={title || label} aria-label={label} onMouseDown={(event) => event.preventDefault()}>
        <Face icon={icon} label={label} showLabel={false} big={big} simplified={simplified} caret />
      </button>
      <Pop dd={dd} className="ribbon-gridpick">
        <p>{hover.r && hover.c ? `Tabel ${hover.c} × ${hover.r}` : 'Sisipkan tabel'}</p>
        <div className="gridpick" style={{ gridTemplateColumns: `repeat(${cols}, 18px)` }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols) + 1
            const c = (i % cols) + 1
            return (
              <button
                key={i}
                type="button"
                className={r <= hover.r && c <= hover.c ? 'on' : ''}
                onMouseEnter={() => setHover({ r, c })}
                onClick={() => { dd.setOpen(false); onPick(r, c) }}
                aria-label={`${c} kolom × ${r} baris`}
              />
            )
          })}
        </div>
      </Pop>
    </div>
  )
}

/** Gallery dropdown (styles, layouts, themes). items: {id,label,preview,run,active} */
export function RGallery({ icon, label, title, big = false, items, cols = 3, width, showLabel }) {
  const { simplified } = useRibbonMode()
  const inStack = useContext(StackContext)
  const dd = useDropdown()
  return (
    <div className={`rb-wrap ${big && !simplified ? 'big' : ''}`} ref={dd.anchor}>
      <button type="button" className={`rb ${big && !simplified ? 'big' : 'small'} ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} title={title || label} aria-label={label} onMouseDown={(event) => event.preventDefault()}>
        <Face icon={icon} label={label} showLabel={showLabel ?? (!simplified && !big && inStack)} big={big} simplified={simplified} caret />
      </button>
      <Pop dd={dd} className="ribbon-gallery" width={width}>
        <div className="gallery-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {items.map((item) => (
            <button key={item.id} type="button" className={item.active ? 'on' : ''} onClick={() => { dd.setOpen(false); item.run() }} title={item.label}>
              <span className="gallery-preview">{item.preview}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </div>
      </Pop>
    </div>
  )
}

export function RSep() {
  return <i className="rb-sep" aria-hidden />
}

/** Vertical stack of small buttons (classic mode) — renders inline in simplified mode. */
export function RStack({ children }) {
  const { simplified } = useRibbonMode()
  return (
    <StackContext.Provider value={!simplified}>
      <div className={simplified ? 'rb-inline' : 'rb-stack'}>{children}</div>
    </StackContext.Provider>
  )
}

/** Right-side "Editing ▾" mode switcher used by all three apps. */
export function EditingMode({ value, onChange, options }) {
  const dd = useDropdown()
  const current = options.find((o) => o.id === value) || options[0]
  return (
    <div className="rb-wrap" ref={dd.anchor}>
      <button type="button" className={`ribbon-editmode ${dd.open ? 'open' : ''}`} onClick={() => dd.setOpen((v) => !v)} aria-expanded={dd.open}>
        {current.icon && <current.icon size={15} />} {current.label} <ChevronDown size={12} />
      </button>
      <Pop dd={dd} width={260}>
        <div className="ribbon-menu modes">
          {options.map((option) => (
            <button key={option.id} type="button" className={option.id === value ? 'active' : ''} onClick={() => { dd.setOpen(false); onChange(option.id) }}>
              {option.icon ? <option.icon size={16} /> : <span className="menu-ico" />}
              <span><b>{option.label}</b><small>{option.detail}</small></span>
              {option.id === value && <Check size={14} />}
            </button>
          ))}
        </div>
      </Pop>
    </div>
  )
}

// Back-compat aliases for older call sites.
export const RibbonBtn = ({ icon, label, onClick, title, wide }) => <RBtn icon={icon} label={label} onClick={onClick} title={title} className={wide ? 'wide' : ''} />
export const RibbonPick = RPick
