import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatBerlinDateTime, parseIso } from './formatTime.ts'

test('parseIso accepts ISO timestamps and rejects de-DE display strings', () => {
  assert.ok(parseIso('2026-11-09T12:00:00Z'))
  assert.ok(parseIso('2026-11-09T12:00:00.344Z'))
  assert.ok(parseIso('2026-11-10T00:00:00+01:00'))
  assert.equal(parseIso('09.11.2026, 13:00'), null)
  assert.equal(parseIso('09.11.2026'), null)
})

test('de-DE formatter keeps 9 November as 09.11.2026 and does not swap to 11.09', () => {
  const formatted = formatBerlinDateTime('2026-11-09T12:00:00Z')
  assert.match(formatted, /09\.11\.2026/)
  assert.doesNotMatch(formatted, /11\.09\.2026/)
  assert.equal(formatBerlinDateTime('09.11.2026, 13:00'), '')
})
