import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getApiKey, runCopilotRequest } from './copilotCore.js'

function hydrateEnv(rootDir) {
  if (getApiKey()) return
  const envPath = resolve(rootDir, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const name = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if ((name === 'DEEPSEEK_API_KEY' || name === 'DEEPSEEK_KEY') && !process.env[name]) {
      process.env[name] = value
    }
  }
}

const MAX_BODY_BYTES = 1_000_000

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        const error = new Error('Konteks terlalu besar untuk dikirim ke Copilot.')
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

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function mount(rootDir) {
  hydrateEnv(rootDir)
  return async (req, res) => {
    const path = (req.originalUrl || req.url || '').split('?')[0]
    if (path === '/api/copilot/health' || path.endsWith('/health')) {
      json(res, 200, { configured: Boolean(getApiKey()), label: 'DeepRomeo' })
      return
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' })
      return
    }
    try {
      const body = await readBody(req)
      const payload = await runCopilotRequest(body)
      json(res, 200, payload)
    } catch (error) {
      json(res, error.status || 502, {
        error: error.code || 'upstream',
        message: error.message || 'Gagal memanggil model.',
      })
    }
  }
}

export function copilotPlugin(rootDir) {
  return {
    name: 'cloud-office-copilot',
    configureServer(server) {
      const handle = mount(rootDir)
      server.middlewares.use('/api/copilot/health', (req, res) => handle(req, res))
      server.middlewares.use('/api/copilot', (req, res) => handle(req, res))
    },
    configurePreviewServer(server) {
      const handle = mount(rootDir)
      server.middlewares.use('/api/copilot/health', (req, res) => handle(req, res))
      server.middlewares.use('/api/copilot', (req, res) => handle(req, res))
    },
  }
}
