import { applyColorPatch } from '../src/lib/editIntent.js'

const MODELS = [
  'deepseek-v4-flash-vision-exp',
  'deepseek-v4-flash',
  'deepseek-chat',
]

export function systemPrompt(kind) {
  return `You are Copilot in Microsoft 365 F3 (web apps only: Word, Excel, PowerPoint, Outlook, Teams, OneDrive).
You edit the live ${kind} file. Reply in Indonesian.
Return ONLY JSON with this shape:
{
  "message": "short explanation of what you did",
  "html": null,
  "appendHtml": null,
  "cells": null,
  "formats": null,
  "color": null,
  "selectionHtml": null,
  "addSlide": null,
  "updateSlide": null,
  "notes": null
}
Rules:
- Always edit the open file. Never refuse formatting. Never tell the user to open the desktop app — F3 is web-only.
- Speak like Copilot in Word/Excel/PowerPoint/Outlook/Teams. Be concise.
- If context.selection is non-empty, the user highlighted that canvas text. ONLY revise or analyze that selection. For a rewrite, set selectionHtml to the replacement fragment. Do not set html (full document). For analysis, message only and quote the selection.
- Format-only requests (font color, bold, highlight): set "color" to a hex like "#c0392b" for merah/red. Do not only send message. If a selection exists, color applies only to that selection.
- Docs (kind=doc): if no selection, set html to the FULL updated HTML, or appendHtml for a fragment, or color for font color. Keep existing headings when rewriting.
- Sheets (kind=sheet): cells is {"r":0-based-row,"c":0-based-col,"v":"value or =FORMULA"}. formats may include color, bold, numFmt, fill. Or set color for the used range.
- Slides (kind=slides): addSlide is {layout,kicker,title,subtitle,body,extra,notes}. updateSlide patches the current slide. notes is speaker notes. color tints slide text.
- PDF (kind=pdf): you CAN edit the open page. Set color for font color, html to replace page body, notes for annotations.
- Home/work (kind=home|work): message that tells the user which app to open, or summarize their files. Do not invent file bytes.
- Outlook (kind=outlook): draft or summarize email in "message".
- Teams (kind=teams): recap or draft a chat message in "message".
Never include API keys. Never wrap JSON in markdown.`
}

export function parseModelJson(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return { message: raw }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return { message: raw }
  }
}

// Vercel caps the function at 30s (vercel.json); keep the whole model fallback chain under that.
const TOTAL_BUDGET_MS = 26000
const PER_MODEL_MS = 20000

export async function callDeepSeek(apiKey, messages) {
  let lastError = 'Model tidak merespons'
  const deadline = Date.now() + TOTAL_BUDGET_MS
  for (const model of MODELS) {
    const remaining = deadline - Date.now()
    if (remaining < 2000) break
    let response
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(Math.min(PER_MODEL_MS, remaining)),
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 2500,
          messages,
        }),
      })
    } catch (error) {
      lastError = error?.name === 'TimeoutError' ? 'Model terlalu lama merespons' : (error?.message || 'Gagal menghubungi model')
      continue
    }
    const data = await response.json().catch(() => ({}))
    if (response.ok && data.choices?.[0]?.message?.content) {
      return parseModelJson(data.choices[0].message.content)
    }
    lastError = data.error?.message || `HTTP ${response.status}`
    if (response.status === 401 || response.status === 402) break
  }
  throw new Error(lastError)
}

export function getApiKey() {
  return (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '').trim()
}

export async function runCopilotRequest(body) {
  const apiKey = getApiKey()
  if (!apiKey) {
    const error = new Error('Kunci DeepSeek belum disetel di server.')
    error.status = 503
    error.code = 'missing_key'
    throw error
  }
  const kind = body.kind || 'home'
  const prompt = String(body.prompt || '').slice(0, 4000)
  const context = JSON.stringify(body.context || {}).slice(0, 12000)
  const history = Array.isArray(body.history) ? body.history.slice(-6) : []
  const messages = [
    { role: 'system', content: systemPrompt(kind) },
    ...history.map((item) => ({ role: item.role === 'ai' ? 'assistant' : 'user', content: String(item.text || '') })),
    { role: 'user', content: `Jenis file: ${kind}\nKonteks file:\n${context}\n\nBriefing pengguna:\n${prompt}` },
  ]
  const patch = await callDeepSeek(apiKey, messages)
  const canvasKinds = ['doc', 'sheet', 'slides', 'pdf']
  const next = canvasKinds.includes(kind) ? applyColorPatch(prompt, patch) : patch
  return { ok: true, ...next, message: next.message || 'Perubahan diterapkan ke file.' }
}
