import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RouteEvidence } from '../data/routeChecks.ts'
import { pdfBytesFromSnapshot, snapshotFromResult, snapshotToCsv } from './exportCheck.ts'
import type { RouteCheckResult } from './routeCheck.ts'
import { applySiteAcknowledgements } from './siteAcknowledgements.ts'

function decodePdfStrings(buffer: ArrayBuffer | Uint8Array) {
  const latin1 = Buffer.from(new Uint8Array(buffer)).toString('latin1')
  const strings: string[] = []
  const re = /\((?:\\.|[^\\)])*\)/g
  let match
  while ((match = re.exec(latin1))) {
    strings.push(
      match[0]
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1'),
    )
  }
  return { text: strings.join('\n'), compact: strings.join('').replace(/\s+/g, ' ') }
}

function verifyItem(id: string, title: string, detail = 'Lane restriction on the permitted corridor.'): RouteEvidence {
  return {
    id,
    title,
    detail,
    source: 'Autobahn GmbH',
    age: '',
    confidence: 'medium',
    state: 'warning',
    category: 'roadworks',
    blocker: true,
  }
}

function baseResult(evidence: RouteEvidence[]): RouteCheckResult {
  return {
    verdict: 'VERIFY',
    title: 'Verification required – potential issue detected',
    summary: `${evidence.length} unresolved VERIFY items.`,
    impact: `Selected vehicle: 3.20m W x 4.50m H x 28.5m L · 60t. ${evidence.length} unresolved VERIFY items.`,
    confidence: 'medium',
    issueCount: evidence.length,
    evidence,
    route: { coordinates: [], origin: 'Hamburg', destination: 'Hannover', distance: 140, corridor: 'A7' },
    degraded: false,
    retrievedAt: '2026-11-09T12:00:00Z',
    source: 'Autobahn GmbH',
  }
}

test('PDF and CSV after dispatcher acks list confirmations, not unresolved VERIFY', () => {
  const evidence = [
    verifyItem('v1', 'A7 roadworks near Soltau'),
    verifyItem('v2', 'A7 lane shift near Hannover'),
    verifyItem('v3', 'Temporary speed limit'),
    verifyItem('v4', 'Bridge works on corridor'),
  ]
  const overlaid = applySiteAcknowledgements(
    baseResult(evidence),
    evidence.map(item => ({
      evidenceId: item.id,
      acknowledgedBy: 'Ada Dispatcher',
      acknowledgedAt: '2026-11-09T12:00:00Z',
    })),
    true,
  )
  assert.equal(overlaid.verdict, 'READY')
  assert.match(overlaid.summary, /4 VERIFY items confirmed on site by Ada Dispatcher at/)
  assert.doesNotMatch(overlaid.impact, /unresolved VERIFY/)

  const snapshot = snapshotFromResult(overlaid, { permitNumber: 'DE-HH-2026-01845', permitName: 'Hamburg → Hannover' })
  assert.match(snapshot.summary, /4 VERIFY items confirmed on site by Ada Dispatcher at/)
  assert.doesNotMatch(snapshot.impact, /unresolved VERIFY/)
  assert.equal(snapshot.onSiteConfirmations.length, 4)

  const extracted = decodePdfStrings(pdfBytesFromSnapshot(snapshot))
  assert.match(extracted.compact, /4 VERIFY items confirmed on site by Ada Dispatcher at/)
  assert.doesNotMatch(extracted.compact, /unresolved VERIFY/)
  assert.match(extracted.compact, /Confirmed on site by Ada Dispatcher/)
  assert.match(extracted.compact, /A7 roadworks near Soltau/)
  assert.match(extracted.compact, /confirmed by Ada Dispatcher at/)

  const csv = snapshotToCsv(snapshot)
  assert.match(csv, /4 VERIFY items confirmed on site by Ada Dispatcher at/)
  assert.doesNotMatch(csv, /unresolved VERIFY/)
  assert.match(csv, /On-site confirmation title/)
  assert.match(csv, /Ada Dispatcher/)
  assert.match(csv, /A7 roadworks near Soltau/)
})

test('PDF wraps long evidence titles instead of clipping them', () => {
  const title = 'Entwässerungsarbeiten auf der Fahrbahn der A7 Richtung Hannover in Fahrtrichtung Süd bei länger andauernder Baustelle'
  const snapshot = snapshotFromResult(baseResult([
    verifyItem('long', title, 'Detail text that must wrap inside the evidence card without overlapping the next card edge.'),
  ]), { permitName: 'Hamburg → Hannover' })
  const extracted = decodePdfStrings(pdfBytesFromSnapshot(snapshot))
  assert.match(extracted.compact, /Entwässerungsarbeiten/)
  assert.match(extracted.compact, /andauernder Baustelle/)
  assert.match(extracted.text, /Fahrtrichtung Süd/)
})
