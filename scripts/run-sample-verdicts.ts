import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Sample = {
  id: string
  group: 'existing-live' | 'new-live' | 'scenario'
  expected?: 'READY' | 'VERIFY' | 'HOLD'
  gpx: string
  json?: string
  scenario?: string
}

const samples: Sample[] = [
  { id: 'hamburg-hannover', group: 'existing-live', expected: 'VERIFY', gpx: 'hamburg-hannover-a7.gpx', json: 'hamburg-hannover-a7.json' },
  { id: 'bremen-dortmund', group: 'existing-live', gpx: 'bremen-dortmund-a1.gpx', json: 'bremen-dortmund-a1.json' },
  { id: 'leipzig-nurnberg', group: 'existing-live', expected: 'VERIFY', gpx: 'leipzig-nurnberg-a9.gpx', json: 'leipzig-nurnberg-a9.json' },
  { id: 'duisburg-koln', group: 'existing-live', gpx: 'duisburg-koln-a3.gpx', json: 'duisburg-koln-a3.json' },
  { id: 'munchen-stuttgart', group: 'existing-live', gpx: 'munchen-stuttgart-a8.gpx', json: 'munchen-stuttgart-a8.json' },
  { id: 'lubeck-rostock', group: 'new-live', expected: 'READY', gpx: 'lubeck-rostock-a20.gpx', json: 'lubeck-rostock-a20.json' },
  { id: 'hof-bayreuth', group: 'new-live', expected: 'READY', gpx: 'hof-bayreuth-a9.gpx', json: 'hof-bayreuth-a9.json' },
  { id: 'leipzig-nurnberg', group: 'new-live', expected: 'VERIFY', gpx: 'leipzig-nurnberg-a9.gpx', json: 'leipzig-nurnberg-a9.json' },
  { id: 'hamburg-hannover', group: 'new-live', expected: 'VERIFY', gpx: 'hamburg-hannover-a7.gpx', json: 'hamburg-hannover-a7.json' },
  { id: 'scenario-ready', group: 'scenario', expected: 'READY', gpx: 'lubeck-rostock-a20.gpx', json: 'lubeck-rostock-a20.json', scenario: 'ready-clear' },
  { id: 'scenario-verify', group: 'scenario', expected: 'VERIFY', gpx: 'hamburg-hannover-a7.gpx', json: 'hamburg-hannover-a7.json', scenario: 'verify-nearby' },
  { id: 'scenario-hold-closure', group: 'scenario', expected: 'HOLD', gpx: 'hamburg-hannover-a7.gpx', json: 'hamburg-hannover-a7.json', scenario: 'hold-closure' },
  { id: 'scenario-hold-width', group: 'scenario', expected: 'HOLD', gpx: 'duisburg-koln-a3.gpx', json: 'duisburg-koln-a3.json', scenario: 'hold-width' },
]

function mockRes() {
  const res: {
    _status: number
    _json: any
    status: (code: number) => typeof res
    json: (data: any) => void
    setHeader: () => void
    end: () => void
  } = {
    _status: 200,
    _json: null,
    status(code) {
      this._status = code
      return this
    },
    json(data) {
      this._json = data
    },
    setHeader() {},
    end() {},
  }
  return res
}

async function main() {
  const { default: handler } = await import(resolve(process.cwd(), 'api/check-route.ts'))
  const rows: Array<Record<string, string>> = []

  for (const sample of samples) {
    const gpxContent = readFileSync(`public/test-permits/${sample.gpx}`, 'utf8')
    const meta = sample.json
      ? JSON.parse(readFileSync(`public/test-permits/${sample.json}`, 'utf8'))
      : {}
    const req = {
      method: 'POST',
      body: {
        gpxContent,
        vehicle: meta.vehicle,
        permitNumber: meta.permitNumber,
        corridor: meta.corridor,
        validFrom: meta.validFrom,
        validUntil: meta.validUntil,
        bridgeClearanceConfirmed: Boolean(meta.bridgeClearanceConfirmed) || Boolean(sample.scenario),
        clearanceConfirmedBy: meta.clearanceConfirmedBy || (sample.scenario ? 'Scenario dispatcher' : undefined),
        confirmedAt: meta.confirmedAt,
        scenario: sample.scenario,
      },
    }
    const res = mockRes()
    const started = Date.now()
    await handler(req, res)
    const ms = Date.now() - started
    const data = res._json || {}
    const evidence = Array.isArray(data.evidence) ? data.evidence : []
    const top = evidence
      .filter((item: any) => item.state === 'danger' || item.blocker)
      .slice(0, 3)
      .map((item: any) => `${item.title}: ${item.reason || item.detail}`)
    if (!top.length) {
      top.push(...evidence.slice(0, 2).map((item: any) => `${item.title}: ${item.reason || item.detail}`))
    }
    rows.push({
      group: sample.group,
      permit: sample.id,
      expected: sample.expected || 'unspecified',
      actual: data.verdict || `HTTP ${res._status}`,
      mode: data.mode || '',
      matched: sample.expected && data.verdict === sample.expected ? 'yes' : sample.expected ? 'no' : 'n/a',
      ms: String(ms),
      reasons: top.join(' | ') || data.impact || data.error || '',
    })
    console.log(`\n[${sample.group}] ${sample.id} → ${data.verdict || res._status} (expected ${sample.expected || 'n/a'}) in ${ms}ms`)
    console.log(top.join('\n') || data.error || data.summary)
  }

  console.log('\n\nRESULTS TABLE')
  console.log(['group', 'permit', 'expected', 'actual', 'matched', 'mode', 'ms', 'reasons'].join('\t'))
  for (const row of rows) {
    console.log([row.group, row.permit, row.expected, row.actual, row.matched, row.mode, row.ms, row.reasons.replace(/\s+/g, ' ')].join('\t'))
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
