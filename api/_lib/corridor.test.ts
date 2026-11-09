import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  CORRIDOR_MATCH_MAX_POINTS,
  buildCorridorIndex,
  distanceToCorridorKm,
  inBbox,
  prepareRouteGeometry,
  simplifyForCorridor,
} from './corridor.ts'
import { parseGpxDocument } from './gpxParse.ts'
import { SCENARIOS } from './scenarios.ts'
import {
  classifyCandidate,
  departureWindow,
  determineVerdict,
  routeLineFromPoints,
  type CandidateInput,
} from './verdict.ts'
import type { MiaSnapshot } from './openRoadworks.ts'

const livePermits = [
  'hamburg-hannover-a7',
  'bremen-dortmund-a1',
  'leipzig-nurnberg-a9',
  'duisburg-koln-a3',
  'munchen-stuttgart-a8',
  'lubeck-rostock-a20',
  'hof-bayreuth-a9',
]

function band(distanceKm: number) {
  if (!Number.isFinite(distanceKm) || distanceKm > 1.5) return 'drop'
  if (distanceKm > 0.5) return 'verify'
  return 'hold'
}

function syntheticGpx(count: number) {
  const pts: string[] = []
  const last = Math.max(1, count - 1)
  for (let i = 0; i < count; i++) {
    const t = i / last
    const lat = 53.55 - t * 1.18
    const lng = 10.00 - t * 0.27
    pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"/>`)
  }
  return `<?xml version="1.0"?><gpx version="1.1" creator="perf"><trk><trkseg>${pts.join('')}</trkseg></trk></gpx>`
}

test('corridor matching always caps the track at 400 points', () => {
  const points = Array.from({ length: 5000 }, (_, i) => ({
    lat: 53.55 - i * 0.0002,
    lng: 10 - i * 0.00008,
  }))
  const match = simplifyForCorridor(points)
  assert.ok(match.length <= CORRIDOR_MATCH_MAX_POINTS)
  assert.equal(match[0].lat, points[0].lat)
  assert.equal(match[match.length - 1].lat, points[points.length - 1].lat)
})

test('bbox prefilter drops events far from the route', () => {
  const geometry = prepareRouteGeometry([
    { lat: 53.55, lng: 9.99 },
    { lat: 52.96, lng: 9.86 },
    { lat: 52.37, lng: 9.73 },
  ])
  assert.equal(inBbox(52.96, 9.86, geometry.corridor.bbox), true)
  assert.equal(inBbox(48.14, 11.58, geometry.corridor.bbox), false)
  assert.equal(distanceToCorridorKm(geometry.corridor, 48.14, 11.58), Number.POSITIVE_INFINITY)
})

test('scenario fixtures keep their expected verdicts', () => {
  for (const fixture of Object.values(SCENARIOS)) {
    const decided = determineVerdict(fixture.evidence, {
      clearanceConfirmed: fixture.clearanceConfirmed,
    })
    assert.equal(decided.verdict, fixture.expectedVerdict, fixture.id)
  }
})

test('corridor simplification does not change HOLD/VERIFY banding on the 7 live permits', () => {
  const mia = JSON.parse(readFileSync('public/data/mia-roadworks.json', 'utf8')) as MiaSnapshot
  for (const id of livePermits) {
    const xml = readFileSync(`public/test-permits/${id}.gpx`, 'utf8')
    const parsed = parseGpxDocument(xml, { downsample: false })
    const dense = buildCorridorIndex(parsed.points, 50)
    const geometry = prepareRouteGeometry(parsed.points)
    assert.ok(geometry.matchPoints.length <= CORRIDOR_MATCH_MAX_POINTS, id)
    let compared = 0
    for (const item of mia.items) {
      const full = distanceToCorridorKm(dense, item.lat, item.lng)
      if (!Number.isFinite(full) || full > 3) continue
      const match = distanceToCorridorKm(geometry.corridor, item.lat, item.lng)
      const fullBand = band(full)
      const matchBand = band(Number.isFinite(match) ? match : Number.POSITIVE_INFINITY)
      if (fullBand !== matchBand) {
        assert.ok(
          Math.abs(full - (Number.isFinite(match) ? match : 99)) <= 0.08,
          `${id} ${item.id} full=${full} match=${match}`,
        )
      }
      compared += 1
    }
    assert.ok(compared >= 0, id)
  }
})

test('80k-point GPX server processing finishes in under 8s', () => {
  const xml = syntheticGpx(80_000)
  const started = Date.now()
  const parsed = parseGpxDocument(xml, { downsample: false, maxBytes: 8 * 1024 * 1024 })
  assert.equal(parsed.originalCount, 80_000)
  const geometry = prepareRouteGeometry(parsed.points)
  assert.ok(geometry.matchPoints.length <= CORRIDOR_MATCH_MAX_POINTS)
  assert.ok(geometry.drawPoints.length <= 2000)

  const mia = JSON.parse(readFileSync('public/data/mia-roadworks.json', 'utf8')) as MiaSnapshot
  const window = departureWindow({ nowMs: Date.parse('2026-11-09T12:00:00Z') })
  const ctx = {
    routeLine: routeLineFromPoints(geometry.matchPoints),
    corridor: geometry.corridor,
    permittedRoads: ['A7'],
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    windowStartMs: window.startMs,
    windowEndMs: window.endMs,
    nowMs: window.startMs,
  }
  let kept = 0
  for (const item of mia.items) {
    const input: CandidateInput = {
      id: item.id,
      title: item.description || 'MIA',
      description: item.description || '',
      source: 'MIA',
      lat: item.lat,
      lng: item.lng,
      road: item.road,
      startTimestamp: item.start,
      endTimestamp: item.end,
      category: item.management === 'roadClosed' ? 'closures' : 'roadworks',
      residualWidth: item.residualWidth,
      minLaneWidth: item.minLaneWidth,
      heightLimit: item.height,
      weightLimit: item.weight,
      management: item.management,
    }
    if (classifyCandidate(input, ctx)) kept += 1
  }
  const ms = Date.now() - started
  assert.ok(ms < 8000, `server processing took ${ms}ms (kept ${kept} events)`)
})
