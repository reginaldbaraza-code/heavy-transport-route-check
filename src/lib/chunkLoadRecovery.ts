/** Session key marking a recent recovery reload after a stale chunk failure. */
export const CHUNK_RELOAD_STORAGE_KEY = 'htr-chunk-reload'

/** Ignore a prior reload marker older than this (ms) so a later deploy can recover again. */
export const CHUNK_RELOAD_TTL_MS = 30_000

const DYNAMIC_IMPORT_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

/** React.lazy crash when a prevented vite:preloadError resolves the import as undefined. */
const UNDEFINED_LAZY_DEFAULT_RE =
  /Cannot read propert(?:y|ies) of undefined \(reading ['"]default['"]\)/i

export type ChunkReloadStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type ChunkReloadClock = () => number

export type ChunkReloadNavigation = {
  reload: () => void
}

/**
 * True for this document after tryReloadForChunkError starts a reload.
 * Resets on full navigation (new JS realm). Distinguishes an in-flight recovery
 * reload from a sessionStorage marker left by a previous page load.
 */
let chunkReloadInitiatedThisDocument = false

/** Test helper — reset the in-document reload flag between cases. */
export function resetChunkReloadInitiatedForTests(): void {
  chunkReloadInitiatedThisDocument = false
}

export function wasChunkReloadInitiated(): boolean {
  return chunkReloadInitiatedThisDocument
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
  if (UNDEFINED_LAZY_DEFAULT_RE.test(message)) return true
  // Chromium sometimes surfaces a bare TypeError without a useful message for 404 chunks.
  if (error instanceof TypeError && /fetch|load|import/i.test(message || 'fetch')) return true
  return false
}

/**
 * Vite's preload helper resolves the dynamic import with `undefined` when a
 * `vite:preloadError` listener calls `preventDefault()` (see Vite handlePreloadError).
 * React.lazy then crashes reading `.default`. Treat that as a failed chunk load.
 */
export function isMissingLazyModule(module: unknown): boolean {
  return module == null
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
  chunkReloadInitiatedThisDocument = true
  navigation.reload()
  return true
}

/**
 * Keep React.lazy / Suspense pending while a recovery reload unloads the document.
 * Used when we started the reload, or when vite:preloadError already did.
 */
function pendingWhileReloading<T>(): Promise<T> {
  return new Promise<T>(() => undefined)
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
    // preventDefault makes the dynamic import resolve with `undefined` — callers
    // must use importWithChunkRecovery (or equivalent) so React.lazy never sees it.
    // If the guard blocks another reload, let the failure reject so the error
    // boundary can show the new-version message.
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
  const storage = options?.storage
  const navigation = options?.navigation
  const now = options?.now

  const recoverOrThrow = (error: unknown): Promise<T> => {
    const reloaded = tryReloadForChunkError({
      error,
      storage,
      navigation,
      now,
    })
    if (reloaded || wasChunkReloadInitiated()) {
      return pendingWhileReloading()
    }
    throw error instanceof Error
      ? error
      : new TypeError('Failed to fetch dynamically imported module')
  }

  return importer().then(
    (mod) => {
      // preventDefault on vite:preloadError → import resolves undefined instead of rejecting.
      if (isMissingLazyModule(mod)) {
        return recoverOrThrow(
          new TypeError('Failed to fetch dynamically imported module'),
        )
      }
      return mod
    },
    (error: unknown) => recoverOrThrow(error),
  )
}
