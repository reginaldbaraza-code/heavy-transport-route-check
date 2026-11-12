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

const DEBOUNCE_MS = 600
const MAX_RETRIES = 3

type SyncListener = () => void

const cache = new Map<string, string>()
const pendingTimers = new Map<string, number>()
const pendingKeys = new Set<string>()
const retryCounts = new Map<string, number>()
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
  // Prefer keepalive fetch so the write can finish; beacon is a fallback inside flush.
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

export function writeJson(key: string, value: unknown) {
  const serialized = JSON.stringify(value)
  cache.set(key, serialized)
  if (!activeUserId) return
  if (!(STATE_FIELD_KEYS as readonly string[]).includes(key)) return
  scheduleSave(key, serialized)
}

function scheduleSave(key: string, serialized: string) {
  pendingKeys.add(key)
  setSaveStatus('pending')
  const existing = pendingTimers.get(key)
  if (existing != null) window.clearTimeout(existing)
  const timer = window.setTimeout(() => {
    pendingTimers.delete(key)
    void persistKey(key, serialized)
  }, DEBOUNCE_MS)
  pendingTimers.set(key, timer)
}

async function persistKey(key: string, serialized: string, attempt = 0): Promise<boolean> {
  if (!activeUserId) return false
  // Skip if a newer value replaced this one while we were waiting.
  if (cache.get(key) !== serialized) {
    pendingKeys.delete(key)
    if (pendingKeys.size === 0 && saveStatus !== 'error') setSaveStatus('ok')
    return true
  }
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: activeUserId, key, value: JSON.parse(serialized) }),
      keepalive: true,
    })
    if (!res.ok) throw new Error(`save failed ${res.status}`)
    pendingKeys.delete(key)
    retryCounts.delete(key)
    saveToastShown = false
    if (pendingKeys.size === 0) setSaveStatus('ok')
    return true
  } catch {
    if (attempt + 1 < MAX_RETRIES) {
      const delay = 400 * (2 ** attempt)
      await new Promise(resolve => window.setTimeout(resolve, delay))
      return persistKey(key, serialized, attempt + 1)
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
    // Keep retrying quietly in the background.
    window.setTimeout(() => {
      const current = cache.get(key)
      if (current != null && activeUserId) void persistKey(key, current, 0)
    }, 4000)
    return false
  }
}

function beaconSave(userId: string, key: string, serialized: string) {
  try {
    const body = JSON.stringify({ user: userId, key, value: JSON.parse(serialized) })
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/state', blob)) return true
    }
  } catch {
    // fall through to fetch
  }
  return false
}

export async function flushPendingSaves(opts?: { beacon?: boolean }): Promise<void> {
  if (!activeUserId) return
  const userId = activeUserId
  for (const timer of pendingTimers.values()) window.clearTimeout(timer)
  pendingTimers.clear()

  const keys = [...pendingKeys]
  if (keys.length === 0) return

  await Promise.all(keys.map(async key => {
    const serialized = cache.get(key)
    if (serialized == null) {
      pendingKeys.delete(key)
      return
    }
    if (opts?.beacon && beaconSave(userId, key, serialized)) {
      pendingKeys.delete(key)
      return
    }
    await persistKey(key, serialized)
  }))
}

export async function hydrateUserStore(userId: string): Promise<SyncBackend> {
  installFlushHooks()
  activeUserId = userId
  cache.clear()
  pendingKeys.clear()
  retryCounts.clear()
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
