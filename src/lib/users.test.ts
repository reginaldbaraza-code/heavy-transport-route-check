import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  APP_USERS,
  APP_USER_IDS,
  CURRENT_USER_STORAGE_KEY,
  clearStoredUserId,
  isAppUserId,
  readStoredUserId,
  userInitials,
  writeStoredUserId,
} from './users.ts'

test('allowlist has seven fixed users with Demo last', () => {
  assert.deepEqual(APP_USER_IDS, ['chuka', 'reggie', 'luis', 'anna', 'paul', 'fabi', 'demo'])
  assert.equal(APP_USERS[APP_USERS.length - 1].name, 'Demo')
})

test('src and api user allowlists match', () => {
  const apiSource = readFileSync(new URL('../../api/_lib/users.ts', import.meta.url), 'utf8')
  for (const user of APP_USERS) {
    assert.match(apiSource, new RegExp(`id:\\s*'${user.id}'`))
    assert.match(apiSource, new RegExp(`name:\\s*'${user.name}'`))
    assert.match(apiSource, new RegExp(`avatarBg:\\s*'${user.avatarBg}'`))
  }
  assert.equal(isAppUserId('anna'), true)
  assert.equal(isAppUserId('nobody'), false)
  assert.equal(userInitials('Anna'), 'AN')
  assert.equal(userInitials('Demo'), 'DE')
})

test('clearStoredUserId drops htr-current-user after a remembered login', () => {
  const memory = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
  }
  Object.assign(globalThis, {
    window: { localStorage },
    localStorage,
  })
  writeStoredUserId('anna')
  assert.equal(readStoredUserId(), 'anna')
  assert.equal(memory.get(CURRENT_USER_STORAGE_KEY), 'anna')
  clearStoredUserId()
  assert.equal(readStoredUserId(), null)
  assert.equal(memory.has(CURRENT_USER_STORAGE_KEY), false)
})
