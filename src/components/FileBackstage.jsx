import { ArrowLeft, FileText, Printer, Save, Upload } from 'lucide-react'
import { APP_NAME, EXT } from '../lib/brand.js'

export default function FileBackstage({ kind, title, onClose, onHome, onPrint, onExport, onNotify }) {
  const app = APP_NAME[kind] || 'Office'
  const ext = EXT[kind] || 'file'
  return (
    <div className={`file-backstage accent-${kind}`}>
      <aside>
        <button className="back" onClick={onClose}><ArrowLeft size={16} /> Kembali</button>
        {[['Info', 'info'], ['Baru', 'new'], ['Buka', 'open'], ['Simpan', 'save'], ['Simpan sebagai', 'saveas'], ['Cetak', 'print'], ['Tutup', 'close']].map(([label, id]) => (
          <button
            key={id}
            className={id === 'info' ? 'on' : ''}
            onClick={() => {
              if (id === 'close') onHome()
              else if (id === 'print') onPrint?.()
              else if (id === 'save' || id === 'saveas') onExport?.()
              else if (id === 'open' || id === 'new') { onHome(); onNotify?.(`Pilih file di OneDrive untuk ${label.toLowerCase()}`) }
              else onNotify?.(`${label} · ${title}.${ext}`)
            }}
          >
            {label}
          </button>
        ))}
      </aside>
      <section>
        <p className="eyebrow">INFO</p>
        <h2>{title}.{ext}</h2>
        <p className="muted">Aplikasi web {app} · Office Romeo · Simpan otomatis ke OneDrive</p>
        <div className="backstage-cards">
          <button onClick={onExport}><Save size={18} /><span><b>Unduh salinan</b><small>{app} (.{ext})</small></span></button>
          <button onClick={onPrint}><Printer size={18} /><span><b>Cetak</b><small>Tata letak halaman web</small></span></button>
          <button onClick={onHome}><Upload size={18} /><span><b>Buka di OneDrive</b><small>File saya</small></span></button>
          <button onClick={onHome}><FileText size={18} /><span><b>File baru</b><small>Mulai dari templat</small></span></button>
        </div>
      </section>
    </div>
  )
}
