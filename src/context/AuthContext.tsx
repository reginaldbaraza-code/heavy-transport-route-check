import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Toast } from '../components/Feedback'
import {
  clearUserStore,
  flushPendingSaves,
  getActiveUserId,
  getSyncStatus,
  hydrateUserStore,
  subscribeSyncStatus,
  type SyncBackend,
  type SyncSaveStatus,
} from '../lib/browserStore'
import {
  APP_USERS,
  clearStoredUserId,
  getUserById,
  readStoredUserId,
  writeStoredUserId,
  type AppUser,
} from '../lib/users'

type AuthValue = {
  users: readonly AppUser[]
  user: AppUser | null
  lastUsedId: string | null
  bootstrapping: boolean
  selectingId: string | null
  selectUser: (id: string) => Promise<void>
  switchUser: () => Promise<void>
  syncBackend: SyncBackend
  saveStatus: SyncSaveStatus
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [lastUsedId, setLastUsedId] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [syncBackend, setSyncBackend] = useState<SyncBackend>(null)
  const [saveStatus, setSaveStatus] = useState<SyncSaveStatus>('ok')
  const [syncToast, setSyncToast] = useState('')

  useEffect(() => {
    return subscribeSyncStatus(() => {
      const status = getSyncStatus()
      setSyncBackend(status.backend)
      setSaveStatus(status.saveStatus)
    })
  }, [])

  useEffect(() => {
    const onSyncError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setSyncToast(detail?.message || "Couldn't save to your account. Retrying…")
    }
    const onAppToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      if (detail?.message) setSyncToast(detail.message)
    }
    window.addEventListener('htr-sync-error', onSyncError)
    window.addEventListener('htr-app-toast', onAppToast)
    return () => {
      window.removeEventListener('htr-sync-error', onSyncError)
      window.removeEventListener('htr-app-toast', onAppToast)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const stored = readStoredUserId()
      setLastUsedId(stored)
      if (!stored) {
        if (!cancelled) setBootstrapping(false)
        return
      }
      try {
        const backend = await hydrateUserStore(stored)
        if (cancelled) return
        setSyncBackend(backend)
        setUser(getUserById(stored))
      } catch {
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  const selectUser = useCallback(async (id: string) => {
    const next = getUserById(id)
    if (!next) return
    setSelectingId(id)
    try {
      const backend = await hydrateUserStore(next.id)
      writeStoredUserId(next.id)
      setLastUsedId(next.id)
      setSyncBackend(backend)
      setSaveStatus('ok')
      setUser(next)
    } finally {
      setSelectingId(null)
    }
  }, [])

  const switchUser = useCallback(async () => {
    const previousId = user?.id ?? getActiveUserId()
    // Flush pending saves for the OLD user (each write carries its scheduled userId).
    await flushPendingSaves({ beacon: true, userId: previousId ?? undefined })
    await clearUserStore({ flush: false })
    // Do not remember the previous account — reload of the login screen must not auto-sign in.
    clearStoredUserId()
    setLastUsedId(previousId)
    setUser(null)
    setSyncBackend(null)
    setSaveStatus('ok')
  }, [user])

  const value = useMemo<AuthValue>(() => ({
    users: APP_USERS,
    user,
    lastUsedId,
    bootstrapping,
    selectingId,
    selectUser,
    switchUser,
    syncBackend,
    saveStatus,
  }), [bootstrapping, lastUsedId, saveStatus, selectUser, selectingId, switchUser, syncBackend, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {syncToast && (
        <Toast message={syncToast} tone="warning" onClose={() => setSyncToast('')} />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
