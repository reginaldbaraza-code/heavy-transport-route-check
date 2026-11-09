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

export function stripUnresolvedVerifyCopy(text: string) {
  return text
    .replace(/\s*\d+\s+unresolved VERIFY items?\.\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatOnSiteConfirmationLine(
  acks: Array<{ acknowledgedBy?: string; acknowledgedAt?: string }>,
) {
  if (!acks.length) return ''
  const n = acks.length
  const names = [...new Set(acks.map(item => item.acknowledgedBy).filter(Boolean))] as string[]
  const name = names.join(', ') || 'Dispatcher'
  const latest = acks.map(item => item.acknowledgedAt).filter(Boolean).sort().at(-1)
  const time = formatBerlinDateTime(latest) || latest || ''
  return `${n} VERIFY item${n === 1 ? '' : 's'} confirmed on site by ${name} at ${time}`
}

export function applySiteAcknowledgements(
  result: RouteCheckResult,
  acknowledgements: SiteAcknowledgement[],
  clearanceConfirmed = Boolean(result.clearanceConfirmed),
): RouteCheckResult {
  const ackById = new Map(acknowledgements.map(item => [item.evidenceId, item]))
  const evidence = result.evidence.map(item => {
    const ack = ackById.get(item.id)
    if (!ack || !isAcknowledgeable(item)) return item
    return {
      ...item,
      acknowledgedBy: ack.acknowledgedBy,
      acknowledgedAt: ack.acknowledgedAt,
    }
  })
  const hold = evidence.filter(isHoldItem)
  const acknowledgeable = evidence.filter(isAcknowledgeable)
  const remaining = acknowledgeable.filter(item => !ackById.has(item.id))
  const acknowledgedCount = acknowledgeable.filter(item => ackById.has(item.id)).length

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
      impact: stripUnresolvedVerifyCopy(result.impact || ''),
      clearanceConfirmed: true,
    }
  }

  return {
    ...result,
    evidence,
    verdict: 'READY',
    title: result.title,
    summary: result.summary,
    clearanceConfirmed: true,
  }
}
