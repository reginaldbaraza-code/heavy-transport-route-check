/**
 * Regression: switching users must not let an in-flight / debounced save for A
 * land in B's client cache or as a PUT for B.
 */
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

type PutCall = { user: string; key: string; value: unknown }

type FakeResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function installBrowserGlobals() {
  const localStorage = new Map<string, string>()

  const windowObj = {
    localStorage: {
      getItem: (key: string) => localStorage.get(key) ?? null,
      setItem: (key: string, value: string) => { localStorage.set(key, value) },
      removeItem: (key: string) => { localStorage.delete(key) },
    },
    setTimeout: (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) =>
      setTimeout(fn, ms ?? 0, ...args) as unknown as number,
    clearTimeout: (id: number) => clearTimeout(id as unknown as NodeJS.Timeout),
    addEventListener: () => {},
    dispatchEvent: () => true,
  }

  const documentObj = {
    visibilityState: 'visible' as const,
    addEventListener: () => {},
  }

  Object.assign(globalThis, {
    window: windowObj,
    document: documentObj,
    localStorage: windowObj.localStorage,
    CustomEvent: class CustomEvent {
      type: string
      detail: unknown
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type
        this.detail = init?.detail
      }
    },
  })
}

const serverState = new Map<string, Record<string, unknown>>()
const putCalls: PutCall[] = []
let pendingPuts: Array<{
  user: string
  key: string
  value: unknown
  resolve: (res: FakeResponse) => void
  reject: (err: Error) => void
}> = []
let holdPuts = false

function jsonResponse(data: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }
}

async function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<FakeResponse> {
  const url = String(input)
  const method = (init?.method || 'GET').toUpperCase()

  if (method === 'GET' && url.includes('/api/state')) {
    const user = new URL(url, 'http://local').searchParams.get('user') || ''
    return jsonResponse({
      user,
      data: serverState.get(user) || {},
      backend: 'memory',
    })
  }

  if ((method === 'PUT' || method === 'POST') && url.includes('/api/state')) {
    const body = JSON.parse(String(init?.body || '{}')) as PutCall
    putCalls.push({ user: body.user, key: body.key, value: body.value })

    if (init?.signal?.aborted) {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }

    if (holdPuts) {
      return await new Promise<FakeResponse>((resolve, reject) => {
        const onAbort = () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (init?.signal) {
          if (init.signal.aborted) {
            onAbort()
            return
          }
          init.signal.addEventListener('abort', onAbort, { once: true })
        }
        pendingPuts.push({
          user: body.user,
          key: body.key,
          value: body.value,
          resolve: (res) => {
            init?.signal?.removeEventListener('abort', onAbort)
            const bucket = serverState.get(body.user) || {}
            bucket[body.key] = body.value
            serverState.set(body.user, bucket)
            resolve(res)
          },
          reject,
        })
      })
    }

    const bucket = serverState.get(body.user) || {}
    bucket[body.key] = body.value
    serverState.set(body.user, bucket)
    return jsonResponse({ ok: true, updatedAt: new Date().toISOString() })
  }

  return jsonResponse({ error: 'not found' }, 404)
}

installBrowserGlobals()
// @ts-expect-error test mock
globalThis.fetch = mockFetch

const store = await import('./browserStore.ts')
const users = await import('./users.ts')

const annaJob = {
  id: 'job-anna-1',
  name: 'Anna isolation job',
  createdAt: '2026-03-12T08:00:00.000Z',
  updatedAt: '2026-03-12T08:00:00.000Z',
  vehicle: { width: 3, height: 4, length: 25, grossWeight: 52 },
  plannedDeparture: '2026-03-12T18:00:00.000Z',
  gpxContent: '',
  origin: 'A',
  destination: 'B',
  corridor: 'A7',
}

beforeEach(async () => {
  holdPuts = false
  for (const pending of pendingPuts) {
    const err = new Error('aborted')
    err.name = 'AbortError'
    pending.reject(err)
  }
  pendingPuts = []
  putCalls.length = 0
  serverState.clear()
  await store.clearUserStore({ flush: false })
})

after(async () => {
  await store.clearUserStore({ flush: false }).catch(() => {})
})

before(() => {
  assert.ok(typeof store.writeJson === 'function')
})

