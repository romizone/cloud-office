const MODELS = [
  'deepseek-v4-flash-vision-exp',
  'deepseek-v4-flash',
  'deepseek-chat',
]

export function systemPrompt(kind) {
  return `You are DeepRomeo, an in-file copilot for Cloud Office.
You edit the live ${kind} file. Reply in Indonesian.
Return ONLY JSON with this shape:
{
  "message": "short explanation of what you did",
  "html": null,
  "appendHtml": null,
  "cells": null,
  "addSlide": null,
  "updateSlide": null,
  "notes": null
}
Rules:
- Always edit the open file. message alone is not enough when the user asked to change the document.
- Docs (kind=doc): set html to the FULL updated HTML, or appendHtml for a fragment to append. Keep existing headings when rewriting.
- Sheets (kind=sheet): cells is an array of {"r":0-based-row,"c":0-based-col,"v":"value or =FORMULA"}. Prefer formulas like =SUM(B2:B6). Optional formats: [{"r":0,"c":0,"numFmt":"currency","bold":true}].
- Slides (kind=slides): addSlide is {layout,kicker,title,subtitle,body,extra,notes} with body as newline-separated bullets. updateSlide patches the current slide. notes is speaker notes text.
- PDF (kind=pdf): message only, plus optional notes with a summary of the page.
- Home (kind=home): message that tells the user which app to open; do not invent file bytes.
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

export async function callDeepSeek(apiKey, messages) {
  let lastError = 'Model tidak merespons'
  for (const model of MODELS) {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 2500,
        messages,
      }),
    })
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
  return { ok: true, ...patch, message: patch.message || 'Perubahan diterapkan ke file.' }
}
