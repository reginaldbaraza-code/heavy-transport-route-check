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
  extractHardHeightLimit,
  extractHardWeightLimit,
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

test('item 1: Maximale Durchfahrtsbreite 3.5 m vs 3.8 m vehicle is HOLD, not a ramp', () => {
  const text = 'Garlstorfer Wald – Vorm Naturschutzpark, 11.08 km, Maximale Durchfahrtsbreite: 3.5 m'
  assert.equal(classifyLocationKind(text), 'mainline')
  assert.equal(extractHardWidthLimit(text), 3.5)
  const wide = { ...baseCtx, vehicle: { ...baseCtx.vehicle, width: 3.8 } }
  const item = classifyCandidate(candidate({
    title: 'A7 Garlstorfer Wald – Vorm Naturschutzpark',
    description: text,
    startTimestamp: '2026-11-02T00:00:00Z',
    endTimestamp: '2026-11-16T00:00:00Z',
  }), wide)
  assert.ok(item)
  assert.equal(item.locationKind, 'mainline')
  assert.equal(item.state, 'danger')
  assert.equal(isAcknowledgeable(item), false)
  assert.equal(determineVerdict([item], { clearanceConfirmed: true }).verdict, 'HOLD')
})

test('item 1: text height and weight limits HOLD when vehicle exceeds them', () => {
  assert.equal(extractHardHeightLimit('Maximale Durchfahrtshöhe: 4.0 m'), 4)
  assert.equal(extractHardWeightLimit('Gewichtsbeschränkung 40 t'), 40)
  const heightHold = classifyCandidate(candidate({
    title: 'A7 Bauwerk',
    description: 'Maximale Durchfahrtshöhe: 4.0 m',
  }), baseCtx)
  assert.equal(heightHold?.state, 'danger')
  const weightHold = classifyCandidate(candidate({
    title: 'A7 Bauwerk',
    description: 'Maximale Gewichtsbeschränkung 40 t',
  }), baseCtx)
  assert.equal(weightHold?.state, 'danger')
})

test('item 3: A1 ramp mentioning A7 cannot HOLD an A7 corridor', () => {
  const item = classifyCandidate(candidate({
    id: 'a1-maschen-ramp',
    road: 'A1',
    title: 'A1, AK Maschen Rampe 3 – Zubringer A7 zur A39',
    description: 'Sperrung Rampe 3 Zubringer A7 zur A39',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.locationKind, 'ramp')
  assert.notEqual(item.state, 'danger')
  assert.match(item.reason, /Ramp|not the permitted|other road/i)
})

test('item 3: primary road mismatch is off-permit even when permitted road is mentioned', () => {
  const item = classifyCandidate(candidate({
    road: 'A1',
    title: 'A1 Vollsperrung near A7 junction',
    description: 'Vollsperrung beide Richtungen Richtung A7',
    category: 'closures',
    isBlocked: true,
  }), baseCtx)
  assert.ok(item)
  assert.equal(item.state, 'warning')
  assert.match(item.reason, /not the permitted/)
})

test('item 6: closure that ended before departure is dropped', () => {
  const ctx: ClassifyContext = {
    ...baseCtx,
    windowStartMs: Date.parse('2026-11-14T21:00:00Z'),
    windowEndMs: Date.parse('2026-11-15T21:00:00Z'),
    nowMs: Date.parse('2026-11-14T12:00:00Z'),
  }
  const ended = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
    startTimestamp: '2026-11-12T00:00:00Z',
    endTimestamp: '2026-11-13T13:00:00Z',
  }), ctx)
  assert.equal(ended, null)

  const active = classifyCandidate(candidate({
    title: 'Vollsperrung A7',
    description: 'Vollsperrung beide Richtungen',
    category: 'closures',
    isBlocked: true,
    startTimestamp: '2026-11-12T00:00:00Z',
    endTimestamp: '2026-11-16T13:00:00Z',
  }), ctx)
  assert.equal(active?.state, 'danger')

  const win = departureWindow({
    departureStart: '2026-11-14T21:00:00Z',
    departureEnd: '2026-11-15T05:00:00Z',
  })
  assert.equal(win.startMs, Date.parse('2026-11-14T21:00:00Z'))
})

