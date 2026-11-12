import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'
import { isValidWebsiteUrl, WEBSITE_URL_ERROR } from '../lib/urlValidation'

export type OrgProfile = {
  orgName: string
  dispatcherName: string
  website: string
  description: string
  orgType: string
  country: string
}

export const defaultOrgProfile: OrgProfile = {
  orgName: '',
  dispatcherName: '',
  website: '',
  description: '',
  orgType: 'Heavy-haul logistics operator',
  country: 'Germany',
}

export type NotificationPrefs = {
  channels: { inApp: boolean; email: boolean; sms: boolean }
  alerts: { verdict: boolean; closure: boolean; stale: boolean }
}

export const defaultNotificationPrefs: NotificationPrefs = {
  channels: { inApp: true, email: false, sms: false },
  alerts: { verdict: true, closure: true, stale: true },
}

type StoredSettings = {
  profile: OrgProfile
  notifications: NotificationPrefs
}

export function isOrgProfileComplete(profile: OrgProfile): boolean {
  return Boolean(profile.orgName.trim())
}

type OrgSettingsValue = {
  profile: OrgProfile
  savedProfile: OrgProfile
  notifications: NotificationPrefs
  dirty: boolean
  complete: boolean
  displayName: string
  orgTypeLabel: string
  setProfile: (update: Partial<OrgProfile> | ((current: OrgProfile) => OrgProfile)) => void
  setNotifications: (update: Partial<NotificationPrefs> | ((current: NotificationPrefs) => NotificationPrefs)) => void
  saveProfile: () => { ok: true } | { ok: false; error: string }
}

const OrgSettingsContext = createContext<OrgSettingsValue | null>(null)

export function OrgSettingsProvider({ children }: { children: ReactNode }) {
  const stored = typeof window === 'undefined'
    ? null
    : readJson<StoredSettings | null>(STORAGE_KEYS.orgProfile, null)

  const hydrate = (profile?: Partial<OrgProfile> | null): OrgProfile => ({
    ...defaultOrgProfile,
    ...profile,
    dispatcherName: profile?.dispatcherName || '',
  })
  const [profile, setProfileState] = useState<OrgProfile>(hydrate(stored?.profile))
  const [savedProfile, setSavedProfile] = useState<OrgProfile>(hydrate(stored?.profile))
  const [notifications, setNotificationsState] = useState<NotificationPrefs>(
    stored?.notifications ?? defaultNotificationPrefs,
  )

  const persist = (nextProfile: OrgProfile, nextNotifications: NotificationPrefs) => {
    writeJson(STORAGE_KEYS.orgProfile, { profile: nextProfile, notifications: nextNotifications } satisfies StoredSettings)
  }

  const setProfile: OrgSettingsValue['setProfile'] = update => {
    setProfileState(current => typeof update === 'function' ? update(current) : { ...current, ...update })
  }

  const setNotifications: OrgSettingsValue['setNotifications'] = update => {
    setNotificationsState(current => {
      const next = typeof update === 'function' ? update(current) : { ...current, ...update }
      persist(savedProfile, next)
      return next
    })
  }

  const saveProfile: OrgSettingsValue['saveProfile'] = () => {
    if (!isValidWebsiteUrl(profile.website)) {
      return { ok: false, error: WEBSITE_URL_ERROR }
    }
    setSavedProfile(profile)
    persist(profile, notifications)
    return { ok: true }
  }

  const complete = isOrgProfileComplete(savedProfile)
  const displayName = savedProfile.orgName.trim() || 'Dispatcher'
  const orgTypeLabel = complete
    ? (savedProfile.dispatcherName.trim() || savedProfile.orgType.trim() || 'Operator')
    : 'Set up profile'

  const value = useMemo<OrgSettingsValue>(() => ({
    profile,
    savedProfile,
    notifications,
    dirty: JSON.stringify(profile) !== JSON.stringify(savedProfile),
    complete,
    displayName,
    orgTypeLabel,
    setProfile,
    setNotifications,
    saveProfile,
  }), [complete, displayName, notifications, orgTypeLabel, profile, savedProfile])

  return <OrgSettingsContext.Provider value={value}>{children}</OrgSettingsContext.Provider>
}

export function useOrgSettings() {
  const context = useContext(OrgSettingsContext)
  if (!context) throw new Error('useOrgSettings must be used inside OrgSettingsProvider')
  return context
}
