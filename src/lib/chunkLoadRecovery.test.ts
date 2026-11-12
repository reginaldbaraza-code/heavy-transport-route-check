import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_TTL_MS,
  clearChunkReload,
  importWithChunkRecovery,
  installChunkLoadRecovery,
  isChunkLoadError,
  markChunkReload,
  readChunkReloadAt,
  tryReloadForChunkError,
  type ChunkReloadStorage,
} from './chunkLoadRecovery.ts'

function memoryStorage(initial: Record<string, string> = {}): ChunkReloadStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    removeItem(key) {
      delete data[key]
    },
  }
}

test('isChunkLoadError detects dynamic import and preload failures', () => {
  assert.equal(
    isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/Settings-abc.js')),
    true,
  )
  assert.equal(
    isChunkLoadError(new Error('error loading dynamically imported module')),
    true,
  )
  assert.equal(isChunkLoadError(new TypeError('Importing a module script failed.')), true)
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css')), true)
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false)
  assert.equal(isChunkLoadError(null), false)
})

test('tryReloadForChunkError reloads once and guards against loops', () => {
  const storage = memoryStorage()
  let reloads = 0
  const navigation = { reload: () => { reloads += 1 } }
  let now = 1_000

  const first = tryReloadForChunkError({
    error: new TypeError('Failed to fetch dynamically imported module: https://x/a.js'),
    storage,
    navigation,
    now: () => now,
  })
  assert.equal(first, true)
  assert.equal(reloads, 1)
  assert.equal(storage.data[CHUNK_RELOAD_STORAGE_KEY], '1000')

  const second = tryReloadForChunkError({
    error: new TypeError('Failed to fetch dynamically imported module: https://x/a.js'),
    storage,
    navigation,
    now: () => now + 5_000,
  })
  assert.equal(second, false)
  assert.equal(reloads, 1)

  now += CHUNK_RELOAD_TTL_MS + 1
  const third = tryReloadForChunkError({
    error: new TypeError('Failed to fetch dynamically imported module: https://x/b.js'),
    storage,
    navigation,
    now: () => now,
  })
  assert.equal(third, true)
  assert.equal(reloads, 2)
})

test('tryReloadForChunkError ignores non-chunk errors unless forced', () => {
  const storage = memoryStorage()
  let reloads = 0
  const navigation = { reload: () => { reloads += 1 } }

  assert.equal(
    tryReloadForChunkError({
      error: new Error('boom'),
      storage,
      navigation,
    }),
    false,
  )
  assert.equal(reloads, 0)

  assert.equal(
    tryReloadForChunkError({
      force: true,
      storage,
      navigation,
      now: () => 42,
    }),
    true,
  )
  assert.equal(reloads, 1)
  assert.equal(storage.data[CHUNK_RELOAD_STORAGE_KEY], '42')
})

test('readChunkReloadAt expires and clears stale markers', () => {
  const storage = memoryStorage({ [CHUNK_RELOAD_STORAGE_KEY]: '10' })
  assert.equal(readChunkReloadAt(storage, () => 10 + CHUNK_RELOAD_TTL_MS + 1), null)
  assert.equal(storage.data[CHUNK_RELOAD_STORAGE_KEY], undefined)

  markChunkReload(storage, () => 100)
  assert.equal(readChunkReloadAt(storage, () => 100), 100)
  clearChunkReload(storage)
  assert.equal(readChunkReloadAt(storage, () => 100), null)
})

test('importWithChunkRecovery reloads on chunk failure then rethrows after guard', async () => {
  const storage = memoryStorage()
  let reloads = 0
  const navigation = { reload: () => { reloads += 1 } }
  const chunkError = new TypeError('Failed to fetch dynamically imported module: https://x/Settings.js')

  const pending = importWithChunkRecovery(
    () => Promise.reject(chunkError),
    { storage, navigation, now: () => 7 },
  )
  // First failure starts a reload and leaves the promise pending while the page unloads.
  await Promise.race([
    pending.then(
      () => { throw new Error('expected pending promise') },
      () => { throw new Error('expected pending promise') },
    ),
    new Promise<void>(resolve => setTimeout(resolve, 20)),
  ])
  assert.equal(reloads, 1)

  await assert.rejects(
    () => importWithChunkRecovery(
      () => Promise.reject(chunkError),
      { storage, navigation, now: () => 7 },
    ),
    chunkError,
  )
  assert.equal(reloads, 1)
})

test('importWithChunkRecovery resolves successful imports', async () => {
  const value = await importWithChunkRecovery(async () => ({ default: 1 }))
  assert.deepEqual(value, { default: 1 })
})

test('installChunkLoadRecovery preventDefault only when a reload starts', () => {
  const storage = memoryStorage()
  let reloads = 0
  const listeners = new Map<string, Set<EventListener>>()
  const target = {
    addEventListener(type: string, listener: EventListener) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener)
    },
  }
  const dispose = installChunkLoadRecovery({
    target,
    storage,
    navigation: { reload: () => { reloads += 1 } },
    now: () => 50,
  })

  let prevented = 0
  const first = {
    preventDefault() { prevented += 1 },
  } as Event
  for (const listener of listeners.get('vite:preloadError') ?? []) listener(first)
  assert.equal(reloads, 1)
  assert.equal(prevented, 1)

  prevented = 0
  const second = {
    preventDefault() { prevented += 1 },
  } as Event
  for (const listener of listeners.get('vite:preloadError') ?? []) listener(second)
  assert.equal(reloads, 1)
  assert.equal(prevented, 0)

  dispose()
})
