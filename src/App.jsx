import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import DriveApp from './DriveApp.jsx'
import DocsEditor from './editors/DocsEditor.jsx'
import SheetsEditor from './editors/SheetsEditor.jsx'
import SlidesEditor from './editors/SlidesEditor.jsx'
import PdfEditor from './editors/PdfEditor.jsx'
import OutlookApp from './apps/OutlookApp.jsx'
import TeamsApp from './apps/TeamsApp.jsx'
import CopilotWork from './apps/CopilotWork.jsx'
import LoginPage from './components/LoginPage.jsx'
import { fileHash, loadFiles, parseHash, saveFiles, seedFiles } from './lib/files.js'
import { fetchSession, loadRemoteFiles, logout as apiLogout, saveRemoteFiles } from './lib/auth.js'
import { UserContext, applyUser } from './lib/user.js'

const GUEST_KEY = 'office-romeo-guest'

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [files, setFiles] = useState(loadFiles)
  const [toast, setToast] = useState('')
  // auth: 'loading' | 'signed-out' | 'guest' | 'cloud'
  const [auth, setAuth] = useState('loading')
  const [user, setUser] = useState(null)
  const [cloudReady, setCloudReady] = useState(false)
  const toastTimer = useRef(null)
  const saveWarned = useRef(false)
  const dirty = useRef(false)
  const lastSaved = useRef('')

  const notify = (text) => {
    if (!text) return
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector('.fluent-search input')?.focus()
      }
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(toastTimer.current)
    }
  }, [])

  // Restore the session on load.
  useEffect(() => {
    let alive = true
    fetchSession().then(async (session) => {
      if (!alive) return
      if (session) {
        await enterCloud(session)
      } else if (sessionStorage.getItem(GUEST_KEY) === '1') {
        setAuth('guest')
      } else {
        setAuth('signed-out')
      }
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enterCloud = async (session) => {
    setUser(session)
    applyUser(session)
    setCloudReady(false)
    setAuth('cloud')
    try {
      const remote = await loadRemoteFiles()
      if (Array.isArray(remote) && remote.length) {
        setFiles(remote)
        lastSaved.current = JSON.stringify(remote)
      } else {
        // First sign-in: start from what this device already had (or the starter files) and store it in the account.
        const initial = loadFiles()
        setFiles(initial)
        lastSaved.current = ''
        dirty.current = true
      }
    } catch (error) {
      notify(error.message || 'File akun tidak dapat dimuat')
      setFiles(seedFiles())
    } finally {
      setCloudReady(true)
    }
  }

  const handleLogin = (session) => {
    sessionStorage.removeItem(GUEST_KEY)
    enterCloud(session)
    notify(`Selamat datang, ${session.name || session.email}`)
  }

  const handleGuest = () => {
    sessionStorage.setItem(GUEST_KEY, '1')
    applyUser(null)
    setUser(null)
    setFiles(loadFiles())
    setAuth('guest')
  }

  const handleLogout = async () => {
    await flushCloud()
    await apiLogout()
    sessionStorage.removeItem(GUEST_KEY)
    applyUser(null)
    setUser(null)
    setFiles(seedFiles())
    setAuth('signed-out')
    location.hash = '#/'
  }

  const flushCloud = async () => {
    if (auth !== 'cloud' || !cloudReady) return
    const json = JSON.stringify(files)
    if (json === lastSaved.current) return
    try {
      await saveRemoteFiles(files)
      lastSaved.current = json
      dirty.current = false
    } catch (error) {
      if (error.status === 401) {
        notify('Sesi berakhir. Silakan masuk lagi.')
        setAuth('signed-out')
      } else if (!saveWarned.current) {
        saveWarned.current = true
        notify(error.message || 'Gagal menyimpan ke akun')
      }
    }
  }

  // Persist: cloud account (debounced) or this device (guest).
  useEffect(() => {
    if (auth === 'guest') {
      const timer = window.setTimeout(() => {
        const ok = saveFiles(files)
        if (ok) saveWarned.current = false
        else if (!saveWarned.current) {
          saveWarned.current = true
          notify('Penyimpanan browser penuh. Perubahan terbaru tidak tersimpan.')
        }
      }, 280)
      return () => window.clearTimeout(timer)
    }
    if (auth === 'cloud' && cloudReady) {
      const json = JSON.stringify(files)
      if (json === lastSaved.current) return undefined
      dirty.current = true
      const timer = window.setTimeout(async () => {
        try {
          await saveRemoteFiles(files)
          lastSaved.current = json
          dirty.current = false
          saveWarned.current = false
        } catch (error) {
          if (error.status === 401) {
            notify('Sesi berakhir. Silakan masuk lagi.')
            setAuth('signed-out')
          } else if (!saveWarned.current) {
            saveWarned.current = true
            notify(error.message || 'Gagal menyimpan ke akun')
          }
        }
      }, 900)
      return () => window.clearTimeout(timer)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, auth, cloudReady])

  // Warn before leaving with unsaved cloud changes.
  useEffect(() => {
    const onLeave = (event) => {
      if (auth === 'cloud' && dirty.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [auth])

  const upsert = (file) => {
    setFiles((list) => {
      const exists = list.some((item) => item.id === file.id)
      return exists ? list.map((item) => item.id === file.id ? file : item) : [file, ...list]
    })
  }

  const openFile = (file) => {
    location.hash = fileHash(file)
  }

  const goHome = () => {
    location.hash = '#/'
  }

  const createAndOpen = (file) => {
    upsert(file)
    openFile(file)
  }

  const current = files.find((file) => file.id === route.id && !file.trashed)
  const missingFile = Boolean(route.id) && !current && auth !== 'loading' && (auth !== 'cloud' || cloudReady)

  useEffect(() => {
    if (missingFile) goHome()
  }, [missingFile, route.id])

  if (auth === 'loading' || (auth === 'cloud' && !cloudReady)) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ alignItems: 'center' }}>
          <p className="muted">{auth === 'cloud' ? 'Memuat file akun Anda…' : 'Memeriksa sesi…'}</p>
        </div>
      </div>
    )
  }

  if (auth === 'signed-out') {
    return wrap(<LoginPage onLogin={handleLogin} onGuest={handleGuest} />, toast)
  }

  const drive = (
    <DriveApp
      files={files}
      view={route.view}
      onOpen={openFile}
      onCreate={createAndOpen}
      onPatch={upsert}
      onNotify={notify}
    />
  )

  let node
  if (route.view === 'outlook') node = <OutlookApp onNotify={notify} />
  else if (route.view === 'teams') node = <TeamsApp onNotify={notify} />
  else if (route.view === 'copilot') node = <CopilotWork files={files} onOpen={openFile} onCreate={createAndOpen} onNotify={notify} />
  else if (route.view === 'onedrive' || route.view === 'sharepoint' || route.view === 'apps') node = drive
  else if (current?.type === 'doc') node = <DocsEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  else if (current?.type === 'sheet') node = <SheetsEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  else if (current?.type === 'slides') node = <SlidesEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  else if (current?.type === 'pdf') node = <PdfEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  else node = drive

  return (
    <UserContext.Provider value={{ user, mode: auth, logout: handleLogout, login: () => { sessionStorage.removeItem(GUEST_KEY); setAuth('signed-out') } }}>
      {wrap(node, toast)}
    </UserContext.Provider>
  )
}

function wrap(node, toast) {
  return (
    <>
      {node}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </>
  )
}
