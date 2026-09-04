const COLORS = [
  { test: /\bmerah|\bred\b/i, value: '#c0392b', label: 'merah' },
  { test: /\bbiru|\bblue\b/i, value: '#1d4e89', label: 'biru' },
  { test: /\bhijau|\bgreen\b|\bteal\b/i, value: '#1f6f5b', label: 'hijau' },
  { test: /\bhitam|\bblack\b/i, value: '#17232d', label: 'hitam' },
  { test: /\boranye|\borange\b/i, value: '#c43e1c', label: 'oranye' },
]

const COLOR_CONTEXT = /\b(warna|font|teks|tulisan|huruf|color|colou?r|merah|red|biru|blue|hijau|green|hitam|black|oranye|orange)\b/i

export function parseFontColor(prompt) {
  const q = String(prompt || '')
  if (!COLOR_CONTEXT.test(q)) return null
  return COLORS.find((item) => item.test.test(q)) || null
}

export function looksLikeRefusal(text) {
  return /(tidak dapat|tidak bisa|cannot|can'?t|unable to|silakan buka|buka file ini di aplikasi|pengolah dokumen|editor pdf)/i.test(String(text || ''))
}

export function applyColorPatch(prompt, patch = {}) {
  const color = parseFontColor(prompt)
  if (!color) return patch
  const next = { ...patch, color: patch.color || color.value }
  if (!next.message || looksLikeRefusal(next.message)) {
    next.message = `Font di kanvas diubah menjadi ${color.label}.`
  }
  return next
}

export function paintHtml(root, color) {
  if (!root) return false
  root.style.color = color
  root.querySelectorAll('p,h1,h2,h3,h4,li,td,th,span,div,blockquote,a,font,em,strong,b,i,u').forEach((el) => {
    el.style.color = color
    if (el.tagName === 'FONT') el.setAttribute('color', color)
  })
  return true
}
