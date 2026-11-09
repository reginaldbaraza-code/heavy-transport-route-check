import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import checkRouteHandler from '../api/check-route.ts'
import autobahnEventsHandler from '../api/autobahn-events.ts'

const dist = resolve(process.cwd(), 'dist')
const port = Number(process.env.QA_PORT || 4173)

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gpx': 'application/gpx+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendFile(res: ServerResponse, filePath: string) {
  const type = mime[extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
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
    if (url.pathname === '/api/check-route') {
      const body = req.method === 'POST' ? await readJsonBody(req) : {}
      await checkRouteHandler({ method: req.method, body, query: Object.fromEntries(url.searchParams) } as any, mockRes(res) as any)
      return
    }
    if (url.pathname === '/api/autobahn-events') {
      await autobahnEventsHandler({ method: req.method, query: Object.fromEntries(url.searchParams) } as any, mockRes(res) as any)
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
      sendFile(res, candidate)
      return
    }
    sendFile(res, join(dist, 'index.html'))
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