test('stale write for user A does not land in user B cache or as a B PUT', async () => {
  await store.hydrateUserStore('anna')
  store.writeJson(store.STORAGE_KEYS.savedJobs, [annaJob], { immediate: true, userId: 'anna' })
  await store.flushPendingSaves({ userId: 'anna' })

  const annaServer = serverState.get('anna')?.[store.STORAGE_KEYS.savedJobs] as typeof annaJob[]
  assert.ok(Array.isArray(annaServer) && annaServer[0]?.id === 'job-anna-1')
  assert.equal(annaServer[0]?.createdAt, annaJob.createdAt)

  // Switch to Paul: flush Anna, clear cache, hydrate empty Paul.
  await store.flushPendingSaves({ userId: 'anna' })
  await store.clearUserStore({ flush: false })
  await store.hydrateUserStore('paul')

  assert.equal(store.getCachedRaw(store.STORAGE_KEYS.savedJobs), undefined)
  assert.equal(store.getActiveUserId(), 'paul')

  // Simulate late job-monitor / debounced save completing for Anna after the switch.
  store.writeJson(store.STORAGE_KEYS.savedJobs, [annaJob], { immediate: true, userId: 'anna' })
  store.writeJson(store.STORAGE_KEYS.checkHistory, [{
    id: 'check-anna-1',
    permitName: 'Anna isolation job',
    routeLabel: 'A → B',
    runAt: annaJob.createdAt,
    verdict: 'READY',
    evidenceCount: 0,
    retrievedAt: annaJob.createdAt,
    source: 'test',
    summary: 'stale',
  }], { immediate: true, userId: 'anna' })

  assert.equal(store.getCachedRaw(store.STORAGE_KEYS.savedJobs), undefined)
  assert.equal(store.getCachedRaw(store.STORAGE_KEYS.checkHistory), undefined)

  const paulPuts = putCalls.filter(call => call.user === 'paul')
  assert.equal(paulPuts.length, 0, `Paul must not receive Anna's data: ${JSON.stringify(paulPuts)}`)

  const paulServerJobs = serverState.get('paul')?.[store.STORAGE_KEYS.savedJobs]
  assert.ok(paulServerJobs == null || (Array.isArray(paulServerJobs) && paulServerJobs.length === 0))

  // Anna's data remains intact on the server.
  const annaAgain = serverState.get('anna')?.[store.STORAGE_KEYS.savedJobs] as typeof annaJob[]
  assert.equal(annaAgain[0]?.id, 'job-anna-1')
  assert.equal(annaAgain[0]?.createdAt, annaJob.createdAt)
})

test('in-flight persist for A cannot rewrite B cache after switch', async () => {
  holdPuts = true
  await store.hydrateUserStore('anna')
  store.writeJson(store.STORAGE_KEYS.savedJobs, [annaJob], { immediate: true, userId: 'anna' })

  await new Promise<void>((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (pendingPuts.some(p => p.user === 'anna')) resolve()
      else if (Date.now() - start > 2000) reject(new Error('Anna PUT never held'))
      else setTimeout(tick, 5)
    }
    tick()
  })

  // Switch before the PUT resolves — abort in-flight, hydrate Paul.
  await store.clearUserStore({ flush: false })
  await store.hydrateUserStore('paul')
  assert.equal(store.getCachedRaw(store.STORAGE_KEYS.savedJobs), undefined)

  // Resolve any non-aborted leftovers; body.user must remain anna (never paul).
  for (const pending of [...pendingPuts]) {
    pending.resolve(jsonResponse({ ok: true }))
  }
  pendingPuts = []
  holdPuts = false

  // Paul's empty write after switch.
  store.writeJson(store.STORAGE_KEYS.savedJobs, [], { immediate: true, userId: 'paul' })
  await store.flushPendingSaves({ userId: 'paul' })

  const leakedToPaul = putCalls.some(
    call => call.user === 'paul'
      && call.key === store.STORAGE_KEYS.savedJobs
      && Array.isArray(call.value)
      && (call.value as Array<{ id?: string }>).some(job => job?.id === 'job-anna-1'),
  )
  assert.equal(leakedToPaul, false)

  const paulCache = store.readJson<Array<{ id?: string }>>(store.STORAGE_KEYS.savedJobs, [])
  assert.equal(paulCache.some(job => job.id === 'job-anna-1'), false)

  // Anna still has her job on the server from the held PUT (if it committed) or prior — either way
  // Paul must stay clean. Re-seed Anna path to assert intactness after a clean save.
  holdPuts = false
  await store.clearUserStore({ flush: false })
  await store.hydrateUserStore('anna')
  store.writeJson(store.STORAGE_KEYS.savedJobs, [annaJob], { immediate: true, userId: 'anna' })
  await store.flushPendingSaves({ userId: 'anna' })
  const annaAgain = serverState.get('anna')?.[store.STORAGE_KEYS.savedJobs] as typeof annaJob[]
  assert.equal(annaAgain[0]?.createdAt, annaJob.createdAt)
})

test('clearStoredUserId removes htr-current-user so login does not auto-sign previous user', () => {
  users.writeStoredUserId('anna')
  assert.equal(users.readStoredUserId(), 'anna')
  users.clearStoredUserId()
  assert.equal(users.readStoredUserId(), null)
  assert.equal(window.localStorage.getItem(users.CURRENT_USER_STORAGE_KEY), null)
})
