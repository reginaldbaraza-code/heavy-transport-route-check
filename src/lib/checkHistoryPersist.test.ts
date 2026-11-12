import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CheckHistoryRecord } from '../context/RouteMonitoringContext'
import {
  CHECK_HISTORY_MAX_RECORDS,
  CHECK_HISTORY_SOFT_MAX_BYTES,
  KEEPALIVE_BODY_MAX_BYTES,
  STATE_BODY_MAX_BYTES,
  compactCheckHistoryRecord,
  createKeepaliveBudget,
  decidePersistStart,
  encodeStateWriteBody,
  prepareCheckHistoryForPersist,
  reserveKeepaliveBytes,
  shouldScheduleRetry,
  shouldUseKeepalive,
  utf8ByteLength,
} from './checkHistoryPersist.ts'

/** Synthetic Bremen→Dortmund HOLD shaped like a live Autobahn check (heavy evidence). */
function bremenStyleRecord(index: number): CheckHistoryRecord {
  const runAt = new Date(Date.UTC(2026, 2, 12, 8, index % 60, 0)).toISOString()
  const evidence = Array.from({ length: 12 }, (_, i) => ({
    id: `ev-${index}-${i}`,
    title: `A1 roadworks km ${120 + i} — lane restriction near AS Münster-Nord`,
    detail: 'Carriageway works with temporary width limit 3.20 m on the permitted heavy-transport corridor. '
      + 'Confirm remaining width with on-site escort before committing to departure. '
      + 'Coordinates and related Autobahn GmbH MIA / Open Roadworks text retained for dispatcher review. '
      + 'Lorem detail padding to approximate realistic live payload size for each evidence row item.',
    source: 'Autobahn GmbH MIA, Open Roadworks',
    age: '2h',
    confidence: 'high' as const,
    state: i % 4 === 0 ? 'danger' as const : 'warning' as const,
    category: i % 3 === 0 ? 'closures' as const : 'roadworks' as const,
    lat: 52.3 + i * 0.01,
    lng: 8.1 + i * 0.01,
    startTimestamp: runAt,
    endTimestamp: null,
    retrievedAt: runAt,
    distanceKm: 1.2 + i * 0.3,
    reason: 'width',
    locationKind: 'mainline',
    blocker: i % 4 === 0,
    travelDirection: 'both',
    relatedRecords: [{ id: `rel-${i}`, title: `Related notice ${i}` }],
  }))

  return {
    id: `check-bremen-${index}`,
    permitName: 'Bremen → Dortmund (A1) · DE-HB-2026-00734',
    routeLabel: 'Bremen Heavy Cargo Terminal → Dortmund',
    runAt,
    verdict: 'HOLD',
    evidenceCount: evidence.length,
    retrievedAt: runAt,
    source: 'Autobahn GmbH MIA, Open Roadworks',
    summary: 'Full closure or residual width conflict on the permitted A1 corridor.',
    degraded: false,
    permitNumber: 'DE-HB-2026-00734',
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    title: 'HOLD — residual width on A1',
    impact: 'Do not depart until the corridor is clear or an alternate is approved.',
    confidence: 'high',
    evidence,
    confirmOnSite: evidence.filter(item => item.state === 'warning').map(item => item.title),
    jobId: index % 3 === 0 ? `job-${index}` : undefined,
    alertEligible: true,
    siteAcknowledgements: [],
    actionsLog: index % 5 === 0 ? ['Escalate · Logged locally (demo), not sent'] : undefined,
  }
}

test('keepalive is used only for bodies ≤ 60 KB', () => {
  assert.equal(KEEPALIVE_BODY_MAX_BYTES, 60 * 1024)
  assert.equal(shouldUseKeepalive(KEEPALIVE_BODY_MAX_BYTES), true)
  assert.equal(shouldUseKeepalive(KEEPALIVE_BODY_MAX_BYTES + 1), false)
  assert.equal(shouldUseKeepalive(0), true)

  const small = encodeStateWriteBody('anna', 'htr-saved-jobs', [{ id: 'job-1' }])
  assert.ok(shouldUseKeepalive(utf8ByteLength(small)))

  const bulky = encodeStateWriteBody(
    'anna',
    'htr-route-check-history',
    Array.from({ length: 8 }, (_, i) => bremenStyleRecord(i)),
  )
  assert.ok(utf8ByteLength(bulky) > KEEPALIVE_BODY_MAX_BYTES)
  assert.equal(shouldUseKeepalive(utf8ByteLength(bulky)), false)
})

