import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HOLD_DISTANCE_KM,
  VERIFY_DISTANCE_KM,
  classifyCandidate,
  classifyLocationKind,
  dedupeClassified,
  departureWindow,
  determineVerdict,
  dimDecision,
  distanceToRouteKm,
  extractHardWidthLimit,
  inferPermittedRoads,
  isAcknowledgeable,
  routeLineFromPoints,
  startsAfterWindow,
  type CandidateInput,
  type ClassifiedEvidence,
  type ClassifyContext,
} from './verdict.ts'

const line = routeLineFromPoints([
  { lat: 53.55, lng: 9.99 },
  { lat: 52.96, lng: 9.86 },
  { lat: 52.37, lng: 9.73 },
])
const onRoute = { lat: 52.96, lng: 9.86 }

const baseCtx: ClassifyContext = {
  routeLine: line,
  permittedRoads: ['A7'],
  vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
  windowStartMs: Date.parse('2026-11-09T12:00:00Z'),
  windowEndMs: Date.parse('2026-11-10T12:00:00Z'),
  nowMs: Date.parse('2026-11-09T12:00:00Z'),
}

function candidate(patch: Partial<CandidateInput> = {}): CandidateInput {
  return {
    id: patch.id || 'e1',
    title: patch.title || 'A7 roadworks',
    description: patch.description || 'A7 mainline works',
    source: patch.source || 'test',
    lat: patch.lat ?? onRoute.lat,
    lng: patch.lng ?? onRoute.lng,
    road: patch.road ?? 'A7',
    startTimestamp: patch.startTimestamp ?? '2026-11-09T00:00:00Z',
    endTimestamp: patch.endTimestamp ?? '2026-11-12T00:00:00Z',
    retrievedAt: '2026-11-09T12:00:00Z',
    category: patch.category || 'roadworks',
    ...patch,
  }
}

test('distance: HOLD-eligible only within 0.5 km; 0.5-1.5 nearby VERIFY; farther dropped', () => {
  const onLine = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.ok(onLine)
  assert.ok((onLine.distanceKm || 0) <= HOLD_DISTANCE_KM + 0.15)
  assert.equal(onLine.state, 'danger')

  const nearbyPoint = turfOffset(line, 0.9)
  const nearby = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
    lat: nearbyPoint.lat,
    lng: nearbyPoint.lng,
  }), baseCtx)
  assert.ok(nearby)
  assert.ok((nearby.distanceKm || 0) > HOLD_DISTANCE_KM)
  assert.ok((nearby.distanceKm || 0) <= VERIFY_DISTANCE_KM)
  assert.equal(nearby.state, 'warning')
  assert.equal(nearby.blocker, true)
  assert.match(nearby.reason, /permitted corridor|VERIFY nearby/)

  const far = classifyCandidate(candidate({
    lat: 53.2,
    lng: 8.0,
    title: 'Vollsperrung A1',
    description: 'Vollsperrung',
    category: 'closures',
    isBlocked: true,
    road: 'A1',
  }), baseCtx)
  assert.equal(far, null)
})

function turfOffset(routeLine: ReturnType<typeof routeLineFromPoints>, kmEast: number) {
  const mid = routeLine.geometry.coordinates[Math.floor(routeLine.geometry.coordinates.length / 2)]
  const lngPerKm = 1 / (111.32 * Math.cos(mid[1] * Math.PI / 180))
  return { lng: mid[0] + kmEast * lngPerKm, lat: mid[1] }
}

