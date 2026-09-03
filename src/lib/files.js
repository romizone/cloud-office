const KEY = 'cloud-office-files-v2'

export const COLS = 18
export const ROWS = 40

export function blankGrid(rows = ROWS, cols = COLS, fill = '') {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill))
}

export function blankFormats(rows = ROWS, cols = COLS) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
}

function stamp(daysAgo = 0, minutesAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000 - minutesAgo * 60000).toISOString()
}

const STRATEGY_HTML = `<h1>Rencana Strategis 2025</h1>
<p class="paper-subtitle">Northstar Studio · Dokumen kerja</p>
<hr />
<h2>Ringkasan eksekutif</h2>
<p>Northstar Studio membangun perangkat lunak yang membuat kerja pengetahuan terasa lebih ringan. Tahun 2025 kami memusatkan energi pada tiga hal: produk yang disukai, distribusi yang terukur, dan organisasi yang siap tumbuh.</p>
<h2>Utara yang kami kejar</h2>
<p>Menjadi ruang kerja default bagi tim produk di Asia Tenggara — tempat dokumen, angka, dan cerita visual hidup berdampingan, dan agen AI menyelesaikan pekerjaan di dalam file, bukan di jendela obrolan terpisah.</p>
<h2>Prioritas kuartal ini</h2>
<ul>
<li>Meluncurkan editor Docs, Sheets, dan Slides yang membuka serta menyimpan format yang sudah dipakai klien.</li>
<li>Membangun alur agen yang menghasilkan artefak jadi: briefing, tracker, dan outline dek.</li>
<li>Mengukur retensi mingguan dan waktu hingga dokumen pertama tersimpan.</li>
</ul>
<h2>Metrik</h2>
<p>Aktivasi diukur dari dokumen pertama yang diedit sampai selesai. Retensi diukur dari kembali ke workspace dalam tujuh hari. Kualitas diukur dari file yang dibuka ulang di aplikasi lain tanpa rusak.</p>
<p>Klik di mana saja untuk menulis. Gunakan bilah alat untuk judul, daftar, tabel, tautan, dan gambar.</p>`

function salesSheet() {
  const cells = blankGrid()
  const formats = blankFormats()
  const header = ['Produk', 'Unit terjual', 'Harga / unit', 'Total penjualan', 'Status', 'Pangsa']
  header.forEach((value, col) => {
    cells[0][col] = value
    formats[0][col] = { bold: true, fill: '#eef8f4' }
  })
  const rows = [
    ['Aurora Desk Lamp', '24', '1250000', '=B2*C2', 'Tersedia', '=D2/D$7'],
    ['Mono Lounge Chair', '12', '3750000', '=B3*C3', 'Tersedia', '=D3/D$7'],
    ['Arc Floor Light', '8', '2100000', '=B4*C4', 'Pre-order', '=D4/D$7'],
    ['Pebble Side Table', '15', '1800000', '=B5*C5', 'Tersedia', '=D5/D$7'],
    ['Halo Shelf', '6', '2450000', '=B6*C6', 'Habis', '=D6/D$7'],
  ]
  rows.forEach((line, i) => {
    line.forEach((value, col) => {
      cells[i + 1][col] = value
    })
    formats[i + 1][2] = { numFmt: 'currency' }
    formats[i + 1][3] = { numFmt: 'currency' }
    formats[i + 1][5] = { numFmt: 'percent' }
  })
  cells[6][0] = 'Total'
  cells[6][1] = '=SUM(B2:B6)'
  cells[6][3] = '=SUM(D2:D6)'
  cells[6][4] = '=COUNTIF(E2:E6,"Tersedia")'
  formats[6][0] = { bold: true }
  formats[6][3] = { bold: true, numFmt: 'currency', fill: '#e7f4f0' }
  formats[6][1] = { bold: true, fill: '#e7f4f0' }
  cells[8][0] = 'Rata-rata unit'
  cells[8][1] = '=AVERAGE(B2:B6)'
  cells[9][0] = 'Nilai terbesar'
  cells[9][1] = '=MAX(D2:D6)'
  formats[9][1] = { numFmt: 'currency' }
  return {
    sheets: [
      { id: 'sales', name: 'Penjualan Q3', cells, formats },
      { id: 'notes', name: 'Catatan', cells: (() => {
        const next = blankGrid()
        next[0][0] = 'Catatan'
        next[1][0] = 'Pre-order Arc Floor Light masuk minggu depan.'
        next[2][0] = 'Halo Shelf perlu restock sebelum Oktober.'
        return next
      })(), formats: blankFormats() },
    ],
    active: 0,
  }
}

