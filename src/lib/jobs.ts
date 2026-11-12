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
  /** Clean Autobahn labels only (e.g. "A1" or "A3 / A9") — never the API display buffer suffix. */
  corridor: string
  /** Explicit permitted Autobahn codes derived from the original check (e.g. ["A1"]). */
  permittedRoads?: string[]
  /** Permit validity + travel endpoints — required so job re-runs match the original verdict window. */
  validFrom?: string
  validUntil?: string
  travelFrom?: string
  travelTo?: string
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

/** Autobahn codes (A1–A999) from free text, including polluted display labels. */
const CORRIDOR_ROAD_RE = /\bA\s?(\d{1,3})\b/gi

/**
 * Strip API display suffixes such as "· ±0.5 km HOLD / ±1.5 km VERIFY" and
 * recover Autobahn codes from polluted localStorage corridors.
 */
export function extractPermittedRoads(...parts: Array<string | string[] | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const chunks = Array.isArray(part) ? part : [part]
    for (const chunk of chunks) {
      if (!chunk) continue
      const re = new RegExp(CORRIDOR_ROAD_RE.source, 'gi')
      let match: RegExpExecArray | null
      while ((match = re.exec(String(chunk)))) {
        const road = `A${match[1]}`
        if (seen.has(road)) continue
        seen.add(road)
        out.push(road)
      }
    }
  }
  return out
}

/** Clean corridor label for storage / check-route (never the buffer display string). */
export function sanitizeCorridor(...parts: Array<string | string[] | null | undefined>): string {
  return extractPermittedRoads(...parts).join(', ')
}

/** Normalize a job loaded from localStorage (including pre-fix polluted corridors). */
export function normalizeSavedJob(job: SavedJob): SavedJob {
  const roads = extractPermittedRoads(job.corridor, job.permittedRoads)
  const corridor = roads.join(', ') || sanitizeCorridor(job.corridor) || job.corridor
  return {
    ...job,
    corridor,
    permittedRoads: roads.length ? roads : job.permittedRoads,
    travelFrom: job.travelFrom || job.origin || undefined,
    travelTo: job.travelTo || job.destination || undefined,
  }
}

/** Options for /api/check-route reconstructed from a saved job (after sanitize-on-read). */
export function jobCheckOptions(job: SavedJob) {
  const normalized = normalizeSavedJob(job)
  const roads = normalized.permittedRoads?.length
    ? normalized.permittedRoads
    : extractPermittedRoads(normalized.corridor)
  return {
    permitNumber: normalized.permitNumber,
    corridor: normalized.corridor || undefined,
    permittedRoads: roads.length ? roads : undefined,
    validFrom: normalized.validFrom,
    validUntil: normalized.validUntil,
    travelFrom: normalized.travelFrom,
    travelTo: normalized.travelTo,
    bridgeClearanceConfirmed: normalized.bridgeClearanceConfirmed,
    clearanceConfirmedBy: normalized.clearanceConfirmedBy,
    confirmedAt: normalized.confirmedAt,
  }
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
  const normalized = normalizeSavedJob(job)
  // Never persist the API display corridor (buffer suffix) — keep the clean permit roads.
  const corridor = normalized.corridor || sanitizeCorridor(result.route.corridor)
  return {
    ...normalized,
    updatedAt: nowIso,
    lastCheckedAt: nowIso,
    lastVerdict: result.verdict,
    lastSummary: result.summary,
    lastRetrievedAt: result.retrievedAt,
    lastSource: result.source,
    origin: result.route.origin || normalized.origin,
    destination: result.route.destination || normalized.destination,
    corridor,
    permittedRoads: normalized.permittedRoads?.length
      ? normalized.permittedRoads
      : extractPermittedRoads(corridor),
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
