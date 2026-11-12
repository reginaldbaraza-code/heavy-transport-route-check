import {
  createKeepaliveBudget,
  decidePersistStart,
  encodeStateWriteBody,
  prepareCheckHistoryForPersist,
  reserveKeepaliveBytes,
  shouldScheduleRetry,
  STATE_BODY_MAX_BYTES,
  utf8ByteLength,
  KEEPALIVE_BODY_MAX_BYTES,
  type HistoryPersistInput,
  type KeepaliveBudget,
} from './checkHistoryPersist'
import { prepareSavedJobsForPersist } from './jobsPersist'
import type { SavedJob } from './jobs'

export const STORAGE_KEYS = {
  orgProfile: 'htr-org-profile',
  checkHistory: 'htr-route-check-history',
  alertState: 'htr-alert-read-state',
  overviewSampleMode: 'htr-overview-sample-mode',
  savedJobs: 'htr-saved-jobs',
  extraAlerts: 'htr-monitor-alerts',
  monitorPrefs: 'htr-monitor-prefs',
} as const

export const ONBOARDING_COMPLETE_KEY = 'htr-onboarding-complete'

export const STATE_FIELD_KEYS = [
  STORAGE_KEYS.orgProfile,
  STORAGE_KEYS.checkHistory,
  STORAGE_KEYS.alertState,
  STORAGE_KEYS.overviewSampleMode,
  STORAGE_KEYS.savedJobs,
  STORAGE_KEYS.extraAlerts,
  STORAGE_KEYS.monitorPrefs,
  ONBOARDING_COMPLETE_KEY,
] as const

export type StateFieldKey = (typeof STATE_FIELD_KEYS)[number]
export type SyncBackend = 'redis' | 'memory' | null
export type SyncSaveStatus = 'ok' | 'pending' | 'error'

export {
  KEEPALIVE_BODY_MAX_BYTES,
  STATE_BODY_MAX_BYTES,
  shouldUseKeepalive,
  createKeepaliveBudget,
  reserveKeepaliveBytes,
  decidePersistStart,
  shouldScheduleRetry,
  encodeStateWriteBody,
  utf8ByteLength,
} from './checkHistoryPersist'

/**
 * Chrome rejects fetch `{ keepalive: true }` and `navigator.sendBeacon` bodies
 * over ~64 KB, and that quota is shared across all in-flight keepalive requests.
 * Normal saves (debounce, immediate flush, retries) always use `keepalive: false`.
 * Only pagehide / visibilitychange=hidden may use keepalive/sendBeacon, and only
 * while a running shared byte budget still fits (sum ≤ 60 KB); anything that does
 * not fit uses the sync-XHR best-effort path instead.
 */

const DEBOUNCE_MS = 600
const MAX_RETRIES = 3

type SyncListener = () => void

type PendingSave = {
  userId: string
  serialized: string
}

const cache = new Map<string, string>()
const pendingTimers = new Map<string, number>()
/** Pending key → userId + body captured when the write was scheduled. */
const pendingSaves = new Map<string, PendingSave>()
const retryCounts = new Map<string, number>()
const inflightControllers = new Map<string, AbortController>()
const inflightSerialized = new Map<string, string>()
const inflightUserIds = new Map<string, string>()
const listeners = new Set<SyncListener>()

