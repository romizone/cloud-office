import { useEffect, useRef, useState } from 'react'
import { Bell, Grid3X3, Menu, Search, Settings } from 'lucide-react'
import { APPS, SKU, TENANT, USER } from '../lib/brand.js'
import { AppIcon, CopilotMark, MsLogo } from './MsApps.jsx'
import { createFile } from '../lib/files.js'
import { useUser } from '../lib/user.js'

export default function FluentShell({
  app = 'home',
  nav,
  activeNav,
  onNav,
  search,
  onSearch,
  searchPlaceholder = 'Cari di Office Romeo',
  onCreate,
  onNotify,
  right,
  children,
}) {
  const [waffle, setWaffle] = useState(false)
  const [profile, setProfile] = useState(false)
  const [notes, setNotes] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [internalSearch, setInternalSearch] = useState('')
  const searchValue = onSearch ? (search ?? '') : internalSearch
  const topRef = useRef(null)
  const { user, mode, logout, login } = useUser()

  useEffect(() => {
    const close = () => { setWaffle(false); setProfile(false); setNotes(false) }
    const onPointer = (event) => {
      if (!topRef.current?.contains(event.target)) close()
    }
    const onKey = (event) => { if (event.key === 'Escape') { close(); setMobile(false) } }
    window.addEventListener('hashchange', close)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', close)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const go = (item) => {
    setWaffle(false)
    if (item.create && onCreate) onCreate(createFile(item.create))
    else location.hash = item.route
  }

  return (
    <div className={`fluent-shell app-${app}`}>
      <header className="fluent-top" ref={topRef}>
        <button className="fluent-icon mobile-only" onClick={() => setMobile((v) => !v)} aria-label="Menu"><Menu size={18} /></button>
        <div className="waffle-wrap">
          <button className="fluent-icon" onClick={() => { setWaffle((v) => !v); setProfile(false); setNotes(false) }} aria-label="Peluncur aplikasi" title="Peluncur aplikasi" aria-expanded={waffle}>
            <Grid3X3 size={18} />
          </button>
          {waffle && (
            <div className="waffle-menu">
              <p>Aplikasi</p>
              <div className="waffle-grid">
                {APPS.map((item) => (
                  <button key={item.id} onClick={() => go(item)}>
                    <AppIcon app={item.id} size={32} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <a className="fluent-brand" href="#/">
          <MsLogo size={18} />
          <span>Office Romeo</span>
          <em>F3</em>
        </a>
        <div className="fluent-search">
          <Search size={16} />
          <input value={searchValue} onChange={(event) => (onSearch || setInternalSearch)(event.target.value)} placeholder={searchPlaceholder} />
        </div>
        <div className="fluent-actions">
          <a className="copilot-chip" href="#/copilot" title="Copilot">
            <CopilotMark size={18} />
            <span>Copilot</span>
          </a>
          <button className="fluent-icon" onClick={() => { setNotes((v) => !v); setProfile(false); setWaffle(false) }} aria-label="Notifikasi" aria-expanded={notes}><Bell size={18} />{!notes && <i />}</button>
          <button className="fluent-icon" onClick={() => onNotify?.('Pengaturan Office Romeo F3')} aria-label="Pengaturan"><Settings size={18} /></button>
          <button className="ms-avatar" onClick={() => { setProfile((v) => !v); setNotes(false); setWaffle(false) }} title={USER.email} aria-label="Akun" aria-expanded={profile}>{user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : USER.initials}</button>
          {notes && (
            <div className="fluent-pop notes-pop">
              <strong>Notifikasi</strong>
              <p>Simpan otomatis aktif di OneDrive (2 GB, F3).</p>
              <p>Copilot tersedia di Word, Excel, PowerPoint, Outlook, dan Teams.</p>
              <button onClick={() => setNotes(false)}>Tandai sudah dibaca</button>
            </div>
          )}
          {profile && (
            <div className="fluent-pop profile-pop">
              <div className="profile-head">
                <span className="ms-avatar lg">{user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : USER.initials}</span>
                <div>
                  <b>{USER.name}</b>
                  <small>{USER.email}</small>
                  <small>{mode === 'cloud' ? 'File tersimpan di akun Anda' : 'Mode tamu · file di perangkat ini'}</small>
                </div>
              </div>
              <button onClick={() => { setProfile(false); onNotify?.(SKU.detail) }}>Lisensi: {SKU.name}</button>
              {mode === 'cloud'
                ? <button className="primary signout" onClick={() => { setProfile(false); logout() }}>Keluar</button>
                : <button className="primary signout" onClick={() => { setProfile(false); login() }}>Masuk dengan Google</button>}
            </div>
          )}
        </div>
      </header>
      <div className="fluent-body">
        <aside className={`fluent-nav ${mobile ? 'open' : ''}`}>
          {(nav || []).map((item) => (
            <button
              key={item.id}
              className={activeNav === item.id ? 'on' : ''}
              onClick={() => { onNav?.(item); setMobile(false) }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge != null && <em>{item.badge}</em>}
            </button>
          ))}
          <div className="nav-sku">
            <span>{SKU.name}</span>
            <small>245 MB dari 2 GB</small>
            <div className="storage-bar"><i style={{ width: '12%' }} /></div>
          </div>
        </aside>
        <main className="fluent-main">{children}</main>
        {right}
      </div>
    </div>
  )
}
