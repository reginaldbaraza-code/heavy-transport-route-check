import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evidenceEnglishSummary, joinLocationParts, splitConcatenatedPlaces } from './evidenceSummary.ts'
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
  assert.match(summary, /southbound|towards/)
  assert.match(summary, /width 3.20 m/)
})
