import { useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BookOpen, CircleHelp, Columns2, Eye,
  Highlighter, Image, Indent, Italic, Link, List, ListOrdered, MessageSquare,
  Outdent, PenLine, Printer, Replace, Search, Strikethrough, Subscript, Superscript,
  Table2, Type, Underline
} from 'lucide-react'
import { EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import { Ribbon, RibbonBtn, RibbonPick } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CanvasCopilotChip } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { WordIcon } from '../components/MsApps.jsx'
import { exportDoc, exportDocText } from '../lib/export.js'
import { newId } from '../lib/files.js'
import { USER } from '../lib/brand.js'
import { paintHtml, parseFontColor } from '../lib/editIntent.js'
import { asFragment, colorPick, isAnalyzeIntent, isReviseIntent, replacePick, useCanvasPick } from '../lib/canvasPick.js'

const COLORS = ['#17232d', '#c0392b', '#1f6f5b', '#1d4e89', '#b86a1c', '#6b4ea2', '#ffffff']
const HILITES = ['transparent', '#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#f3e8ff']
const FONTS = [
  { value: 'Calibri, "Segoe UI", sans-serif', label: 'Calibri' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Plus Jakarta Sans", sans-serif', label: 'Jakarta Sans' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map((n) => ({ value: String(n), label: `${n}` }))

function run(command, value = null) {
  document.execCommand(command, false, value)
}

export default function DocsEditor({ file, onChange, onBack, onNotify }) {
  const paper = useRef(null)
  const [pick, clearPick, pickRef] = useCanvasPick(paper)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const [title, setTitle] = useState(file.name)
  const [html, setHtml] = useState(file.content.html)
  const [header, setHeader] = useState(file.content.header || 'Northstar Studio')
  const [footer, setFooter] = useState(file.content.footer || '')
  const [comments, setComments] = useState(file.content.comments || [])
  const [findOpen, setFindOpen] = useState(false)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [showAgent, setShowAgent] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const [zoom, setZoom] = useState(file.content.zoom || 100)
  const [columns, setColumns] = useState(file.content.columns || 1)
  const [pageColor, setPageColor] = useState(file.content.pageColor || '#ffffff')
  const [lineHeight, setLineHeight] = useState(file.content.lineHeight || '1.75')
  const [margin, setMargin] = useState(file.content.margin || 'normal')
  const [counts, setCounts] = useState({ words: 0, chars: 0, paras: 0 })
  const [fontName, setFontName] = useState(FONTS[0].value)
  const [fontSize, setFontSize] = useState('12')
  const saved = useSavedFlag(html + title + header + footer + JSON.stringify(comments) + zoom)

  useEffect(() => {
    setTitle(file.name)
    setHtml(file.content.html)
    setHeader(file.content.header || 'Northstar Studio')
    setFooter(file.content.footer || '')
    setComments(file.content.comments || [])
    setZoom(file.content.zoom || 100)
    setColumns(file.content.columns || 1)
    setPageColor(file.content.pageColor || '#ffffff')
    setLineHeight(file.content.lineHeight || '1.75')
    setMargin(file.content.margin || 'normal')
    clearPick()
  }, [file.id])

  const persist = (patch = {}) => {
    const nextHtml = patch.html ?? paper.current?.innerHTML ?? html
    const next = {
      html: nextHtml,
      header: patch.header ?? header,
      footer: patch.footer ?? footer,
      comments: patch.comments ?? comments,
      zoom: patch.zoom ?? zoom,
      columns: patch.columns ?? columns,
      pageColor: patch.pageColor ?? pageColor,
      lineHeight: patch.lineHeight ?? lineHeight,
      margin: patch.margin ?? margin,
    }
    setHtml(nextHtml)
    onChange({ ...file, name: patch.title ?? title, content: next, updatedAt: new Date().toISOString() })
    recount()
  }

  const recount = () => {
    const text = paper.current?.innerText || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const paras = text.split(/\n+/).filter((p) => p.trim()).length
    setCounts({ words, chars: text.length, paras })
  }

  const apply = (command, value) => {
    paper.current?.focus()
    run(command, value)
    persist()
  }

  const insertHtml = (snippet) => {
    paper.current?.focus()
    const before = paper.current?.innerHTML || html
    run('insertHTML', snippet)
    if ((paper.current?.innerHTML || before) === before) {
      const next = `${before}${snippet}`
      if (paper.current) paper.current.innerHTML = next
    }
    persist()
  }

  const writePaper = (nextHtml) => {
    if (!nextHtml) return false
    if (paper.current) paper.current.innerHTML = nextHtml
    persist({ html: nextHtml })
    return true
  }

  const applyTextColor = (color) => {
    const el = paper.current
    if (!el || !color) return false
    if (pickRef.current?.text && colorPick(el, pickRef.current, color)) {
      persist()
      return true
    }
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection.removeAllRanges()
    selection.addRange(range)
    run('foreColor', color)
    selection.removeAllRanges()
    paintHtml(el, color)
    persist()
    return true
  }

  const applyToPick = (html) => {
    if (!pickRef.current?.text || !paper.current) return false
    const ok = replacePick(paper.current, pickRef.current, html)
    if (ok) persist()
    return ok
  }

  const applyCopilot = async (result) => {
    if (pickRef.current?.text) {
      if (result?.color) applyTextColor(result.color)
      const frag = result?.selectionHtml || result?.appendHtml || (result?.html && !/<h1[\s>]/i.test(result.html) ? result.html : null)
      if (frag) return applyToPick(asFragment(frag))
      return Boolean(result?.color)
    }
    if (result?.html) writePaper(result.html)
    else if (result?.appendHtml) writePaper(`${paper.current?.innerHTML || html}${result.appendHtml}`)
    if (result?.color) return applyTextColor(result.color)
    return Boolean(result?.html || result?.appendHtml)
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

  const insertTable = (rows = 3, cols = 3) => {
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>Kolom ${i + 1}</th>`).join('')}</tr>`
    const body = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td></td>').join('')}</tr>`).join('')
    insertHtml(`<table class="doc-table"><thead>${head}</thead><tbody>${body}</tbody></table><p></p>`)
  }

  const addComment = () => {
    const quote = window.getSelection()?.toString() || 'Pilihan'
    const text = window.prompt('Komentar', '')
    if (!text) return
    const next = [...comments, { id: newId('c'), quote: quote.slice(0, 160), text, author: USER.initials, at: new Date().toISOString() }]
    setComments(next)
    setShowComments(true)
    persist({ comments: next })
  }

  const replaceAll = () => {
    if (!find || !paper.current) return
    let count = 0
    const walker = document.createTreeWalker(paper.current, NodeFilter.SHOW_TEXT)
    const nodes = []
    let node
    while ((node = walker.nextNode())) nodes.push(node)
    nodes.forEach((textNode) => {
      if (!textNode.nodeValue.includes(find)) return
      count += textNode.nodeValue.split(find).length - 1
      textNode.nodeValue = textNode.nodeValue.split(find).join(replace)
    })
    if (!count) return onNotify('Teks tidak ditemukan')
    persist()
    onNotify(`${count} kemunculan diganti`)
  }

  const printDoc = () => window.print()

  const getContext = () => ({
    title,
    html: (paper.current?.innerHTML || html).slice(0, 8000),
    text: (paper.current?.innerText || '').slice(0, 4000),
    header,
    footer,
    selection: pickRef.current?.text || '',
    scoped: Boolean(pickRef.current?.text),
  })

  const askAgent = async (prompt) => {
    const color = parseFontColor(prompt)
    const picked = pickRef.current
    if (picked?.text) {
      if (color) {
        applyTextColor(color.value)
        return { message: `Font pada pilihan diubah menjadi ${color.label}.` }
      }
      if (isAnalyzeIntent(prompt) && !isReviseIntent(prompt)) {
        return { message: `Dari pilihan: “${picked.text.slice(0, 360)}${picked.text.length > 360 ? '…' : ''}”` }
      }
      if (isReviseIntent(prompt) || /tulis ulang|buat draf/i.test(prompt)) {
        const cut = picked.text.split(/(?<=[.!?])\s+/)[0] || picked.text
        applyToPick(`<span>${cut.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`)
        return { message: 'Pilihan di kanvas diperbarui. Teks lain tidak diubah.' }
      }
      return { message: `Siap bekerja pada pilihan: “${picked.text.slice(0, 160)}${picked.text.length > 160 ? '…' : ''}”` }
    }
    if (color) {
      applyTextColor(color.value)
      return { message: `Font di kanvas diubah menjadi ${color.label}.` }
    }
    const q = prompt.toLowerCase()
    const current = paper.current?.innerHTML || html
    const text = paper.current?.innerText || ''
    if (q.includes('ringkas') || q.includes('rangkum')) {
      const firstLines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 40).slice(0, 2).join(' ')
      const summary = firstLines || 'dokumen ini menetapkan arah, prioritas, dan cara mengukur kemajuan.'
      const block = `<blockquote>Ringkasan: ${summary.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</blockquote>`
      writePaper(/<\/h1>/i.test(current) ? current.replace(/<\/h1>/i, `</h1>${block}`) : `${block}${current}`)
      return { message: 'Ringkasan ditulis di kanvas, di bawah judul.' }
    }
    if (q.includes('kesimpulan') || q.includes('penutup')) {
      writePaper(`${current}<h2>Kesimpulan</h2><p>Langkah berikutnya adalah mengeksekusi prioritas kuartal ini dan meninjau progres setiap dua minggu.</p>`)
      return { message: 'Bagian kesimpulan ditambahkan di kanvas.' }
    }
    if (q.includes('tabel')) {
      insertTable()
      return { message: 'Tabel disisipkan ke kanvas dokumen.' }
    }
    if (q.includes('daftar isi')) {
      const heads = [...(paper.current?.querySelectorAll('h2') || [])].map((el) => el.innerText.trim()).filter(Boolean)
      if (!heads.length) return { message: 'Belum ada Judul 2 untuk dijadikan daftar isi.', applied: false }
      insertHtml(`<h2>Daftar isi</h2><ol class="toc">${heads.map((h) => `<li>${h.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ol>`)
      return { message: 'Daftar isi disisipkan dari judul yang ada.' }
    }
    if (q.includes('berapa') || q.includes('jumlah kata') || q.includes('hitung')) {
      return { message: `Dokumen ini ${counts.words} kata, ${counts.chars} karakter, ${counts.paras} paragraf.`, applied: false }
    }
    return { message: 'Copilot siaga lokal: minta ringkasan, kesimpulan, tabel, daftar isi, atau warna font. Seleksi teks untuk merevisi bagian tertentu.', applied: false }
  }

  const menus = [
    {
      label: 'File',
      actions: [
        { id: 'print', label: 'Cetak', hint: '⌘P', run: printDoc },
        { id: 'doc', label: 'Unduh Word (.doc)', run: () => exportDoc(title, paper.current?.innerHTML || html) },
        { id: 'txt', label: 'Unduh teks', run: () => exportDocText(title, paper.current?.innerHTML || html) },
      ],
    },
    {
      label: 'Sunting',
      actions: [
        { id: 'undo', label: 'Urungkan', hint: '⌘Z', run: () => apply('undo') },
        { id: 'redo', label: 'Ulangi', run: () => apply('redo') },
        { id: 'find', label: 'Temukan & ganti', hint: '⌘F', run: () => setFindOpen(true) },
      ],
    },
    {
      label: 'Tampilan',
      actions: [
        { id: 'z80', label: 'Zoom 80%', run: () => { setZoom(80); persist({ zoom: 80 }) } },
        { id: 'z100', label: 'Zoom 100%', run: () => { setZoom(100); persist({ zoom: 100 }) } },
        { id: 'z125', label: 'Zoom 125%', run: () => { setZoom(125); persist({ zoom: 125 }) } },
      ],
    },
  ]

  const ribbon = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        {
          label: 'Papan klip',
          items: [
            <RibbonBtn key="u" label="Urungkan" onClick={() => apply('undo')} />,
            <RibbonBtn key="r" label="Ulangi" onClick={() => apply('redo')} />,
          ],
        },
        {
          label: 'Font',
          items: [
            <RibbonPick key="f" width={130} value={fontName} onChange={(v) => { setFontName(v); apply('fontName', v) }} options={FONTS} />,
            <RibbonPick key="s" width={64} value={fontSize} onChange={(v) => {
              setFontSize(v)
              paper.current?.focus()
              run('fontSize', '7')
              paper.current?.querySelectorAll('font[size="7"]').forEach((el) => { el.removeAttribute('size'); el.style.fontSize = `${v}pt` })
              persist()
            }} options={SIZES} />,
            <RibbonBtn key="b" icon={Bold} label="Tebal" onClick={() => apply('bold')} />,
            <RibbonBtn key="i" icon={Italic} label="Miring" onClick={() => apply('italic')} />,
            <RibbonBtn key="un" icon={Underline} label="Garis" onClick={() => apply('underline')} />,
            <RibbonBtn key="st" icon={Strikethrough} label="Coret" onClick={() => apply('strikeThrough')} />,
            <RibbonBtn key="sub" icon={Subscript} label="Sub" onClick={() => apply('subscript')} />,
            <RibbonBtn key="sup" icon={Superscript} label="Super" onClick={() => apply('superscript')} />,
            <span key="c" className="swatches">{COLORS.map((color) => <button key={color} className="swatch" style={{ background: color }} onClick={() => apply('foreColor', color)} />)}</span>,
            <span key="h" className="swatches"><Highlighter size={12} />{HILITES.map((color) => <button key={color} className="swatch" style={{ background: color === 'transparent' ? '#fff' : color }} onClick={() => apply('hiliteColor', color)} />)}</span>,
          ],
        },
        {
          label: 'Paragraf',
          items: [
            <RibbonBtn key="l" icon={AlignLeft} label="Kiri" onClick={() => apply('justifyLeft')} />,
            <RibbonBtn key="c" icon={AlignCenter} label="Tengah" onClick={() => apply('justifyCenter')} />,
            <RibbonBtn key="r" icon={AlignRight} label="Kanan" onClick={() => apply('justifyRight')} />,
            <RibbonBtn key="j" icon={AlignJustify} label="Rata" onClick={() => apply('justifyFull')} />,
            <RibbonBtn key="ul" icon={List} label="Poin" onClick={() => apply('insertUnorderedList')} />,
            <RibbonBtn key="ol" icon={ListOrdered} label="Nomor" onClick={() => apply('insertOrderedList')} />,
            <RibbonBtn key="in" icon={Indent} label="Indent" onClick={() => apply('indent')} />,
            <RibbonBtn key="out" icon={Outdent} label="Outdent" onClick={() => apply('outdent')} />,
            <RibbonPick key="lh" width={90} value={lineHeight} onChange={(v) => { setLineHeight(v); persist({ lineHeight: v }) }} options={[{ value: '1.15', label: '1.15' }, { value: '1.5', label: '1.5' }, { value: '1.75', label: '1.75' }, { value: '2', label: '2.0' }]} />,
          ],
        },
        {
          label: 'Gaya',
          items: [
            <RibbonBtn key="n" label="Normal" onClick={() => apply('formatBlock', 'p')} />,
            <RibbonBtn key="h1" label="Judul 1" onClick={() => apply('formatBlock', 'h1')} />,
            <RibbonBtn key="h2" label="Judul 2" onClick={() => apply('formatBlock', 'h2')} />,
            <RibbonBtn key="h3" label="Judul 3" onClick={() => apply('formatBlock', 'h3')} />,
            <RibbonBtn key="q" label="Kutipan" onClick={() => apply('formatBlock', 'blockquote')} />,
            <RibbonBtn key="clr" label="Hapus format" onClick={() => apply('removeFormat')} />,
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        {
          label: 'Ilustrasi',
          items: [
            <RibbonBtn key="img" icon={Image} label="Gambar" onClick={insertImage} />,
            <RibbonBtn key="link" icon={Link} label="Tautan" onClick={insertLink} />,
            <RibbonBtn key="tbl" icon={Table2} label="Tabel 3×3" onClick={() => insertTable(3, 3)} />,
            <RibbonBtn key="tbl5" icon={Table2} label="Tabel 5×4" onClick={() => insertTable(4, 5)} />,
            <RibbonBtn key="hr" label="Garis" onClick={() => apply('insertHorizontalRule')} />,
            <RibbonBtn key="pb" label="Ganti halaman" onClick={() => insertHtml('<div class="page-break"></div><p></p>')} />,
          ],
        },
        {
          label: 'Teks',
          items: [
            <RibbonBtn key="dt" label="Tanggal" onClick={() => insertHtml(new Date().toLocaleDateString('id-ID', { dateStyle: 'long' }))} />,
            <RibbonBtn key="sym" label="Simbol •" onClick={() => insertHtml('• ')} />,
            <RibbonBtn key="drop" label="Drop cap" onClick={() => insertHtml('<span class="dropcap">A</span>')} />,
          ],
        },
      ],
    },
    {
      id: 'draw',
      label: 'Gambar',
      groups: [
        {
          label: 'Alat gambar',
          items: [
            <RibbonBtn key="pen" icon={PenLine} label="Pena" onClick={() => apply('foreColor', '#185ABD')} />,
            <RibbonBtn key="hi" icon={Highlighter} label="Stabilo" onClick={() => apply('hiliteColor', '#fff3bf')} />,
          ],
        },
      ],
    },
    {
      id: 'layout',
      label: 'Tata Letak',
      groups: [
        {
          label: 'Halaman',
          items: [
            <RibbonBtn key="c1" icon={Columns2} label="1 kolom" onClick={() => { setColumns(1); persist({ columns: 1 }) }} />,
            <RibbonBtn key="c2" icon={Columns2} label="2 kolom" onClick={() => { setColumns(2); persist({ columns: 2 }) }} />,
            <RibbonBtn key="w" label="Kertas putih" onClick={() => { setPageColor('#ffffff'); persist({ pageColor: '#ffffff' }) }} />,
            <RibbonBtn key="iv" label="Kertas gading" onClick={() => { setPageColor('#fbf7ef'); persist({ pageColor: '#fbf7ef' }) }} />,
            <RibbonPick key="m" width={110} value={margin} onChange={(v) => { setMargin(v); persist({ margin: v }) }} options={[{ value: 'narrow', label: 'Sempit' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Lebar' }]} />,
          ],
        },
        {
          label: 'Zoom',
          items: [
            <RibbonPick key="z" width={90} value={String(zoom)} onChange={(v) => { const n = Number(v); setZoom(n); persist({ zoom: n }) }} options={[{ value: '80', label: '80%' }, { value: '100', label: '100%' }, { value: '125', label: '125%' }, { value: '150', label: '150%' }]} />,
          ],
        },
      ],
    },
    {
      id: 'refs',
      label: 'Referensi',
      groups: [
        {
          label: 'Daftar isi',
          items: [
            <RibbonBtn key="toc" icon={BookOpen} label="Daftar isi" onClick={() => {
              const heads = [...(paper.current?.querySelectorAll('h2') || [])].map((el) => el.innerText.trim()).filter(Boolean)
              if (!heads.length) return onNotify('Tambahkan Judul 2 dulu untuk membuat daftar isi')
              insertHtml(`<h2>Daftar isi</h2><ol class="toc">${heads.map((h) => `<li>${h.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ol>`)
            }} />,
          ],
        },
      ],
    },
    {
      id: 'review',
      label: 'Tinjau',
      groups: [
        {
          label: 'Komentar',
          items: [
            <RibbonBtn key="cm" icon={MessageSquare} label="Komentar baru" onClick={addComment} />,
            <RibbonBtn key="cs" icon={MessageSquare} label={showComments ? 'Sembunyikan' : 'Tampilkan'} onClick={() => setShowComments((v) => !v)} />,
          ],
        },
        {
          label: 'Pemeriksaan',
          items: [
            <RibbonBtn key="f" icon={Search} label="Temukan" onClick={() => setFindOpen(true)} />,
            <RibbonBtn key="wc" icon={Type} label={`${counts.words} kata`} onClick={() => onNotify(`${counts.words} kata · ${counts.chars} karakter · ${counts.paras} paragraf`)} />,
            <RibbonBtn key="pr" icon={Printer} label="Cetak" onClick={printDoc} />,
          ],
        },
      ],
    },
    {
      id: 'view',
      label: 'Tampilan',
      groups: [
        {
          label: 'Tata letak',
          items: [
            <RibbonBtn key="print" icon={Eye} label="Tata cetak" onClick={() => { setZoom(100); persist({ zoom: 100 }) }} />,
          ],
        },
      ],
    },
    {
      id: 'help',
      label: 'Bantuan',
      groups: [
        {
          label: 'Microsoft 365',
          items: [
            <RibbonBtn key="f3" icon={CircleHelp} label="Tentang F3" onClick={() => onNotify('Microsoft 365 F3 · Word for the web · OneDrive 2 GB')} />,
          ],
        },
      ],
    },
  ]

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
    <div className={`ed-shell docs-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main">
        <EditorChrome
          kind="doc"
          mark={<WordIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist({ title: value }) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onComments={() => setShowComments((v) => !v)}
          onCopilot={() => setShowAgent((v) => !v)}
        />
        {backstage && (
          <FileBackstage
            kind="doc"
            title={title}
            onClose={() => setBackstage(false)}
            onHome={onBack}
            onPrint={printDoc}
            onExport={() => exportDoc(title, paper.current?.innerHTML || html)}
            onNotify={onNotify}
          />
        )}
        <MenuBar items={menus} />
        <Ribbon tabs={ribbon} accent="word" onFile={() => setBackstage(true)} />
        {findOpen && (
          <div className="find-bar">
            <Search size={14} />
            <input autoFocus value={find} placeholder="Temukan" onChange={(event) => setFind(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && find) { if (!window.find?.(find, false, event.shiftKey, true)) onNotify('Teks tidak ditemukan') }
              if (event.key === 'Escape') setFindOpen(false)
            }} />
            <Replace size={14} />
            <input value={replace} placeholder="Ganti dengan" onChange={(event) => setReplace(event.target.value)} />
            <button onClick={() => { if (find && !window.find?.(find, false, false, true)) onNotify('Teks tidak ditemukan') }}>Berikutnya</button>
            <button onClick={replaceAll}>Ganti semua</button>
            <button onClick={() => setFindOpen(false)}>Tutup</button>
          </div>
        )}
        <div className="paper-workspace">
          <main className="paper-wrap">
            <div className="page-stack" style={{ transform: `scale(${zoom / 100})` }}>
              <div className="page-header" contentEditable suppressContentEditableWarning onBlur={(event) => { const v = event.currentTarget.innerText; setHeader(v); persist({ header: v }) }}>{header}</div>
              <article
                className={`paper cols-${columns} margin-${margin} ${pick?.text ? 'copilot-scoped' : ''}`}
                style={{ background: pageColor, lineHeight }}
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
                onBlur={() => persist()}
                spellCheck
              />
              <div className="page-footer">
                <span contentEditable suppressContentEditableWarning onBlur={(event) => { const v = event.currentTarget.innerText; setFooter(v); persist({ footer: v }) }}>{footer || 'Kaki halaman — klik untuk mengedit'}</span>
                <em>{counts.words} kata</em>
              </div>
            </div>
          </main>
          {showComments && (
            <aside className="comment-rail">
              <strong>Komentar</strong>
              {comments.length === 0 && <p className="muted">Belum ada komentar. Pilih teks, lalu Tinjau → Komentar baru.</p>}
              {comments.map((item) => (
                <div className="comment-card" key={item.id}>
                  <small>{item.author}</small>
                  <b>“{item.quote}”</b>
                  <p>{item.text}</p>
                  <button onClick={() => { const next = comments.filter((c) => c.id !== item.id); setComments(next); persist({ comments: next }) }}>Hapus</button>
                </div>
              ))}
            </aside>
          )}
        </div>
        <footer className="ed-status">
          <span>Halaman 1</span>
          <span>{counts.words} kata</span>
          <span>{counts.chars} karakter</span>
          <span>{counts.paras} paragraf</span>
          {showAgent && <span className="copilot-link-badge">Copilot terhubung{pick?.text ? ' · pilihan' : ''}</span>}
          <button onClick={printDoc}><Printer size={13} /> Cetak</button>
        </footer>
      </div>
      <CanvasCopilotChip pick={pick} onOpen={() => setShowAgent(true)} />
      {showAgent && (
        <AgentPanel kind="doc" app="Word" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={pick?.text || ''} onClearSelection={clearPick} onBusyChange={setCopilotBusy} />
      )}
      {share && <ShareDialog title={`${title}.docx`} onClose={() => setShare(false)} onNotify={onNotify} />}
    </div>
  )
}
