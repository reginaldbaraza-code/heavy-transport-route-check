import type { RouteEvidence } from '../data/routeChecks'
import { formatBerlinDateTime } from './formatTime'
import type { RouteCheckResult } from './routeCheck'

export type SiteAcknowledgement = {
  evidenceId: string
  acknowledgedBy: string
  acknowledgedAt: string
}

const SYSTEM_NOTE = /^(mia-snapshot-|mia-deduped|bw-deduped|bw-unavailable|route-clear|bridge-clearance-|system-error)/

export function isHoldItem(item: Pick<RouteEvidence, 'state'>) {
  return item.state === 'danger'
}

export function isNearbyOffRoute(item: Pick<RouteEvidence, 'state'>) {
  return item.state === 'info'
}

export function isAcknowledgeable(item: Pick<RouteEvidence, 'id' | 'state' | 'blocker'>) {
  if (item.state === 'danger') return false
  if (item.state !== 'warning' || item.blocker === false) return false
  return !SYSTEM_NOTE.test(item.id)
}

export type ClearanceMeta = {
  by?: string
  at?: string
}

export function stripUnresolvedVerifyCopy(text: string) {
  return text
    .replace(/\s*\d+\s+unresolved VERIFY items?\.\s*/gi, ' ')
    .replace(/\s*Bridge and clearance are not dispatcher-confirmed\.\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatClearanceConfirmationLine(by?: string, at?: string) {
  const name = by?.trim() || 'Dispatcher'
  const time = formatBerlinDateTime(at) || at || ''
  if (!time) return `Clearance confirmed by ${name}`
  return `Clearance confirmed by ${name} at ${time}`
}

export function withClearanceConfirmation(impact: string, confirmed: boolean, by?: string, at?: string) {
  const base = stripUnresolvedVerifyCopy(impact || '')
    .replace(/\s*Clearance confirmed by .+?(?=(?:\s+Clearance confirmed by |\s*$))/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!confirmed) return base
  return [base, formatClearanceConfirmationLine(by, at)].filter(Boolean).join(' ')
}

export function formatOnSiteConfirmationLine(
  acks: Array<{ acknowledgedBy?: string; acknowledgedAt?: string }>,
) {
  if (!acks.length) return ''
  const n = acks.length
  const names = [...new Set(acks.map(item => item.acknowledgedBy).filter(Boolean))] as string[]
  const name = names.join(', ') || 'Dispatcher'
  const stamps = acks.map(item => item.acknowledgedAt).filter(Boolean) as string[]
  const latestIso = stamps.filter(value => /^\d{4}-\d{2}-\d{2}/.test(value)).sort().at(-1)
  const latest = latestIso || stamps.at(-1)
  const time = formatBerlinDateTime(latest) || latest || ''
  return `${n} VERIFY item${n === 1 ? '' : 's'} confirmed on site by ${name} at ${time}`
}

function applyClearanceCard(
  evidence: RouteEvidence[],
  clearanceConfirmed: boolean,
  meta?: ClearanceMeta,
): RouteEvidence[] {
  if (!clearanceConfirmed) return evidence
  const by = meta?.by?.trim() || 'Dispatcher'
  const at = meta?.at || new Date().toISOString()
  const card: RouteEvidence = {
    id: 'bridge-clearance-confirmed',
    title: 'Bridge and clearance confirmed by dispatcher',
    detail: `${by} confirmed at ${formatBerlinDateTime(at) || at}.`,
    source: 'Dispatcher confirmation',
    age: '',
    confidence: 'high',
    state: 'clear',
    category: 'observations',
    blocker: false,
    reason: 'Clearance tick present.',
    locationKind: 'unknown',
    retrievedAt: at,
    acknowledgedBy: by,
    acknowledgedAt: at,
  }
  let found = false
  const next = evidence.map(item => {
    if (item.id !== 'bridge-clearance-unknown' && item.id !== 'bridge-clearance-confirmed') return item
    found = true
    return { ...item, ...card }
  })
  return found ? next : [...next, card]
}

export function applySiteAcknowledgements(
  result: RouteCheckResult,
  acknowledgements: SiteAcknowledgement[],
  clearanceConfirmed = Boolean(result.clearanceConfirmed),
  clearanceMeta?: ClearanceMeta,
): RouteCheckResult {
  const ackById = new Map(acknowledgements.map(item => [item.evidenceId, item]))
  const meta: ClearanceMeta = {
    by: clearanceMeta?.by || result.clearanceConfirmedBy,
    at: clearanceMeta?.at || result.confirmedAt,
  }
  let evidence = result.evidence.map(item => {
    const ack = ackById.get(item.id)
    if (!ack || !isAcknowledgeable(item)) return item
    return {
      ...item,
      acknowledgedBy: ack.acknowledgedBy,
      acknowledgedAt: ack.acknowledgedAt,
    }
  })
  evidence = applyClearanceCard(evidence, clearanceConfirmed, meta)
  const hold = evidence.filter(isHoldItem)
  const acknowledgeable = evidence.filter(isAcknowledgeable)
  const remaining = acknowledgeable.filter(item => !ackById.has(item.id))
  const acknowledgedCount = acknowledgeable.filter(item => ackById.has(item.id)).length
  const by = meta.by?.trim() || 'Dispatcher'
  const at = meta.at
  const impact = withClearanceConfirmation(result.impact || '', clearanceConfirmed, by, at)

  if (result.degraded) return { ...result, evidence }

  if (hold.length) {
    return {
      ...result,
      evidence,
      verdict: 'HOLD',
      title: 'Hold departure – blocking issue on route',
      summary: `${hold.length} blocking ${hold.length === 1 ? 'issue' : 'issues'} on the permitted mainline.`,
    }
  }

  if (remaining.length || !clearanceConfirmed) {
    return {
      ...result,
      evidence,
      verdict: 'VERIFY',
      title: clearanceConfirmed
        ? 'Verification required – potential issue detected'
        : 'Verification required – bridge and clearance not confirmed',
      summary: remaining.length
        ? `${remaining.length} unresolved VERIFY item${remaining.length === 1 ? '' : 's'}.`
        : 'Bridge and clearance are not dispatcher-confirmed.',
      impact: clearanceConfirmed ? impact : result.impact,
      clearanceConfirmed,
      clearanceConfirmedBy: clearanceConfirmed ? by : result.clearanceConfirmedBy,
      confirmedAt: clearanceConfirmed ? at : result.confirmedAt,
    }
  }

  if (acknowledgedCount) {
    const acks = acknowledgements.filter(item => acknowledgeable.some(entry => entry.id === item.evidenceId))
    return {
      ...result,
      evidence,
      verdict: 'READY',
      title: `READY – dispatcher confirmed ${acknowledgedCount} item${acknowledgedCount === 1 ? '' : 's'}`,
      summary: formatOnSiteConfirmationLine(acks),
      impact,
      clearanceConfirmed: true,
      clearanceConfirmedBy: by,
      confirmedAt: at,
    }
  }

  return {
    ...result,
    evidence,
    verdict: 'READY',
    title: result.title,
    summary: result.summary,
    impact,
    clearanceConfirmed: true,
    clearanceConfirmedBy: by,
    confirmedAt: at,
  }
}
