import type { CheckHistoryRecord, MonitoringAlert } from '../context/RouteMonitoringContext'
import type { SavedJob } from './jobs'
import { sampleTestPermits, scenarioTestPermits, type TestPermit } from './testPermitCatalog'

export type SearchHitKind = 'job' | 'check' | 'permit' | 'scenario' | 'alert'

export type SearchHit = {
  id: string
  kind: SearchHitKind
  title: string
  detail: string
  href: string
}

function haystack(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(' ').toLowerCase()
}

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[\s,;/]+/).map(item => item.trim()).filter(item => item.length >= 1)
}

function matches(query: string, text: string): boolean {
  const words = tokens(query)
  if (!words.length) return false
  return words.every(word => text.includes(word))
}

function permitHref(permit: TestPermit): string {
  return `/route-checks?permit=${encodeURIComponent(permit.id)}`
}

export function searchAppData(opts: {
  query: string
  jobs: SavedJob[]
  history: CheckHistoryRecord[]
  alerts: MonitoringAlert[]
  permits?: TestPermit[]
}): SearchHit[] {
  const q = opts.query.trim()
  if (!q) return []
  const hits: SearchHit[] = []
  const permits = opts.permits || [...sampleTestPermits, ...scenarioTestPermits]

  for (const job of opts.jobs) {
    const text = haystack([
      job.name, job.permitNumber, job.origin, job.destination, job.corridor, job.routeFileName, job.lastVerdict,
    ])
    if (!matches(q, text)) continue
    hits.push({
      id: `job-${job.id}`,
      kind: 'job',
      title: job.name,
      detail: [job.permitNumber, `${job.origin} → ${job.destination}`, job.corridor].filter(Boolean).join(' · '),
      href: `/route-checks?job=${encodeURIComponent(job.id)}`,
    })
  }

  for (const record of opts.history) {
    const text = haystack([
      record.permitName, record.routeLabel, record.permitNumber, record.summary, record.verdict, record.source,
    ])
    if (!matches(q, text)) continue
    hits.push({
      id: `check-${record.id}`,
      kind: 'check',
      title: record.permitName || record.routeLabel,
      detail: `${record.verdict} · ${record.routeLabel}`,
      href: record.jobId ? `/route-checks?job=${encodeURIComponent(record.jobId)}` : '/activity',
    })
  }

  for (const permit of permits) {
    const text = haystack([
      permit.name, permit.origin, permit.destination, permit.originShort, permit.destinationShort,
      permit.permitNumber, permit.corridor, permit.routeDescription, permit.id,
    ])
    if (!matches(q, text)) continue
    hits.push({
      id: `permit-${permit.id}`,
      kind: permit.kind === 'scenario' ? 'scenario' : 'permit',
      title: `${permit.originShort} → ${permit.destinationShort}`,
      detail: `${permit.permitNumber} · ${permit.corridor} · ${permit.kind === 'scenario' ? 'Scenario' : 'Sample'}`,
      href: permitHref(permit),
    })
  }

  for (const alert of opts.alerts) {
    const text = haystack([alert.routeLabel, alert.change, alert.detail, alert.severity, alert.source])
    if (!matches(q, text)) continue
    hits.push({
      id: `alert-${alert.id}`,
      kind: 'alert',
      title: alert.change,
      detail: `${alert.routeLabel} · ${alert.severity}`,
      href: alert.jobId ? '/jobs' : '/activity',
    })
  }

  const seen = new Set<string>()
  return hits.filter(hit => {
    if (seen.has(hit.href + hit.title)) return false
    seen.add(hit.href + hit.title)
    return true
  }).slice(0, 24)
}

export { SEARCH_EMPTY_HELP } from './searchCopy'