test('zwischen AS X und AS Y stays mainline, Rampe is ramp', () => {
  assert.equal(classifyLocationKind('Sperrung zwischen AS Soltau und AS Fallingbostel, 4.2 km'), 'mainline')
  assert.equal(classifyLocationKind('A1 AK Maschen Rampe 3'), 'ramp')
})

test('dedupe by ~250 m + road + type keeps worst severity', () => {
  const a: ClassifiedEvidence = {
    id: 'a', title: 'warn', detail: '', source: 't', confidence: 'medium', state: 'warning',
    category: 'closures', lat: onRoute.lat, lng: onRoute.lng, distanceKm: 0.1, reason: 'x', locationKind: 'mainline',
    road: 'A7', blocker: true, travelDirection: 'with',
  }
  const b: ClassifiedEvidence = {
    ...a, id: 'b', title: 'hold', state: 'danger', lat: onRoute.lat + 0.001, lng: onRoute.lng + 0.001, confidence: 'high',
  }
  const out = dedupeClassified([a, b])
  assert.equal(out.length, 1)
  assert.equal(out[0].state, 'danger')
  assert.equal(out[0].relatedRecords?.length, 1)
  assert.equal(out[0].relatedRecords?.[0].id, 'a')
  assert.match(out[0].reason, /\+1 related record/)
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

  // Remaining confirmed HOLD must not be downgraded when Autobahn feeds are degraded.
  const holdWhileDegraded = determineVerdict([
    { id: 'block', state: 'danger', blocker: true, category: 'closures' },
  ], { degraded: true, clearanceConfirmed: true })
  assert.equal(holdWhileDegraded.verdict, 'HOLD')
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

test('inferPermittedRoads sanitizes polluted job re-run corridor tokens', () => {
  assert.deepEqual(
    inferPermittedRoads('A1 · ±0.5 km HOLD / ±1.5 km VERIFY', ['A1·±0.5kmHOLD/±1.5kmVERIFY']),
    ['A1'],
  )
  assert.deepEqual(
    inferPermittedRoads('A1, A1·±0.5KMHOLD/±1.5KMVERIFY · ±0.5 km HOLD / ±1.5 km VERIFY'),
    ['A1'],
  )
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

test('Rampe / Zubringer keywords classify as ramp, not mainline', () => {
  assert.equal(classifyLocationKind('A1 Rampe 3 Zubringer A7 zur A39'), 'ramp')
  assert.equal(classifyLocationKind('Überfahrt A9 RF München auf A38'), 'ramp')
  assert.equal(classifyLocationKind('Ohr A3->A1'), 'ramp')
  assert.equal(classifyLocationKind('Tangente A3->A1'), 'ramp')
  assert.equal(classifyLocationKind('Verflechtung A46->A3'), 'ramp')
  assert.equal(classifyLocationKind('Verfelchtung A46->A3 FR OB'), 'ramp') // common MIA misspelling
  assert.equal(classifyLocationKind('Sperrung im Knotenpunkt'), 'ramp')
  assert.equal(classifyLocationKind('Betriebsumfahrung'), 'ramp')
  assert.equal(classifyLocationKind('AK Maschen works'), 'ramp')
  assert.equal(classifyLocationKind('AD Horster Dreieck'), 'ramp')
  assert.equal(classifyLocationKind('A9 von Bayreuth – Kulmbach (AD) Erneuerung'), 'ramp')
  // MIA work-code "Ak – D …" is not Autobahnkreuz — keep mainline so genuine width HOLDs
  assert.equal(classifyLocationKind('A1 - Bauwerksarbeiten - Ak – D 57914 - 1-str. R Köln'), 'mainline')
})

test('A1 ramp item must not HOLD an A7 permit', () => {
  // Hamburg→Hannover A7: "A1, AK Maschen, Bauwerksarbeiten, BW432a - A1 Abbau Verkehrsführung Rampe 3 - Zubringer A7 zur A39"
  // Use a coordinate closer to the A7 line
  const a7Line = routeLineFromPoints([
    { lat: 53.55, lng: 9.99 },
    { lat: 53.38, lng: 10.02 },
    { lat: 52.96, lng: 9.86 },
    { lat: 52.37, lng: 9.73 },
  ])
  
  const a1Ramp = classifyCandidate(candidate({
    id: 'mia-18908726-26409922-26409927-26409932',
    road: 'A1',
    title: 'A1, AK Maschen, Bauwerksarbeiten, BW432a',
    description: 'A1 Abbau Verkehrsführung Rampe 3 - Zubringer A7 zur A39',
    category: 'closures',
    isBlocked: true,
    lat: 53.38199,
    lng: 10.02032,
  }), { ...baseCtx, routeLine: a7Line, permittedRoads: ['A7'] })
  
  assert.ok(a1Ramp, 'Item should be classified, not filtered out')
  assert.equal(a1Ramp.locationKind, 'ramp', 'Should detect Rampe/Zubringer as ramp')
  assert.equal(a1Ramp.road, 'A1', 'Should identify primary road as A1')
  assert.equal(a1Ramp.state, 'warning', 'Should be warning, not danger')
  assert.notEqual(a1Ramp.state, 'danger', 'A1 ramp must not HOLD an A7 permit')
  assert.match(a1Ramp.reason, /ramp|not a confirmed mainline/i)
})

test('A38 Überfahrt item must not HOLD an A9 permit', () => {
  // Leipzig→Nürnberg A9: "Überfahrt A9 RF München auf A38"
  const a38Item = classifyCandidate(candidate({
    road: 'A38',
    title: 'A38 Überfahrt',
    description: 'Überfahrt A9 RF München auf A38',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A9'] })
  
  assert.ok(a38Item)
  assert.equal(a38Item.locationKind, 'ramp', 'Überfahrt should be classified as ramp')
  assert.equal(a38Item.road, 'A38', 'Primary road should be A38, not A9')
  assert.notEqual(a38Item.state, 'danger', 'A38 item must not HOLD an A9 permit')
})

test('A3 interchange connectors must not HOLD an A3 permit', () => {
  // Duisburg→Köln A3: "Ohr A3->A1", "Tangente A3->A1", "Rampe A3 -> A46", "Verflechtung A46->A3"
  const ohr = classifyCandidate(candidate({
    road: 'A3',
    title: 'Ohr A3->A1',
    description: 'Sperrung Ohr A3->A1',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A3'] })
  
  assert.ok(ohr)
  assert.equal(ohr.locationKind, 'ramp')
  assert.notEqual(ohr.state, 'danger')
  
  const tangente = classifyCandidate(candidate({
    road: 'A3',
    title: 'Tangente A3->A1',
    description: 'Tangente gesperrt',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A3'] })
  
  assert.ok(tangente)
  assert.equal(tangente.locationKind, 'ramp')
  assert.notEqual(tangente.state, 'danger')
  
  const rampe = classifyCandidate(candidate({
    road: 'A3',
    title: 'Rampe A3 -> A46',
    description: 'Vollsperrung Rampe',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A3'] })
  
  assert.ok(rampe)
  assert.equal(rampe.locationKind, 'ramp')
  assert.notEqual(rampe.state, 'danger')
  
  const verflechtung = classifyCandidate(candidate({
    road: 'A46',
    title: 'Verflechtung A46->A3',
    description: 'Verflechtung gesperrt',
    category: 'closures',
    isBlocked: true,
    lat: onRoute.lat + 0.001,
    lng: onRoute.lng + 0.001,
  }), { ...baseCtx, permittedRoads: ['A3'] })
  
  assert.ok(verflechtung)
  assert.equal(verflechtung.locationKind, 'ramp')
  // A46 item near A3 should be other-road VERIFY
  assert.notEqual(verflechtung.state, 'danger')
})

test('Knotenpunkt / Betriebsumfahrung on A8 must not HOLD', () => {
  // München→Stuttgart A8: "Sperrung im Knotenpunkt", "Betriebsumfahrung"
  const knotenpunkt = classifyCandidate(candidate({
    road: 'A8',
    title: 'Sperrung im Knotenpunkt',
    description: 'Sperrung im Knotenpunkt',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A8'] })
  
  assert.ok(knotenpunkt)
  assert.equal(knotenpunkt.locationKind, 'ramp')
  assert.notEqual(knotenpunkt.state, 'danger')
  
  const betrieb = classifyCandidate(candidate({
    road: 'A8',
    title: 'Betriebsumfahrung',
    description: 'Betriebsumfahrung eingerichtet',
    category: 'closures',
  }), { ...baseCtx, permittedRoads: ['A8'] })
  
  assert.ok(betrieb)
  assert.equal(betrieb.locationKind, 'ramp')
  assert.notEqual(betrieb.state, 'danger')
})

test('genuine A7 mainline closure must still HOLD', () => {
  // Control case: ensure we don't over-correct
  const genuine = classifyCandidate(candidate({
    road: 'A7',
    title: 'A7 Vollsperrung',
    description: 'Vollsperrung beide Richtungen A7 mainline zwischen Hamburg und Hannover',
    category: 'closures',
    isBlocked: true,
  }), { ...baseCtx, permittedRoads: ['A7'] })
  
  assert.ok(genuine)
  assert.equal(genuine.locationKind, 'mainline', 'Should be mainline, not ramp')
  assert.equal(genuine.state, 'danger', 'Genuine mainline closure must HOLD')
})

test('genuine A1 width restriction with MIA Ak code still HOLDs', () => {
  // Bremen→Dortmund control: "Ak – D 57914" must not demote a hard width limit to VERIFY
  const width = classifyCandidate(candidate({
    road: 'A1',
    title: 'A1 - Bauwerksarbeiten - Ak – D 57914 - 1-str. R Köln',
    description: 'Restbreite 3.25 m',
    residualWidth: 3.25,
    category: 'roadworks',
  }), { ...baseCtx, permittedRoads: ['A1'], vehicle: { width: 3.5, height: 4.5, length: 28.5, grossWeight: 60 } })

  assert.ok(width)
  assert.equal(width.locationKind, 'mainline')
  assert.equal(width.state, 'danger', 'Hard width on permitted A1 mainline must HOLD')
})

/** Real MIA closure payload shape (RoadOrCarriagewayOrLaneManagement + management roadClosed). */
function miaClosureCandidate(patch: Partial<CandidateInput> & { description: string }): CandidateInput {
  return candidate({
    id: patch.id || 'mia-closure-fixture',
    title: patch.title || patch.description,
    description: patch.description,
    source: 'Autobahn GmbH MIA via Mobilithek/MobiData BW',
    road: patch.road ?? 'A7',
    lat: patch.lat ?? onRoute.lat,
    lng: patch.lng ?? onRoute.lng,
    startTimestamp: patch.startTimestamp ?? '2026-11-02T18:00:00.000Z',
    endTimestamp: patch.endTimestamp ?? '2026-11-16T04:00:00.000Z',
    management: 'roadClosed',
    category: 'closures',
    isBlocked: true,
    ...patch,
  })
}

test('round-3: MIA closure "Sperrung Abfahrt Evendorf RF Süd" is VERIFY ramp, not HOLD', () => {
  const description =
    'A7, AS Bispingen bis AS Garlstorf, km 44,5-37,0, Grundinstandsetzung - Bauphase 2.2 - Sperrung Abfahrt Evendorf RF Süd'
  assert.equal(classifyLocationKind(description), 'ramp')
  const hhHan: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg Port Terminal',
    travelTo: 'Hannover Logistics Hub',
    routeBearing: 180,
  }
  // Coordinates placed on the fixture corridor; field structure matches the live MIA closure record.
  const asClosure = classifyCandidate(miaClosureCandidate({
    id: '16407587-25369598-25470845-25470848',
    description,
  }), hhHan)
  assert.ok(asClosure)
  assert.equal(asClosure.locationKind, 'ramp')
  assert.equal(asClosure.state, 'warning')
  assert.notEqual(asClosure.state, 'danger')
  assert.equal(determineVerdict([asClosure], { clearanceConfirmed: true }).verdict, 'VERIFY')

  const asRoadworks = classifyCandidate(candidate({
    id: '16407587-25369598-25470845-25470848#RW',
    title: description,
    description: `${description} · Short-term MIA record`,
    road: 'A7',
    startTimestamp: '2026-11-02T18:00:00.000Z',
    endTimestamp: '2026-11-16T04:00:00.000Z',
    category: 'roadworks',
  }), hhHan)
  assert.equal(asRoadworks?.locationKind, 'ramp')
  assert.equal(asRoadworks?.state, asClosure.state, 'record type must not change the ramp verdict')
})

test('round-3: MIA "Vollsperrung AS Westenholz" closure is VERIFY ramp, not HOLD', () => {
  const description =
    'Erneuerung der Fahrbahn L191 - Vollsperrung AS Westenholz - Vollsperrung AS Westenholz - AS Westenholz - Ausfahrt FR Hannover'
  assert.equal(classifyLocationKind(description), 'ramp')
  const hhHan: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg',
    travelTo: 'Hannover',
    routeBearing: 180,
  }
  const item = classifyCandidate(miaClosureCandidate({
    id: '24968442-24968444-24968447-24969204',
    description,
    startTimestamp: '2026-11-03T20:00:00.000Z',
    endTimestamp: '2026-11-25T20:00:00.000Z',
  }), hhHan)
  assert.ok(item)
  assert.equal(item.locationKind, 'ramp')
  assert.equal(item.state, 'warning')
  assert.equal(determineVerdict([item], { clearanceConfirmed: true }).verdict, 'VERIFY')
})

test('round-3: opposite-direction Westenholz ramp is visible Opposite direction info, not HOLD', () => {
  const description =
    'Von Auffahrt auf die A7: AS Westenholz Hannover -> Hamburg Vollsperrung AS Westenholz'
  const hhHan: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg Port Terminal',
    travelTo: 'Hannover Logistics Hub',
    routeBearing: 180,
  }
  const opposite = classifyCandidate(miaClosureCandidate({
    id: 'westenholz-opposite',
    description,
  }), hhHan)
  assert.ok(opposite, 'must not drop opposite-direction ramps silently')
  assert.equal(opposite.state, 'info')
  assert.equal(opposite.blocker, false)
  assert.match(opposite.title, /Opposite direction/i)
  assert.match(opposite.reason, /Opposite direction/i)
  assert.notEqual(opposite.state, 'danger')
  assert.equal(determineVerdict([opposite], { clearanceConfirmed: true }).verdict, 'READY')
})

test('round-3: ambiguous-direction ramp stays VERIFY', () => {
  const description =
    'A7, AS Bispingen bis AS Garlstorf, Grundinstandsetzung - Sperrung Abfahrt Evendorf'
  const hhHan: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg',
    travelTo: 'Hannover',
  }
  const item = classifyCandidate(miaClosureCandidate({ description }), hhHan)
  assert.ok(item)
  assert.equal(item.locationKind, 'ramp')
  assert.equal(item.state, 'warning')
  assert.equal(determineVerdict([item], { clearanceConfirmed: true }).verdict, 'VERIFY')
})

test('round-3: mainline Vollsperrung in travel direction during departure window still HOLDs', () => {
  const hhHan: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg',
    travelTo: 'Hannover',
    routeBearing: 180,
  }
  const mainline = classifyCandidate(miaClosureCandidate({
    id: 'a7-mainline-vollsperrung',
    title: 'A7 Vollsperrung',
    description: 'Vollsperrung beide Richtungen A7 Fahrbahn zwischen Soltau und Fallingbostel',
  }), hhHan)
  assert.ok(mainline)
  assert.equal(mainline.locationKind, 'mainline')
  assert.equal(mainline.state, 'danger')
  assert.equal(determineVerdict([mainline], { clearanceConfirmed: true }).verdict, 'HOLD')
})

test('round-3: same geometry sample vs custom GPX (track-derived travel) give the same ramp verdict', () => {
  const description =
    'Von Auffahrt auf die A7: AS Westenholz Hannover -> Hamburg Vollsperrung AS Westenholz'
  const fromTrack: ClassifyContext = {
    ...baseCtx,
    // Custom GPX with no permit — only track endpoint names / bearing.
    travelFrom: 'Hamburg Port Terminal',
    travelTo: 'Hannover Logistics Hub',
    routeBearing: 180,
  }
  const fromPermit: ClassifyContext = {
    ...baseCtx,
    travelFrom: 'Hamburg',
    travelTo: 'Hannover',
    routeBearing: 180,
  }
  const custom = classifyCandidate(miaClosureCandidate({ description }), fromTrack)
  const sample = classifyCandidate(miaClosureCandidate({ description }), fromPermit)
  assert.ok(custom && sample)
  assert.equal(custom.state, sample.state)
  assert.equal(custom.locationKind, sample.locationKind)
  assert.equal(custom.state, 'info')
})

test('round-4: dedupe keeps opposite-direction Westenholz .de4 separate from with-direction neighbour', () => {
  // Live Autobahn closures around AS Westenholz: .de4 is Hannover→Hamburg (against HH→HAN),
  // .de1 is Hamburg→Hannover (with). Place them inside DEDUPE_KM so only the direction guard saves .de4.
  const withDir: ClassifiedEvidence = {
    id: '2026-042956--vi-fbm.2026-11-03_21-00-00-000.devi-zus.2026-10-19_00-00-00-000.de1',
    title: 'Erneuerung der Fahrbahn L191 - Vollsperrung AS Westenholz',
    detail: 'Von A7: Hamburg -> Hannover nach Abfahrt von der A7: AS Westenholz',
    source: 'Autobahn',
    confidence: 'medium',
    state: 'warning',
    category: 'closures',
    lat: 52.7748,
    lng: 9.6677,
    distanceKm: 0.1,
    reason: 'Ramp / AS / parking site — not a confirmed mainline carriageway block.',
    locationKind: 'ramp',
    road: 'A7',
    blocker: true,
    travelDirection: 'with',
  }
  const againstDir: ClassifiedEvidence = {
    id: '2026-042956--vi-fbm.2026-11-03_21-00-00-000.devi-zus.2026-10-19_00-00-00-000.de4',
    title: 'Von Auffahrt auf die A7: AS Westenholz (Opposite direction)',
    detail: 'Von Auffahrt auf die A7: AS Westenholz nach A7: Hannover -> Hamburg',
    source: 'Autobahn',
    confidence: 'medium',
    state: 'info',
    category: 'closures',
    lat: 52.7746,
    lng: 9.6680,
    distanceKm: 0.12,
    reason: 'Opposite direction — junction ramp/AS is against the route travel direction.',
    locationKind: 'ramp',
    road: 'A7',
    blocker: false,
    travelDirection: 'against',
  }
  const out = dedupeClassified([withDir, againstDir])
  assert.equal(out.length, 2, 'direction mismatch must not silently drop .de4')
  assert.ok(out.some(item => item.id.endsWith('.de4')))
  assert.ok(out.some(item => item.id.endsWith('.de1')))
})

test('round-4: dedupe keeps ramp and mainline distinct; same-kind merge leaves related-record trace', () => {
  const ramp: ClassifiedEvidence = {
    id: 'ramp-a',
    title: 'AS Westenholz Auffahrt',
    detail: '',
    source: 't',
    confidence: 'medium',
    state: 'warning',
    category: 'closures',
    lat: onRoute.lat,
    lng: onRoute.lng,
    distanceKm: 0.05,
    reason: 'Ramp',
    locationKind: 'ramp',
    road: 'A7',
    blocker: true,
    travelDirection: 'with',
  }
  const mainline: ClassifiedEvidence = {
    ...ramp,
    id: 'mainline-a',
    title: 'A7 mainline works',
    locationKind: 'mainline',
    lat: onRoute.lat + 0.0005,
    lng: onRoute.lng + 0.0005,
  }
  const kindSplit = dedupeClassified([ramp, mainline])
  assert.equal(kindSplit.length, 2, 'ramp vs mainline must not merge')

  const twin: ClassifiedEvidence = {
    ...ramp,
    id: 'ramp-b',
    title: 'AS Westenholz twin sub-record',
    state: 'info',
    blocker: false,
    lat: onRoute.lat + 0.0008,
    lng: onRoute.lng + 0.0008,
  }
  const merged = dedupeClassified([ramp, twin])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'ramp-a')
  assert.equal(merged[0].relatedRecords?.length, 1)
  assert.equal(merged[0].relatedRecords?.[0].id, 'ramp-b')
  assert.equal(merged[0].relatedRecords?.[0].title, 'AS Westenholz twin sub-record')
  assert.match(merged[0].reason, /\+1 related record/)
})
