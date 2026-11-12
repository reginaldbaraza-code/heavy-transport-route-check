import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PARKING_EVENT_CAP, selectBalancedByGroups } from './parkingSelect.ts'

function roadGroups(counts: Record<string, number>) {
  return Object.entries(counts).map(([road, count]) =>
    Array.from({ length: count }, (_, i) => ({ road, id: `${road}-${i}` })),
  )
}

function roadsIn(items: { road: string }[]) {
  return [...new Set(items.map(item => item.road))]
}

test('parking cap constant stays at 120 for map payload size', () => {
  assert.equal(PARKING_EVENT_CAP, 120)
})

test('selectBalancedByGroups returns empty for empty or non-positive inputs', () => {
  assert.deepEqual(selectBalancedByGroups([], 10), [])
  assert.deepEqual(selectBalancedByGroups([['a'], ['b']], 0), [])
  assert.deepEqual(selectBalancedByGroups([['a']], -1), [])
})

test('naive flatten+slice would starve later roads; balanced pick covers them', () => {
  const groups = roadGroups({ A1: 200, A2: 40, A8: 71, A9: 50 })
  const flatCapped = groups.flat().slice(0, PARKING_EVENT_CAP)
  assert.deepEqual(roadsIn(flatCapped), ['A1'])

  const balanced = selectBalancedByGroups(groups, PARKING_EVENT_CAP)
  assert.equal(balanced.length, PARKING_EVENT_CAP)
  const roads = roadsIn(balanced)
  assert.ok(roads.includes('A1'))
  assert.ok(roads.includes('A2'))
  assert.ok(roads.includes('A8'))
  assert.ok(roads.includes('A9'))
  assert.equal(roads.length, 4)
})

test('selectBalancedByGroups round-robins so early roads do not monopolize the cap', () => {
  const groups = roadGroups({
    A1: 200,
    A2: 30,
    A3: 30,
    A4: 30,
    A5: 30,
    A6: 30,
    A7: 30,
    A8: 30,
    A9: 30,
    A10: 30,
  })
  const selected = selectBalancedByGroups(groups, PARKING_EVENT_CAP)
  assert.equal(selected.length, PARKING_EVENT_CAP)

  const byRoad = Object.fromEntries(
    [...new Set(selected.map(item => item.road))].map(road => [
      road,
      selected.filter(item => item.road === road).length,
    ]),
  )
  assert.equal(Object.keys(byRoad).length, 10)
  for (const count of Object.values(byRoad)) {
    // 120 / 10 = 12 each when every road still has remaining sites.
    assert.equal(count, 12)
  }
})

test('selectBalancedByGroups skips empty roads and backfills from remaining', () => {
  const groups = roadGroups({ A1: 5, A2: 0, A8: 100, A9: 100 })
  // Drop the empty A2 group the same way callers filter usable events per road.
  const nonEmpty = groups.filter(group => group.length > 0)
  const selected = selectBalancedByGroups(nonEmpty, 20)
  assert.equal(selected.length, 20)
  const byRoad = {
    A1: selected.filter(item => item.road === 'A1').length,
    A8: selected.filter(item => item.road === 'A8').length,
    A9: selected.filter(item => item.road === 'A9').length,
  }
  assert.equal(byRoad.A1, 5)
  assert.equal(byRoad.A8, 8)
  assert.equal(byRoad.A9, 7)
  assert.ok(!selected.some(item => item.road === 'A2'))
})

test('selectBalancedByGroups returns all items when under the cap', () => {
  const groups = roadGroups({ A1: 3, A8: 2 })
  const selected = selectBalancedByGroups(groups, PARKING_EVENT_CAP)
  assert.equal(selected.length, 5)
  assert.deepEqual(selected.map(item => item.id), [
    'A1-0', 'A8-0', 'A1-1', 'A8-1', 'A1-2',
  ])
})
