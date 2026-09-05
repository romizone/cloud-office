import crypto from 'node:crypto'

export const COOKIE_NAME = 'or_session'
const SESSION_DAYS = 30

export function getClientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim()
}

function secret() {
  const value = (process.env.SESSION_SECRET || '').trim()
  if (!value) {
    const error = new Error('Sesi belum dikonfigurasi di server.')
    error.status = 500
    error.code = 'no_secret'
    throw error
  }
  return value
}

const b64 = (buf) => Buffer.from(buf).toString('base64url')
const unb64 = (text) => Buffer.from(String(text), 'base64url')

function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url')
}

export function signSession(user) {
  const payload = {
    sub: String(user.sub),
    email: user.email || '',
    name: user.name || '',
    picture: user.picture || '',
    exp: Date.now() + SESSION_DAYS * 86400000,
  }
  const body = b64(JSON.stringify(payload))
  return `${body}.${hmac(body)}`
}

export function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  let expected
  try { expected = hmac(body) } catch { return null }
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(unb64(body).toString('utf8'))
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function parseCookies(header) {
  const out = {}
  String(header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=')
    if (idx < 0) return
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  })
  return out
}

export function sessionCookie(token, { secure = true } = {}) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`
}

export function clearCookie({ secure = true } = {}) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

/** Verifies a Google Identity Services ID token and returns the profile. */
export async function verifyGoogleIdToken(credential) {
  const clientId = getClientId()
  if (!clientId) {
    const error = new Error('Login Google belum diaktifkan (GOOGLE_CLIENT_ID kosong).')
    error.status = 503
    error.code = 'no_client'
    throw error
  }
  if (!credential || typeof credential !== 'string' || credential.length > 4096) {
    const error = new Error('Token login tidak valid.')
    error.status = 400
    throw error
  }
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10000) })
  const info = await response.json().catch(() => ({}))
  const okIssuer = info.iss === 'https://accounts.google.com' || info.iss === 'accounts.google.com'
  if (!response.ok || info.aud !== clientId || !okIssuer || !info.sub) {
    const error = new Error('Login Google ditolak. Coba masuk lagi.')
    error.status = 401
    throw error
  }
  if (info.exp && Number(info.exp) * 1000 < Date.now()) {
    const error = new Error('Token login kedaluwarsa.')
    error.status = 401
    throw error
  }
  return {
    sub: info.sub,
    email: info.email || '',
    name: info.name || info.email || 'Pengguna',
    picture: info.picture || '',
  }
}
