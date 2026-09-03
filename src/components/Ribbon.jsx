import { useState } from 'react'

export function Ribbon({ tabs, accent = 'teal' }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const current = tabs.find((tab) => tab.id === active) || tabs[0]
  return (
    <div className={`ribbon ribbon-${accent}`}>
      <div className="ribbon-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === current.id}
            className={tab.id === current.id ? 'on' : ''}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="ribbon-body">
        {current.groups.map((group) => (
          <div className="ribbon-group" key={group.label}>
            <div className="ribbon-controls">{group.items}</div>
            <span>{group.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RibbonBtn({ label, icon: Icon, onClick, title, wide }) {
  return (
    <button className={`rb ${wide ? 'wide' : ''}`} onClick={onClick} title={title || label} type="button">
      {Icon && <Icon size={16} />}
      <em>{label}</em>
    </button>
  )
}

export function RibbonPick({ value, onChange, options, width }) {
  return (
    <select className="rp" style={width ? { width } : undefined} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}
