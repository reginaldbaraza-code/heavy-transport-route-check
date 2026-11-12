import type { RouteVerdict } from '../data/routeChecks'
import type { RouteCheckResult } from './routeCheck'

export type VehicleDims = {
  width: number
  height: number
  length: number
  grossWeight: number
}

export type SavedJob = {
  id: string
  name: string
  permitNumber: string
  routeFileName: string
  gpxContent: string
  origin: string
  destination: string
  corridor: string
  vehicle: VehicleDims
  plannedDeparture: string
  monitorIntervalMinutes: number
  createdAt: string
  updatedAt: string
  lastCheckedAt?: string
  lastVerdict?: RouteVerdict
  lastSummary?: string
  lastRetrievedAt?: string
  lastSource?: string
  monitoringStoppedReason?: 'departed' | 'deleted' | null
  bridgeClearanceConfirmed?: boolean
  clearanceConfirmedBy?: string
  confirmedAt?: string
  siteAcknowledgements?: Array<{
    evidenceId: string
    acknowledgedBy: string
    acknowledgedAt: string
  }>
}

export type MonitorPrefs = {
  intervalMinutes: number
  escalateAfterMinutes: number
}

export const DEFAULT_MONITOR_PREFS: MonitorPrefs = {
  intervalMinutes: 15,
  escalateAfterMinutes: 15,
}

export const MONITOR_INTERVAL_OPTIONS = [5, 15, 30, 60] as const

export function newJobId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function formatVehicleDims(vehicle: VehicleDims) {
  return `${vehicle.width.toFixed(2)} m W × ${vehicle.height.toFixed(2)} m H × ${vehicle.length.toFixed(1)} m L · ${vehicle.grossWeight} t`
}

export function departureMs(job: Pick<SavedJob, 'plannedDeparture'>) {
  const value = Date.parse(job.plannedDeparture)
  return Number.isFinite(value) ? value : NaN
}

export function isFutureDeparture(job: Pick<SavedJob, 'plannedDeparture'>, now = Date.now()) {
  const at = departureMs(job)
  return Number.isFinite(at) && at > now
}

export function shouldMonitorJob(job: SavedJob, now = Date.now()) {
  return isFutureDeparture(job, now) && job.monitoringStoppedReason !== 'departed'
}

export function minutesUntilDeparture(job: Pick<SavedJob, 'plannedDeparture'>, now = Date.now()) {
  const at = departureMs(job)
  if (!Number.isFinite(at)) return Infinity
  return (at - now) / 60000
}

export function jobDueForCheck(job: SavedJob, now = Date.now()) {
  if (!shouldMonitorJob(job, now)) return false
  const intervalMs = Math.max(1, job.monitorIntervalMinutes || DEFAULT_MONITOR_PREFS.intervalMinutes) * 60 * 1000
  const last = job.lastCheckedAt ? Date.parse(job.lastCheckedAt) : 0
  if (!Number.isFinite(last) || last <= 0) return true
  return now - last >= intervalMs
}

export function applyCheckToJob(job: SavedJob, result: RouteCheckResult, nowIso: string): SavedJob {
  const departed = !isFutureDeparture(job, Date.parse(nowIso) || Date.now())
  return {
    ...job,
    updatedAt: nowIso,
    lastCheckedAt: nowIso,
    lastVerdict: result.verdict,
    lastSummary: result.summary,
    lastRetrievedAt: result.retrievedAt,
    lastSource: result.source,
    origin: result.route.origin || job.origin,
    destination: result.route.destination || job.destination,
    corridor: result.route.corridor || job.corridor,
    monitoringStoppedReason: departed ? 'departed' : null,
    siteAcknowledgements: job.siteAcknowledgements,
  }
}

export function defaultJobName(routeFile: string, origin?: string, destination?: string, permitNumber?: string) {
  const namedFile = routeFile?.trim()
  if (namedFile && !/\.gpx$/i.test(namedFile) && !/^VEMAGS_/i.test(namedFile)) return namedFile
  if (origin && destination) return `${origin} → ${destination}`
  if (permitNumber) return permitNumber
  return namedFile || 'Saved job'
}

export function nextCheckIso(job: Pick<SavedJob, 'lastCheckedAt' | 'monitorIntervalMinutes' | 'plannedDeparture'>) {
  if (!shouldMonitorJob(job as SavedJob)) return ''
  const intervalMs = Math.max(1, job.monitorIntervalMinutes || DEFAULT_MONITOR_PREFS.intervalMinutes) * 60 * 1000
  const last = job.lastCheckedAt ? Date.parse(job.lastCheckedAt) : 0
  const next = Number.isFinite(last) && last > 0 ? last + intervalMs : Date.now()
  return new Date(next).toISOString()
}

export function toLocalInput(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function defaultDepartureIso(hoursAhead = 8) {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString()
}

/** Demo/sample departure inside the permit window (or ~8h ahead when no window). */
export function demoDepartureIso(
  permit?: { validFrom?: string; validUntil?: string } | null,
  nowMs = Date.now(),
  hoursAhead = 8,
) {
  const candidate = nowMs + hoursAhead * 60 * 60 * 1000
  const from = Date.parse(permit?.validFrom || '')
  const until = Date.parse(permit?.validUntil || '')
  const hasFrom = Number.isFinite(from)
  const hasUntil = Number.isFinite(until)

  let chosen = candidate
  if (hasFrom && hasUntil) {
    if (candidate < from) chosen = from + 60 * 60 * 1000
    else if (candidate > until) chosen = Math.max(from, until - 60 * 60 * 1000)
  } else if (hasFrom && candidate < from) {
    chosen = from + 60 * 60 * 1000
  } else if (hasUntil && candidate > until) {
    chosen = until - 60 * 60 * 1000
  }
  return new Date(chosen).toISOString()
}

/** File-use errors only — missing departure must never use this heading. */
export function isGpxFileProblemMessage(message: string) {
  return /gpx|file|vemags|upload|too large|valid route|parse|xml|pdf/i.test(message)
}
