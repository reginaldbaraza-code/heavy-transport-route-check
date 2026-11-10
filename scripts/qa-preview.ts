import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream'
import checkRouteHandler from '../api/check-route.ts'
import autobahnEventsHandler from '../api/autobahn-events.ts'
import bwRoadworksHandler from '../api/bw-roadworks.ts'

const dist = resolve(process.cwd(), 'dist')
const port = Number(process.env.QA_PORT || 4173)

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.gpx': 'application/gpx+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendFile(req: IncomingMessage, res: ServerResponse, filePath: string) {
  const type = mime[extname(filePath)] || 'application/octet-stream'
  const accept = String(req.headers['accept-encoding'] || '')
  const compressible = /javascript|json|css|svg|xml|text\/|manifest|gpx/.test(type)
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=60',
  }
  if (compressible && accept.includes('gzip')) {
    headers['Content-Encoding'] = 'gzip'
    headers.Vary = 'Accept-Encoding'
    res.writeHead(200, headers)
    pipeline(createReadStream(filePath), createGzip({ level: 6 }), res, () => {})
    return
  }
  res.writeHead(200, headers)
  createReadStream(filePath).pipe(res)
}

function mockRes(res: ServerResponse) {
  let statusCode = 200
  return {
    status(code: number) {
      statusCode = code
      return this
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value)
    },
    json(data: unknown) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(data))
    },
    end() {
      res.writeHead(statusCode)
      res.end()
    },
  }
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)

  try {
    const apiReq = {
      method: req.method,
      query: Object.fromEntries(url.searchParams),
      headers: req.headers,
      socket: { remoteAddress: req.socket.remoteAddress },
    }
    if (url.pathname === '/api/check-route') {
      const body = req.method === 'POST' ? await readJsonBody(req) : {}
      await checkRouteHandler({ ...apiReq, body } as any, mockRes(res) as any)
      return
    }
    if (url.pathname === '/api/autobahn-events') {
      await autobahnEventsHandler(apiReq as any, mockRes(res) as any)
      return
    }
    if (url.pathname === '/api/bw-roadworks') {
      await bwRoadworksHandler(apiReq as any, mockRes(res) as any)
      return
    }

    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const candidate = normalize(join(dist, relative))
    if (!candidate.startsWith(dist)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      sendFile(req, res, candidate)
      return
    }
    sendFile(req, res, join(dist, 'index.html'))
  } catch (error) {
    console.error(error)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
    }
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`QA preview listening on http://127.0.0.1:${port}`)
})
