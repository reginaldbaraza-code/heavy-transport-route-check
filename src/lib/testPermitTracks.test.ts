import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

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
  assert.ok(nearestKm({ lat: 52.85, lng: 9.75 }, hamburg) <= 0.5)
  const nearby = nearestKm({ lat: 52.85, lng: 9.76 }, hamburg)
  assert.ok(nearby > 0.5 && nearby <= 1.5, `A7 VERIFY offset is ${nearby.toFixed(3)} km`)
  assert.ok(nearestKm({ lat: 51.05, lng: 6.95 }, duisburg) <= 0.5)
  assert.ok(nearestKm({ lat: 48.4, lng: 10.25 }, munchen) <= 0.5)
  assert.ok(nearestKm({ lat: 52.20185, lng: 7.81021 }, bremen) <= 0.5)
})
