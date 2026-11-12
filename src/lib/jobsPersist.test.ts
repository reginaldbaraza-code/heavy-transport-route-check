import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import type { SavedJob } from './jobs.ts'
import {
  SAVED_JOBS_MAX_RECORDS,
  SAVED_JOBS_SOFT_MAX_BYTES,
  compactJobGpx,
  compactSavedJob,
  prepareSavedJobsForPersist,
} from './jobsPersist.ts'
import {
  STATE_BODY_MAX_BYTES,
  encodeStateWriteBody,
  utf8ByteLength,
} from './checkHistoryPersist.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const bremenGpx = readFileSync(join(root, 'public/test-permits/bremen-dortmund-a1.gpx'), 'utf8')

function realisticJob(index: number, gpx = bremenGpx): SavedJob {
  const now = new Date(Date.UTC(2026, 2, 12, 8, index % 60, 0)).toISOString()
  return {
    id: `job-bremen-${index}`,
    name: `Bremen → Dortmund #${index}`,
    permitNumber: `DE-HB-2026-${String(70000 + index).padStart(5, '0')}`,
    routeFileName: 'bremen-dortmund-a1.gpx',
    gpxContent: gpx,
    origin: 'Bremen Heavy Cargo Terminal',
    destination: 'Dortmund',
    corridor: 'A1',
    permittedRoads: ['A1'],
    validFrom: '2026-03-01T00:00:00.000Z',
    validUntil: '2026-03-31T23:59:00.000Z',
    travelFrom: 'Bremen Heavy Cargo Terminal',
    travelTo: 'Dortmund',
    scenario: index % 4 === 0 ? 'hold-width' : undefined,
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    plannedDeparture: new Date(Date.UTC(2026, 2, 12, 16, index % 60, 0)).toISOString(),
    monitorIntervalMinutes: 15,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now,
    lastVerdict: index % 3 === 0 ? 'HOLD' : index % 3 === 1 ? 'VERIFY' : 'READY',
    lastSummary: 'Full closure or residual width conflict on the permitted A1 corridor. '
      + 'Confirm remaining width with on-site escort before committing to departure.',
    lastRetrievedAt: now,
    lastSource: 'Autobahn GmbH MIA, Open Roadworks',
    monitoringStoppedReason: null,
    siteAcknowledgements: index % 5 === 0
      ? [{ evidenceId: 'bridge-clearance-unknown', acknowledgedBy: 'Anna', acknowledgedAt: now }]
      : undefined,
  }
}

test('compactJobGpx shrinks a realistic Bremen GPX while keeping a usable track', () => {
  const fullBytes = utf8ByteLength(bremenGpx)
  const compact = compactJobGpx(bremenGpx)
  assert.ok(utf8ByteLength(compact) < fullBytes / 2, 'compact GPX should be much smaller')
  assert.match(compact, /<trkpt /)
  assert.ok((compact.match(/<trkpt /g) || []).length >= 2)
})

test('50 realistic jobs serialize under 200 KB after compact', () => {
  const full = Array.from({ length: SAVED_JOBS_MAX_RECORDS }, (_, i) => realisticJob(i))
  const fullBytes = utf8ByteLength(JSON.stringify(full))
  assert.ok(
    fullBytes > SAVED_JOBS_SOFT_MAX_BYTES,
    `fixture should be heavy before compact (${fullBytes})`,
  )

  const { jobs, dropped } = prepareSavedJobsForPersist(full, { userId: 'anna' })
  assert.equal(dropped, 0)
  assert.equal(jobs.length, SAVED_JOBS_MAX_RECORDS)
  assert.ok(jobs.every(job => utf8ByteLength(job.gpxContent) < utf8ByteLength(bremenGpx)))
  assert.equal(jobs[0]?.permitNumber, 'DE-HB-2026-70000')
  assert.equal(jobs[0]?.vehicle.width, 3.5)
  assert.equal(jobs[0]?.lastVerdict, 'HOLD')

  const serialized = JSON.stringify(jobs)
  const bytes = utf8ByteLength(serialized)
  assert.ok(
    bytes < SAVED_JOBS_SOFT_MAX_BYTES,
    `compact jobs are ${bytes} bytes, expected < ${SAVED_JOBS_SOFT_MAX_BYTES}`,
  )

  const putBody = encodeStateWriteBody('anna', 'htr-saved-jobs', jobs)
  assert.ok(utf8ByteLength(putBody) <= STATE_BODY_MAX_BYTES)
})

test('prepareSavedJobsForPersist drops oldest beyond the hard cap', () => {
  const full = Array.from({ length: 55 }, (_, i) => compactSavedJob(realisticJob(i)))
  const { jobs, dropped } = prepareSavedJobsForPersist(full, { userId: 'anna' })
  assert.equal(jobs.length, SAVED_JOBS_MAX_RECORDS)
  assert.equal(dropped, 5)
  assert.equal(jobs[0]?.id, full[0]?.id)
  assert.equal(jobs[jobs.length - 1]?.id, full[SAVED_JOBS_MAX_RECORDS - 1]?.id)
})
