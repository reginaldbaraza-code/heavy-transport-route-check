import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applySiteAcknowledgements,
  isAcknowledgeable,
  isHoldItem,
  isNearbyOffRoute,
  isOppositeDirectionNote,
} from './siteAcknowledgements.ts'
import type { RouteCheckResult } from './routeCheck.ts'

function result(evidence: RouteCheckResult['evidence'], verdict: RouteCheckResult['verdict'] = 'VERIFY'): RouteCheckResult {
  return {
    verdict,
    title: 'Verification required – potential issue detected',
    summary: 'Nearby items remain.',
    impact: `Selected vehicle: 3.20m W x 4.50m H. ${evidence.filter(item => item.state === 'warning').length} unresolved VERIFY items.`,
    confidence: 'medium',
    issueCount: 0,
    evidence,
    route: { coordinates: [], origin: 'A', destination: 'B', distance: 40, corridor: 'A20' },
    degraded: false,
    clearanceConfirmed: true,
  }
}

test('opposite-direction info notes are not collapsed into nearby-off-route', () => {
  const opposite = {
    id: 'opp',
    title: 'AS Westenholz (Opposite direction)',
    detail: '',
    source: 't',
    age: '',
    confidence: 'medium' as const,
    state: 'info' as const,
    category: 'closures' as const,
    reason: 'Opposite direction — junction ramp/AS is against the route travel direction.',
  }
  const nearby = {
    ...opposite,
    id: 'near',
    title: 'A2 works (nearby, not on route)',
    reason: 'Nearby, not on route (0.8 km). Other Autobahn — shown for context.',
  }
  assert.equal(isOppositeDirectionNote(opposite), true)
  assert.equal(isNearbyOffRoute(opposite), false)
  assert.equal(isOppositeDirectionNote(nearby), false)
  assert.equal(isNearbyOffRoute(nearby), true)
})

test('client overlay: acknowledging VERIFY items yields READY; HOLD cannot be cleared', () => {
  const verify = result([{
    id: 'v1', title: 'Nearby A20', detail: '', source: 't', age: '', confidence: 'medium',
    state: 'warning', category: 'roadworks', blocker: true,
  }])
  assert.equal(isAcknowledgeable(verify.evidence[0]), true)
  const ready = applySiteAcknowledgements(verify, [{
    evidenceId: 'v1', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z',
  }], true)
  assert.equal(ready.verdict, 'READY')
  assert.match(ready.title, /READY – dispatcher confirmed 1 item/)
  assert.match(ready.summary, /1 VERIFY item confirmed on site by Ada at/)
  assert.doesNotMatch(ready.impact, /unresolved VERIFY/)
  assert.match(ready.impact, /Selected vehicle/)

  const hold = result([{
    id: 'h1', title: 'Vollsperrung', detail: '', source: 't', age: '', confidence: 'high',
    state: 'danger', category: 'closures', blocker: true,
  }], 'HOLD')
  assert.equal(isHoldItem(hold.evidence[0]), true)
  assert.equal(isAcknowledgeable(hold.evidence[0]), false)
  const stillHold = applySiteAcknowledgements(hold, [{
    evidenceId: 'h1', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z',
  }], true)
  assert.equal(stillHold.verdict, 'HOLD')
})

test('result-screen clearance rewrites the bridge card and stale impact copy', () => {
  const raw = result([
    {
      id: 'v1', title: 'Nearby A20', detail: '', source: 't', age: '', confidence: 'medium',
      state: 'warning', category: 'roadworks', blocker: true,
    },
    {
      id: 'bridge-clearance-unknown',
      title: 'Bridge and clearance data not available',
      detail: 'Unknown clearance cannot yield READY — confirm on site or tick dispatcher confirmation.',
      source: 'Route check system',
      age: '',
      confidence: 'medium',
      state: 'warning',
      category: 'observations',
      blocker: true,
    },
  ])
  raw.impact = 'Selected vehicle: 3.20m W. 1 unresolved VERIFY items. Bridge and clearance are not dispatcher-confirmed.'
  raw.clearanceConfirmed = false
  const ready = applySiteAcknowledgements(raw, [{
    evidenceId: 'v1', acknowledgedBy: 'QA Test', acknowledgedAt: '2026-11-09T12:00:00Z',
  }], true, { by: 'QA Test', at: '2026-11-09T12:00:00Z' })
  assert.equal(ready.verdict, 'READY')
  const bridge = ready.evidence.find(item => String(item.id).startsWith('bridge-clearance'))
  assert.equal(bridge?.id, 'bridge-clearance-confirmed')
  assert.match(bridge?.title || '', /Bridge and clearance confirmed by dispatcher/)
  assert.doesNotMatch(ready.impact, /not dispatcher-confirmed/)
  assert.doesNotMatch(ready.impact, /unresolved VERIFY/)
  assert.match(ready.impact, /Clearance confirmed by QA Test at/)
  assert.equal((ready.impact.match(/Clearance confirmed by QA Test at/g) || []).length, 1)
  assert.match(ready.summary, /1 VERIFY item confirmed on site by QA Test at/)
  assert.doesNotMatch(ready.summary, /11\.09\.2026/)
  assert.match(ready.summary, /09\.11\.2026/)
})
