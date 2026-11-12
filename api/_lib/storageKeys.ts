/** Mirror of src/lib/browserStore STORAGE_KEYS values + onboarding flag. */
export const STATE_FIELD_KEYS = [
  'htr-org-profile',
  'htr-route-check-history',
  'htr-alert-read-state',
  'htr-overview-sample-mode',
  'htr-saved-jobs',
  'htr-monitor-alerts',
  'htr-monitor-prefs',
  'htr-onboarding-complete',
] as const

export type StateFieldKey = (typeof STATE_FIELD_KEYS)[number]

export function isStateFieldKey(key: unknown): key is StateFieldKey {
  return typeof key === 'string' && (STATE_FIELD_KEYS as readonly string[]).includes(key)
}

export const STATE_BODY_MAX_BYTES = 256 * 1024
