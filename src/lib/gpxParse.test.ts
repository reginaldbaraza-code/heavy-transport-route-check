import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  GPX_FRIENDLY_EMPTY,
  GPX_FRIENDLY_INVALID,
  GpxParseError,
  downsampleGpxPoints,
  parseGpxDocument,
} from './gpxParse.ts'

function wrap(body: string, creator = 'VEMAGS Route Export') {
  return `<?xml version="1.0"?><gpx version="1.1" creator="${creator}">${body}</gpx>`
}

test('multi-segment trkpt are merged in document order', () => {
  const xml = wrap(`
    <trk><trkseg>
      <trkpt lat="53.55" lon="10.00"></trkpt>
      <trkpt lat="53.40" lon="9.90"></trkpt>
    </trkseg></trk>
    <trk><trkseg>
      <trkpt lat="52.50" lon="9.80"></trkpt>
      <trkpt lat="52.36" lon="9.73"></trkpt>
    </trkseg></trk>
  `)
  const parsed = parseGpxDocument(xml)
  assert.equal(parsed.points.length, 4)
  assert.equal(parsed.source, 'trkpt')
  assert.equal(parsed.vemags, true)
  assert.equal(parsed.points[0].lat, 53.55)
  assert.equal(parsed.points[3].lat, 52.36)
})

test('rtept-only GPX is accepted', () => {
  const xml = wrap(`
    <rte>
      <rtept lat="51.2" lon="6.8"><name>Start</name></rtept>
      <rtept lat="50.9" lon="6.9"><name>End</name></rtept>
    </rte>
  `)
  const parsed = parseGpxDocument(xml)
  assert.equal(parsed.source, 'rtept')
  assert.equal(parsed.points.length, 2)
  assert.equal(parsed.points[0].name, 'Start')
})

test('wpt-only GPX is accepted', () => {
  const xml = wrap(`
    <wpt lat="48.1" lon="11.5"></wpt>
    <wpt lat="48.8" lon="9.2"></wpt>
  `, 'OSM')
  const parsed = parseGpxDocument(xml)
  assert.equal(parsed.source, 'wpt')
  assert.equal(parsed.vemags, false)
  assert.equal(parsed.points.length, 2)
})

test('empty GPX is rejected with a friendly message', () => {
  assert.throws(() => parseGpxDocument(wrap('<trk></trk>')), (error: unknown) => {
    assert.ok(error instanceof GpxParseError)
    assert.equal(error.message, GPX_FRIENDLY_EMPTY)
    assert.match(error.technical, /trkpt/)
    return true
  })
})

test('non-GPX is rejected with a friendly message', () => {
  assert.throws(() => parseGpxDocument('<html>not a route</html>'), (error: unknown) => {
    assert.ok(error instanceof GpxParseError)
    assert.equal(error.message, GPX_FRIENDLY_INVALID)
    return true
  })
})

test('huge tracks are downsampled below 5000 points', () => {
  const pts = Array.from({ length: 6200 }, (_, i) => (
    `<trkpt lat="${53.5 - i * 0.0002}" lon="${10 - i * 0.0001}"></trkpt>`
  )).join('')
  const parsed = parseGpxDocument(wrap(`<trk><trkseg>${pts}</trkseg></trk>`))
  assert.equal(parsed.downsampled, true)
  assert.ok(parsed.points.length <= 5000)
  assert.equal(parsed.points[0].lat, 53.5)
  const simplified = downsampleGpxPoints(parsed.points, 200)
  assert.ok(simplified.length <= 200)
  assert.equal(simplified[0].lat, parsed.points[0].lat)
})
