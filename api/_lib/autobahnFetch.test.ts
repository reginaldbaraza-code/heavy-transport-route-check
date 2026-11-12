import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import {
  CRITICAL_AUTOBAHN_FEEDS,
  fetchAutobahnFeed,
  fetchAutobahnRoadFeeds,
  formatAutobahnFailureDetail,
  summarizeAutobahnFetchHealth,
  type AutobahnRoadFeeds,
} from './autobahnFetch.ts'
import { determineVerdict, verdictCopy } from './verdict.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('fetchAutobahnFeed returns items on healthy response', async () => {
  const fetchImpl = mock.fn(async () =>
    jsonResponse({ roadworks: [{ identifier: 'rw-1' }] }),
  )
  const result = await fetchAutobahnFeed('A7', 'roadworks', { fetchImpl: fetchImpl as unknown as typeof fetch })
  assert.equal(result.ok, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].identifier, 'rw-1')
})

test('fetchAutobahnFeed marks timeout / network errors as failed (not empty success)', async () => {
  const fetchImpl = mock.fn(async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  })
  const result = await fetchAutobahnFeed('A7', 'roadworks', { fetchImpl: fetchImpl as unknown as typeof fetch })
  assert.equal(result.ok, false)
  assert.deepEqual(result.items, [])
  assert.match(result.error || '', /timeout|aborted|TimeoutError/i)
})

test('fetchAutobahnFeed marks non-OK HTTP as failed', async () => {
  const fetchImpl = mock.fn(async () => jsonResponse({ error: 'nope' }, 503))
  const result = await fetchAutobahnFeed('A20', 'closure', { fetchImpl: fetchImpl as unknown as typeof fetch })
  assert.equal(result.ok, false)
  assert.equal(result.error, 'HTTP 503')
  assert.deepEqual(result.items, [])
})

test('fetchAutobahnRoadFeeds collects per-feed failures for one road', async () => {
  const fetchImpl = mock.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/roadworks')) {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }
    if (url.includes('/closure')) return jsonResponse({ closure: [{ identifier: 'c-1' }] })
    if (url.includes('/warning')) return jsonResponse({ warning: [] })
    if (url.includes('/parking_lorry')) return jsonResponse({ parking_lorry: [] })
    return jsonResponse({}, 404)
  })

  const road = await fetchAutobahnRoadFeeds('A7', { fetchImpl: fetchImpl as unknown as typeof fetch })
  assert.equal(road.roadworks.length, 0)
  assert.equal(road.closures.length, 1)
  assert.equal(road.failures.length, 1)
  assert.equal(road.failures[0].type, 'roadworks')
  assert.equal(road.failures[0].road, 'A7')
})

test('summarizeAutobahnFetchHealth: healthy feeds are not degraded', () => {
  const roads: AutobahnRoadFeeds[] = [{
    road: 'A7',
    roadworks: [{ id: 1 }],
    closures: [],
    warnings: [],
    parking: [],
    failures: [],
  }]
  const health = summarizeAutobahnFetchHealth(roads)
  assert.equal(health.degraded, false)
  assert.equal(health.partial, false)
  assert.equal(health.criticalSucceeded, CRITICAL_AUTOBAHN_FEEDS.length)
})

test('summarizeAutobahnFetchHealth: one critical feed failure is partial degraded', () => {
  const roads: AutobahnRoadFeeds[] = [{
    road: 'A7',
    roadworks: [],
    closures: [{ id: 1 }],
    warnings: [],
    parking: [],
    failures: [{ road: 'A7', type: 'roadworks', error: 'TimeoutError' }],
  }]
  const health = summarizeAutobahnFetchHealth(roads)
  assert.equal(health.degraded, true)
  assert.equal(health.partial, true)
  assert.match(formatAutobahnFailureDetail(health), /Partial Autobahn/)
})

test('summarizeAutobahnFetchHealth: all critical feeds failing is total degraded', () => {
  const roads: AutobahnRoadFeeds[] = [{
    road: 'A20',
    roadworks: [],
    closures: [],
    warnings: [],
    parking: [],
    failures: CRITICAL_AUTOBAHN_FEEDS.map(type => ({
      road: 'A20',
      type,
      error: 'TimeoutError',
    })),
  }]
  const health = summarizeAutobahnFetchHealth(roads)
  assert.equal(health.degraded, true)
  assert.equal(health.partial, false)
  assert.equal(health.criticalSucceeded, 0)
  assert.match(formatAutobahnFailureDetail(health), /unavailable/)
})

test('parking-only failure does not degrade the route check', () => {
  const roads: AutobahnRoadFeeds[] = [{
    road: 'A7',
    roadworks: [],
    closures: [],
    warnings: [],
    parking: [],
    failures: [{ road: 'A7', type: 'parking_lorry', error: 'HTTP 500' }],
  }]
  const health = summarizeAutobahnFetchHealth(roads)
  assert.equal(health.degraded, false)
  assert.equal(health.partial, false)
})

test('degraded check never yields READY; remaining HOLD stays HOLD', () => {
  const degradedEmpty = determineVerdict([], { degraded: true, clearanceConfirmed: true })
  assert.equal(degradedEmpty.verdict, 'VERIFY')
  assert.match(degradedEmpty.reasons.join(' '), /unavailable/i)

  const holdPreserved = determineVerdict([
    { id: 'block', state: 'danger', blocker: true, category: 'closures' },
  ], { degraded: true, clearanceConfirmed: true })
  assert.equal(holdPreserved.verdict, 'HOLD')

  const copyTotal = verdictCopy('VERIFY', {
    degraded: true,
    degradedPartial: false,
    issueCount: 0,
    distanceKm: 100,
    clearanceConfirmed: true,
  })
  assert.match(copyTotal.title, /data source unavailable/i)

  const copyPartial = verdictCopy('VERIFY', {
    degraded: true,
    degradedPartial: true,
    issueCount: 0,
    distanceKm: 100,
    clearanceConfirmed: true,
  })
  assert.match(copyPartial.title, /some Autobahn feeds unavailable/i)

  const holdCopy = verdictCopy('HOLD', {
    degraded: true,
    degradedPartial: true,
    issueCount: 1,
    distanceKm: 100,
    clearanceConfirmed: true,
  })
  assert.match(holdCopy.title, /Hold departure/i)
  assert.match(holdCopy.summary, /incomplete evidence/i)
})
