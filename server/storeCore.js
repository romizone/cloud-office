import crypto from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Per-user file storage. Payloads are encrypted (AES-256-GCM) with a key derived from
 * SESSION_SECRET before they leave the server, so the blob store never sees plaintext.
 * Backends: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise a local .data directory.
 */
const MAX_BYTES = 12 * 1024 * 1024

function key() {
  const secret = (process.env.SESSION_SECRET || '').trim()
  if (!secret) throw Object.assign(new Error('Penyimpanan belum dikonfigurasi di server.'), { status: 500 })
  return crypto.createHash('sha256').update(`${secret}:files`).digest()
}

function encrypt(json) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(Buffer.from(json, 'utf8')), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data])
}

function decrypt(buf) {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
}

function userKey(sub) {
  return crypto.createHash('sha256').update(String(sub)).digest('hex').slice(0, 40)
}

async function blobClient() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) return null
  const mod = await import('@vercel/blob')
  return { ...mod, token }
}

const localRoot = () => resolve(process.env.OFFICE_DATA_DIR || '.data', 'users')

export async function readUserFiles(sub) {
  const id = userKey(sub)
  const blob = await blobClient()
  if (blob) {
    const { blobs } = await blob.list({ prefix: `users/${id}/`, token: blob.token, limit: 50 })
    if (!blobs.length) return null
    const latest = blobs.slice().sort((a, b) => (a.pathname < b.pathname ? 1 : -1))[0]
    const response = await fetch(latest.url, { cache: 'no-store' })
    if (!response.ok) return null
    const buf = Buffer.from(await response.arrayBuffer())
    return JSON.parse(decrypt(buf))
  }
  try {
    const buf = await readFile(resolve(localRoot(), `${id}.bin`))
    return JSON.parse(decrypt(buf))
  } catch {
    return null
  }
}

export async function writeUserFiles(sub, files) {
  const json = JSON.stringify(files)
  if (Buffer.byteLength(json) > MAX_BYTES) {
    const error = new Error('Ukuran file terlalu besar untuk disimpan (maks 12 MB). Kurangi gambar yang disematkan.')
    error.status = 413
    throw error
  }
  const id = userKey(sub)
  const payload = encrypt(json)
  const blob = await blobClient()
  if (blob) {
    const stamp = String(Date.now()).padStart(15, '0')
    await blob.put(`users/${id}/${stamp}.bin`, payload, { access: 'public', addRandomSuffix: false, contentType: 'application/octet-stream', token: blob.token, cacheControlMaxAge: 60 })
    const { blobs } = await blob.list({ prefix: `users/${id}/`, token: blob.token, limit: 100 })
    const stale = blobs.filter((b) => !b.pathname.endsWith(`${stamp}.bin`)).map((b) => b.url)
    if (stale.length) await blob.del(stale, { token: blob.token }).catch(() => {})
    return true
  }
  await mkdir(localRoot(), { recursive: true })
  await writeFile(resolve(localRoot(), `${id}.bin`), payload)
  return true
}
