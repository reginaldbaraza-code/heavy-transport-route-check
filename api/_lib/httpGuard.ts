import type { VercelRequest, VercelResponse } from '@vercel/node'

export const GPX_MAX_BYTES = 5 * 1024 * 1024
const WINDOW_MS = 60_000
const MAX_HITS = 40

type Bucket = { hits: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0].split(',')[0].trim()
  const socket = (req as VercelRequest & { socket?: { remoteAddress?: string } }).socket
  return socket?.remoteAddress || 'unknown'
}

export function applyCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  let allow = ''
  if (origin && host) {
    try {
      if (new URL(origin).host === host) allow = origin
    } catch {
      allow = ''
    }
  }
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function rateLimit(req: VercelRequest, res: VercelResponse): boolean {
  const now = Date.now()
  const ip = clientIp(req)
  const current = buckets.get(ip)
  if (!current || now >= current.resetAt) {
    buckets.set(ip, { hits: 1, resetAt: now + WINDOW_MS })
    return true
  }
  current.hits += 1
  if (current.hits > MAX_HITS) {
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' })
    return false
  }
  return true
}

export function rejectOversizedBody(req: VercelRequest, res: VercelResponse, extraBytes = 0): boolean {
  const header = req.headers['content-length']
  const declared = Number(Array.isArray(header) ? header[0] : header)
  if (Number.isFinite(declared) && declared > GPX_MAX_BYTES) {
    res.status(413).json({
      error: 'This file is larger than 4 MB. Export a smaller GPX from VEMAGS and try again.',
    })
    return false
  }
  if (extraBytes > GPX_MAX_BYTES) {
    res.status(413).json({
      error: 'This file is larger than 4 MB. Export a smaller GPX from VEMAGS and try again.',
    })
    return false
  }
  return true
}

export function guardApi(
  req: VercelRequest,
  res: VercelResponse,
  methods: string,
  opts?: { rateLimit?: boolean },
): boolean {
  applyCors(req, res, methods)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return false
  }
  if (!methods.split(',').map(item => item.trim()).includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  if (opts?.rateLimit === false) return true
  if (!rateLimit(req, res)) return false
  return true
}
