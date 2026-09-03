export function didPatchCanvas(kind, result) {
  if (!result || typeof result !== 'object') return false
  if (kind === 'doc') return Boolean(result.html || result.appendHtml)
  if (kind === 'sheet') {
    return (Array.isArray(result.cells) && result.cells.length > 0)
      || (Array.isArray(result.formats) && result.formats.length > 0)
  }
  if (kind === 'slides') {
    return Boolean(result.addSlide || result.updateSlide || result.notes)
      || (Array.isArray(result.slides) && result.slides.length > 0)
  }
  if (kind === 'pdf') return Boolean(result.notes)
  return false
}

export async function copilotHealth() {
  try {
    const response = await fetch('/api/copilot/health')
    if (!response.ok) return { configured: false }
    return response.json()
  } catch {
    return { configured: false }
  }
}

export async function askCopilot({ kind, prompt, context, history }) {
  const response = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, prompt, context, history }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Copilot tidak tersedia')
    error.status = response.status
    throw error
  }
  return data
}
