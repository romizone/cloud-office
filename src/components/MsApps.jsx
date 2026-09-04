export function MsLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <rect x="0" y="0" width="8" height="8" fill="#F25022" />
      <rect x="10" y="0" width="8" height="8" fill="#7FBA00" />
      <rect x="0" y="10" width="8" height="8" fill="#00A4EF" />
      <rect x="10" y="10" width="8" height="8" fill="#FFB900" />
    </svg>
  )
}

export function CopilotMark({ size = 22 }) {
  const id = `cp-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0F6CBD" />
          <stop offset="40%" stopColor="#7B83EB" />
          <stop offset="70%" stopColor="#B4A0FF" />
          <stop offset="100%" stopColor="#E6A0C8" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.2 13.7 8.4 20 9.2 15.2 13.4 16.8 20 12 16.6 7.2 20 8.8 13.4 4 9.2 10.3 8.4 12 2.2Z"
      />
    </svg>
  )
}

function Tile({ bg, children, size = 32, radius = 6 }) {
  return (
    <span className="ms-tile" style={{ width: size, height: size, background: bg, borderRadius: radius }}>
      {children}
    </span>
  )
}

export function WordIcon({ size = 32 }) {
  return (
    <Tile bg="#185ABD" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72}>
        <path fill="#fff" d="M7 8h5.2l1.7 8.6L16 8h4l2.1 8.6L23.8 8H29L25 24h-4.4L18 14.2 15.4 24H11L7 8z" />
      </svg>
    </Tile>
  )
}

export function ExcelIcon({ size = 32 }) {
  return (
    <Tile bg="#107C41" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.7} height={size * 0.7}>
        <path fill="#fff" d="M9 8h5.4l3.1 5.6L20.8 8H27l-6.2 8L27 24h-6.3l-3.3-5.8L14.2 24H9l6.3-8L9 8z" />
      </svg>
    </Tile>
  )
}

export function PowerPointIcon({ size = 32 }) {
  return (
    <Tile bg="#C43E1C" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62}>
        <path fill="#fff" d="M10 8h7.4c4.2 0 6.8 2.4 6.8 6.1 0 3.8-2.8 6.1-7.1 6.1H15.2V24H10V8zm5.2 8.4h1.8c2 0 3.1-1 3.1-2.4s-1.1-2.3-3.1-2.3h-1.8v4.7z" />
      </svg>
    </Tile>
  )
}

export function OutlookIcon({ size = 32 }) {
  return (
    <Tile bg="#0F6CBD" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.7} height={size * 0.7}>
        <path fill="#fff" d="M8 10.2 16 16l8-5.8V8H8v2.2zM8 13.1V24h16V13.1L16 19l-8-5.9z" />
      </svg>
    </Tile>
  )
}

export function TeamsIcon({ size = 32 }) {
  return (
    <Tile bg="#5B5FC7" size={size} radius={size * 0.28}>
      <svg viewBox="0 0 32 32" width={size * 0.7} height={size * 0.7}>
        <circle cx="12" cy="11" r="4" fill="#fff" />
        <circle cx="21" cy="12.5" r="3" fill="#d7daf7" />
        <path fill="#fff" d="M6 24c0-4 3.2-6.5 8-6.5s8 2.5 8 6.5H6z" />
      </svg>
    </Tile>
  )
}

export function OneDriveIcon({ size = 32 }) {
  return (
    <Tile bg="#0078D4" size={size} radius={size * 0.5}>
      <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72}>
        <path fill="#fff" d="M11 21c-3 0-5.5-2.3-5.5-5.2 0-2.6 1.9-4.8 4.4-5.2C11 8.4 13.2 7 16 7c3.2 0 5.9 2.2 6.6 5.2 3 .3 5.4 2.8 5.4 5.8 0 3.2-2.6 5-5.8 5H11z" />
      </svg>
    </Tile>
  )
}

export function SharePointIcon({ size = 32 }) {
  return (
    <Tile bg="#038387" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.7} height={size * 0.7}>
        <circle cx="12" cy="12" r="5" fill="#fff" />
        <circle cx="21" cy="14" r="3.5" fill="#c5eceb" />
        <circle cx="16" cy="21" r="4" fill="#e6f6f5" />
      </svg>
    </Tile>
  )
}

export function PdfIcon({ size = 32 }) {
  return (
    <Tile bg="#D13438" size={size}>
      <svg viewBox="0 0 32 32" width={size * 0.7} height={size * 0.7}>
        <path fill="#fff" d="M9 8h9l5 5v11H9V8zm9 1.4V14h4.4L18 9.4z" />
      </svg>
    </Tile>
  )
}

const MAP = {
  doc: WordIcon,
  sheet: ExcelIcon,
  slides: PowerPointIcon,
  pdf: PdfIcon,
  word: WordIcon,
  excel: ExcelIcon,
  powerpoint: PowerPointIcon,
  outlook: OutlookIcon,
  teams: TeamsIcon,
  onedrive: OneDriveIcon,
  copilot: CopilotMark,
  sharepoint: SharePointIcon,
}

export function AppIcon({ app, size = 32 }) {
  const Icon = MAP[app] || WordIcon
  return <Icon size={size} />
}
