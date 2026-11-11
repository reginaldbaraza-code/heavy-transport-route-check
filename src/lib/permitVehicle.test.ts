import assert from 'node:assert/strict'
import { test } from 'node:test'
import { permitVehicleDims, resolveCheckVehicle, type TestPermit } from './routeCheck.ts'

const scenario = {
  kind: 'scenario' as const,
  vehicle: { width: 3.8, height: 4.5, length: 35, grossWeight: 80 },
} satisfies Pick<TestPermit, 'kind' | 'vehicle'>

test('scenario selection uses the scenario vehicle even if metadata is empty', () => {
  const dims = permitVehicleDims(scenario, { vehicle: { width: '', height: '', length: '', grossWeight: '' } })
  assert.deepEqual(dims, scenario.vehicle)
})

test('live samples prefer metadata vehicle when present', () => {
  const permit = {
    kind: 'live' as const,
    vehicle: { width: 3, height: 4, length: 25, grossWeight: 52 },
  } satisfies Pick<TestPermit, 'kind' | 'vehicle'>
  const dims = permitVehicleDims(permit, { vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 } })
  assert.equal(dims?.width, 3.2)
  assert.equal(dims?.grossWeight, 60)
})

test('route check uses form dimensions over sample permit defaults', () => {
  const permit = {
    kind: 'live' as const,
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
  } satisfies Pick<TestPermit, 'kind' | 'vehicle'>
  const form = { width: 3.8, height: 4.5, length: 28.5, grossWeight: 60 }
  const dims = resolveCheckVehicle(form, permit, { vehicle: permit.vehicle })
  assert.equal(dims?.width, 3.8)
  assert.equal(dims?.height, 4.5)
  assert.equal(dims?.length, 28.5)
  assert.equal(dims?.grossWeight, 60)
})