let activeUserId: string | null = null
let syncBackend: SyncBackend = null
let saveStatus: SyncSaveStatus = 'ok'
let flushHookInstalled = false
let saveToastShown = false

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeSyncStatus(listener: SyncListener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getActiveUserId(): string | null {
  return activeUserId
}

export function getSyncStatus(): {
  userId: string | null
  backend: SyncBackend
  saveStatus: SyncSaveStatus
  hasPending: boolean
} {
  return {
    userId: activeUserId,
    backend: syncBackend,
    saveStatus,
    hasPending: pendingSaves.size > 0,
  }
}

function setSaveStatus(next: SyncSaveStatus) {
  if (saveStatus === next) return
  saveStatus = next
  notify()
}

function setBackend(next: SyncBackend) {
  if (syncBackend === next) return
  syncBackend = next
  notify()
}

function installFlushHooks() {
  if (flushHookInstalled || typeof window === 'undefined') return
  flushHookInstalled = true
  // Prefer keepalive fetch so the write can finish; beacon / sync XHR inside flush.
  const flush = () => { void flushPendingSaves({ beacon: true }) }
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

function parseCached<T>(raw: string | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** No-op: legacy browser localStorage user data is ignored (start fresh). */
export function migrateLegacyStorage() {
  // Intentionally empty — product decision: do not migrate old htr-* / mds-* browser data.
}

export function readJson<T>(key: string, fallback: T): T {
  return parseCached(cache.get(key), fallback)
}

function prepareValueForPersist(
  key: string,
  value: unknown,
  userId: string,
): { value: unknown; dropped?: number } {
  if (key === STORAGE_KEYS.checkHistory && Array.isArray(value)) {
    return {
      value: prepareCheckHistoryForPersist(value as HistoryPersistInput[], {
        userId,
        maxBodyBytes: STATE_BODY_MAX_BYTES,
      }),
    }
  }
  if (key === STORAGE_KEYS.savedJobs && Array.isArray(value)) {
    const prepared = prepareSavedJobsForPersist(value as SavedJob[], {
      userId,
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    return { value: prepared.jobs, dropped: prepared.dropped }
  }
  return { value }
}

/**
 * Persist `value` for `opts.userId` (or the active user when omitted).
 * Stale writers whose userId ≠ the active session never touch the client cache
 * and never schedule a save for the newly active account.
 */
export function writeJson(
  key: string,
  value: unknown,
  opts?: { immediate?: boolean; userId?: string },
) {
  const forUser = opts?.userId ?? activeUserId
  if (!forUser) return
  // Drop any write that resolves for a user who is no longer active.
  if (forUser !== activeUserId) return

  const prepared = prepareValueForPersist(key, value, forUser)
  // Job-cap toasts are owned by JobsContext so the UI list and message stay in sync.
  const serialized = JSON.stringify(prepared.value)
  cache.set(key, serialized)
  if (!(STATE_FIELD_KEYS as readonly string[]).includes(key)) return
  if (opts?.immediate) {
    scheduleSaveImmediate(key, serialized, forUser)
  } else {
    scheduleSave(key, serialized, forUser)
  }
}

function clearPendingTimer(key: string) {
  const existing = pendingTimers.get(key)
  if (existing != null) {
    window.clearTimeout(existing)
    pendingTimers.delete(key)
  }
}

function abortInflight(key: string) {
  const controller = inflightControllers.get(key)
  if (!controller) return
  controller.abort()
  inflightControllers.delete(key)
  inflightSerialized.delete(key)
  inflightUserIds.delete(key)
}

function markPending(key: string, userId: string, serialized: string) {
  pendingSaves.set(key, { userId, serialized })
  setSaveStatus('pending')
}

function clearPendingIfMatch(key: string, userId: string, serialized: string) {
  const pending = pendingSaves.get(key)
  if (pending && pending.userId === userId && pending.serialized === serialized) {
    pendingSaves.delete(key)
  }
  if (pendingSaves.size === 0 && saveStatus !== 'error') setSaveStatus('ok')
}

function scheduleSave(key: string, serialized: string, userId: string) {
  markPending(key, userId, serialized)
  clearPendingTimer(key)
  const timer = window.setTimeout(() => {
    pendingTimers.delete(key)
    void persistKey(key, serialized, userId)
  }, DEBOUNCE_MS)
  pendingTimers.set(key, timer)
}

/** Skip debounce — used for job save and route-change flushes. */
function scheduleSaveImmediate(key: string, serialized: string, userId: string) {
  markPending(key, userId, serialized)
  clearPendingTimer(key)
  void persistKey(key, serialized, userId)
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError')
    || (error instanceof Error && error.name === 'AbortError')
  )
}

async function persistKey(
  key: string,
  serialized: string,
  userId: string,
  attempt = 0,
  opts?: { keepalive?: boolean },
): Promise<boolean> {
  // Server write is always bound to the user captured at schedule time.
  // Skip only when a newer value for the same user replaced this one in pending/cache.
  const pending = pendingSaves.get(key)
  if (pending && pending.userId === userId && pending.serialized !== serialized) {
    return true
  }
  if (activeUserId === userId && cache.get(key) !== serialized) {
    clearPendingIfMatch(key, userId, serialized)
    return true
  }

  const startDecision = decidePersistStart({
    hasInflight: inflightControllers.has(key),
    inflightSerialized: inflightSerialized.get(key) ?? null,
    nextSerialized: serialized,
  })
  // Same body already in flight for this key — but only skip if it's the same user.
  if (startDecision === 'skip-same-inflight' && inflightUserIds.get(key) === userId) {
    return true
  }

  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    clearPendingIfMatch(key, userId, serialized)
    setSaveStatus('error')
    return false
  }

  // History / jobs: last-chance trim if something still exceeds the server limit.
  if (key === STORAGE_KEYS.checkHistory && Array.isArray(value)) {
    const trimmed = prepareCheckHistoryForPersist(value as HistoryPersistInput[], {
      userId,
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    const trimmedSerialized = JSON.stringify(trimmed)
    if (trimmedSerialized !== serialized) {
      if (activeUserId === userId && cache.get(key) === serialized) {
        cache.set(key, trimmedSerialized)
      }
      if (pendingSaves.get(key)?.serialized === serialized && pendingSaves.get(key)?.userId === userId) {
        pendingSaves.set(key, { userId, serialized: trimmedSerialized })
      }
      serialized = trimmedSerialized
      value = trimmed
    }
  }
  if (key === STORAGE_KEYS.savedJobs && Array.isArray(value)) {
    const trimmed = prepareSavedJobsForPersist(value as SavedJob[], {
      userId,
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    const trimmedSerialized = JSON.stringify(trimmed.jobs)
    if (trimmedSerialized !== serialized) {
      if (activeUserId === userId && cache.get(key) === serialized) {
        cache.set(key, trimmedSerialized)
      }
      if (pendingSaves.get(key)?.serialized === serialized && pendingSaves.get(key)?.userId === userId) {
        pendingSaves.set(key, { userId, serialized: trimmedSerialized })
      }
      serialized = trimmedSerialized
      value = trimmed.jobs
    }
  }

  const body = encodeStateWriteBody(userId, key, value)
  const bodyBytes = utf8ByteLength(body)
  if (bodyBytes > STATE_BODY_MAX_BYTES) {
    // Never send a request the server will reject with 413.
    clearPendingIfMatch(key, userId, serialized)
    setSaveStatus('error')
    if (!saveToastShown && activeUserId === userId) {
      saveToastShown = true
      window.dispatchEvent(new CustomEvent('htr-sync-error', {
        detail: { message: "Couldn't save to your account. Retrying…" },
      }))
    }
    return false
  }

  if (startDecision === 'abort-and-replace' || (inflightControllers.has(key) && inflightUserIds.get(key) !== userId)) {
    abortInflight(key)
  }
  const controller = new AbortController()
  inflightControllers.set(key, controller)
  inflightSerialized.set(key, serialized)
  inflightUserIds.set(key, userId)

  const useKeepalive = opts?.keepalive === true

  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      // Normal saves never use keepalive — Chrome's shared ~64 KB quota rejects
      // concurrent keepalive PUTs even when each body alone would fit.
      keepalive: useKeepalive,
      signal: controller.signal,
    })
    if (inflightControllers.get(key) === controller) {
      inflightControllers.delete(key)
      inflightSerialized.delete(key)
      inflightUserIds.delete(key)
    }
    if (!res.ok) throw new Error(`save failed ${res.status}`)
    // Ignore success for a superseded body, or when this user is no longer active
    // (server write for the scheduled user is fine; do not touch the new user's cache).
    if (activeUserId !== userId || cache.get(key) !== serialized) {
      clearPendingIfMatch(key, userId, serialized)
      return true
    }
    clearPendingIfMatch(key, userId, serialized)
    retryCounts.delete(key)
    saveToastShown = false
    if (pendingSaves.size === 0) setSaveStatus('ok')
    return true
  } catch (error) {
    const stillMine = inflightControllers.get(key) === controller
    if (stillMine) {
      inflightControllers.delete(key)
      inflightSerialized.delete(key)
      inflightUserIds.delete(key)
    }
    // Superseded by a newer persist for this key — leave pendingSaves alone;
    // the replacement owns the pending state.
    if (isAbortError(error)) {
      return true
    }
    if (activeUserId !== userId || cache.get(key) !== serialized) {
      clearPendingIfMatch(key, userId, serialized)
      return true
    }
    if (attempt + 1 < MAX_RETRIES) {
      const delay = 400 * (2 ** attempt)
      await new Promise(resolve => window.setTimeout(resolve, delay))
      if (activeUserId !== userId) {
        clearPendingIfMatch(key, userId, serialized)
        return true
      }
      if (!shouldScheduleRetry({
        hasInflight: inflightControllers.has(key),
        cacheSerialized: cache.get(key),
        attemptedSerialized: serialized,
      })) {
        return true
      }
      return persistKey(key, serialized, userId, attempt + 1, opts)
    }
    clearPendingIfMatch(key, userId, serialized)
    retryCounts.set(key, attempt + 1)
    setSaveStatus('error')
    if (!saveToastShown && activeUserId === userId) {
      saveToastShown = true
      window.dispatchEvent(new CustomEvent('htr-sync-error', {
        detail: { message: "Couldn't save to your account. Retrying…" },
      }))
    }
    // Keep retrying quietly in the background — never while a PUT is in flight.
    // Capture userId so a later active-user change cannot redirect the retry.
    const retryUserId = userId
    window.setTimeout(() => {
      if (activeUserId !== retryUserId) return
      const current = cache.get(key)
      if (current == null) return
      if (!shouldScheduleRetry({
        hasInflight: inflightControllers.has(key),
        cacheSerialized: current,
        attemptedSerialized: current,
      })) {
        return
      }
      void persistKey(key, current, retryUserId, 0)
    }, 4000)
    return false
  }
}

function beaconSave(userId: string, key: string, serialized: string) {
  try {
    const body = encodeStateWriteBody(userId, key, JSON.parse(serialized))
    // sendBeacon shares the ~64 KB keepalive limit — caller must reserve first.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/state', blob)) return true
    }
  } catch {
    // fall through
  }
  return false
}

/**
 * Synchronous best-effort PUT for unload when the body exceeds the shared
 * keepalive budget. Async fetch is unreliable during pagehide; sync XHR may
 * still complete. Documented limit: see KEEPALIVE_BODY_MAX_BYTES.
 */
function syncUnloadSave(userId: string, key: string, serialized: string): boolean {
  try {
    const body = encodeStateWriteBody(userId, key, JSON.parse(serialized))
    const bodyBytes = utf8ByteLength(body)
    if (bodyBytes > STATE_BODY_MAX_BYTES) return false
    if (typeof XMLHttpRequest === 'undefined') return false
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', '/api/state', false)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(body)
    return xhr.status >= 200 && xhr.status < 300
  } catch {
    return false
  }
}

function bodyBytesFor(userId: string, key: string, serialized: string): number {
  return utf8ByteLength(encodeStateWriteBody(userId, key, JSON.parse(serialized)))
}

/**
 * Flush pending saves. Each write uses the userId captured when it was scheduled —
 * never the "current" user at flush time. When `opts.userId` is set, only that
 * user's pending keys are flushed (used before Switch user).
 */
export async function flushPendingSaves(opts?: { beacon?: boolean; userId?: string }): Promise<void> {
  const filterUser = opts?.userId
  for (const [key, timer] of pendingTimers.entries()) {
    const pending = pendingSaves.get(key)
    if (filterUser && pending && pending.userId !== filterUser) continue
    window.clearTimeout(timer)
    pendingTimers.delete(key)
  }

  const entries = [...pendingSaves.entries()].filter(([, pending]) => (
    !filterUser || pending.userId === filterUser
  ))
  if (entries.length === 0) return

  // Shared across this unload flush only — Chrome's keepalive quota is per-tab.
  const keepaliveBudget: KeepaliveBudget | null = opts?.beacon ? createKeepaliveBudget() : null

  await Promise.all(entries.map(async ([key, pending]) => {
    const { userId, serialized } = pending
    if (opts?.beacon && keepaliveBudget) {
      let bodyBytes = 0
      try {
        bodyBytes = bodyBytesFor(userId, key, serialized)
      } catch {
        await persistKey(key, serialized, userId)
        return
      }

      if (reserveKeepaliveBytes(keepaliveBudget, bodyBytes)) {
        if (beaconSave(userId, key, serialized)) {
          pendingSaves.delete(key)
          return
        }
        // Beacon refused — try a single keepalive fetch against the reserved budget.
        await persistKey(key, serialized, userId, 0, { keepalive: true })
        return
      }

      // Does not fit the shared keepalive budget: sync XHR best-effort.
      if (syncUnloadSave(userId, key, serialized)) {
        pendingSaves.delete(key)
        return
      }
    }
    // Normal flush (or unload fallback): never use keepalive.
    await persistKey(key, serialized, userId)
  }))
}

export async function hydrateUserStore(userId: string): Promise<SyncBackend> {
  installFlushHooks()
  // Clear under a null active user so late writers for any account cannot land
  // in the cache during the transition, then activate the new user.
  activeUserId = null
  cache.clear()
  pendingSaves.clear()
  retryCounts.clear()
  for (const controller of inflightControllers.values()) controller.abort()
  inflightControllers.clear()
  inflightSerialized.clear()
  inflightUserIds.clear()
  for (const timer of pendingTimers.values()) window.clearTimeout(timer)
  pendingTimers.clear()
  saveToastShown = false
  setSaveStatus('ok')
  setBackend(null)
  activeUserId = userId

  const res = await fetch(`/api/state?user=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to load account state (${res.status})`)
  // Another hydrate/clear may have won while we awaited — do not apply stale payload.
  if (activeUserId !== userId) return syncBackend
  const payload = await res.json() as {
    user: string
    data: Record<string, unknown>
    backend: 'redis' | 'memory'
  }
  if (activeUserId !== userId) return syncBackend
  for (const [key, value] of Object.entries(payload.data || {})) {
    if (typeof value === 'string') cache.set(key, value)
    else cache.set(key, JSON.stringify(value))
  }
  setBackend(payload.backend)
  notify()
  return payload.backend
}

export async function clearUserStore(opts?: { flush?: boolean }) {
  const previousUserId = activeUserId
  if (opts?.flush !== false) {
    await flushPendingSaves({ beacon: true, userId: previousUserId ?? undefined })
  }
  activeUserId = null
  cache.clear()
  pendingSaves.clear()
  retryCounts.clear()
  for (const controller of inflightControllers.values()) controller.abort()
  inflightControllers.clear()
  inflightSerialized.clear()
  inflightUserIds.clear()
  for (const timer of pendingTimers.values()) window.clearTimeout(timer)
  pendingTimers.clear()
  setBackend(null)
  setSaveStatus('ok')
  saveToastShown = false
  notify()
}

/** Test / QA helper — peek at hydrated cache. */
export function getCachedRaw(key: string): string | undefined {
  return cache.get(key)
}
