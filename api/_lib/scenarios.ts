import type { ClassifiedEvidence } from './verdict.js'

export type ScenarioId = 'ready-clear' | 'verify-nearby' | 'hold-closure' | 'hold-width' | 'hold-height' | 'hold-weight'

export type ScenarioFixture = {
  id: ScenarioId
  label: string
  expectedVerdict: 'READY' | 'VERIFY' | 'HOLD'
  origin: string
  destination: string
  distanceKm: number
  corridor: string
  vehicle: { width: number; height: number; length: number; grossWeight: number }
  clearanceConfirmed: boolean
  clearanceConfirmedBy: string
  evidence: ClassifiedEvidence[]
}

const retrievedAt = '2026-11-09T12:00:00.000Z'

export const SCENARIOS: Record<ScenarioId, ScenarioFixture> = {
  'ready-clear': {
    id: 'ready-clear',
    label: 'Simulated READY — empty A20 corridor',
    expectedVerdict: 'READY',
    origin: 'Lübeck A20',
    destination: 'Rostock A20',
    distanceKm: 131,
    corridor: 'A20',
    vehicle: { width: 2.55, height: 4.0, length: 18, grossWeight: 40 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'route-clear',
        title: 'No active Autobahn roadworks or closures on corridor',
        detail: 'Simulated empty corridor.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'clear',
        category: 'roadworks',
        distanceKm: 0,
        reason: 'Fixture has no disruptions.',
        locationKind: 'mainline',
        road: 'A20',
        blocker: false,
        retrievedAt,
      },
      {
        id: 'bridge-clearance-confirmed',
        title: 'Bridge and clearance confirmed by dispatcher',
        detail: 'Scenario dispatcher confirmed clearance at 09.11.2026, 13:00.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'clear',
        category: 'observations',
        distanceKm: null,
        reason: 'Dispatcher tick present.',
        locationKind: 'unknown',
        blocker: false,
        retrievedAt,
      },
    ],
  },
  'verify-nearby': {
    id: 'verify-nearby',
    label: 'Simulated VERIFY — nearby AS ramp',
    expectedVerdict: 'VERIFY',
    origin: 'Hamburg Port Terminal',
    destination: 'Hannover Logistics Hub',
    distanceKm: 157,
    corridor: 'A7',
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'as-westenholz',
        title: 'AS Westenholz Auffahrt (ramp)',
        detail: 'Simulated ramp closure 0.9 km off the GPX line.',
        source: 'Simulated — not live data',
        confidence: 'medium',
        state: 'warning',
        category: 'closures',
        lat: 52.85,
        lng: 9.76,
        distanceKm: 0.9,
        reason: 'Ramp / AS / parking site — not a confirmed mainline carriageway block.',
        locationKind: 'ramp',
        road: 'A7',
        blocker: true,
        retrievedAt,
      },
    ],
  },
  'hold-closure': {
    id: 'hold-closure',
    label: 'Simulated HOLD — A7 mainline Vollsperrung',
    expectedVerdict: 'HOLD',
    origin: 'Hamburg Port Terminal',
    destination: 'Hannover Logistics Hub',
    distanceKm: 157,
    corridor: 'A7',
    vehicle: { width: 3.2, height: 4.5, length: 28.5, grossWeight: 60 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'a7-vollsperrung',
        title: 'Full mainline closure on permitted route',
        detail: 'Simulated A7 Vollsperrung on the GPX line during the departure window.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'danger',
        category: 'closures',
        lat: 52.85,
        lng: 9.75,
        startTimestamp: '2026-11-09T10:00:00.000Z',
        endTimestamp: '2026-11-10T18:00:00.000Z',
        distanceKm: 0.05,
        reason: 'Confirmed full mainline carriageway closure on the permitted route during the departure window.',
        locationKind: 'mainline',
        road: 'A7',
        blocker: true,
        retrievedAt,
      },
    ],
  },
  'hold-width': {
    id: 'hold-width',
    label: 'Simulated HOLD — A3 residual width 3.0 m',
    expectedVerdict: 'HOLD',
    origin: 'Duisburg Logistics Yard',
    destination: 'Köln Wind Terminal',
    distanceKm: 74,
    corridor: 'A3',
    vehicle: { width: 3.8, height: 4.5, length: 35, grossWeight: 80 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'a3-width',
        title: 'Width restriction 3 m – vehicle exceeds',
        detail: 'Simulated residualRoadWidth 3.0 m on A3 mainline vs 3.8 m vehicle.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'danger',
        category: 'roadworks',
        lat: 51.05,
        lng: 6.95,
        distanceKm: 0.04,
        reason: 'Hard width limit 3 on the mainline carriageway is below the vehicle.',
        locationKind: 'mainline',
        road: 'A3',
        blocker: true,
        retrievedAt,
      },
    ],
  },
  'hold-height': {
    id: 'hold-height',
    label: 'Simulated HOLD — A8 height 4.00 m vs 4.30 m',
    expectedVerdict: 'HOLD',
    origin: 'München Wind Farm',
    destination: 'Stuttgart Industrial Complex',
    distanceKm: 231,
    corridor: 'A8',
    vehicle: { width: 3.3, height: 4.3, length: 30, grossWeight: 65 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'a8-height',
        title: 'Height restriction 4.00 m vs vehicle 4.30 m',
        detail: 'Simulated A8 mainline structure residual clearance 4.00 m vs 4.30 m vehicle.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'danger',
        category: 'roadworks',
        lat: 48.4,
        lng: 10.25,
        distanceKm: 0.03,
        reason: 'Hard height limit 4.00 m vs vehicle 4.30 m on the mainline carriageway.',
        locationKind: 'mainline',
        road: 'A8',
        blocker: true,
        retrievedAt,
      },
    ],
  },
  'hold-weight': {
    id: 'hold-weight',
    label: 'Simulated HOLD — A1 weight 40 t vs 72 t',
    expectedVerdict: 'HOLD',
    origin: 'Bremen Heavy Cargo Terminal',
    destination: 'Dortmund Industrial Park',
    distanceKm: 241,
    corridor: 'A1',
    vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
    clearanceConfirmed: true,
    clearanceConfirmedBy: 'Scenario dispatcher',
    evidence: [
      {
        id: 'a1-weight',
        title: 'Weight restriction 40 t vs vehicle 72 t',
        detail: 'Simulated A1 mainline structure weight limit 40 t vs 72 t vehicle.',
        source: 'Simulated — not live data',
        confidence: 'high',
        state: 'danger',
        category: 'roadworks',
        lat: 52.20185,
        lng: 7.81021,
        distanceKm: 0.04,
        reason: 'Hard weight limit 40 t vs vehicle 72 t on the mainline carriageway.',
        locationKind: 'mainline',
        road: 'A1',
        blocker: true,
        retrievedAt,
      },
    ],
  },
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && value in SCENARIOS
}
