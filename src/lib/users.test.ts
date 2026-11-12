import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { APP_USERS, APP_USER_IDS, isAppUserId, userInitials } from './users.ts'

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