test('ramp / AS / Auffahrt classifies as ramp and cannot HOLD', () => {
  assert.equal(classifyLocationKind('Sperrung AS Westenholz Auffahrt'), 'ramp')
  const item = classifyCandidate(candidate({
    title: 'Full closure AS Westenholz Auffahrt',
    description: 'Sperrung der Auffahrt AS Westenholz',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.locationKind, 'ramp')
  assert.equal(item.state, 'warning')
})

test('future start after departure window is dropped', () => {
  assert.equal(startsAfterWindow('2026-11-20T00:00:00Z', baseCtx.windowEndMs), true)
  const item = classifyCandidate(candidate({
    startTimestamp: '2026-11-20T21:00:00Z',
    endTimestamp: '2026-11-21T04:00:00Z',
    title: 'Vollsperrung A7',
    description: 'Vollsperrung',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.equal(item, null)
})

test('long-running item with no end is VERIFY never HOLD', () => {
  const item = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
    startTimestamp: '2025-01-01T00:00:00Z',
    endTimestamp: null,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.state, 'warning')
  assert.match(item.reason, /Long-running/)
})

test('minLaneWidth exceeding vehicle is VERIFY, residualWidth HOLD', () => {
  const lane = dimDecision(baseCtx.vehicle, { minLaneWidth: 3.0, description: '' })
  assert.equal(lane.hold, false)
  assert.equal(lane.verify, true)
  assert.equal(lane.type, 'minLaneWidth')

  const residual = dimDecision(baseCtx.vehicle, { residualWidth: 3.0, description: '' })
  assert.equal(residual.hold, true)
  assert.equal(residual.type, 'width')

  const classifiedLane = classifyCandidate(candidate({
    minLaneWidth: 3.0,
    title: 'A7 lane restriction',
    description: 'minLaneWidth 3.0',
  }), baseCtx)
  assert.equal(classifiedLane?.state, 'warning')
  assert.match(classifiedLane?.reason || '', /minLaneWidth/)

  const classifiedResidual = classifyCandidate(candidate({
    residualWidth: 3.0,
    title: 'A7 residual width',
    description: 'Restbreite 3.0 m',
  }), baseCtx)
  assert.equal(classifiedResidual?.state, 'danger')
})

test('height exceeded => HOLD, height OK => not HOLD', () => {
  const exceeded = dimDecision(baseCtx.vehicle, { heightLimit: 4.0, description: '' })
  assert.equal(exceeded.hold, true)
  assert.equal(exceeded.verify, false)
  assert.equal(exceeded.type, 'height')

  const ok = dimDecision(baseCtx.vehicle, { heightLimit: 4.6, description: '' })
  assert.equal(ok.hold, false)
  assert.equal(ok.verify, false)

  const unknown = dimDecision({ ...baseCtx.vehicle, height: 0 }, { heightLimit: 4.0, description: '' })
  assert.equal(unknown.hold, false)
  assert.equal(unknown.verify, true)

  const classified = classifyCandidate(candidate({
    heightLimit: 4.0,
    title: 'A7 Durchfahrtshöhe',
    description: 'Residual clearance 4.00 m',
  }), baseCtx)
  assert.equal(classified?.state, 'danger')
  assert.match(classified?.title || '', /4(\.0+)? m vs vehicle 4\.5 m/)
})

test('weight exceeded => HOLD, weight OK => not HOLD', () => {
  const exceeded = dimDecision(baseCtx.vehicle, { weightLimit: 40, description: '' })
  assert.equal(exceeded.hold, true)
  assert.equal(exceeded.verify, false)
  assert.equal(exceeded.type, 'weight')

  const ok = dimDecision(baseCtx.vehicle, { weightLimit: 80, description: '' })
  assert.equal(ok.hold, false)
  assert.equal(ok.verify, false)

  const unknown = dimDecision({ ...baseCtx.vehicle, grossWeight: 0 }, { weightLimit: 40, description: '' })
  assert.equal(unknown.hold, false)
  assert.equal(unknown.verify, true)

  const classified = classifyCandidate(candidate({
    weightLimit: 40,
    title: 'A7 Bauwerk',
    description: 'Gewichtsbeschränkung 40 t',
  }), baseCtx)
  assert.equal(classified?.state, 'danger')
  assert.match(classified?.title || '', /40 t vs vehicle 60 t/)
})

test('generic meter values in descriptions are not hard width limits', () => {
  assert.equal(extractHardWidthLimit('Baustelle 3.25 m neben der Fahrbahn'), null)
  assert.ok(extractHardWidthLimit('Restbreite 3.10 m'))
})

test('dedupe by ~250 m + road + type keeps worst severity', () => {
  const a: ClassifiedEvidence = {
    id: 'a', title: 'warn', detail: '', source: 't', confidence: 'medium', state: 'warning',
    category: 'closures', lat: onRoute.lat, lng: onRoute.lng, distanceKm: 0.1, reason: 'x', locationKind: 'mainline',
    road: 'A7', blocker: true,
  }
  const b: ClassifiedEvidence = {
    ...a, id: 'b', title: 'hold', state: 'danger', lat: onRoute.lat + 0.001, lng: onRoute.lng + 0.001, confidence: 'high',
  }
  const out = dedupeClassified([a, b])
  assert.equal(out.length, 1)
  assert.equal(out[0].state, 'danger')
})

test('READY only with clearance confirmed and no VERIFY blockers', () => {
  const clear = determineVerdict([
    { id: 'bridge-clearance-confirmed', state: 'clear', blocker: false, category: 'observations' },
    { id: 'route-clear', state: 'clear', blocker: false, category: 'roadworks' },
  ], { clearanceConfirmed: true })
  assert.equal(clear.verdict, 'READY')

  const noTick = determineVerdict([
    { id: 'bridge-clearance-unknown', state: 'warning', blocker: true, category: 'observations' },
  ], { clearanceConfirmed: false })
  assert.equal(noTick.verdict, 'VERIFY')

  const nearby = determineVerdict([
    { id: 'nearby', state: 'warning', blocker: true, category: 'closures' },
  ], { clearanceConfirmed: true })
  assert.equal(nearby.verdict, 'VERIFY')

  const hold = determineVerdict([
    { id: 'block', state: 'danger', blocker: true, category: 'closures' },
  ], { clearanceConfirmed: true })
  assert.equal(hold.verdict, 'HOLD')

  const degraded = determineVerdict([], { degraded: true, clearanceConfirmed: true })
  assert.equal(degraded.verdict, 'VERIFY')
})

test('BW state roads and opposite direction cannot HOLD', () => {
  const bw = classifyCandidate(candidate({
    isBw: true,
    category: 'bw',
    title: 'B14 ROAD_CLOSED',
    description: 'ROAD_CLOSED Stuttgart',
    road: 'B14',
  }), baseCtx)
  assert.equal(bw?.state, 'warning')
  assert.match(bw?.reason || '', /BEMaS|state road/)

  const against = classifyCandidate(candidate({
    title: 'Sperrung Gegenrichtung',
    description: 'Sperrung nur Gegenrichtung Vollsperrung',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.equal(against?.state, 'warning')
})

test('permitted roads inferred from corridor; other Autobahn is VERIFY', () => {
  assert.deepEqual(inferPermittedRoads('A7'), ['A7'])
  const other = classifyCandidate(candidate({
    road: 'A27',
    title: 'Vollsperrung A27',
    description: 'Vollsperrung A27',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.equal(other?.state, 'warning')
  assert.match(other?.reason || '', /not the permitted/)
})

test('Autobahn closure without Vollsperrung is VERIFY, not HOLD', () => {
  const item = classifyCandidate(candidate({
    title: 'Sperrung rechter Fahrstreifen A7',
    description: 'Sperrung des rechten Fahrstreifens zwischen Soltau und Hannover',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.state, 'warning')
})

test('departure window defaults to now plus 24h', () => {
  const now = Date.parse('2026-11-09T13:00:00Z')
  const win = departureWindow({ nowMs: now })
  assert.equal(win.endMs - win.startMs, 24 * 60 * 60 * 1000)
})

test('off-route nearby items are info, not VERIFY blockers', () => {
  const nearbyPoint = turfOffset(line, 0.9)
  const other = classifyCandidate(candidate({
    road: 'A27',
    title: 'Vollsperrung A27',
    description: 'Vollsperrung A27',
    category: 'closures',
    isBlocked: true,
    lat: nearbyPoint.lat,
    lng: nearbyPoint.lng,
  }), baseCtx)
  assert.ok(other)
  assert.equal(other.state, 'info')
  assert.equal(other.blocker, false)
  assert.match(other.reason, /not on route/)

  const bw = classifyCandidate(candidate({
    isBw: true,
    category: 'bw',
    title: 'B14 ROAD_CLOSED',
    description: 'ROAD_CLOSED Stuttgart',
    road: 'B14',
    lat: nearbyPoint.lat,
    lng: nearbyPoint.lng,
  }), baseCtx)
  assert.equal(bw?.state, 'info')
  assert.equal(bw?.blocker, false)

  const rampOther = classifyCandidate(candidate({
    road: 'A261',
    title: 'AS Marmstorf Auffahrt',
    description: 'Sperrung der Auffahrt AS Marmstorf A261',
    category: 'closures',
    isBlocked: true,
    lat: nearbyPoint.lat,
    lng: nearbyPoint.lng,
  }), baseCtx)
  assert.equal(rampOther?.state, 'info')
  assert.equal(rampOther?.blocker, false)

  const ready = determineVerdict([
    { id: 'off-route', state: 'info', blocker: false, category: 'closures' },
    { id: 'route-clear', state: 'clear', blocker: false, category: 'roadworks' },
  ], { clearanceConfirmed: true })
  assert.equal(ready.verdict, 'READY')
})

test('unclear geometry stays VERIFY, never HOLD', () => {
  const item = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
    lat: undefined,
    lng: undefined,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.state, 'warning')
  assert.match(item.reason, /unclear/i)
})

test('dispatcher acknowledgements can clear VERIFY but never HOLD', () => {
  const verifyItem = { id: 'nearby-a7', state: 'warning' as const, blocker: true, category: 'closures' as const }
  const holdItem = { id: 'hold-a7', state: 'danger' as const, blocker: true, category: 'closures' as const }
  assert.equal(isAcknowledgeable(verifyItem), true)
  assert.equal(isAcknowledgeable(holdItem), false)

  const stillVerify = determineVerdict([verifyItem], {
    clearanceConfirmed: true,
    acknowledgements: [],
  })
  assert.equal(stillVerify.verdict, 'VERIFY')

  const ready = determineVerdict([verifyItem, {
    id: 'info-off', state: 'info', blocker: false, category: 'roadworks',
  }], {
    clearanceConfirmed: true,
    acknowledgements: [{ evidenceId: 'nearby-a7', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z' }],
  })
  assert.equal(ready.verdict, 'READY')
  assert.equal(ready.acknowledgedCount, 1)
  assert.match(ready.reasons.join(' '), /Dispatcher confirmed 1/)

  const hold = determineVerdict([holdItem, verifyItem], {
    clearanceConfirmed: true,
    acknowledgements: [
      { evidenceId: 'hold-a7', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z' },
      { evidenceId: 'nearby-a7', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z' },
    ],
  })
  assert.equal(hold.verdict, 'HOLD')

  const noClearance = determineVerdict([verifyItem], {
    clearanceConfirmed: false,
    acknowledgements: [{ evidenceId: 'nearby-a7', acknowledgedBy: 'Ada', acknowledgedAt: '2026-11-09T12:00:00Z' }],
  })
  assert.equal(noClearance.verdict, 'VERIFY')
})

test('distance helper returns ~0 on the line', () => {
  const km = distanceToRouteKm(line, 53.55, 9.99)
  assert.ok(km < 0.05)
})

test('concatenated place names are split in classified titles and details', () => {
  const item = classifyCandidate(candidate({
    road: 'A9',
    title: 'A9 Sperrung BayreuthKulmbach',
    description: 'Vollsperrung BayreuthKulmbach in Fahrtrichtung Süd',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A9'] })
  assert.ok(item)
  const blob = `${item.title} ${item.detail}`
  assert.match(blob, /Bayreuth – Kulmbach/)
  assert.doesNotMatch(blob, /BayreuthKulmbach/)
})
