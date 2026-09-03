import { useEffect, useState } from 'react'
import {
  ChevronDown, ChevronUp, Copy, FilePlus2, Play, Presentation, Square, Trash2
} from 'lucide-react'
import { AgentToggle, EditorChrome, MenuBar, useSavedFlag } from '../components/EditorChrome.jsx'
import AgentPanel from '../components/AgentPanel.jsx'
import { newId } from '../lib/files.js'
import { exportPptx } from '../lib/export.js'

const THEMES = [
  { id: 'northstar', label: 'Northstar' },
  { id: 'ink', label: 'Ink' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'ocean', label: 'Ocean' },
]

const LAYOUTS = [
  { id: 'title', label: 'Judul' },
  { id: 'content', label: 'Judul + isi' },
  { id: 'split', label: 'Dua kolom' },
  { id: 'section', label: 'Bagian' },
  { id: 'blank', label: 'Kosong' },
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
  }
}

function SlideCanvas({ slide, theme, onChange, present }) {
  const set = (patch) => onChange({ ...slide, ...patch })
  const bullets = (text) => String(text || '').split('\n')
  const field = (value, key, className, tag = 'div') => {
    const Tag = tag
    if (present) return <Tag className={className}>{value}</Tag>
    return (
      <Tag
        className={className}
        contentEditable
        suppressContentEditableWarning
        onBlur={(event) => set({ [key]: event.currentTarget.innerText })}
      >
        {value}
      </Tag>
    )
  }

  return (
    <div className={`sl-canvas ${theme} ${slide.layout} ${present ? 'presenting' : ''}`}>
      {slide.layout !== 'blank' && field(slide.kicker, 'kicker', 'sl-kicker')}
      {field(slide.title, 'title', 'sl-title', 'h1')}
      {slide.layout === 'title' && field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
      {slide.layout === 'section' && field(slide.subtitle, 'subtitle', 'sl-sub', 'p')}
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
      {slide.layout === 'blank' && field(slide.body, 'body', 'sl-free')}
      <span className="sl-num" />
    </div>
  )
}

export default function SlidesEditor({ file, onChange, onBack, onNotify }) {
  const [title, setTitle] = useState(file.name)
  const [content, setContent] = useState(file.content)
  const [index, setIndex] = useState(0)
  const [present, setPresent] = useState(false)
  const [showAgent, setShowAgent] = useState(true)
  const saved = useSavedFlag(JSON.stringify(content) + title)
  const slide = content.slides[index] || content.slides[0]

  useEffect(() => {
    setTitle(file.name)
    setContent(file.content)
    setIndex(0)
  }, [file.id])

  useEffect(() => {
    if (!present) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPresent(false)
      if (event.key === 'ArrowRight' || event.key === ' ') setIndex((i) => Math.min(content.slides.length - 1, i + 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [present, content.slides.length])

  const persist = (next, nextTitle = title) => {
    setContent(next)
    onChange({ ...file, name: nextTitle, content: next, updatedAt: new Date().toISOString() })
  }

  const updateSlide = (nextSlide) => {
    persist({
      ...content,
      slides: content.slides.map((item, i) => i === index ? nextSlide : item),
    })
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

  const applyCopilot = async (result) => {
    if (Array.isArray(result?.slides) && result.slides.length) {
      persist({
        ...content,
        slides: result.slides.map((item, i) => ({
          id: item.id || newId('s'),
          layout: item.layout || 'content',
          kicker: item.kicker || '',
          title: item.title || `Slide ${i + 1}`,
          subtitle: item.subtitle || '',
          body: item.body || '',
          extra: item.extra || '',
          notes: item.notes || '',
        })),
      })
      return
    }
    if (result?.addSlide) {
      const next = [...content.slides, { ...blankSlide(result.addSlide.layout || 'content'), ...result.addSlide, id: newId('s') }]
      persist({ ...content, slides: next })
      setIndex(next.length - 1)
      return
    }
    if (result?.updateSlide) {
      updateSlide({ ...slide, ...result.updateSlide })
    }
    if (result?.notes && !result.updateSlide) {
      updateSlide({ ...slide, notes: result.notes })
    }
  }

  const getContext = () => ({
    title,
    theme: content.theme,
    index,
    slides: content.slides.map((item) => ({
      layout: item.layout,
      kicker: item.kicker,
      title: item.title,
      subtitle: item.subtitle,
      body: item.body,
      extra: item.extra,
      notes: item.notes,
    })),
  })

  const askAgent = async (prompt) => {
    const q = prompt.toLowerCase()
    if (q.includes('agenda')) {
      const slides = [...content.slides]
      slides.splice(1, 0, {
        id: newId('s'),
        layout: 'content',
        kicker: 'AGENDA',
        title: 'Yang akan kita bahas',
        subtitle: '',
        body: 'Masalah yang kita selesaikan\nProduk: Docs, Sheets, Slides\nCara agen bekerja di dalam file\nApa yang diukur selanjutnya',
        notes: 'Jangan lebih dari empat poin. Tahan pertanyaan sampai slide produk.',
      })
      persist({ ...content, slides })
      setIndex(1)
      return { message: 'Slide agenda disisipkan setelah judul. Saya juga mengisi catatan pembicara.' }
    }
    if (q.includes('penutup') || q.includes('closing') || q.includes('tutup')) {
      const slides = [...content.slides, {
        id: newId('s'),
        layout: 'section',
        kicker: 'TERIMA KASIH',
        title: 'Mari selesaikan pekerjaan yang membosankan.',
        subtitle: 'Briefing kembali sebagai file — .docx, .xlsx, .pptx.',
        body: '',
        notes: 'Tutup, diam sejenak, lalu buka Q&A.',
      }]
      persist({ ...content, slides })
      setIndex(slides.length - 1)
      return { message: 'Slide penutup ditambahkan di akhir dek.' }
    }
    if (q.includes('catatan') || q.includes('notes') || q.includes('speaker')) {
      updateSlide({
        ...slide,
        notes: slide.notes || 'Tekankan satu kalimat: kerja terjadi di dalam file, bukan di jendela obrolan.',
      })
      return { message: 'Catatan pembicara pada slide ini dilengkapi.' }
    }
    updateSlide({ ...slide, notes: `${slide.notes ? `${slide.notes}\n` : ''}Agen: ${prompt}` })
    return { message: 'Briefing Anda saya simpan ke catatan pembicara slide ini.' }
  }

  const menus = [
    {
      label: 'File',
      actions: [
        { id: 'pptx', label: 'Unduh presentasi (.html)', run: async () => { await exportPptx(title, content); onNotify('Dek diunduh') } },
        { id: 'present', label: 'Mulai presentasi', hint: '⌘Enter', run: () => setPresent(true) },
      ],
    },
    {
      label: 'Slide',
      actions: [
        { id: 'add', label: 'Slide baru', run: () => addSlide('content') },
        { id: 'dup', label: 'Duplikat slide', run: () => {
          const slides = [...content.slides]
          slides.splice(index + 1, 0, { ...slide, id: newId('s') })
          persist({ ...content, slides })
          setIndex(index + 1)
        } },
        { id: 'del', label: 'Hapus slide', run: () => {
          if (content.slides.length < 2) return onNotify('Minimal satu slide')
          persist({ ...content, slides: content.slides.filter((_, i) => i !== index) })
          setIndex(Math.max(0, index - 1))
        } },
      ],
    },
  ]

  return (
    <div className="ed-shell slides-app">
      <div className="ed-main">
        <EditorChrome
          icon={Presentation}
          tone="orange"
          title={title}
          onTitle={(value) => { setTitle(value); persist(content, value) }}
          saved={saved}
          onBack={onBack}
          onShare={() => onNotify('Tautan presentasi siap dibagikan')}
          extra={(
            <>
              <button className="present-btn" onClick={() => setPresent(true)}><Play size={14} /> Presentasikan</button>
              <AgentToggle onClick={() => setShowAgent((v) => !v)} />
            </>
          )}
        />
        <MenuBar items={menus} />
        <div className="editor-toolbar">
          <select className="toolbar-select" value={slide.layout} onChange={(event) => updateSlide({ ...slide, layout: event.target.value })}>
            {LAYOUTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select className="toolbar-select" value={content.theme} onChange={(event) => persist({ ...content, theme: event.target.value })}>
            {THEMES.map((item) => <option key={item.id} value={item.id}>Tema {item.label}</option>)}
          </select>
          <span className="tool-divider" />
          {LAYOUTS.map((item) => (
            <button key={item.id} className="tool-button" onClick={() => addSlide(item.id)} title={`Tambah ${item.label}`}>
              <FilePlus2 size={14} />
            </button>
          ))}
        </div>
        <div className="sl-body-wrap">
          <aside className="sl-strip">
            <button className="new-slide" onClick={() => addSlide('content')}><FilePlus2 size={14} /> Slide baru</button>
            {content.slides.map((item, i) => (
              <button key={item.id} className={`slide-thumb ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)}>
                <span>{i + 1}</span>
                <div>
                  <b>{item.title || 'Tanpa judul'}</b>
                  <small>{LAYOUTS.find((l) => l.id === item.layout)?.label}</small>
                </div>
              </button>
            ))}
            <div className="sl-reorder">
              <button onClick={() => move(-1)}><ChevronUp size={14} /></button>
              <button onClick={() => move(1)}><ChevronDown size={14} /></button>
              <button onClick={() => {
                const slides = [...content.slides]
                slides.splice(index + 1, 0, { ...slide, id: newId('s'), title: `${slide.title} (salinan)` })
                persist({ ...content, slides })
                setIndex(index + 1)
              }}><Copy size={14} /></button>
              <button onClick={() => {
                if (content.slides.length < 2) return
                persist({ ...content, slides: content.slides.filter((_, i) => i !== index) })
                setIndex(Math.max(0, index - 1))
              }}><Trash2 size={14} /></button>
            </div>
          </aside>
          <main className="sl-stage">
            <SlideCanvas key={slide.id} slide={slide} theme={content.theme} onChange={updateSlide} />
            <div className="slide-controls">
              <button onClick={() => setIndex(Math.max(0, index - 1))}>←</button>
              <span>Slide {index + 1} dari {content.slides.length}</span>
              <button onClick={() => setIndex(Math.min(content.slides.length - 1, index + 1))}>→</button>
            </div>
            <label className="sl-notes">
              <span>Catatan pembicara</span>
              <textarea
                value={slide.notes || ''}
                onChange={(event) => updateSlide({ ...slide, notes: event.target.value })}
                placeholder="Yang akan Anda katakan, bukan yang tertulis di slide."
              />
            </label>
          </main>
        </div>
      </div>
      {showAgent && (
        <AgentPanel
          kind="slides"
          floating
          onClose={() => setShowAgent(false)}
          getContext={getContext}
          onApply={applyCopilot}
          onAsk={askAgent}
        />
      )}
      {present && (
        <div className="sl-present" onClick={() => setIndex((i) => Math.min(content.slides.length - 1, i + 1))}>
          <SlideCanvas slide={content.slides[index]} theme={content.theme} onChange={() => {}} present />
          <div className="sl-present-bar">
            <span>{index + 1} / {content.slides.length}</span>
            <span>{slide.notes}</span>
            <button onClick={(event) => { event.stopPropagation(); setPresent(false) }}><Square size={13} /> Keluar</button>
          </div>
        </div>
      )}
    </div>
  )
}
