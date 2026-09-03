import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import DriveApp from './DriveApp.jsx'
import DocsEditor from './editors/DocsEditor.jsx'
import SheetsEditor from './editors/SheetsEditor.jsx'
import SlidesEditor from './editors/SlidesEditor.jsx'
import PdfEditor from './editors/PdfEditor.jsx'
import { fileHash, loadFiles, parseHash, saveFiles } from './lib/files.js'

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [files, setFiles] = useState(loadFiles)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector('.search input')?.focus()
      }
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => saveFiles(files), 280)
    return () => window.clearTimeout(timer)
  }, [files])

  const notify = (text) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 2600)
  }

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

  if (route.view !== 'home' && !current) {
    if (route.id) queueMicrotask(goHome)
  }

  let editor = null
  if (current?.type === 'doc') {
    editor = <DocsEditor file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'sheet') {
    editor = <SheetsEditor file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'slides') {
    editor = <SlidesEditor file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  } else if (current?.type === 'pdf') {
    editor = <PdfEditor file={current} onChange={upsert} onBack={goHome} onNotify={notify} />
  }

  return (
    <>
      {editor || (
        <DriveApp
          files={files}
          onOpen={openFile}
          onCreate={createAndOpen}
          onPatch={upsert}
          onNotify={notify}
        />
      )}
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </>
  )
}