test('shared keepalive budget rejects concurrent bodies that exceed 60 KB total', () => {
  const budget = createKeepaliveBudget()
  assert.equal(reserveKeepaliveBytes(budget, 30 * 1024), true)
  assert.equal(reserveKeepaliveBytes(budget, 30 * 1024), true)
  // 30 + 30 already filled the shared 60 KB — a third request must fall back.
  assert.equal(reserveKeepaliveBytes(budget, 1), false)

  const tight = createKeepaliveBudget()
  assert.equal(reserveKeepaliveBytes(tight, 51 * 1024), true)
  // 51 KB + 15 KB would exceed Chrome's shared keepalive quota.
  assert.equal(reserveKeepaliveBytes(tight, 15 * 1024), false)
  assert.equal(tight.used, 51 * 1024)

  const oversized = createKeepaliveBudget()
  assert.equal(reserveKeepaliveBytes(oversized, KEEPALIVE_BODY_MAX_BYTES + 1), false)
  assert.equal(oversized.used, 0)
})

test('persist dedupe starts once per key and skips same-body inflight', () => {
  assert.equal(
    decidePersistStart({ hasInflight: false, inflightSerialized: null, nextSerialized: 'a' }),
    'start',
  )
  assert.equal(
    decidePersistStart({ hasInflight: true, inflightSerialized: 'a', nextSerialized: 'a' }),
    'skip-same-inflight',
  )
  assert.equal(
    decidePersistStart({ hasInflight: true, inflightSerialized: 'a', nextSerialized: 'b' }),
    'abort-and-replace',
  )
})

test('retries are blocked while a PUT for the same key is still in flight', () => {
  assert.equal(
    shouldScheduleRetry({
      hasInflight: true,
      cacheSerialized: 'a',
      attemptedSerialized: 'a',
    }),
    false,
  )
  assert.equal(
    shouldScheduleRetry({
      hasInflight: false,
      cacheSerialized: 'b',
      attemptedSerialized: 'a',
    }),
    false,
  )
  assert.equal(
    shouldScheduleRetry({
      hasInflight: false,
      cacheSerialized: undefined,
      attemptedSerialized: 'a',
    }),
    false,
  )
  assert.equal(
    shouldScheduleRetry({
      hasInflight: false,
      cacheSerialized: 'a',
      attemptedSerialized: 'a',
    }),
    true,
  )
})

test('50 realistic Bremen-shaped history records compact to under 200 KB', () => {
  const full = Array.from({ length: CHECK_HISTORY_MAX_RECORDS }, (_, i) => bremenStyleRecord(i))
  const fullBytes = utf8ByteLength(JSON.stringify(full))
  assert.ok(fullBytes > CHECK_HISTORY_SOFT_MAX_BYTES, `fixture should be heavy before compact (${fullBytes})`)

  const compact = prepareCheckHistoryForPersist(full, { userId: 'anna' })
  assert.equal(compact.length, CHECK_HISTORY_MAX_RECORDS)
  assert.ok(compact.every(record => !('evidence' in record) || record.evidence === undefined))
  assert.equal(compact[0]?.permitNumber, 'DE-HB-2026-00734')
  const vehicle = compact[0]?.vehicle as { width?: number } | undefined
  assert.equal(vehicle?.width, 3.5)

  const serialized = JSON.stringify(compact)
  const bytes = utf8ByteLength(serialized)
  assert.ok(
    bytes < CHECK_HISTORY_SOFT_MAX_BYTES,
    `compact history is ${bytes} bytes, expected < ${CHECK_HISTORY_SOFT_MAX_BYTES}`,
  )

  const putBody = encodeStateWriteBody('anna', 'htr-route-check-history', compact)
  assert.ok(utf8ByteLength(putBody) <= STATE_BODY_MAX_BYTES)
})

test('prepareCheckHistoryForPersist trims oldest when body would exceed the limit', () => {
  const full = Array.from({ length: 20 }, (_, i) => ({
    ...compactCheckHistoryRecord(bremenStyleRecord(i)),
    // Inflate each compact row so a few already exceed a tiny budget.
    summary: 'x'.repeat(2_000),
  }))
  const trimmed = prepareCheckHistoryForPersist(full, {
    userId: 'anna',
    maxBodyBytes: 8_000,
  })
  assert.ok(trimmed.length > 0)
  assert.ok(trimmed.length < full.length)
  assert.equal(trimmed[0]?.id, full[0]?.id)
  const body = encodeStateWriteBody('anna', 'htr-route-check-history', trimmed)
  assert.ok(utf8ByteLength(body) <= 8_000)
})
