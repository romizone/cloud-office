import { clearCookie, getClientId, parseCookies, sessionCookie, signSession, verifyGoogleIdToken, verifySession } from './authCore.js'
import { readUserFiles, writeUserFiles } from './storeCore.js'
import { runCopilotRequest } from './copilotCore.js'

/**
 * Framework-neutral API router shared by the Vite dev plugin and the Vercel functions.
 * Returns { status, body, headers }.
 */
export async function handleApi({ method, path, body, headers = {} }) {
  const cookies = parseCookies(headers.cookie)
  const secure = String(headers['x-forwarded-proto'] || '').includes('https') || !/^(localhost|127\.0\.0\.1)/.test(String(headers.host || ''))
  const session = verifySession(cookies.or_session)
  const clean = path.replace(/\/+$/, '')

  try {
    if (clean === '/api/copilot/health' && method === 'GET') {
      return ok({ configured: Boolean((process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '').trim()), label: 'Copilot' })
    }
    if (clean === '/api/copilot' && method === 'POST') {
      return ok(await runCopilotRequest(body || {}))
    }
    if (clean === '/api/auth/config' && method === 'GET') {
      const clientId = getClientId()
      return ok({ clientId, configured: Boolean(clientId) && Boolean((process.env.SESSION_SECRET || '').trim()) })
    }
    if (clean === '/api/auth/google' && method === 'POST') {
      const user = await verifyGoogleIdToken(body?.credential)
      const token = signSession(user)
      return ok({ user }, { 'Set-Cookie': sessionCookie(token, { secure }) })
    }
    if (clean === '/api/auth/me' && method === 'GET') {
      if (!session) return ok({ user: null })
      const { exp, ...user } = session
      return ok({ user })
    }
    if (clean === '/api/auth/logout' && method === 'POST') {
      return ok({ ok: true }, { 'Set-Cookie': clearCookie({ secure }) })
    }
    if (clean === '/api/files') {
      if (!session) return fail(401, 'unauthorized', 'Silakan masuk dulu.')
      if (method === 'GET') {
        const files = await readUserFiles(session.sub)
        return ok({ files })
      }
      if (method === 'PUT') {
        if (!Array.isArray(body?.files)) return fail(400, 'bad_request', 'Daftar file tidak valid.')
        await writeUserFiles(session.sub, body.files)
        return ok({ ok: true, savedAt: new Date().toISOString() })
      }
    }
    return fail(404, 'not_found', 'Rute tidak ditemukan.')
  } catch (error) {
    return fail(error.status || 502, error.code || 'upstream', error.message || 'Gagal memproses permintaan.')
  }
}

function ok(body, headers = {}) {
  return { status: 200, body, headers }
}

function fail(status, code, message) {
  return { status, body: { error: code, message }, headers: {} }
}
