export type AppUser = {
  id: string
  name: string
  /** Solid avatar fill — white initials stay ≥4.5:1 in light and dark. */
  avatarBg: string
  avatarFg: string
}

/** Fixed allowlist — no passwords. Demo is last for the login divider. */
export const APP_USERS: readonly AppUser[] = [
  { id: 'chuka', name: 'Chuka', avatarBg: '#0c2439', avatarFg: '#ffffff' },
  { id: 'reggie', name: 'Reggie', avatarBg: '#0058b0', avatarFg: '#ffffff' },
  { id: 'luis', name: 'Luis', avatarBg: '#0b6b3a', avatarFg: '#ffffff' },
  { id: 'anna', name: 'Anna', avatarBg: '#9a5b00', avatarFg: '#ffffff' },
  { id: 'paul', name: 'Paul', avatarBg: '#c41e16', avatarFg: '#ffffff' },
  { id: 'fabi', name: 'Fabi', avatarBg: '#2a5678', avatarFg: '#ffffff' },
  { id: 'demo', name: 'Demo', avatarBg: '#636366', avatarFg: '#ffffff' },
] as const

export const APP_USER_IDS = APP_USERS.map(user => user.id)

export const CURRENT_USER_STORAGE_KEY = 'htr-current-user'

export function getUserById(id: string | null | undefined): AppUser | null {
  if (!id) return null
  return APP_USERS.find(user => user.id === id) ?? null
}

export function isAppUserId(id: unknown): id is string {
  return typeof id === 'string' && APP_USER_IDS.includes(id)
}

export function userInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}
