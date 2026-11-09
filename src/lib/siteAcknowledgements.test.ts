import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applySiteAcknowledgements,
  isAcknowledgeable,
  isHoldItem,
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
