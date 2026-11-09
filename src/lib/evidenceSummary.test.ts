import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayEvidenceTitle, evidenceEnglishSummary, joinLocationParts, splitConcatenatedPlaces } from './evidenceSummary.ts'
import type { RouteEvidence } from '../data/routeChecks.ts'

test('concatenated German place names get a separator', () => {
  assert.equal(splitConcatenatedPlaces('BayreuthKulmbach'), 'Bayreuth – Kulmbach')
  assert.equal(joinLocationParts(['Bayreuth', 'Kulmbach']), 'Bayreuth / Kulmbach')
})

test('English summary keeps the original German aside and names type/road/dates', () => {
  const item: RouteEvidence = {
    id: 'a9-1',
    title: 'A9 Sperrung BayreuthKulmbach',
    detail: 'Vollsperrung in Fahrtrichtung Süd. Restbreite 3,20 m. Richtung Nürnberg.',
    source: 'Autobahn GmbH',
    age: '',
    confidence: 'high',
    state: 'danger',
    category: 'closures',
    startTimestamp: '2026-11-09T22:00:00Z',
    endTimestamp: '2026-11-10T05:00:00Z',
  }
  const summary = evidenceEnglishSummary(item)
  assert.match(summary, /Closure/)
  assert.match(summary, /A9/)
  assert.match(summary, /Bayreuth – Kulmbach/)
  assert.match(summary, /southbound|towards/)
  assert.match(summary, /width 3.20 m/)
})

test('English summary applies to HOLD items whose title is already English', () => {
  const item: RouteEvidence = {
    id: 'hold-1',
    title: 'Full mainline closure on permitted route',
    detail: 'A9 Vollsperrung BayreuthKulmbach · Confirmed full mainline carriageway closure.',
    source: 'Autobahn GmbH',
    age: '',
    confidence: 'high',
    state: 'danger',
    category: 'closures',
  }
  const summary = evidenceEnglishSummary(item)
  assert.match(summary, /Closure/)
  assert.match(summary, /A9/)
  assert.match(summary, /Bayreuth – Kulmbach/)
  assert.equal(splitConcatenatedPlaces(item.detail).includes('Bayreuth – Kulmbach'), true)
  assert.match(displayEvidenceTitle(item), /Closure/)
  assert.match(displayEvidenceTitle(item), /Bayreuth – Kulmbach/)
})

test('dispatcher confirmation cards keep their title instead of a type summary', () => {
  const item: RouteEvidence = {
    id: 'bridge-clearance-confirmed',
    title: 'Bridge and clearance confirmed by dispatcher',
    detail: 'QA Test confirmed at 09.11.2026, 13:00.',
    source: 'Dispatcher confirmation',
    age: '',
    confidence: 'high',
    state: 'clear',
    category: 'observations',
  }
  assert.equal(displayEvidenceTitle(item), 'Bridge and clearance confirmed by dispatcher')
})
