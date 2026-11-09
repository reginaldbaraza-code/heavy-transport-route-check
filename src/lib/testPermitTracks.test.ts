import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SCENARIOS } from '../../api/_lib/scenarios.ts'

const DIR = 'public/test-permits'
const VALID = [
  'hof-bayreuth-a9.gpx',
  'duisburg-koln-a3.gpx',
  'bremen-dortmund-a1.gpx',
  'lubeck-rostock-a20.gpx',
  'leipzig-nurnberg-a9.gpx',
  'hamburg-hannover-a7.gpx',
  'munchen-stuttgart-a8.gpx',
]

function parseTrkpts(xml: string) {
  const points: { lat: number; lng: number }[] = []
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)"/g
  let m
  while ((m = re.exec(xml))) {
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng })
  }
  return points
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function angDiff(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d <= 180 ? d : 360 - d
}

function nearestKm(p: { lat: number; lng: number }, points: { lat: number; lng: number }[]) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const abLat = b.lat - a.lat
    const abLng = b.lng - a.lng
    const len2 = abLat * abLat + abLng * abLng
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.lat - a.lat) * abLat + (p.lng - a.lng) * abLng) / len2))
    const q = { lat: a.lat + t * abLat, lng: a.lng + t * abLng }
    best = Math.min(best, haversineKm(p, q))
  }
  return best
}

test('valid test permits have dense road-following tracks', () => {
  const onDisk = readdirSync(DIR).filter(name => name.endsWith('.gpx'))
  assert.ok(onDisk.includes('invalid-test.gpx'))
  for (const file of VALID) {
    const xml = readFileSync(join(DIR, file), 'utf8')
    const points = parseTrkpts(xml)
    assert.ok(points.length >= 200, `${file} has ${points.length} trkpts, expected ≥200`)
    let maxGap = 0
    for (let i = 1; i < points.length; i++) {
      maxGap = Math.max(maxGap, haversineKm(points[i - 1], points[i]))
    }
    assert.ok(maxGap <= 2.01, `${file} max gap ${maxGap.toFixed(3)} km exceeds 2 km`)
    assert.match(xml, /OpenStreetMap contributors/)
  }
})

test('invalid-test.gpx is unchanged and not treated as a valid track', () => {
  const xml = readFileSync(join(DIR, 'invalid-test.gpx'), 'utf8')
  assert.match(xml, /lat="invalid"/)
  assert.equal(parseTrkpts(xml).length, 0)
})

test('scenario fixture points stay within intended distance of the snapped line', () => {
  const hamburg = parseTrkpts(readFileSync(join(DIR, 'hamburg-hannover-a7.gpx'), 'utf8'))
  const duisburg = parseTrkpts(readFileSync(join(DIR, 'duisburg-koln-a3.gpx'), 'utf8'))
  const munchen = parseTrkpts(readFileSync(join(DIR, 'munchen-stuttgart-a8.gpx'), 'utf8'))
  const bremen = parseTrkpts(readFileSync(join(DIR, 'bremen-dortmund-a1.gpx'), 'utf8'))
  const hold = SCENARIOS['hold-closure'].evidence[0]
  const ramp = SCENARIOS['verify-nearby'].evidence[0]
  const width = SCENARIOS['hold-width'].evidence[0]
  const height = SCENARIOS['hold-height'].evidence[0]
  const weight = SCENARIOS['hold-weight'].evidence[0]
  const holdKm = nearestKm({ lat: hold.lat!, lng: hold.lng! }, hamburg)
  const rampKm = nearestKm({ lat: ramp.lat!, lng: ramp.lng! }, hamburg)
  assert.ok(holdKm >= 0.03 && holdKm <= 0.05, `A7 HOLD is ${holdKm.toFixed(3)} km from the line`)
  assert.ok(rampKm >= 0.8 && rampKm <= 1.0, `A7 VERIFY ramp is ${rampKm.toFixed(3)} km from the line`)
  const widthKm = nearestKm({ lat: width.lat!, lng: width.lng! }, duisburg)
  const heightKm = nearestKm({ lat: height.lat!, lng: height.lng! }, munchen)
  const weightKm = nearestKm({ lat: weight.lat!, lng: weight.lng! }, bremen)
  assert.ok(widthKm >= 0.03 && widthKm <= 0.05, `A3 width is ${widthKm.toFixed(3)} km`)
  assert.ok(heightKm >= 0.03 && heightKm <= 0.05, `A8 height is ${heightKm.toFixed(3)} km`)
  assert.ok(weightKm >= 0.03 && weightKm <= 0.05, `A1 weight is ${weightKm.toFixed(3)} km`)
})

test('snapped tracks have no heading change over 120° except within 2 km of the ends', () => {
  for (const file of VALID) {
    const points = parseTrkpts(readFileSync(join(DIR, file), 'utf8'))
    let total = 0
    for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i])
    let along = 0
    for (let i = 2; i < points.length; i++) {
      along += haversineKm(points[i - 2], points[i - 1])
      const delta = angDiff(bearingDeg(points[i - 2], points[i - 1]), bearingDeg(points[i - 1], points[i]))
      const fromEnd = total - along
      if (along <= 2 || fromEnd <= 2) continue
      assert.ok(
        delta <= 120,
        `${file} pt ${i} turns ${delta.toFixed(1)}° at ${points[i].lat.toFixed(5)},${points[i].lng.toFixed(5)} (${along.toFixed(1)} km from start)`,
      )
    }
  }
})
