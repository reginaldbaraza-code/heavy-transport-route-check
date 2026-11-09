export const STORAGE_KEYS = {
  orgProfile: 'mds-org-profile',
  checkHistory: 'mds-route-check-history',
  alertState: 'mds-alert-read-state',
  overviewSampleMode: 'mds-overview-sample-mode',
  savedJobs: 'mds-saved-jobs',
  extraAlerts: 'mds-monitor-alerts',
  monitorPrefs: 'mds-monitor-prefs',
} as const

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
