import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyCheckToJob,
  extractPermittedRoads,
  jobCheckOptions,
  normalizeSavedJob,
  sanitizeCorridor,
  type SavedJob,
} from './jobs.ts'
import type { RouteCheckResult } from './routeCheck.ts'

const pollutedDisplay = 'A1 · ±0.5 km HOLD / ±1.5 km VERIFY'
const doublePolluted = 'A1, A1·±0.5KMHOLD/±1.5KMVERIFY · ±0.5 km HOLD / ±1.5 km VERIFY'

test('sanitizeCorridor strips buffer display suffix', () => {
  assert.equal(sanitizeCorridor(pollutedDisplay), 'A1')
  assert.equal(sanitizeCorridor(doublePolluted), 'A1')
  assert.equal(sanitizeCorridor('A3 / A9'), 'A3, A9')
  assert.equal(sanitizeCorridor('A7', ['A7']), 'A7')
})

test('extractPermittedRoads recovers codes from polluted permittedRoads tokens', () => {
  assert.deepEqual(
    extractPermittedRoads(pollutedDisplay, ['A1·±0.5kmHOLD/±1.5kmVERIFY']),
    ['A1'],
  )
  assert.deepEqual(extractPermittedRoads('A1, A7 · ±0.5 km HOLD / ±1.5 km VERIFY'), ['A1', 'A7'])
})

test('normalizeSavedJob sanitizes polluted corridor on read', () => {
  const job = normalizeSavedJob({
    id: 'job-1',
    name: 'Bremen → Dortmund',
    permitNumber: 'DE-HB-2026-00734',
    routeFileName: 'bremen.gpx',
    gpxContent: '<gpx/>',
    origin: 'Bremen',
    destination: 'Dortmund',
    corridor: doublePolluted,
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    plannedDeparture: '2026-11-14T07:00:00.000Z',
    monitorIntervalMinutes: 15,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  })
  assert.equal(job.corridor, 'A1')
  assert.deepEqual(job.permittedRoads, ['A1'])
  assert.equal(job.travelFrom, 'Bremen')
  assert.equal(job.travelTo, 'Dortmund')
})

test('jobCheckOptions restores clean roads and validity for re-run', () => {
  const options = jobCheckOptions({
    id: 'job-1',
    name: 'Bremen → Dortmund',
    permitNumber: 'DE-HB-2026-00734',
    routeFileName: 'bremen.gpx',
    gpxContent: '<gpx/>',
    origin: 'Bremen Heavy Cargo Terminal',
    destination: 'Dortmund Industrial Park',
    corridor: pollutedDisplay,
    permittedRoads: ['A1·±0.5kmHOLD/±1.5kmVERIFY'],
    validFrom: '2026-11-12T00:00:00+01:00',
    validUntil: '2026-11-18T23:59:59+01:00',
    travelFrom: 'Bremen',
    travelTo: 'Dortmund',
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    plannedDeparture: '2026-11-14T07:00:00.000Z',
    monitorIntervalMinutes: 15,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  })
  assert.equal(options.corridor, 'A1')
  assert.deepEqual(options.permittedRoads, ['A1'])
  assert.equal(options.validFrom, '2026-11-12T00:00:00+01:00')
  assert.equal(options.validUntil, '2026-11-18T23:59:59+01:00')
  assert.equal(options.travelFrom, 'Bremen')
  assert.equal(options.travelTo, 'Dortmund')
  assert.equal(options.permitNumber, 'DE-HB-2026-00734')
  assert.equal('scenario' in options, false)
})

test('jobCheckOptions preserves simulated scenario for re-run and monitor', () => {
  const options = jobCheckOptions({
    id: 'job-scenario',
    name: 'Duisburg → Köln (simulated)',
    permitNumber: 'SIM-HOLD-WIDTH',
    routeFileName: 'duisburg.gpx',
    gpxContent: '<gpx/>',
    origin: 'Duisburg',
    destination: 'Köln',
    corridor: 'A3',
    permittedRoads: ['A3'],
    validFrom: '2026-11-12T00:00:00+01:00',
    validUntil: '2026-11-18T23:59:59+01:00',
    travelFrom: 'Duisburg',
    travelTo: 'Köln',
    scenario: 'hold-width',
    vehicle: { width: 3.8, height: 4.2, length: 30, grossWeight: 70 },
    plannedDeparture: '2026-11-14T07:00:00.000Z',
    monitorIntervalMinutes: 15,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  })
  assert.equal(options.scenario, 'hold-width')
  assert.equal(options.corridor, 'A3')
})

test('applyCheckToJob keeps scenario when updating last check', () => {
  const job: SavedJob = {
    id: 'job-scenario',
    name: 'Duisburg → Köln (simulated)',
    permitNumber: 'SIM-HOLD-WIDTH',
    routeFileName: 'duisburg.gpx',
    gpxContent: '<gpx/>',
    origin: 'Duisburg',
    destination: 'Köln',
    corridor: 'A3',
    permittedRoads: ['A3'],
    scenario: 'hold-width',
    vehicle: { width: 3.8, height: 4.2, length: 30, grossWeight: 70 },
    plannedDeparture: '2026-11-14T07:00:00.000Z',
    monitorIntervalMinutes: 15,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  }
  const result = {
    verdict: 'HOLD',
    title: 'Hold',
    summary: 'blocking',
    impact: '',
    confidence: 'high',
    issueCount: 1,
    evidence: [],
    route: {
      coordinates: [],
      origin: 'Duisburg',
      destination: 'Köln',
      distance: 60,
      corridor: 'A3 · ±0.5 km HOLD / ±1.5 km VERIFY',
    },
    degraded: false,
    mode: 'simulated',
    source: 'Simulated — not live data',
  } satisfies RouteCheckResult

  const next = applyCheckToJob(job, result, '2026-11-12T12:00:00.000Z')
  assert.equal(next.scenario, 'hold-width')
  assert.equal(next.lastVerdict, 'HOLD')
  assert.equal(next.corridor, 'A3')
})

test('applyCheckToJob does not persist API buffer display corridor', () => {
  const job: SavedJob = {
    id: 'job-1',
    name: 'Bremen → Dortmund',
    permitNumber: 'DE-HB-2026-00734',
    routeFileName: 'bremen.gpx',
    gpxContent: '<gpx/>',
    origin: 'Bremen',
    destination: 'Dortmund',
    corridor: 'A1',
    permittedRoads: ['A1'],
    validFrom: '2026-11-12T00:00:00+01:00',
    validUntil: '2026-11-18T23:59:59+01:00',
    travelFrom: 'Bremen',
    travelTo: 'Dortmund',
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    plannedDeparture: '2026-11-14T07:00:00.000Z',
    monitorIntervalMinutes: 15,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  }
  const result = {
    verdict: 'HOLD',
    title: 'Hold',
    summary: 'blocking',
    impact: '',
    confidence: 'high',
    issueCount: 7,
    evidence: [],
    route: {
      coordinates: [],
      origin: 'Bremen Heavy Cargo Terminal',
      destination: 'Dortmund Industrial Park',
      distance: 233,
      corridor: pollutedDisplay,
    },
    degraded: false,
  } satisfies RouteCheckResult

  const next = applyCheckToJob(job, result, '2026-11-12T12:00:00.000Z')
  assert.equal(next.corridor, 'A1')
  assert.deepEqual(next.permittedRoads, ['A1'])
  assert.equal(next.validFrom, '2026-11-12T00:00:00+01:00')
  assert.equal(next.validUntil, '2026-11-18T23:59:59+01:00')
  assert.equal(next.lastVerdict, 'HOLD')
})
