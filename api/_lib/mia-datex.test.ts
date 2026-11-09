import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildMiaSnapshot,
  buildMiaSnapshotFromXml,
  extractRecord,
  parseFeedXml,
  snapshotContentUnchanged,
} from './mia-datex.mjs'

const NOW = Date.parse('2026-11-09T20:00:00Z')

function recordXml(overrides: {
  id?: string
  type?: string
  road?: string
  start?: string
  end?: string
  lat?: number
  lng?: number
  description?: string
  residualWidth?: number
  management?: string
}) {
  const id = overrides.id || 'rec-1'
  const type = overrides.type || 'MaintenanceWorks'
  const road = overrides.road || 'A9'
  const start = overrides.start || '2026-11-10T06:00:00Z'
  const end = overrides.end || '2026-11-12T18:00:00Z'
  const lat = overrides.lat ?? 49.95
  const lng = overrides.lng ?? 11.58
  const posList = `${lat} ${lng}`
  const description = overrides.description || 'A9 roadworks'
  const width = overrides.residualWidth != null ? `<residualRoadWidth>${overrides.residualWidth}</residualRoadWidth>` : ''
  const management = overrides.management
    ? `<roadOrCarriagewayOrLaneManagementType>${overrides.management}</roadOrCarriagewayOrLaneManagementType>`
    : ''
  return `<situationRecord id="${id}" xsi:type="${type}"><overallStartTime>${start}</overallStartTime><overallEndTime>${end}</overallEndTime><posList>${posList}</posList><roadNumber>${road}</roadNumber><value>${description}</value>${width}${management}</situationRecord>`
}

function feedXml(records: string, publicationTime = '2026-11-09T19:50:00Z') {
  return `<d2LogicalModel><payloadPublication><publicationTime>${publicationTime}</publicationTime>${records}</payloadPublication></d2LogicalModel>`
}

test('extractRecord keeps valid DATEX situation records', () => {
  const xml = recordXml({ residualWidth: 2.8, management: 'roadClosed' })
  const extracted = extractRecord(xml, 'short', NOW)
  assert.ok(extracted.item)
  assert.equal(extracted.item?.id, 'rec-1')
  assert.equal(extracted.item?.road, 'A9')
  assert.equal(extracted.item?.residualWidth, 2.8)
  assert.equal(extracted.item?.management, 'roadClosed')
  assert.equal(extracted.item?.lat, 49.95)
  assert.equal(extracted.item?.lng, 11.58)
})

test('extractRecord skips expired, coord-less, and id-less records', () => {
  const expired = extractRecord(recordXml({ id: 'old', end: '2026-11-01T00:00:00Z' }), 'long', NOW)
  assert.equal(expired.skip, 'expired')

  const noCoords = extractRecord(
    '<situationRecord id="nocoords"><overallEndTime>2026-12-01T00:00:00Z</overallEndTime><value>x</value></situationRecord>',
    'short',
    NOW,
  )
  assert.equal(noCoords.skip, 'no-coords')

  const noId = extractRecord(
    '<situationRecord xsi:type="MaintenanceWorks"><posList>49 11</posList></situationRecord>',
    'short',
    NOW,
  )
  assert.equal(noId.skip, 'no-id')
})

test('parseFeedXml merges records and reads publicationTime', () => {
  const xml = feedXml(recordXml({ id: 'a' }) + recordXml({ id: 'b', road: 'A3' }))
  const parsed = parseFeedXml(xml, 'short', NOW)
  assert.equal(parsed.items.length, 2)
  assert.equal(parsed.stats.kept, 2)
  assert.equal(parsed.publicationTime, '2026-11-09T19:50:00.000Z')
})

test('buildMiaSnapshotFromXml prefers short-term when ids collide', () => {
  const short = feedXml(recordXml({ id: 'same', description: 'short works' }))
  const long = feedXml(recordXml({ id: 'same', description: 'long works', road: 'A7' }), '2026-11-09T18:00:00Z')
  const snapshot = buildMiaSnapshotFromXml(short, long, NOW)
  assert.equal(snapshot.items.length, 1)
  assert.equal(snapshot.items[0].term, 'short')
  assert.equal(snapshot.items[0].description, 'short works')
  assert.equal(snapshot.counts?.kept, 1)
})

test('snapshotContentUnchanged ignores snapshotAt and runtime', () => {
  const xml = feedXml(recordXml({ id: 'keep' }))
  const a = buildMiaSnapshotFromXml(xml, feedXml(''), NOW)
  const b = buildMiaSnapshotFromXml(xml, feedXml(''), NOW + 60_000)
  b.runtimeMs = 99
  assert.equal(snapshotContentUnchanged(a, b), true)
  const c = buildMiaSnapshotFromXml(feedXml(recordXml({ id: 'other' })), feedXml(''), NOW)
  assert.equal(snapshotContentUnchanged(a, c), false)
})

test('buildMiaSnapshot streams mocked DATEX feeds in parallel', async () => {
  const shortXml = feedXml(recordXml({ id: 's1' }))
  const longXml = feedXml(recordXml({ id: 'l1', road: 'A8' }), '2026-11-09T18:00:00Z')
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)
    const xml = url.includes('short_term') ? shortXml : longXml
    return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
  }
  const snapshot = await buildMiaSnapshot({ now: NOW, fetchImpl, timeoutMs: 2000 })
  assert.equal(snapshot.items.length, 2)
  assert.equal(snapshot.publicationTime?.short, '2026-11-09T19:50:00.000Z')
  assert.equal(snapshot.publicationTime?.long, '2026-11-09T18:00:00.000Z')
})
