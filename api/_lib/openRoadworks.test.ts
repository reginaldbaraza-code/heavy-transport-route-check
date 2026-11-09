import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MIA_STALE_HOURS, MIA_STALE_MS } from './mobidata.ts'
import {
  miaSnapshotAgeMs,
  miaSnapshotIsStale,
  resetMiaCaches,
  resolveMiaSnapshot,
  setMiaFetchForTests,
  setMiaSnapshotForTests,
  type MiaSnapshot,
} from './openRoadworks.ts'

const FRESH_AT = '2026-11-09T18:00:00.000Z'
const STALE_AT = '2026-11-09T08:00:00.000Z'
const NOW = Date.parse('2026-11-09T20:00:00.000Z')

function snapshot(snapshotAt: string, id = 'file-1'): MiaSnapshot {
  return {
    snapshotAt,
    source: 'test',
    license: 'dl-de/by-2.0',
    attribution: 'test',
    items: [{
      id,
      term: 'short',
      type: 'MaintenanceWorks',
      road: 'A9',
      lat: 49.95,
      lng: 11.58,
      start: '2026-11-10T00:00:00Z',
      end: '2026-11-12T00:00:00Z',
      description: 'file snapshot item',
    }],
  }
}

function datexResponse(id: string) {
  const xml = `<d2LogicalModel><payloadPublication><publicationTime>2026-11-09T19:55:00Z</publicationTime><situationRecord id="${id}" xsi:type="MaintenanceWorks"><overallStartTime>2026-11-10T00:00:00Z</overallStartTime><overallEndTime>2026-11-12T00:00:00Z</overallEndTime><posList>50.1 8.6 50.11 8.61</posList><roadNumber>A5</roadNumber><value>live ${id}</value></situationRecord></payloadPublication></d2LogicalModel>`
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })
}

test('MIA stale threshold is 8 hours', () => {
  assert.equal(MIA_STALE_HOURS, 8)
  const fresh: MiaSnapshot = snapshot(new Date(NOW - MIA_STALE_MS).toISOString())
  assert.equal(miaSnapshotIsStale(fresh, NOW), false)
  const stale: MiaSnapshot = snapshot(new Date(NOW - MIA_STALE_MS - 1).toISOString())
  assert.equal(miaSnapshotIsStale(stale, NOW), true)
  assert.ok(miaSnapshotAgeMs(stale, NOW) > MIA_STALE_MS)
})

test('resolveMiaSnapshot uses the bundled file when it is fresher than 8h', async () => {
  resetMiaCaches()
  setMiaSnapshotForTests(snapshot(FRESH_AT))
  let fetches = 0
  setMiaFetchForTests(async () => {
    fetches += 1
    return datexResponse('should-not-run')
  })
  const result = await resolveMiaSnapshot(NOW)
  assert.equal(result.live, false)
  assert.equal(result.stale, false)
  assert.equal(result.snapshot?.items[0].id, 'file-1')
  assert.equal(fetches, 0)
  resetMiaCaches()
})

test('resolveMiaSnapshot live-fetches DATEX when the bundled snapshot is older than 8h', async () => {
  resetMiaCaches()
  setMiaSnapshotForTests(snapshot(STALE_AT))
  let fetches = 0
  setMiaFetchForTests(async () => {
    fetches += 1
    return datexResponse('live-1')
  })
  const first = await resolveMiaSnapshot(NOW)
  assert.equal(first.stale, false)
  assert.equal(first.live, true)
  assert.equal(first.snapshot?.items[0].id, 'live-1')
  assert.equal(first.snapshot?.live, true)
  assert.equal(fetches, 2)

  const second = await resolveMiaSnapshot(NOW + 1000)
  assert.equal(second.live, true)
  assert.equal(second.snapshot?.items[0].id, 'live-1')
  assert.equal(fetches, 2)
  resetMiaCaches()
})

test('resolveMiaSnapshot marks the MIA layer stale when live DATEX fails', async () => {
  resetMiaCaches()
  setMiaSnapshotForTests(snapshot(STALE_AT, 'stale-file'))
  setMiaFetchForTests(async () => {
    throw new Error('DATEX unreachable')
  })
  const result = await resolveMiaSnapshot(NOW)
  assert.equal(result.live, false)
  assert.equal(result.stale, true)
  assert.equal(result.snapshot?.items[0].id, 'stale-file')
  assert.match(result.error || '', /DATEX unreachable/)
  resetMiaCaches()
})
