import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardApi } from './_lib/httpGuard.js'
import { STATE_BODY_MAX_BYTES } from './_lib/storageKeys.js'
import {
  readUserState,
  validateStateKey,
  validateUserId,
  writeUserStateField,
} from './_lib/userState.js'

function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

function bodyBytes(req: VercelRequest): number {
  const header = req.headers['content-length']
  const declared = Number(Array.isArray(header) ? header[0] : header)
  if (Number.isFinite(declared) && declared >= 0) return declared
  try {
    return Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8')
  } catch {
    return 0
  }
}

function parseWriteBody(req: VercelRequest): { user?: unknown; key?: unknown; value?: unknown } {
  const body = req.body
  if (body == null) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { user?: unknown; key?: unknown; value?: unknown }
    } catch {
      return {}
    }
  }
  if (typeof body === 'object') return body as { user?: unknown; key?: unknown; value?: unknown }
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Account sync is chatty (debounced key writes); do not share the Autobahn check rate bucket.
  if (!guardApi(req, res, 'GET, PUT, POST, OPTIONS', { rateLimit: false })) return
  noStore(res)

  if (req.method === 'GET') {
    const userParam = typeof req.query.user === 'string' ? req.query.user : Array.isArray(req.query.user) ? req.query.user[0] : ''
    const user = validateUserId(userParam)
    if (!user) {
      res.status(400).json({ error: 'Invalid or unknown user.' })
      return
    }
    const { data, backend } = await readUserState(user)
    res.status(200).json({ user, data, backend })
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (bodyBytes(req) > STATE_BODY_MAX_BYTES) {
      res.status(413).json({ error: 'Payload too large (max 256 KB).' })
      return
    }
    const { user: rawUser, key: rawKey, value } = parseWriteBody(req)
    const user = validateUserId(rawUser)
    const key = validateStateKey(rawKey)
    if (!user || !key) {
      res.status(400).json({ error: 'Invalid user or key.' })
      return
    }
    if (value === undefined) {
      res.status(400).json({ error: 'Missing value.' })
      return
    }
    const { updatedAt } = await writeUserStateField(user, key, value)
    res.status(200).json({ ok: true, updatedAt })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
