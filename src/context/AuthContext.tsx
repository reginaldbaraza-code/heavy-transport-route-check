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
  getSyncStatus,
  hydrateUserStore,
  subscribeSyncStatus,
  type SyncBackend,
  type SyncSaveStatus,
} from '../lib/browserStore'
import {
  APP_USERS,
  CURRENT_USER_STORAGE_KEY,
  getUserById,
  isAppUserId,
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

function readStoredUserId(): string | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
    return isAppUserId(raw) ? raw : null
  } catch {
    return null
  }
}

function writeStoredUserId(id: string) {
  try {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, id)
  } catch {
    // Private mode — session still works without remembering last user.
  }
}

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
    window.addEventListener('htr-sync-error', onSyncError)
    return () => window.removeEventListener('htr-sync-error', onSyncError)
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
    await flushPendingSaves({ beacon: true })
    await clearUserStore({ flush: false })
    setLastUsedId(readStoredUserId())
    setUser(null)
    setSyncBackend(null)
    setSaveStatus('ok')
  }, [])

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
