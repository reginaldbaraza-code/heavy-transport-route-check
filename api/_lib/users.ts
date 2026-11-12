export type AppUser = {
  id: string
  name: string
  avatarBg: string
  avatarFg: string
}

/** Keep in sync with src/lib/users.ts — asserted by src/lib/users.test.ts. */
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

export function isAppUserId(id: unknown): id is string {
  return typeof id === 'string' && APP_USER_IDS.includes(id)
}
