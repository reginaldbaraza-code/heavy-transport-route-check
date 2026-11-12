import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'
import { STATE_BODY_MAX_BYTES, STATE_FIELD_KEYS, isStateFieldKey } from './storageKeys.ts'
import {
  readUserState,
  resetUserStateForTests,
  resolveBackend,
  validateStateKey,
  validateUserId,
  writeUserStateField,
} from './userState.ts'

beforeEach(() => {
  resetUserStateForTests()
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

test('validateUserId accepts allowlist only', () => {
  assert.equal(validateUserId('anna'), 'anna')
  assert.equal(validateUserId('demo'), 'demo')
  assert.equal(validateUserId('nope'), null)
  assert.equal(validateUserId(''), null)
  assert.equal(validateUserId(null), null)
})

test('validateStateKey accepts storage field allowlist only', () => {
  assert.equal(validateStateKey('htr-saved-jobs'), 'htr-saved-jobs')
  assert.equal(validateStateKey('htr-onboarding-complete'), 'htr-onboarding-complete')
  assert.equal(validateStateKey('htr-current-user'), null)
  assert.equal(validateStateKey('evil'), null)
  for (const key of STATE_FIELD_KEYS) {
    assert.equal(isStateFieldKey(key), true)
  }
})

test('resolveBackend falls back to memory without Redis env', () => {
  assert.equal(resolveBackend(), 'memory')
})

test('memory backend read/write is per-user and isolated', async () => {
  const writeAnna = await writeUserStateField('anna', 'htr-saved-jobs', [{ id: 'job-a' }])
  assert.equal(writeAnna.backend, 'memory')
  assert.ok(writeAnna.updatedAt)

  await writeUserStateField('paul', 'htr-saved-jobs', [{ id: 'job-p' }])

  const anna = await readUserState('anna')
  const paul = await readUserState('paul')
  assert.equal(anna.backend, 'memory')
  assert.equal(paul.backend, 'memory')
  assert.equal(JSON.parse(anna.data['htr-saved-jobs'])[0].id, 'job-a')
  assert.equal(JSON.parse(paul.data['htr-saved-jobs'])[0].id, 'job-p')
  assert.equal(anna.data['htr-saved-jobs'] === paul.data['htr-saved-jobs'], false)
})

test('memory backend overwrites a single field without clearing others', async () => {
  await writeUserStateField('demo', 'htr-saved-jobs', [])
  await writeUserStateField('demo', 'htr-overview-sample-mode', 'example')
  const after = await readUserState('demo')
  assert.equal(JSON.parse(after.data['htr-saved-jobs']).length, 0)
  assert.equal(JSON.parse(after.data['htr-overview-sample-mode']), 'example')
})

test('state body max is 256 KB', () => {
  assert.equal(STATE_BODY_MAX_BYTES, 256 * 1024)
})
