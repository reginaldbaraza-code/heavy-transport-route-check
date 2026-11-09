export const STORAGE_KEYS = {
  orgProfile: 'htr-org-profile',
  checkHistory: 'htr-route-check-history',
  alertState: 'htr-alert-read-state',
  overviewSampleMode: 'htr-overview-sample-mode',
  savedJobs: 'htr-saved-jobs',
  extraAlerts: 'htr-monitor-alerts',
  monitorPrefs: 'htr-monitor-prefs',
} as const

const LEGACY_KEYS: Record<string, string> = {
  'mds-org-profile': STORAGE_KEYS.orgProfile,
  'mds-route-check-history': STORAGE_KEYS.checkHistory,
  'mds-alert-read-state': STORAGE_KEYS.alertState,
  'mds-overview-sample-mode': STORAGE_KEYS.overviewSampleMode,
  'mds-saved-jobs': STORAGE_KEYS.savedJobs,
  'mds-monitor-alerts': STORAGE_KEYS.extraAlerts,
  'mds-monitor-prefs': STORAGE_KEYS.monitorPrefs,
  'mds-onboarding-complete': 'htr-onboarding-complete',
}

export function migrateLegacyStorage() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem('htr-storage-migrated') === '1') return
    for (const [from, to] of Object.entries(LEGACY_KEYS)) {
      const value = window.localStorage.getItem(from)
      if (value != null && window.localStorage.getItem(to) == null) {
        window.localStorage.setItem(to, value)
      }
    }
    window.localStorage.setItem('htr-storage-migrated', '1')
  } catch {
    // Private mode — in-memory state still works for the session.
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or quota — in-memory state still works for the session.
  }
}
