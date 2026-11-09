import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boundsFromEvidence, routeBounds } from './mapBounds.ts'

test('München→Stuttgart A8 bounds stay in southern Germany, not Hannover', () => {
  const coords: [number, number][] = [
    [48.1351, 11.582],
    [48.25, 10.85],
    [48.4, 10.25],
    [48.55, 9.7],
    [48.78, 9.18],
  ]
  const bounds = routeBounds(coords)
  assert.ok(bounds)
  assert.ok(bounds.south > 47.5 && bounds.north < 49.5, JSON.stringify(bounds))
  assert.ok(bounds.west > 8.5 && bounds.east < 12, JSON.stringify(bounds))
  assert.ok(bounds.north < 51, 'must not include Kassel/Hannover (~52°N)')
})

test('routeBounds needs two valid points', () => {
  assert.equal(routeBounds([]), null)
  assert.equal(routeBounds([[48.1, 11.5]]), null)
  assert.ok(routeBounds([[48.1, 11.5], [48.8, 9.2]]))
})

test('evidence fallback builds a box from lat/lng', () => {
  const bounds = boundsFromEvidence([
    { lat: 48.14, lng: 11.58 },
    { lat: 48.78, lng: 9.18 },
    { lat: null, lng: 8 },
  ])
  assert.ok(bounds)
  assert.ok(bounds.south < 48.2 && bounds.north > 48.7)
})
