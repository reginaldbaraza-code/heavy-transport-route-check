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

const cache = new Map<string, string>()
const pendingTimers = new Map<string, number>()
const pendingKeys = new Set<string>()
const retryCounts = new Map<string, number>()
const inflightControllers = new Map<string, AbortController>()
const inflightSerialized = new Map<string, string>()
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
    hasPending: pendingKeys.size > 0,
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

function prepareValueForPersist(key: string, value: unknown): { value: unknown; dropped?: number } {
  if (key === STORAGE_KEYS.checkHistory && Array.isArray(value)) {
    return {
      value: prepareCheckHistoryForPersist(value as HistoryPersistInput[], {
        userId: activeUserId || 'user',
        maxBodyBytes: STATE_BODY_MAX_BYTES,
      }),
    }
  }
  if (key === STORAGE_KEYS.savedJobs && Array.isArray(value)) {
    const prepared = prepareSavedJobsForPersist(value as SavedJob[], {
      userId: activeUserId || 'user',
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    return { value: prepared.jobs, dropped: prepared.dropped }
  }
  return { value }
}

export function writeJson(key: string, value: unknown, opts?: { immediate?: boolean }) {
  const prepared = prepareValueForPersist(key, value)
  // Job-cap toasts are owned by JobsContext so the UI list and message stay in sync.
  const serialized = JSON.stringify(prepared.value)
  cache.set(key, serialized)
  if (!activeUserId) return
  if (!(STATE_FIELD_KEYS as readonly string[]).includes(key)) return
  if (opts?.immediate) {
    scheduleSaveImmediate(key, serialized)
  } else {
    scheduleSave(key, serialized)
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
}

function scheduleSave(key: string, serialized: string) {
  pendingKeys.add(key)
  setSaveStatus('pending')
  clearPendingTimer(key)
  const timer = window.setTimeout(() => {
    pendingTimers.delete(key)
    void persistKey(key, serialized)
  }, DEBOUNCE_MS)
  pendingTimers.set(key, timer)
}

/** Skip debounce — used for job save and route-change flushes. */
function scheduleSaveImmediate(key: string, serialized: string) {
  pendingKeys.add(key)
  setSaveStatus('pending')
  clearPendingTimer(key)
  void persistKey(key, serialized)
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
  attempt = 0,
  opts?: { keepalive?: boolean },
): Promise<boolean> {
  if (!activeUserId) return false
  // Skip if a newer value replaced this one while we were waiting.
  if (cache.get(key) !== serialized) {
    pendingKeys.delete(key)
    if (pendingKeys.size === 0 && saveStatus !== 'error') setSaveStatus('ok')
    return true
  }

  const startDecision = decidePersistStart({
    hasInflight: inflightControllers.has(key),
    inflightSerialized: inflightSerialized.get(key) ?? null,
    nextSerialized: serialized,
  })
  if (startDecision === 'skip-same-inflight') {
    // Same body already in flight — do not open a second PUT for this key.
    return true
  }

  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    pendingKeys.delete(key)
    setSaveStatus('error')
    return false
  }

  // History / jobs: last-chance trim if something still exceeds the server limit.
  if (key === STORAGE_KEYS.checkHistory && Array.isArray(value)) {
    const trimmed = prepareCheckHistoryForPersist(value as HistoryPersistInput[], {
      userId: activeUserId,
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    const trimmedSerialized = JSON.stringify(trimmed)
    if (trimmedSerialized !== serialized) {
      cache.set(key, trimmedSerialized)
      serialized = trimmedSerialized
      value = trimmed
    }
  }
  if (key === STORAGE_KEYS.savedJobs && Array.isArray(value)) {
    const trimmed = prepareSavedJobsForPersist(value as SavedJob[], {
      userId: activeUserId,
      maxBodyBytes: STATE_BODY_MAX_BYTES,
    })
    const trimmedSerialized = JSON.stringify(trimmed.jobs)
    if (trimmedSerialized !== serialized) {
      cache.set(key, trimmedSerialized)
      serialized = trimmedSerialized
      value = trimmed.jobs
    }
  }

  const body = encodeStateWriteBody(activeUserId, key, value)
  const bodyBytes = utf8ByteLength(body)
  if (bodyBytes > STATE_BODY_MAX_BYTES) {
    // Never send a request the server will reject with 413.
    pendingKeys.delete(key)
    setSaveStatus('error')
    if (!saveToastShown) {
      saveToastShown = true
      window.dispatchEvent(new CustomEvent('htr-sync-error', {
        detail: { message: "Couldn't save to your account. Retrying…" },
      }))
    }
    return false
  }

  if (startDecision === 'abort-and-replace') abortInflight(key)
  const controller = new AbortController()
  inflightControllers.set(key, controller)
  inflightSerialized.set(key, serialized)

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
    }
    if (!res.ok) throw new Error(`save failed ${res.status}`)
    // Ignore success for a superseded body.
    if (cache.get(key) !== serialized) {
      pendingKeys.delete(key)
      if (pendingKeys.size === 0 && saveStatus !== 'error') setSaveStatus('ok')
      return true
    }
    pendingKeys.delete(key)
    retryCounts.delete(key)
    saveToastShown = false
    if (pendingKeys.size === 0) setSaveStatus('ok')
    return true
  } catch (error) {
    const stillMine = inflightControllers.get(key) === controller
    if (stillMine) {
      inflightControllers.delete(key)
      inflightSerialized.delete(key)
    }
    // Superseded by a newer persist for this key — leave pendingKeys alone;
    // the replacement owns the pending state.
    if (isAbortError(error)) {
      return true
    }
    if (cache.get(key) !== serialized) {
      pendingKeys.delete(key)
      if (pendingKeys.size === 0 && saveStatus !== 'error') setSaveStatus('ok')
      return true
    }
    if (attempt + 1 < MAX_RETRIES) {
      const delay = 400 * (2 ** attempt)
      await new Promise(resolve => window.setTimeout(resolve, delay))
      if (!shouldScheduleRetry({
        hasInflight: inflightControllers.has(key),
        cacheSerialized: cache.get(key),
        attemptedSerialized: serialized,
      })) {
        return true
      }
      return persistKey(key, serialized, attempt + 1, opts)
    }
    pendingKeys.delete(key)
    retryCounts.set(key, attempt + 1)
    setSaveStatus('error')
    if (!saveToastShown) {
      saveToastShown = true
      window.dispatchEvent(new CustomEvent('htr-sync-error', {
        detail: { message: "Couldn't save to your account. Retrying…" },
      }))
    }
    // Keep retrying quietly in the background — never while a PUT is in flight.
    window.setTimeout(() => {
      const current = cache.get(key)
      if (current == null || !activeUserId) return
      if (!shouldScheduleRetry({
        hasInflight: inflightControllers.has(key),
        cacheSerialized: current,
        attemptedSerialized: current,
      })) {
        return
      }
      void persistKey(key, current, 0)
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

export async function flushPendingSaves(opts?: { beacon?: boolean }): Promise<void> {
  if (!activeUserId) return
  const userId = activeUserId
  for (const timer of pendingTimers.values()) window.clearTimeout(timer)
  pendingTimers.clear()

  const keys = [...pendingKeys]
  if (keys.length === 0) return

  // Shared across this unload flush only — Chrome's keepalive quota is per-tab.
  const keepaliveBudget: KeepaliveBudget | null = opts?.beacon ? createKeepaliveBudget() : null

  await Promise.all(keys.map(async key => {
    const serialized = cache.get(key)
    if (serialized == null) {
      pendingKeys.delete(key)
      return
    }
    if (opts?.beacon && keepaliveBudget) {
      let bodyBytes = 0
      try {
        bodyBytes = bodyBytesFor(userId, key, serialized)
      } catch {
        await persistKey(key, serialized)
        return
      }

      if (reserveKeepaliveBytes(keepaliveBudget, bodyBytes)) {
        if (beaconSave(userId, key, serialized)) {
          pendingKeys.delete(key)
          return
        }
        // Beacon refused — try a single keepalive fetch against the reserved budget.
        await persistKey(key, serialized, 0, { keepalive: true })
        return
      }

      // Does not fit the shared keepalive budget: sync XHR best-effort.
      if (syncUnloadSave(userId, key, serialized)) {
        pendingKeys.delete(key)
        return
      }
    }
    // Normal flush (or unload fallback): never use keepalive.
    await persistKey(key, serialized)
  }))
}

export async function hydrateUserStore(userId: string): Promise<SyncBackend> {
  installFlushHooks()
  activeUserId = userId
  cache.clear()
  pendingKeys.clear()
  retryCounts.clear()
  for (const controller of inflightControllers.values()) controller.abort()
  inflightControllers.clear()
  inflightSerialized.clear()
  for (const timer of pendingTimers.values()) window.clearTimeout(timer)
  pendingTimers.clear()
  saveToastShown = false
  setSaveStatus('ok')

  const res = await fetch(`/api/state?user=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to load account state (${res.status})`)
  const payload = await res.json() as {
    user: string
    data: Record<string, unknown>
    backend: 'redis' | 'memory'
  }
  for (const [key, value] of Object.entries(payload.data || {})) {
    if (typeof value === 'string') cache.set(key, value)
    else cache.set(key, JSON.stringify(value))
  }
  setBackend(payload.backend)
  notify()
  return payload.backend
}

export async function clearUserStore(opts?: { flush?: boolean }) {
  if (opts?.flush !== false) await flushPendingSaves({ beacon: true })
  activeUserId = null
  cache.clear()
  pendingKeys.clear()
  retryCounts.clear()
  for (const controller of inflightControllers.values()) controller.abort()
  inflightControllers.clear()
  inflightSerialized.clear()
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
