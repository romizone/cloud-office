import { runCopilotRequest } from '../../server/copilotCore.js'

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(raw || '{}')
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  let body
  try {
    body = await readJson(req)
  } catch {
    res.status(400).json({ error: 'bad_json', message: 'Body permintaan bukan JSON yang valid.' })
    return
  }
  try {
    const payload = await runCopilotRequest(body)
    res.status(200).json(payload)
  } catch (error) {
    res.status(error.status || 502).json({
      error: error.code || 'upstream',
      message: error.message || 'Gagal memanggil model.',
    })
  }
}
