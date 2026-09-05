async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Permintaan gagal')
    error.status = response.status
    error.code = data.error
    throw error
  }
  return data
}

export const fetchAuthConfig = () => api('/api/auth/config').catch(() => ({ clientId: '', configured: false }))
export const fetchSession = () => api('/api/auth/me').then((d) => d.user).catch(() => null)
export const loginWithCredential = (credential) => api('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }).then((d) => d.user)
export const logout = () => api('/api/auth/logout', { method: 'POST' }).catch(() => ({}))
export const loadRemoteFiles = () => api('/api/files').then((d) => d.files)
export const saveRemoteFiles = (files) => api('/api/files', { method: 'PUT', body: JSON.stringify({ files }) })

let gsiPromise = null
/** Loads the Google Identity Services script once. */
export function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google Identity tidak tersedia')))
    script.onerror = () => reject(new Error('Gagal memuat Google Identity'))
    document.head.appendChild(script)
  })
  return gsiPromise
}

export function initialsOf(name = '', email = '') {
  const source = String(name || email.split('@')[0] || '').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return (letters || 'OR').toUpperCase()
}
