import { minutesUntilDeparture, type MonitorPrefs, type SavedJob } from './jobs'

export const DEPARTURE_ESCALATION_MINUTES = 120

export type EscalationAlert = {
  status: string
  severity: string
  escalated?: boolean
  runAt: string
}

export function shouldEscalateAlert(
  alert: EscalationAlert,
  job: SavedJob | undefined,
  prefs: MonitorPrefs,
  now = Date.now(),
) {
  if (alert.status !== 'New') return false
  if (alert.severity !== 'HOLD' && alert.severity !== 'VERIFY') return false
  if (alert.escalated) return true
  const created = Date.parse(alert.runAt)
  const ageMinutes = Number.isFinite(created) ? (now - created) / 60000 : 0
  if (ageMinutes >= Math.max(1, prefs.escalateAfterMinutes)) return true
  if (job && minutesUntilDeparture(job, now) < DEPARTURE_ESCALATION_MINUTES) return true
  return false
}

export function verdictChangeCopy(previous: string | undefined, next: string) {
  if (previous && previous !== next) return `Verdict changed ${previous} → ${next}`
  return `Route check: ${next}`
}

export function notificationBody(routeLabel: string, change: string, detail: string) {
  return `${routeLabel} · ${change}. ${detail}`
}
