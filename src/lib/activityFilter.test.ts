import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertMatchesRouteFilter, historyMatchesRouteFilter } from './activityFilter'

test('alertMatchesRouteFilter links via alert.routeId to history record id', () => {
  const alert = {
    routeId: 'check-hold-1',
    routeLabel: 'Hamburg Port Terminal → Hannover Logistics Hub',
  }
  const history = [
    {
      id: 'check-hold-1',
      permitName: 'SCENARIO-HOLD-CLOSURE',
      routeLabel: 'Hamburg Port Terminal → Hannover Logistics Hub',
    },
    {
      id: 'check-verify-1',
      permitName: 'SCENARIO-VERIFY',
      routeLabel: 'VERIFY · other',
    },
  ]

  assert.equal(
    alertMatchesRouteFilter(alert, 'SCENARIO-HOLD-CLOSURE', history),
    true,
  )
  assert.equal(
    alertMatchesRouteFilter(alert, 'SCENARIO-VERIFY', history),
    false,
  )
})

test('alertMatchesRouteFilter links via alert.routeId to history jobId', () => {
  const alert = {
    id: 'alert-extra-1',
    routeId: 'job-42',
    routeLabel: 'A7 corridor',
  }
  const history = [
    {
      id: 'check-99',
      jobId: 'job-42',
      permitName: 'SCENARIO-HOLD-CLOSURE',
      routeLabel: 'A7 corridor',
    },
  ]

  assert.equal(
    alertMatchesRouteFilter(alert, 'SCENARIO-HOLD-CLOSURE', history),
    true,
  )
})

test('alertMatchesRouteFilter does not match history by alert.id alone', () => {
  const alert = {
    id: 'check-hold-1',
    routeId: 'job-other',
    routeLabel: 'Unrelated label',
  }
  const history = [
    {
      id: 'check-hold-1',
      permitName: 'SCENARIO-HOLD-CLOSURE',
      routeLabel: 'A7',
    },
  ]

  assert.equal(
    alertMatchesRouteFilter(alert, 'SCENARIO-HOLD-CLOSURE', history),
    false,
  )
})

test('historyMatchesRouteFilter filters by permitName', () => {
  const hold = {
    id: 'a',
    permitName: 'SCENARIO-HOLD-CLOSURE',
  }
  const verify = {
    id: 'b',
    permitName: 'SCENARIO-VERIFY',
  }

  assert.equal(historyMatchesRouteFilter(hold, 'all'), true)
  assert.equal(historyMatchesRouteFilter(hold, 'SCENARIO-HOLD-CLOSURE'), true)
  assert.equal(historyMatchesRouteFilter(verify, 'SCENARIO-HOLD-CLOSURE'), false)
})
