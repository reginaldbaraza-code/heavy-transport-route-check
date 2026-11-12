/** Session key marking a recent recovery reload after a stale chunk failure. */
export const CHUNK_RELOAD_STORAGE_KEY = 'htr-chunk-reload'

/** Ignore a prior reload marker older than this (ms) so a later deploy can recover again. */
export const CHUNK_RELOAD_TTL_MS = 30_000

const DYNAMIC_IMPORT_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

export type ChunkReloadStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ChunkReloadClock = () => number

export type ChunkReloadNavigation = {
  reload: () => void
}

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : ''
  if (DYNAMIC_IMPORT_RE.test(message)) return true
  // Chromium sometimes surfaces a bare TypeError without a useful message for 404 chunks.
  if (error instanceof TypeError && /fetch|load|import/i.test(message || 'fetch')) return true
  return false
}

export function readChunkReloadAt(
  storage: ChunkReloadStorage | null | undefined,
  now: ChunkReloadClock = Date.now,
): number | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(CHUNK_RELOAD_STORAGE_KEY)
    if (!raw) return null
    const at = Number(raw)
    if (!Number.isFinite(at)) {
      storage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
      return null
    }
    if (now() - at > CHUNK_RELOAD_TTL_MS) {
      storage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
      return null
    }
    return at
  } catch {
    return null
  }
}

export function markChunkReload(
  storage: ChunkReloadStorage | null | undefined,
  now: ChunkReloadClock = Date.now,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now()))
    return true
  } catch {
    return false
  }
}

export function clearChunkReload(storage: ChunkReloadStorage | null | undefined): void {
  if (!storage) return
  try {
    storage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
  } catch {
    // Private mode — nothing to clear.
  }
}

/**
 * Returns true when a recovery reload was started.
 * Returns false when a reload was already attempted recently (caller should surface UI).
 */
export function tryReloadForChunkError(options: {
  error?: unknown
  storage?: ChunkReloadStorage | null
  navigation?: ChunkReloadNavigation
  now?: ChunkReloadClock
  /** When true, skip isChunkLoadError (e.g. vite:preloadError is already authoritative). */
  force?: boolean
}): boolean {
  const {
    error,
    storage = typeof sessionStorage === 'undefined' ? null : sessionStorage,
    navigation = typeof window === 'undefined' ? { reload: () => undefined } : window.location,
    now = Date.now,
    force = false,
  } = options

  if (!force && error !== undefined && !isChunkLoadError(error)) return false
  if (readChunkReloadAt(storage, now) != null) return false
  markChunkReload(storage, now)
  navigation.reload()
  return true
}

export function installChunkLoadRecovery(options?: {
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>
  storage?: ChunkReloadStorage | null
  navigation?: ChunkReloadNavigation
  now?: ChunkReloadClock
}): () => void {
  const target = options?.target ?? (typeof window === 'undefined' ? null : window)
  if (!target) return () => undefined

  const onPreloadError = (event: Event) => {
    const reloaded = tryReloadForChunkError({
      force: true,
      storage: options?.storage,
      navigation: options?.navigation,
      now: options?.now,
    })
    // Only swallow Vite's default throw when we are recovering with a reload.
    // If the guard blocks another reload, let the failure surface to React.lazy /
    // the error boundary (otherwise the import can resolve without a module).
    if (
      reloaded &&
      'preventDefault' in event &&
      typeof event.preventDefault === 'function'
    ) {
      event.preventDefault()
    }
  }

  target.addEventListener('vite:preloadError', onPreloadError)
  return () => target.removeEventListener('vite:preloadError', onPreloadError)
}

/**
 * Wrap a dynamic import so a stale hashed chunk triggers one guarded full reload
 * instead of bubbling into the React error boundary on the first failure.
 */
export function importWithChunkRecovery<T>(
  importer: () => Promise<T>,
  options?: {
    storage?: ChunkReloadStorage | null
    navigation?: ChunkReloadNavigation
    now?: ChunkReloadClock
  },
): Promise<T> {
  return importer().catch(error => {
    const reloaded = tryReloadForChunkError({
      error,
      storage: options?.storage,
      navigation: options?.navigation,
      now: options?.now,
    })
    if (reloaded) {
      // Keep the Suspense boundary pending while the document unloads.
      return new Promise<T>(() => undefined)
    }
    throw error
  })
}
