import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { determineAffectedRoads, scoreRouteAgainstRoad } from './affectedRoads.ts'
import { prepareRouteGeometry } from './corridor.ts'
import { parseGpxDocument } from './gpxParse.ts'
import { roadVectors } from './roadVectors.ts'

/** Expected primary motorway(s) for each live sample GPX (no corridor hint). */
const EXPECTED_BY_PERMIT: Record<string, string[]> = {
  'hamburg-hannover-a7': ['A7'],
  'bremen-dortmund-a1': ['A1'],
  'leipzig-nurnberg-a9': ['A9'],
  'duisburg-koln-a3': ['A3'],
  'munchen-stuttgart-a8': ['A8'],
  'lubeck-rostock-a20': ['A20'],
  'hof-bayreuth-a9': ['A9'],
}

function matchPointsForPermit(id: string) {
  const xml = readFileSync(`public/test-permits/${id}.gpx`, 'utf8')
  const parsed = parseGpxDocument(xml, { downsample: false })
  return prepareRouteGeometry(parsed.points).matchPoints
}

test('geometry-only detection returns expected motorways for every live sample GPX', () => {
  const gpxFiles = readdirSync('public/test-permits')
    .filter(name => name.endsWith('.gpx') && name !== 'invalid-test.gpx')
    .map(name => name.replace(/\.gpx$/, ''))

  assert.deepEqual(
    [...gpxFiles].sort(),
    [...Object.keys(EXPECTED_BY_PERMIT)].sort(),
    'test-permits GPX set drifted from expected map',
  )

  for (const id of gpxFiles) {
    const detected = determineAffectedRoads(matchPointsForPermit(id))
    assert.deepEqual(detected, EXPECTED_BY_PERMIT[id], id)
  }
})

test('Lübeck→Rostock GPX is A20 and never falls back to A9', () => {
  const detected = determineAffectedRoads(matchPointsForPermit('lubeck-rostock-a20'))
  assert.deepEqual(detected, ['A20'])
  assert.equal(detected.includes('A9'), false)
})

test('Hamburg→Hannover GPX is A7 without spurious A9/A27', () => {
  const detected = determineAffectedRoads(matchPointsForPermit('hamburg-hannover-a7'))
  assert.deepEqual(detected, ['A7'])
  assert.equal(detected.includes('A9'), false)
  assert.equal(detected.includes('A27'), false)
})

test('Duisburg→Köln prefers A3 over nearby parallel A1', () => {
  const points = matchPointsForPermit('duisburg-koln-a3')
  const a3 = scoreRouteAgainstRoad(points, roadVectors.find(road => road.name === 'A3')!)
  const a1 = scoreRouteAgainstRoad(points, roadVectors.find(road => road.name === 'A1')!)
  assert.ok(a3 && a1)
  assert.ok(a3.coverage >= a1.coverage)
  assert.ok(a3.medianKm <= a1.medianKm)
  assert.deepEqual(determineAffectedRoads(points), ['A3'])
})

test('determineAffectedRoads returns empty instead of inventing a default motorway', () => {
  // Mid-Atlantic Ocean — no German Autobahn nearby.
  const ocean = [
    { lat: 40.0, lng: -30.0 },
    { lat: 40.5, lng: -29.5 },
    { lat: 41.0, lng: -29.0 },
  ]
  assert.deepEqual(determineAffectedRoads(ocean), [])
})