function investorSlides() {
  return {
    theme: 'northstar',
    slides: [
      {
        id: 's1',
        layout: 'title',
        kicker: 'NORTHSTAR STUDIO  ·  SERI A',
        title: 'Membangun masa depan yang lebih sederhana.',
        subtitle: 'Ruang kerja dokumen, angka, dan dek — dengan agen yang menyelesaikan file, bukan memberi nasihat.',
        body: '',
        notes: 'Buka dengan masalah: tim masih menyalin kerja antara chat dan dokumen.',
      },
      {
        id: 's2',
        layout: 'content',
        kicker: 'MASALAH',
        title: 'Alat kantor terpecah. Agen berdiri di luar file.',
        subtitle: '',
        body: 'Dokumen hidup di satu suite, angka di suite lain, dek di yang ketiga.\nAgen AI menulis di jendela obrolan, lalu manusia menyalin hasilnya.\nFormat berubah saat file berpindah tangan.\nYang dibutuhkan adalah kerja di dalam file yang sudah dipakai.',
        notes: 'Tekankan round-trip OOXML sebagai janji, bukan fitur sampingan.',
      },
      {
        id: 's3',
        layout: 'split',
        kicker: 'PRODUK',
        title: 'Tiga aplikasi. Satu workspace.',
        subtitle: '',
        body: 'Docs\nMenulis, menata, dan mengekspor naskah kerja.\n\nSheets\nHitung langsung di sel, impor CSV, unduh workbook.',
        extra: 'Slides\nSusun cerita, catatan pembicara, dan mode presentasi.\n\nAgen\nRingkas, analisis, dan terapkan perubahan ke file yang terbuka.',
        notes: 'Demo singkat: buka file, minta agen menambahkan slide penutup.',
      },
      {
        id: 's4',
        layout: 'content',
        kicker: 'TRACTION',
        title: 'Yang kami ukur minggu ini',
        subtitle: '',
        body: 'Waktu hingga dokumen pertama tersimpan.\nFile yang dibuka ulang tanpa rusak.\nAlur agen yang menghasilkan artefak jadi, bukan draf obrolan.\nTim yang kembali dalam tujuh hari.',
        notes: 'Jangan klaim angka yang belum kita miliki. Ceritakan instrumen ukurnya.',
      },
      {
        id: 's5',
        layout: 'section',
        kicker: 'BERIKUTNYA',
        title: 'Mari selesaikan pekerjaan yang membosankan.',
        subtitle: 'Briefing, tabel temuan, outline dek — kembali sebagai file.',
        body: '',
        notes: 'Tutup dengan undangan mencoba workspace, bukan janji yang belum siap.',
      },
    ],
  }
}

export function seedFiles() {
  return [
    {
      id: 'doc-strategy',
      type: 'doc',
      name: 'Rencana Strategis 2025',
      updatedAt: stamp(0, 12),
      favorite: true,
      trashed: false,
      owner: 'RS',
      content: { html: STRATEGY_HTML },
    },
    {
      id: 'sheet-budget',
      type: 'sheet',
      name: 'Budget Operasional Q3',
      updatedAt: stamp(1),
      favorite: false,
      trashed: false,
      owner: 'RS',
      content: salesSheet(),
    },
    {
      id: 'slides-investor',
      type: 'slides',
      name: 'Presentasi Investor — Seri A',
      updatedAt: stamp(3),
      favorite: true,
      trashed: false,
      owner: 'RS',
      content: investorSlides(),
    },
    {
      id: 'pdf-contract',
      type: 'pdf',
      name: 'Kontrak Kerja Sama 2025',
      updatedAt: stamp(5),
      favorite: false,
      trashed: false,
      owner: 'RS',
      content: { page: 1 },
    },
  ]
}

export function loadFiles() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {
    /* ignore quota / parse */
  }
  return seedFiles()
}

export function saveFiles(files) {
  try {
    localStorage.setItem(KEY, JSON.stringify(files))
    return true
  } catch {
    return false
  }
}

export function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function createFile(type, name) {
  const titles = {
    doc: 'Dokumen tanpa judul',
    sheet: 'Spreadsheet tanpa judul',
    slides: 'Presentasi tanpa judul',
    pdf: 'PDF tanpa judul',
  }
  const content = {
    doc: { html: '<h1>Dokumen tanpa judul</h1><p>Mulai menulis di sini.</p>' },
    sheet: {
      sheets: [{ id: newId('tab'), name: 'Sheet 1', cells: blankGrid(), formats: blankFormats() }],
      active: 0,
    },
    slides: {
      theme: 'northstar',
      slides: [{
        id: newId('s'),
        layout: 'title',
        kicker: 'CLOUD OFFICE',
        title: 'Judul presentasi',
        subtitle: 'Tambahkan subtitel untuk membuka cerita.',
        body: '',
        notes: '',
      }],
    },
    pdf: { page: 1 },
  }
  return {
    id: newId(type),
    type,
    name: name || titles[type],
    updatedAt: new Date().toISOString(),
    favorite: false,
    trashed: false,
    owner: 'RS',
    content: content[type],
  }
}

export function formatRelative(iso) {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.round(delta / 60000))
  if (minutes < 60) return `Diedit ${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Diedit ${hours} jam lalu`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Diedit kemarin'
  if (days < 7) return `Diedit ${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function typeLabel(type) {
  return { doc: 'Dokumen', sheet: 'Spreadsheet', slides: 'Presentasi', pdf: 'PDF' }[type] || 'File'
}

export function parseHash() {
  const parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean)
  const view = parts[0]
  const id = parts[1]
  if (['docs', 'sheets', 'slides', 'pdf'].includes(view) && id) {
    const type = view === 'docs' ? 'doc' : view === 'sheets' ? 'sheet' : view === 'pdf' ? 'pdf' : 'slides'
    return { view, type, id }
  }
  return { view: 'home' }
}

export function fileHash(file) {
  const map = { doc: 'docs', sheet: 'sheets', slides: 'slides', pdf: 'pdf' }
  return `#/${map[file.type]}/${file.id}`
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  row.push(cell)
  if (row.some((value) => value !== '')) rows.push(row)
  const cells = blankGrid()
  rows.slice(0, ROWS).forEach((line, r) => {
    line.slice(0, COLS).forEach((value, c) => {
      cells[r][c] = value
    })
  })
  return cells
}
