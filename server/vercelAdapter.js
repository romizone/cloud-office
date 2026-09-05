import { handleApi } from './handlers.js'

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

/** Wraps the shared router as a Vercel Node function. */
export function vercelHandler(pathOverride) {
  return async function handler(req, res) {
    let body = {}
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        body = await readJson(req)
      } catch {
        res.status(400).json({ error: 'bad_json', message: 'Body permintaan bukan JSON yang valid.' })
        return
      }
    }
    const path = typeof pathOverride === 'function' ? pathOverride(req) : (pathOverride || (req.url || '').split('?')[0])
    const result = await handleApi({ method: req.method, path, body, headers: req.headers })
    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value))
    res.status(result.status).json(result.body)
  }
}
