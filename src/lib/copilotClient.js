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
