import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { demoDepartureIso, isGpxFileProblemMessage } from './jobs.ts'

test('demo departure stays inside the permit validity window', () => {
  const now = Date.parse('2026-11-12T10:00:00+01:00')
  const iso = demoDepartureIso(
    {
      validFrom: '2026-11-10T00:00:00+01:00',
      validUntil: '2026-11-15T23:59:59+01:00',
    },
    now,
    8,
  )
  const ms = Date.parse(iso)
  assert.ok(ms > now)
  assert.ok(ms < Date.parse('2026-11-15T23:59:59+01:00'))
})

test('demo departure clamps into a short permit window', () => {
  const now = Date.parse('2026-12-01T10:00:00+01:00')
  const iso = demoDepartureIso(
    {
      validFrom: '2026-11-10T00:00:00+01:00',
      validUntil: '2026-11-12T12:00:00+01:00',
    },
    now,
    8,
  )
  const ms = Date.parse(iso)
  assert.ok(ms <= Date.parse('2026-11-12T12:00:00+01:00'))
  assert.ok(ms >= Date.parse('2026-11-10T00:00:00+01:00'))
})

test('missing departure is never classified as a file-use error', () => {
  assert.equal(
    isGpxFileProblemMessage('Planned departure is required so restrictions are judged against the trip window.'),
    false,
  )
  assert.equal(isGpxFileProblemMessage("This file isn't a valid GPX route. Export the route from VEMAGS as GPX and try again."), true)
  assert.equal(isGpxFileProblemMessage('VEMAGS PDF and XML formats are not yet supported.'), true)
})

test('sample auto-run applies a demo departure instead of the file-error heading', () => {
  const source = readFileSync(new URL('../../src/pages/RouteIntelligence.tsx', import.meta.url), 'utf8')
  assert.match(source, /applyDemoDeparture/)
  assert.match(source, /Demo departure:/)
  assert.match(source, /data-testid="demo-departure-note"/)
  assert.match(source, /data-testid="departure-required-error"/)
  // Sample ?run=1 must pass the demo ISO into runCheck — never leave departure empty.
  assert.match(source, /const demoIso = applyDemoDeparture\(permit, metadata\)/)
  assert.match(source, /await runCheck\(content, metadata, permit, \[\], demoIso\)/)
  // Real uploads clear any demo departure and leave the field empty.
  assert.match(source, /setActivePermitId\(null\)[\s\S]*setPlannedDeparture\(''\)[\s\S]*clearDemoDeparture\(\)/)
  // Real upload without departure: Check route stays disabled; departure copy is the block message.
  assert.match(source, /disabled=\{!vehicleValid \|\| !departureValid\}/)
  assert.match(source, /No default is filled in — enter the real planned departure/)
  assert.match(source, /setDepartureRequiredError/)
  // File-error heading is only rendered from the file `error` state, not formError.
  assert.match(source, /Could not use this file/)
  assert.doesNotMatch(
    source,
    /formError &&[\s\S]{0,80}Could not use this file/,
  )
})
