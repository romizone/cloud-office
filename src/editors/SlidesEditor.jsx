import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, ChevronUp, Copy, Eye, EyeOff, FilePlus2, Image, LayoutGrid, Play,
  Square, Table2, Trash2
} from 'lucide-react'
import { EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import { Ribbon, RibbonBtn, RibbonPick } from '../components/Ribbon.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { CanvasCopilotChip } from '../components/CopilotBridge.jsx'
import FileBackstage from '../components/FileBackstage.jsx'
import ShareDialog from '../components/ShareDialog.jsx'
import { PowerPointIcon } from '../components/MsApps.jsx'
import { newId } from '../lib/files.js'
import { exportPptx } from '../lib/export.js'
import { asFragment, isAnalyzeIntent, isReviseIntent, replacePick, useCanvasPick } from '../lib/canvasPick.js'

const THEMES = [
  { id: 'northstar', label: 'Northstar' },
  { id: 'ink', label: 'Ink' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'paper', label: 'Paper' },
  { id: 'rose', label: 'Rose' },
]

const LAYOUTS = [
  { id: 'title', label: 'Judul' },
  { id: 'content', label: 'Judul + isi' },
  { id: 'split', label: 'Dua kolom' },
  { id: 'section', label: 'Bagian' },
  { id: 'picture', label: 'Gambar' },
  { id: 'table', label: 'Tabel' },
  { id: 'blank', label: 'Kosong' },
]

const TRANSITIONS = [
  { id: 'none', label: 'Tanpa transisi' },
  { id: 'fade', label: 'Pudar' },
  { id: 'push', label: 'Geser' },
]

function blankSlide(layout = 'content') {
  return {
    id: newId('s'),
    layout,
    kicker: 'CLOUD OFFICE',
    title: layout === 'section' ? 'Bagian baru' : 'Judul slide',
    subtitle: 'Subtitel',
    body: 'Poin pertama\nPoin kedua\nPoin ketiga',
    extra: 'Kolom kanan',
    notes: '',
    hidden: false,
    image: '',
    table: [['', '', ''], ['', '', ''], ['', '', '']],
  }
}

function SlideCanvas({ slide, theme, onChange, present, transition }) {
  const set = (patch) => onChange({ ...slide, ...patch })
  const bullets = (text) => String(text || '').split('\n')
  const field = (value, key, className, tag = 'div') => {
    const Tag = tag
    if (present) return <Tag className={className}>{value}</Tag>
    return (
      <Tag className={className} contentEditable suppressContentEditableWarning onBlur={(event) => set({ [key]: event.currentTarget.innerText })}>
        {value}
      </Tag>
    )
  }

  return (
    <div className={`sl-canvas ${theme} ${slide.layout} ${present ? 'presenting' : ''} trans-${transition || 'none'}`}>
      {slide.layout !== 'blank' && field(slide.kicker, 'kicker', 'sl-kicker')}
      {field(slide.title, 'title', 'sl-title', 'h1')}
      {(slide.layout === 'title' || slide.layout === 'section') && field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
      {slide.layout === 'content' && (
        <ul className="sl-body">
          {bullets(slide.body).map((line, i) => (
            <li key={i}>{present ? line : (
              <span contentEditable suppressContentEditableWarning onBlur={(event) => {
                const next = bullets(slide.body)
                next[i] = event.currentTarget.innerText
                set({ body: next.join('\n') })
              }}>{line}</span>
            )}</li>
          ))}
        </ul>
      )}
      {slide.layout === 'split' && (
        <div className="sl-split">
          <div>
            {bullets(slide.body).map((line, i) => (
              <p key={i} contentEditable={!present} suppressContentEditableWarning onBlur={(event) => {
                if (present) return
                const next = bullets(slide.body)
                next[i] = event.currentTarget.innerText
                set({ body: next.join('\n') })
              }}>{line}</p>
            ))}
          </div>
          <div>
            {bullets(slide.extra).map((line, i) => (
              <p key={i} contentEditable={!present} suppressContentEditableWarning onBlur={(event) => {
                if (present) return
                const next = bullets(slide.extra)
                next[i] = event.currentTarget.innerText
                set({ extra: next.join('\n') })
              }}>{line}</p>
            ))}
          </div>
        </div>
      )}
      {slide.layout === 'picture' && (
        <div className="sl-picture">
          {slide.image ? <img src={slide.image} alt="" /> : <div className="sl-ph">Sisipkan → Gambar</div>}
          {field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
        </div>
      )}
      {slide.layout === 'table' && (
        <table className="sl-table">
          <tbody>
            {(slide.table || [['', ''], ['', '']]).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} contentEditable={!present} suppressContentEditableWarning onBlur={(event) => {
                    if (present) return
                    const table = (slide.table || []).map((line) => [...line])
                    table[ri][ci] = event.currentTarget.innerText
                    set({ table })
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {slide.layout === 'blank' && field(slide.body, 'body', 'sl-free')}
    </div>
  )
}

export default function SlidesEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [content, setContent] = useState(file.content)
  const [index, setIndex] = useState(0)
  const [present, setPresent] = useState(false)
  const [presenter, setPresenter] = useState(false)
  const [sorter, setSorter] = useState(false)
  const [showAgent, setShowAgent] = useState(true)
  const [backstage, setBackstage] = useState(false)
  const [share, setShare] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timer = useRef(null)
  const stageRef = useRef(null)
  const [pick, clearPick, pickRef] = useCanvasPick(stageRef)
  const [copilotBusy, setCopilotBusy] = useState(false)
  const indexRef = useRef(0)
  indexRef.current = index
  const contentRef = useRef(content)
  contentRef.current = content
  const saved = useSavedFlag(JSON.stringify(content) + title)
  const slide = content.slides[index] || content.slides[0]
  const transition = content.transition || 'fade'

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
    setIndex(0)
    clearPick()
  }, [file.id])

  useEffect(() => {
    if (!present) {
      window.clearInterval(timer.current)
      setElapsed(0)
      return undefined
    }
    timer.current = window.setInterval(() => setElapsed((n) => n + 1), 1000)
    const onKey = (event) => {
      if (event.key === 'Escape') { setPresent(false); setPresenter(false) }
      if (event.key === 'ArrowRight' || event.key === ' ') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer.current)
    }
  }, [present])

  const persist = (next, nextTitle = title) => {
    setContent(next)
    onChange({ ...file, name: nextTitle, content: next, updatedAt: new Date().toISOString() })
  }

  const updateSlide = (nextSlide) => {
    persist({ ...content, slides: content.slides.map((item, i) => i === index ? nextSlide : item) })
  }

  const addSlide = (layout) => {
    const next = [...content.slides]
    next.splice(index + 1, 0, blankSlide(layout))
    persist({ ...content, slides: next })
    setIndex(index + 1)
  }

  const move = (dir) => {
    const to = index + dir
    if (to < 0 || to >= content.slides.length) return
    const slides = [...content.slides]
    const [item] = slides.splice(index, 1)
    slides.splice(to, 0, item)
    persist({ ...content, slides })
    setIndex(to)
  }

  const go = (dir) => {
    const current = indexRef.current
    const ids = contentRef.current.slides.map((item, i) => (!present || !item.hidden ? i : -1)).filter((i) => i >= 0)
    const at = ids.indexOf(current)
    const next = ids[Math.max(0, Math.min(ids.length - 1, at + dir))]
    if (next != null) setIndex(next)
  }

  const pickImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const blob = input.files?.[0]
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => updateSlide({ ...slide, layout: 'picture', image: reader.result })
      reader.readAsDataURL(blob)
    }
    input.click()
  }

  const applyCopilot = async (result) => {
    if (pickRef.current?.text && stageRef.current) {
      const frag = result?.selectionHtml || result?.html
      if (frag) {
        replacePick(stageRef.current, pickRef.current, asFragment(typeof frag === 'string' ? frag : JSON.stringify(frag)))
        return true
      }
    }
    if (Array.isArray(result?.slides) && result.slides.length) {
      persist({
        ...content,
        slides: result.slides.map((item, i) => ({ ...blankSlide(item.layout || 'content'), ...item, id: item.id || newId('s'), title: item.title || `Slide ${i + 1}` })),
      })
      return true
    }
    if (result?.addSlide) {
      const next = [...content.slides, { ...blankSlide(result.addSlide.layout || 'content'), ...result.addSlide, id: newId('s') }]
      persist({ ...content, slides: next })
      setIndex(next.length - 1)
      return true
    }
    if (result?.updateSlide) {
      updateSlide({ ...slide, ...result.updateSlide })
      return true
    }
    if (result?.notes) {
      updateSlide({ ...slide, notes: result.notes })
      return true
    }
    return false
  }

  const getContext = () => ({
    title,
    theme: content.theme,
    index,
    selection: pickRef.current?.text || '',
    scoped: Boolean(pickRef.current?.text),
    slides: content.slides.map((item) => ({ layout: item.layout, kicker: item.kicker, title: item.title, subtitle: item.subtitle, body: item.body, extra: item.extra, notes: item.notes, hidden: item.hidden })),
  })

  const askAgent = async (prompt) => {
    const picked = pickRef.current
    if (picked?.text) {
      if (isAnalyzeIntent(prompt) && !isReviseIntent(prompt)) {
        return { message: `Dari pilihan slide: “${picked.text.slice(0, 360)}${picked.text.length > 360 ? '…' : ''}”` }
      }
      if (isReviseIntent(prompt) && stageRef.current) {
        const cut = picked.text.split(/(?<=[.!?])\s+/)[0] || picked.text
        replacePick(stageRef.current, picked, asFragment(cut))
        return { message: 'Pilihan di slide diperbarui. Teks lain tidak diubah.' }
      }
      return { message: `Siap bekerja pada pilihan: “${picked.text.slice(0, 160)}${picked.text.length > 160 ? '…' : ''}”` }
    }
    const q = prompt.toLowerCase()
    if (q.includes('agenda')) {
      const slides = [...content.slides]
      slides.splice(1, 0, { ...blankSlide('content'), kicker: 'AGENDA', title: 'Yang akan kita bahas', body: 'Konteks\nProduk\nBukti\nLangkah berikutnya' })
      persist({ ...content, slides })
      setIndex(1)
      return { message: 'Slide agenda disisipkan ke kanvas.' }
    }
    if (q.includes('penutup')) {
      const slides = [...content.slides, { ...blankSlide('section'), kicker: 'TERIMA KASIH', title: 'Mari selesaikan pekerjaan yang membosankan.' }]
      persist({ ...content, slides })
      setIndex(slides.length - 1)
      return { message: 'Slide penutup ditambahkan ke kanvas.' }
    }
    if (q.includes('catatan')) {
      const bullets = String(slide.body || '').split('\n').filter(Boolean)
      const notes = bullets.length
        ? `Buka dengan “${slide.title}”. Bahas: ${bullets.join('; ')}.`
        : `Buka dengan “${slide.title}”. ${slide.subtitle || ''}`.trim()
      updateSlide({ ...slide, notes })
      return { message: 'Catatan pembicara ditulis untuk slide ini.' }
    }
    if (q.includes('slide baru') || q.includes('tambah slide')) {
      addSlide('content')
      return { message: 'Slide baru ditambahkan setelah slide ini.' }
    }
    if (q.includes('presentasi dari') || q.includes('buat presentasi')) {
      const topic = prompt.replace(/.*?(dari|tentang)\s*/i, '').trim() || 'briefing ini'
      const slides = [
        { ...blankSlide('title'), kicker: 'MICROSOFT 365', title: topic, subtitle: 'Disusun oleh Copilot' },
        { ...blankSlide('content'), kicker: 'AGENDA', title: 'Yang akan kita bahas', body: 'Konteks\nPendekatan\nBukti\nLangkah berikutnya' },
        { ...blankSlide('content'), kicker: 'KONTEKS', title: 'Masalah yang kita selesaikan', body: 'Situasi saat ini\nDampak bagi tim\nPeluang' },
        { ...blankSlide('section'), kicker: 'BERIKUTNYA', title: 'Langkah berikutnya', subtitle: 'Keputusan yang dibutuhkan dan pemiliknya' },
      ]
      persist({ ...content, slides })
      setIndex(0)
      return { message: `Presentasi ${slides.length} slide dibuat dari briefing.` }
    }
    return { message: 'Copilot siaga lokal: minta slide agenda, slide penutup, catatan pembicara, atau presentasi baru dari briefing. Seleksi teks untuk merevisi bagian tertentu.', applied: false }
  }

  const ribbon = [
    {
      id: 'home',
      label: 'Beranda',
      groups: [
        {
          label: 'Slide',
          items: [
            <RibbonBtn key="n" icon={FilePlus2} label="Slide baru" onClick={() => addSlide('content')} />,
            <RibbonBtn key="d" icon={Copy} label="Duplikat" onClick={() => {
              const slides = [...content.slides]
              slides.splice(index + 1, 0, { ...slide, id: newId('s') })
              persist({ ...content, slides })
              setIndex(index + 1)
            }} />,
            <RibbonBtn key="x" icon={Trash2} label="Hapus" onClick={() => {
              if (content.slides.length < 2) return onNotify('Minimal satu slide')
              persist({ ...content, slides: content.slides.filter((_, i) => i !== index) })
              setIndex(Math.min(index, content.slides.length - 2))
            }} />,
            <RibbonBtn key="h" icon={slide.hidden ? Eye : EyeOff} label={slide.hidden ? 'Tampilkan' : 'Sembunyikan'} onClick={() => updateSlide({ ...slide, hidden: !slide.hidden })} />,
          ],
        },
        {
          label: 'Tata letak',
          items: [
            <RibbonPick key="ly" width={140} value={slide.layout} onChange={(v) => updateSlide({ ...slide, layout: v })} options={LAYOUTS.map((item) => ({ value: item.id, label: item.label }))} />,
          ],
        },
        {
          label: 'Tema',
          items: [
            <RibbonPick key="th" width={130} value={content.theme} onChange={(v) => persist({ ...content, theme: v })} options={THEMES.map((item) => ({ value: item.id, label: item.label }))} />,
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Sisipkan',
      groups: [
        {
          label: 'Media',
          items: [
            <RibbonBtn key="img" icon={Image} label="Gambar" onClick={pickImage} />,
            <RibbonBtn key="tbl" icon={Table2} label="Tabel" onClick={() => updateSlide({ ...slide, layout: 'table', table: slide.table || [['A', 'B', 'C'], ['', '', ''], ['', '', '']] })} />,
            <RibbonBtn key="pic" icon={LayoutGrid} label="Tata gambar" onClick={() => updateSlide({ ...slide, layout: 'picture' })} />,
          ],
        },
      ],
    },
    {
      id: 'design',
      label: 'Desain',
      groups: [
        {
          label: 'Transisi',
          items: [
            <RibbonPick key="tr" width={150} value={transition} onChange={(v) => persist({ ...content, transition: v })} options={TRANSITIONS.map((item) => ({ value: item.id, label: item.label }))} />,
          ],
        },
      ],
    },
    {
      id: 'show',
      label: 'Slide Show',
      groups: [
        {
          label: 'Mulai',
          items: [
            <RibbonBtn key="p" icon={Play} label="Dari awal" onClick={() => { setIndex(Math.max(0, content.slides.findIndex((item) => !item.hidden))); setPresenter(false); setPresent(true) }} />,
            <RibbonBtn key="c" icon={Play} label="Dari saat ini" onClick={() => { setPresenter(false); setPresent(true) }} />,
            <RibbonBtn key="pv" icon={Play} label="Tampilan presenter" onClick={() => { setPresenter(true); setPresent(true) }} />,
          ],
        },
        {
          label: 'Tampilan',
          items: [
            <RibbonBtn key="so" icon={LayoutGrid} label={sorter ? 'Editor' : 'Pengurut'} onClick={() => setSorter((v) => !v)} />,
          ],
        },
      ],
    },
  ]

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const nextVisible = content.slides.find((item, i) => i > index && !item.hidden)

  return (
    <div className={`ed-shell slides-app ${showAgent ? 'linked' : ''} ${copilotBusy ? 'copilot-busy' : ''}`}>
      <div className="ed-main">
        <EditorChrome
          kind="slides"
          mark={<PowerPointIcon size={28} />}
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => setShare(true)}
          onCopilot={() => setShowAgent((v) => !v)}
          extra={(
            <button className="present-btn" onClick={() => { setIndex(Math.max(0, content.slides.findIndex((item) => !item.hidden))); setPresenter(false); setPresent(true) }}><Play size={14} /> Mulai dari awal</button>
          )}
        />
        {backstage && (
          <FileBackstage
            kind="slides"
            title={title}
            onClose={() => setBackstage(false)}
            onHome={onBack}
            onPrint={() => window.print()}
            onExport={async () => { await exportPptx(title, content); onNotify('Dek diunduh') }}
            onNotify={onNotify}
          />
        )}
        <MenuBar items={[{
          label: 'File',
          actions: [
            { id: 'html', label: 'Unduh presentasi (.html)', run: async () => { await exportPptx(title, content); onNotify('Dek diunduh') } },
            { id: 'present', label: 'Mulai slide show', run: () => setPresent(true) },
          ],
        }]} />
        <Ribbon tabs={ribbon} accent="ppt" onFile={() => setBackstage(true)} />
        {sorter ? (
          <div className="sl-sorter">
            {content.slides.map((item, i) => (
              <button key={item.id} className={`${i === index ? 'on' : ''} ${item.hidden ? 'dim' : ''}`} onClick={() => setIndex(i)} onDoubleClick={() => { setSorter(false); setIndex(i) }}>
                <SlideCanvas slide={item} theme={content.theme} onChange={() => {}} present />
                <span>{i + 1}. {item.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sl-body-wrap">
            <aside className="sl-strip">
              <button className="new-slide" onClick={() => addSlide('content')}><FilePlus2 size={14} /> Slide baru</button>
              {content.slides.map((item, i) => (
                <button key={item.id} className={`slide-thumb ${i === index ? 'active' : ''} ${item.hidden ? 'dim' : ''}`} onClick={() => setIndex(i)}>
                  <span>{i + 1}</span>
                  <div>
                    <b>{item.title || 'Tanpa judul'}</b>
                    <small>{LAYOUTS.find((l) => l.id === item.layout)?.label}{item.hidden ? ' · tersembunyi' : ''}</small>
                  </div>
                </button>
              ))}
              <div className="sl-reorder">
                <button onClick={() => move(-1)}><ChevronUp size={14} /></button>
                <button onClick={() => move(1)}><ChevronDown size={14} /></button>
                <button onClick={() => { const slides = [...content.slides]; slides.splice(index + 1, 0, { ...slide, id: newId('s') }); persist({ ...content, slides }); setIndex(index + 1) }}><Copy size={14} /></button>
                <button aria-label="Hapus slide" onClick={() => {
                  if (content.slides.length < 2) return onNotify('Minimal satu slide')
                  persist({ ...content, slides: content.slides.filter((_, i) => i !== index) })
                  setIndex(Math.min(index, content.slides.length - 2))
                }}><Trash2 size={14} /></button>
              </div>
            </aside>
            <main className={`sl-stage ${pick?.text ? 'copilot-scoped' : ''}`} ref={stageRef}>
              <SlideCanvas key={slide.id + (slide.layout || '')} slide={slide} theme={content.theme} onChange={updateSlide} transition={transition} />
              <div className="slide-controls">
                <button onClick={() => go(-1)}>←</button>
                <span>Slide {index + 1} dari {content.slides.length}</span>
                <button onClick={() => go(1)}>→</button>
              </div>
              <label className="sl-notes">
                <span>Catatan pembicara</span>
                <textarea value={slide.notes || ''} onChange={(event) => updateSlide({ ...slide, notes: event.target.value })} placeholder="Yang akan Anda katakan, bukan yang tertulis di slide." />
              </label>
            </main>
          </div>
        )}
      </div>
      <CanvasCopilotChip pick={pick} onOpen={() => setShowAgent(true)} />
      {showAgent && <AgentPanel kind="slides" app="PowerPoint" floating onClose={() => setShowAgent(false)} getContext={getContext} onApply={applyCopilot} onAsk={askAgent} selectionText={pick?.text || ''} onClearSelection={clearPick} onBusyChange={setCopilotBusy} />}
      {share && <ShareDialog title={`${title}.pptx`} onClose={() => setShare(false)} onNotify={onNotify} />}
      {present && !presenter && (
        <div className="sl-present" onClick={() => go(1)}>
          <SlideCanvas slide={slide} theme={content.theme} onChange={() => {}} present transition={transition} />
          <div className="sl-present-bar">
            <span>{index + 1} / {content.slides.length}</span>
            <span>{slide.notes}</span>
            <span>{clock}</span>
            <button onClick={(event) => { event.stopPropagation(); setPresent(false) }}><Square size={13} /> Keluar</button>
          </div>
        </div>
      )}
      {present && presenter && (
        <div className="sl-presenter">
          <div className="now"><SlideCanvas slide={slide} theme={content.theme} onChange={() => {}} present /></div>
          <aside>
            <p>Berikutnya</p>
            {nextVisible ? <SlideCanvas slide={nextVisible} theme={content.theme} onChange={() => {}} present /> : <em>Slide terakhir</em>}
            <p>Catatan</p>
            <div className="pv-notes">{slide.notes || '—'}</div>
            <div className="pv-bar">
              <span>{clock}</span>
              <button onClick={() => go(-1)}>←</button>
              <button onClick={() => go(1)}>→</button>
              <button onClick={() => { setPresent(false); setPresenter(false) }}>Keluar</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
