import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Check, FileText, Highlighter, Image,
  Italic, Link, List, ListOrdered, Printer, Search, Table2, Type, Underline
} from 'lucide-react'
import { AgentToggle, EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { exportDoc, exportDocText } from '../lib/export.js'

const COLORS = ['#17232d', '#c0392b', '#1f6f5b', '#1d4e89', '#b86a1c', '#6b4ea2']
const HILITES = ['transparent', '#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3']

function run(command, value = null) {
  document.execCommand(command, false, value)
}

export default function DocsEditor({ file, onChange, onBack, onNotify }) {
  const paper = useRef(null)
  const [title, setTitle] = useState(file.name)
  const [html, setHtml] = useState(file.content.html)
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [showAgent, setShowAgent] = useState(true)
  const [counts, setCounts] = useState({ words: 0, chars: 0 })
  const saved = useSavedFlag(html + title)

  useEffect(() => {
    setTitle(file.name)
    setHtml(file.content.html)
  }, [file.id])

  const persist = (nextHtml = paper.current?.innerHTML ?? html, nextTitle = title) => {
    setHtml(nextHtml)
    onChange({
      ...file,
      name: nextTitle,
      content: { html: nextHtml },
      updatedAt: new Date().toISOString(),
    })
    recount()
  }

  const recount = () => {
    const text = paper.current?.innerText || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    setCounts({ words, chars: text.length })
  }

  const apply = (command, value) => {
    paper.current?.focus()
    run(command, value)
    persist()
  }

  const insertHtml = (snippet) => {
    paper.current?.focus()
    run('insertHTML', snippet)
    persist()
  }

  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const blob = input.files?.[0]
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => insertHtml(`<img src="${reader.result}" alt="" />`)
      reader.readAsDataURL(blob)
    }
    input.click()
  }

  const insertLink = () => {
    const url = window.prompt('Tautan', 'https://')
    if (url) apply('createLink', url)
  }

  const insertTable = () => {
    insertHtml('<table class="doc-table"><thead><tr><th>Kolom 1</th><th>Kolom 2</th><th>Kolom 3</th></tr></thead><tbody><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table><p></p>')
  }

  const printDoc = () => window.print()

  const applyCopilot = async (result) => {
    if (result?.html) {
      paper.current.innerHTML = result.html
      persist(result.html)
      return
    }
    if (result?.appendHtml) {
      const next = `${paper.current?.innerHTML || html}${result.appendHtml}`
      paper.current.innerHTML = next
      persist(next)
    }
  }

  const getContext = () => ({
    title,
    html: (paper.current?.innerHTML || html).slice(0, 8000),
    text: (paper.current?.innerText || '').slice(0, 4000),
  })

  const askAgent = async (prompt) => {
    const q = prompt.toLowerCase()
    const current = paper.current?.innerHTML || html
    if (q.includes('ringkas') || q.includes('summary')) {
      const next = current.replace(
        /<\/h1>/i,
        '</h1><blockquote>Ringkasan agen: dokumen ini menetapkan arah, prioritas kuartal, dan cara mengukur kemajuan — lalu meminta kerja dilanjutkan di dalam file, bukan di luarnya.</blockquote>'
      )
      paper.current.innerHTML = next
      persist(next)
      return { message: 'Saya menambahkan ringkasan tepat di bawah judul. Anda bisa mengedit atau menghapusnya.' }
    }
    if (q.includes('kesimpulan') || q.includes('penutup')) {
      const next = `${current}<h2>Kesimpulan</h2><p>Langkah berikutnya adalah mengeksekusi prioritas kuartal ini, meninjau progres setiap dua minggu, dan memastikan setiap file yang keluar dari workspace ini masih bisa dibuka di aplikasi lain.</p>`
      paper.current.innerHTML = next
      persist(next)
      return { message: 'Kesimpulan ditambahkan di akhir dokumen.' }
    }
    if (q.includes('tabel')) {
      insertTable()
      return { message: 'Tabel prioritas disisipkan di posisi kursor. Isi pemilik dan statusnya.' }
    }
    if (q.includes('judul') || q.includes('heading')) {
      apply('formatBlock', 'h2')
      return { message: 'Paragraf yang dipilih diubah menjadi judul bagian.' }
    }
    const next = `${current}<h2>Catatan agen</h2><p>${prompt.replace(/</g, '')}</p>`
    paper.current.innerHTML = next
    persist(next)
    return { message: 'Briefing Anda saya tempel sebagai bagian baru di akhir dokumen.' }
  }

  const menus = useMemo(() => [
    {
      label: 'File',
      actions: [
        { id: 'print', label: 'Cetak', hint: '⌘P', run: printDoc },
        { id: 'doc', label: 'Unduh sebagai Word (.doc)', run: () => exportDoc(title, paper.current?.innerHTML || html) },
        { id: 'txt', label: 'Unduh sebagai teks', run: () => exportDocText(title, paper.current?.innerHTML || html) },
      ],
    },
    {
      label: 'Sisipkan',
      actions: [
        { id: 'link', label: 'Tautan', run: insertLink },
        { id: 'image', label: 'Gambar', run: insertImage },
        { id: 'table', label: 'Tabel', run: insertTable },
        { id: 'hr', label: 'Garis pemisah', run: () => apply('insertHorizontalRule') },
      ],
    },
    {
      label: 'Format',
      actions: [
        { id: 'p', label: 'Teks biasa', run: () => apply('formatBlock', 'p') },
        { id: 'h1', label: 'Judul 1', run: () => apply('formatBlock', 'h1') },
        { id: 'h2', label: 'Judul 2', run: () => apply('formatBlock', 'h2') },
        { id: 'sep', sep: true },
        { id: 'clear', label: 'Hapus format', run: () => apply('removeFormat') },
      ],
    },
    {
      label: 'Alat',
      actions: [
        { id: 'find', label: 'Temukan', hint: '⌘F', run: () => setFindOpen(true) },
        { id: 'count', label: `${counts.words} kata`, run: () => onNotify(`${counts.words} kata · ${counts.chars} karakter`) },
      ],
    },
  ], [title, html, counts])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFindOpen(true)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        printDoc()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ed-shell docs-app">
      <div className="ed-main">
        <EditorChrome
          icon={FileText}
          tone="blue"
          title={title}
          onTitle={(value) => { setTitle(value); persist(undefined, value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => onNotify('Tautan dokumen siap dibagikan')}
          extra={<AgentToggle onClick={() => setShowAgent((v) => !v)} />}
        />
        <MenuBar items={menus} />
        {findOpen && (
          <div className="find-bar">
            <Search size={14} />
            <input
              autoFocus
              value={find}
              placeholder="Temukan dalam dokumen"
              onChange={(event) => setFind(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') window.find(find, false, event.shiftKey, true)
                if (event.key === 'Escape') setFindOpen(false)
              }}
            />
            <button onClick={() => window.find(find, false, false, true)}>Berikutnya</button>
            <button onClick={() => setFindOpen(false)}>Tutup</button>
          </div>
        )}
        <div className="doc-toolbar">
          <button onClick={() => apply('undo')} title="Undo">↶</button>
          <button onClick={() => apply('redo')} title="Redo">↷</button>
          <i />
          <select defaultValue="p" onChange={(event) => apply('formatBlock', event.target.value)}>
            <option value="p">Teks biasa</option>
            <option value="h1">Judul 1</option>
            <option value="h2">Judul 2</option>
            <option value="h3">Judul 3</option>
            <option value="blockquote">Kutipan</option>
          </select>
          <select defaultValue="3" onChange={(event) => apply('fontSize', event.target.value)}>
            <option value="2">Kecil</option>
            <option value="3">Normal</option>
            <option value="4">Besar</option>
            <option value="5">Lebih besar</option>
            <option value="6">Judul</option>
          </select>
          <i />
          <button onClick={() => apply('bold')}><Bold size={15} /></button>
          <button onClick={() => apply('italic')}><Italic size={15} /></button>
          <button onClick={() => apply('underline')}><Underline size={15} /></button>
          <i />
          <button onClick={() => apply('justifyLeft')}><AlignLeft size={15} /></button>
          <button onClick={() => apply('justifyCenter')}><AlignCenter size={15} /></button>
          <button onClick={() => apply('justifyRight')}><AlignRight size={15} /></button>
          <i />
          <button onClick={() => apply('insertUnorderedList')}><List size={15} /></button>
          <button onClick={() => apply('insertOrderedList')}><ListOrdered size={15} /></button>
          <i />
          <span className="swatches">
            <Type size={13} />
            {COLORS.map((color) => <button key={color} className="swatch" style={{ background: color }} onClick={() => apply('foreColor', color)} />)}
          </span>
          <span className="swatches">
            <Highlighter size={13} />
            {HILITES.map((color) => <button key={color} className="swatch" style={{ background: color === 'transparent' ? '#fff' : color }} onClick={() => apply('hiliteColor', color)} />)}
          </span>
          <i />
          <button onClick={insertLink}><Link size={15} /></button>
          <button onClick={insertImage}><Image size={15} /></button>
          <button onClick={insertTable}><Table2 size={15} /></button>
          <button className="doc-save" onClick={() => { persist(); onNotify('Dokumen tersimpan') }}><Check size={14} /> Simpan</button>
        </div>
        <main className="paper-wrap">
          <article
            className="paper"
            ref={(el) => {
              paper.current = el
              if (el && el.getAttribute('data-id') !== file.id) {
                el.innerHTML = file.content.html
                el.setAttribute('data-id', file.id)
                recount()
              }
            }}
            contentEditable
            suppressContentEditableWarning
            onInput={() => persist()}
            spellCheck
          />
        </main>
        <footer className="ed-status">
          <span>{counts.words} kata</span>
          <span>{counts.chars} karakter</span>
          <button onClick={printDoc}><Printer size={13} /> Cetak</button>
        </footer>
      </div>
      {showAgent && (
        <AgentPanel
          kind="doc"
          floating
          onClose={() => setShowAgent(false)}
          getContext={getContext}
          onApply={applyCopilot}
          onAsk={askAgent}
        />
      )}
    </div>
  )
}
