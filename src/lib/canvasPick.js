import { useEffect, useRef, useState } from 'react'

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

export function asFragment(html) {
  const raw = String(html || '').trim()
  if (!raw) return ''
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw
  return `<span>${escapeHtml(raw)}</span>`
}

export function readPick(root) {
  const sel = window.getSelection()
  if (!root || !sel || sel.rangeCount === 0) return { inside: false, collapsed: true, text: '', range: null }
  const range = sel.getRangeAt(0)
  const node = range.commonAncestorContainer
  const el = node.nodeType === 1 ? node : node.parentNode
  const inside = Boolean(el && root.contains(el))
  if (!inside) return { inside: false, collapsed: true, text: '', range: null }
  const text = sel.toString().replace(/\s+/g, ' ').trim()
  return {
    inside: true,
    collapsed: sel.isCollapsed || !text,
    text,
    range: sel.isCollapsed || !text ? null : range.cloneRange(),
  }
}

export function restorePick(pick) {
  if (!pick?.range) return false
  try {
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(pick.range)
    return !sel.isCollapsed
  } catch {
    return false
  }
}

export function replacePick(root, pick, html) {
  if (!root) return false
  root.focus()
  const frag = asFragment(html)
  if (restorePick(pick)) {
    document.execCommand('insertHTML', false, frag)
    return true
  }
  if (pick?.text) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const idx = node.nodeValue.indexOf(pick.text)
      if (idx < 0) continue
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + pick.text.length)
      range.deleteContents()
      const wrap = document.createElement('span')
      wrap.innerHTML = frag
      range.insertNode(wrap)
      return true
    }
  }
  return false
}

export function colorPick(root, pick, color) {
  if (!root || !color) return false
  root.focus()
  if (restorePick(pick)) {
    document.execCommand('foreColor', false, color)
    return true
  }
  return false
}

export function isReviseIntent(prompt) {
  return /(tulis ulang|rewrite|revisi|perbaiki|ganti|ubah|ringkas|rangkum|formal|pendek|draf)/i.test(String(prompt || ''))
}

export function isAnalyzeIntent(prompt) {
  return /(analis|jelas|arti|maksud|komentar|telaah|review|nilai)/i.test(String(prompt || ''))
}

export function useCanvasPick(rootRef) {
  const [pick, setPick] = useState(null)
  const pickRef = useRef(null)

  useEffect(() => {
    const onChange = () => {
      const next = readPick(rootRef.current)
      if (next.inside && !next.collapsed) {
        pickRef.current = { text: next.text, range: next.range }
        setPick(pickRef.current)
      } else if (next.inside && next.collapsed) {
        pickRef.current = null
        setPick(null)
      }
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [rootRef])

  const clear = () => {
    pickRef.current = null
    setPick(null)
  }

  return [pick, clear, pickRef]
}
