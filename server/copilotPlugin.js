import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { handleApi } from './handlers.js'

/** Loads .env / .env.local into process.env for the dev server (never overrides real env). */
function hydrateEnv(rootDir) {
  for (const name of ['.env', '.env.local']) {
    const envPath = resolve(rootDir, name)
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && !process.env[key]) process.env[key] = value
    }
  }
}

const MAX_BODY_BYTES = 14 * 1024 * 1024

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        const error = new Error('Permintaan terlalu besar.')
        error.status = 413
        error.code = 'too_large'
        req.destroy()
        reject(error)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        const error = new Error('Body permintaan bukan JSON yang valid.')
        error.status = 400
        error.code = 'bad_json'
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res, result) {
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value))
  res.end(JSON.stringify(result.body))
}

function mount(rootDir) {
  hydrateEnv(rootDir)
  return async (req, res) => {
    const path = (req.originalUrl || req.url || '').split('?')[0]
    let body = {}
    try {
      if (req.method === 'POST' || req.method === 'PUT') body = await readBody(req)
    } catch (error) {
      send(res, { status: error.status || 400, body: { error: error.code || 'bad_request', message: error.message } })
      return
    }
    send(res, await handleApi({ method: req.method, path, body, headers: req.headers }))
  }
}

export function copilotPlugin(rootDir) {
  return {
    name: 'office-romeo-api',
    configureServer(server) {
      server.middlewares.use('/api', mount(rootDir))
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', mount(rootDir))
    },
  }
}
