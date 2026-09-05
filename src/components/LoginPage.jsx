import { useEffect, useRef, useState } from 'react'
import { MsLogo, WordIcon, ExcelIcon, PowerPointIcon, PdfIcon } from './MsApps.jsx'
import { fetchAuthConfig, loadGoogleScript, loginWithCredential } from '../lib/auth.js'

export default function LoginPage({ onLogin, onGuest }) {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const buttonHost = useRef(null)

  useEffect(() => {
    let alive = true
    fetchAuthConfig().then((info) => { if (alive) setConfig(info) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!config?.configured || !buttonHost.current) return undefined
    let cancelled = false
    loadGoogleScript().then((google) => {
      if (cancelled || !buttonHost.current) return
      google.accounts.id.initialize({
        client_id: config.clientId,
        ux_mode: 'popup',
        auto_select: false,
        itp_support: true,
        callback: async ({ credential }) => {
          setBusy(true)
          setError('')
          try {
            const user = await loginWithCredential(credential)
            onLogin(user)
          } catch (err) {
            setError(err.message || 'Login gagal')
          } finally {
            setBusy(false)
          }
        },
      })
      buttonHost.current.innerHTML = ''
      google.accounts.id.renderButton(buttonHost.current, { theme: 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', locale: 'id' })
    }).catch((err) => setError(err.message))
    return () => { cancelled = true }
  }, [config])

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <MsLogo size={22} />
          <span>Office Romeo</span>
        </div>
        <h1>Masuk untuk membuka file Anda</h1>
        <p className="login-lead">Dokumen, buku kerja, dan presentasi tersimpan di akun Anda dan bisa dibuka dari perangkat mana pun.</p>
        <div className="login-apps">
          <WordIcon size={30} /><ExcelIcon size={30} /><PowerPointIcon size={30} /><PdfIcon size={30} />
        </div>
        {config === null && <p className="muted">Menyiapkan login…</p>}
        {config && config.configured && (
          <div className="login-google">
            <div ref={buttonHost} className="google-button-host" />
            {busy && <p className="muted">Memverifikasi akun…</p>}
          </div>
        )}
        {config && !config.configured && (
          <div className="login-note">
            <b>Login Google belum diaktifkan.</b>
            <span>Setel <code>GOOGLE_CLIENT_ID</code> dan <code>SESSION_SECRET</code> di server, lalu muat ulang halaman ini.</span>
          </div>
        )}
        {error && <p className="login-error">{error}</p>}
        <button className="login-guest" onClick={onGuest}>Lanjutkan tanpa akun · file hanya tersimpan di perangkat ini</button>
      </div>
      <p className="login-foot">Dengan masuk, Anda menyetujui bahwa file disimpan terenkripsi di penyimpanan Office Romeo untuk akun Anda.</p>
    </div>
  )
}
