import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { downsampleTrack, parseGpxTrack } from './gpxTrack.ts'
import {
  OVERVIEW_FEATURED_COPY,
  OVERVIEW_FEATURED_PERMIT_ID,
  OVERVIEW_MONITOR_ROUTES,
  SAMPLE_ROUTE_COLOR,
  VERDICT_TRACK_COLORS,
  getOverviewFeatured,
  getOverviewMonitorPermits,
  overviewVerdictForPermit,
} from './overviewTracks.ts'
import { sampleTestPermits, scenarioTestPermits } from './routeCheck.ts'

test('overview hero uses four real test-permit GPX tracks with mixed verdicts', () => {
  const overview = getOverviewMonitorPermits()
  assert.equal(overview.length, 4)
  const overviewVerdicts = new Set(overview.map(item => item.verdict))
  assert.ok(overviewVerdicts.has('VERIFY'))
  assert.ok(overviewVerdicts.has('HOLD'))
  // READY lives on scenario samples; live overview tracks mirror post-#27 outcomes.
  const labelled = [...sampleTestPermits, ...scenarioTestPermits]
  const allSampleVerdicts = new Set(labelled.map(permit => overviewVerdictForPermit(permit)))
  assert.ok(allSampleVerdicts.has('READY'))
  assert.ok(allSampleVerdicts.has('VERIFY'))
  assert.ok(allSampleVerdicts.has('HOLD'))

  for (const item of overview) {
    const configured = OVERVIEW_MONITOR_ROUTES.find(route => route.id === item.permit.id)
    assert.ok(configured, item.permit.id)
    assert.equal(item.verdict, item.permit.expectedVerdict ?? configured.verdict)
    const xml = readFileSync(join('public', item.permit.gpxFile.replace(/^\//, '')), 'utf8')
    const points = parseGpxTrack(xml)
    assert.ok(points.length >= 200, `${item.permit.id} has ${points.length} points`)
    assert.notEqual(points.length, 6, `${item.permit.id} must not be the sparse fake overlay`)
  }
})

test('Hamburg→Hannover sample GPX starts in Hamburg and ends in Hannover', () => {
  const permit = sampleTestPermits[0]
  assert.equal(permit.id, 'hamburg-hannover')
  assert.equal(permit.originShort, 'Hamburg')
  assert.equal(permit.destinationShort, 'Hannover')
  const xml = readFileSync(join('public', permit.gpxFile.replace(/^\//, '')), 'utf8')
  const points = parseGpxTrack(xml)
  const start = points[0]
  const end = points[points.length - 1]
  assert.ok(start[0] > 53.4 && start[0] < 53.7, `start lat ${start[0]}`)
  assert.ok(start[1] > 9.8 && start[1] < 10.2, `start lng ${start[1]}`)
  assert.ok(end[0] > 52.2 && end[0] < 52.5, `end lat ${end[0]}`)
  assert.ok(end[1] > 9.6 && end[1] < 9.9, `end lng ${end[1]}`)
  assert.ok(start[0] > 53, 'must not be Duisburg (~51.4°N)')
  assert.ok(end[0] > 52, 'must not be Munich (~48.1°N)')
})

test('overview verdicts prefer the labelled sample outcome', () => {
  const hamburg = sampleTestPermits.find(permit => permit.id === 'hamburg-hannover')
  const lubeck = sampleTestPermits.find(permit => permit.id === 'lubeck-rostock')
  const munich = sampleTestPermits.find(permit => permit.id === 'munchen-stuttgart')
  assert.equal(overviewVerdictForPermit(hamburg!), 'VERIFY')
  assert.equal(overviewVerdictForPermit(lubeck!), 'VERIFY')
  // München omits a hardcoded expectedVerdict (live HOLD depends on Restbreite); overview still demos HOLD.
  assert.equal(munich!.expectedVerdict, undefined)
  assert.equal(overviewVerdictForPermit(munich!), 'HOLD')
  assert.match(munich!.liveLabel || '', /Restbreite|width|not height/i)
})

test('overview line colours match the Ready / Verify / Hold legend', () => {
  assert.equal(VERDICT_TRACK_COLORS.READY, '#16A34A')
  assert.equal(VERDICT_TRACK_COLORS.VERIFY, '#F59E0B')
  assert.equal(VERDICT_TRACK_COLORS.HOLD, '#DC2626')
  assert.equal(SAMPLE_ROUTE_COLOR, '#0b57d0')
})

test('featured hero transport is a route drawn on the overview map', () => {
  const featured = getOverviewFeatured()
  assert.equal(OVERVIEW_FEATURED_PERMIT_ID, 'munchen-stuttgart')
  assert.equal(featured.permit.id, 'munchen-stuttgart')
  assert.equal(featured.verdict, 'HOLD')
  assert.match(OVERVIEW_FEATURED_COPY.title, /width/i)
  assert.doesNotMatch(OVERVIEW_FEATURED_COPY.title, /height/i)
  assert.ok(OVERVIEW_MONITOR_ROUTES.some(route => route.id === featured.permit.id))
  const overview = readFileSync('src/pages/MarketplaceOverview.tsx', 'utf8')
  assert.equal(overview.includes("getPermittedRoute('duisburg-munich')"), false)
  assert.ok(overview.includes('OVERVIEW_FEATURED_PERMIT_ID'))
  assert.ok(overview.includes('highlightPermitId'))
})

test('downsample keeps endpoints and a shorter line', () => {
  const dense = Array.from({ length: 500 }, (_, i) => [53 - i * 0.002, 10 - i * 0.001] as [number, number])
  const sampled = downsampleTrack(dense, 50)
  assert.ok(sampled.length <= 50)
  assert.deepEqual(sampled[0], dense[0])
  assert.deepEqual(sampled[sampled.length - 1], dense[dense.length - 1])
})

test('overview and sample maps no longer use the illustrated Germany heatmap', () => {
  const overview = readFileSync('src/pages/MarketplaceOverview.tsx', 'utf8')
  assert.equal(overview.includes('MobilityHeatmap'), false)
  assert.equal(overview.includes('germanyOutline'), false)
  assert.equal(overview.includes('Hamburg, Bremen, Leipzig, Duisburg, München'), false)
  assert.ok(overview.includes('LazyPermitMap'))
  const heatmap = readFileSync('src/components/MobilityHeatmap.tsx', 'utf8')
  assert.ok(heatmap.includes("from '../data/germanyMap'"))
  const home = readFileSync('src/pages/Home.tsx', 'utf8')
  assert.equal(home.includes('showRoute'), false)
})
