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
import { fileHash, loadFiles, parseHash, saveFiles } from './lib/files.js'

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [files, setFiles] = useState(loadFiles)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const saveWarned = useRef(false)

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

  const notify = (text) => {
    if (!text) return
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ok = saveFiles(files)
      if (ok) {
        saveWarned.current = false
      } else if (!saveWarned.current) {
        saveWarned.current = true
        notify('Penyimpanan browser penuh. Perubahan terbaru tidak tersimpan.')
      }
    }, 280)
    return () => window.clearTimeout(timer)
  }, [files])

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
  const missingFile = Boolean(route.id) && !current

  useEffect(() => {
    if (missingFile) goHome()
  }, [missingFile, route.id])

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

  if (route.view === 'outlook') {
    return wrap(<OutlookApp onNotify={notify} />, toast)
  }
  if (route.view === 'teams') {
    return wrap(<TeamsApp onNotify={notify} />, toast)
  }
  if (route.view === 'copilot') {
    return wrap(<CopilotWork files={files} onOpen={openFile} onCreate={createAndOpen} onNotify={notify} />, toast)
  }
  if (route.view === 'onedrive' || route.view === 'sharepoint' || route.view === 'apps') {
    return wrap(drive, toast)
  }

  let editor = null
  if (current?.type === 'doc') {
    editor = <DocsEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'sheet') {
    editor = <SheetsEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'slides') {
    editor = <SlidesEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'pdf') {
    editor = <PdfEditor key={current.id} file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  }

  return wrap(editor || drive, toast)
}

function wrap(node, toast) {
  return (
    <>
      {node}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </>
  )
}
