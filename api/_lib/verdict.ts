import type { Feature, LineString } from 'geojson'
import * as turf from '@turf/turf'
import { splitConcatenatedPlaces } from './autobahnTimes.js'

export type VehicleDimensions = {
  width: number
  height: number
  length: number
  grossWeight: number
}

export type EvidenceState = 'clear' | 'info' | 'warning' | 'danger'

export type SiteAcknowledgement = {
  evidenceId: string
  acknowledgedBy: string
  acknowledgedAt: string
}
export type LocationKind = 'mainline' | 'ramp' | 'parking' | 'unknown'
export type TravelDirection = 'with' | 'against' | 'unknown' | 'both'

export type ClassifiedEvidence = {
  id: string
  title: string
  detail: string
  source: string
  age?: string
  confidence: 'high' | 'medium'
  state: EvidenceState
  category: 'roadworks' | 'closures' | 'observations'
  lat?: number
  lng?: number
  startTimestamp?: string | null
  endTimestamp?: string | null
  retrievedAt?: string
  longRunning?: boolean
  distanceKm: number | null
  reason: string
  locationKind: LocationKind
  road?: string
  blocker: boolean
}

export type CandidateInput = {
  id: string
  title: string
  description: string
  source: string
  lat?: number
  lng?: number
  road?: string
  startTimestamp?: string | null
  endTimestamp?: string | null
  retrievedAt?: string
  longRunning?: boolean
  isBlocked?: boolean
  residualWidth?: number
  minLaneWidth?: number
  heightLimit?: number
  weightLimit?: number
  management?: string
  category: 'roadworks' | 'closures' | 'warnings' | 'parking' | 'bw'
  isBw?: boolean
}

export type ClassifyContext = {
  routeLine: Feature<LineString>
  permittedRoads: string[]
  vehicle: VehicleDimensions
  windowStartMs: number
  windowEndMs: number
  nowMs: number
}

export const HOLD_DISTANCE_KM = 0.5
export const VERIFY_DISTANCE_KM = 1.5
export const DEDUPE_KM = 0.25

const RAMP_RE = /\b(AS\b|Auffahrt|Abfahrt|Anschlussstelle|Parkplatz|Rastanlage|Rastplatz|Raststätte|\bPWC\b)/i
const FULL_CLOSURE_RE = /\b(Vollsperrung|volle?\s+Sperrung|carriagewayClosed|roadClosed|both directions|beide Richtungen|gesamt(e)? Fahrbahn)\b/i
const OPPOSITE_RE = /\b(Gegenrichtung|entgegen|opposite direction|Gegenfahrbahn)\b/i
const NIGHT_RE = /(?:von\s+)?(\d{1,2}):(\d{2})\s*(?:Uhr\s*)?(?:–|-|bis)\s*(\d{1,2}):(\d{2})/gi
const ROAD_RE = /\bA\s?(\d{1,3})\b/gi
const HARD_WIDTH_RE = /(?:Restbreite|residual(?:\s*road)?\s*width|max(?:imale)?\s*(?:Fahrbahn)?breite|lichte\s*Breite|Fahrbahnbreite(?:\s*max)?)\s*[:=]?\s*(\d+[.,]\d+)\s*m/i

export function extractRoadNumbers(text?: string | null): string[] {
  if (!text) return []
  const out: string[] = []
  const re = new RegExp(ROAD_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    out.push(`A${match[1]}`)
  }
  return [...new Set(out)]
}

export function inferPermittedRoads(corridor?: string, extra: string[] = []): string[] {
  return [...new Set([...extractRoadNumbers(corridor), ...extra.map(road => road.toUpperCase().replace(/\s+/g, ''))])]
}

export function distanceToRouteKm(routeLine: Feature<LineString>, lat: number, lng: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY
  const snapped = turf.nearestPointOnLine(routeLine, turf.point([lng, lat]), { units: 'kilometers' })
  const dist = snapped.properties?.dist
  return typeof dist === 'number' && Number.isFinite(dist) ? dist : Number.POSITIVE_INFINITY
}

export function classifyLocationKind(text: string): LocationKind {
  if (/\b(Parkplatz|Rastanlage|Rastplatz|Raststätte|\bPWC\b)/i.test(text)) return 'parking'
  if (RAMP_RE.test(text)) return 'ramp'
  return 'mainline'
}

export function parseTravelDirection(text: string): TravelDirection {
  if (OPPOSITE_RE.test(text)) return 'against'
  if (/\b(beide Richtungen|both directions|beide Fahrtrichtungen)\b/i.test(text)) return 'both'
  return 'unknown'
}

export function parseNightHours(text: string): Array<{ startMin: number; endMin: number }> {
  const windows: Array<{ startMin: number; endMin: number }> = []
  const re = new RegExp(NIGHT_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const startMin = Number(match[1]) * 60 + Number(match[2])
    const endMin = Number(match[3]) * 60 + Number(match[4])
    const span = (endMin - startMin + 24 * 60) % (24 * 60)
    if (span >= 8 * 60 && span <= 14 * 60 && (Number(match[1]) >= 18 || Number(match[3]) <= 8)) {
      windows.push({ startMin, endMin })
    }
  }
  return windows
}

export function overlapsTimeWindow(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  const start = startIso ? Date.parse(startIso) : Number.NaN
  const end = endIso ? Date.parse(endIso) : Number.NaN
  const itemStart = Number.isFinite(start) ? start : windowStartMs - 1
  const itemEnd = Number.isFinite(end) ? end : windowEndMs + 1
  return itemStart <= windowEndMs && itemEnd >= windowStartMs
}

export function startsAfterWindow(startIso: string | null | undefined, windowEndMs: number): boolean {
  if (!startIso) return false
  const start = Date.parse(startIso)
  return Number.isFinite(start) && start > windowEndMs
}

export function nightWindowMissesDeparture(text: string, windowStartMs: number, windowEndMs: number): boolean {
  const nights = parseNightHours(text)
  if (!nights.length) return false
  const spanHours = (windowEndMs - windowStartMs) / 3600000
  if (spanHours >= 20) return false
  const start = new Date(windowStartMs)
  const minutes = start.getUTCHours() * 60 + start.getUTCMinutes()
  return !nights.some(night => {
    if (night.startMin < night.endMin) return minutes >= night.startMin && minutes <= night.endMin
    return minutes >= night.startMin || minutes <= night.endMin
  })
}

export function extractHardWidthLimit(text: string): number | null {
  const match = text.match(HARD_WIDTH_RE)
  if (!match) return null
  const value = parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value < 10 ? value : null
}

function unknownDim(value?: number) {
  return !Number.isFinite(value) || !value || value <= 0
}

export function dimDecision(
  vehicle: VehicleDimensions,
  input: Pick<CandidateInput, 'residualWidth' | 'minLaneWidth' | 'heightLimit' | 'weightLimit' | 'description'>,
): { hold: boolean; verify: boolean; type?: string; restriction?: number } {
  if (input.residualWidth && vehicle.width > input.residualWidth) {
    return { hold: true, verify: false, type: 'width', restriction: input.residualWidth }
  }
  const hardWidth = extractHardWidthLimit(input.description || '')
  if (hardWidth && vehicle.width > hardWidth) {
    return { hold: true, verify: false, type: 'width', restriction: hardWidth }
  }
  if (input.heightLimit) {
    if (unknownDim(vehicle.height)) {
      return { hold: false, verify: true, type: 'height', restriction: input.heightLimit }
    }
    if (vehicle.height > input.heightLimit) {
      return { hold: true, verify: false, type: 'height', restriction: input.heightLimit }
    }
  }
  if (input.weightLimit) {
    if (unknownDim(vehicle.grossWeight)) {
      return { hold: false, verify: true, type: 'weight', restriction: input.weightLimit }
    }
    if (vehicle.grossWeight > input.weightLimit) {
      return { hold: true, verify: false, type: 'weight', restriction: input.weightLimit }
    }
  }
  if (input.minLaneWidth && vehicle.width > input.minLaneWidth) {
    return { hold: false, verify: true, type: 'minLaneWidth', restriction: input.minLaneWidth }
  }
  return { hold: false, verify: false }
}

export function isFullMainlineClosure(input: CandidateInput, kind: LocationKind): boolean {
  if (kind !== 'mainline') return false
  const text = `${input.title} ${input.description} ${input.management || ''}`
  if (input.management === 'roadClosed' || input.management === 'carriagewayClosed' || input.management === 'carriagewayClosures') {
    return true
  }
  return FULL_CLOSURE_RE.test(text)
}

export function departureWindow(opts: {
  nowMs?: number
  departureStart?: string | null
  departureEnd?: string | null
  validFrom?: string | null
  validUntil?: string | null
}): { startMs: number; endMs: number } {
  const nowMs = opts.nowMs ?? Date.now()
  const start = Date.parse(opts.departureStart || '')
  const end = Date.parse(opts.departureEnd || opts.validUntil || '')
  const startMs = Number.isFinite(start) ? start : nowMs
  const endMs = Number.isFinite(end) ? Math.max(end, startMs + 60 * 60 * 1000) : startMs + 24 * 60 * 60 * 1000
  return { startMs, endMs }
}

function roadMatchesPermit(input: CandidateInput, permittedRoads: string[]): { road?: string; offPermit: boolean } {
  const fromItem = extractRoadNumbers([input.road, input.title, input.description].filter(Boolean).join(' '))
  const road = input.road?.toUpperCase().replace(/\s+/g, '') || fromItem[0]
  if (!permittedRoads.length || !road) return { road, offPermit: false }
  const permitted = new Set(permittedRoads.map(item => item.toUpperCase()))
  const hits = [road, ...fromItem].some(value => permitted.has(value))
  return { road, offPermit: !hits }
}

export function classifyCandidate(input: CandidateInput, ctx: ClassifyContext): ClassifiedEvidence | null {
  input = {
    ...input,
    title: splitConcatenatedPlaces(input.title),
    description: splitConcatenatedPlaces(input.description),
  }
  const text = `${input.title} ${input.description}`
  if (startsAfterWindow(input.startTimestamp, ctx.windowEndMs)) return null
  if (input.endTimestamp && Date.parse(input.endTimestamp) < ctx.windowStartMs) return null
  if (!overlapsTimeWindow(input.startTimestamp, input.endTimestamp, ctx.windowStartMs, ctx.windowEndMs) && input.startTimestamp) {
    return null
  }
  if (nightWindowMissesDeparture(text, ctx.windowStartMs, ctx.windowEndMs)) return null

  const distanceKm = input.lat != null && input.lng != null
    ? distanceToRouteKm(ctx.routeLine, input.lat, input.lng)
    : null
  if (distanceKm != null && distanceKm > VERIFY_DISTANCE_KM) return null

  const kind = classifyLocationKind(text)
  const direction = parseTravelDirection(text)
  const { road, offPermit } = roadMatchesPermit(input, ctx.permittedRoads)
  const nearby = distanceKm != null && distanceKm > HOLD_DISTANCE_KM
  const unclearGeometry = distanceKm == null
  const dims = dimDecision(ctx.vehicle, input)
  const fullClosure = isFullMainlineClosure(input, kind)
  const bw = Boolean(input.isBw || input.category === 'bw')
  const startedAt = input.startTimestamp ? Date.parse(input.startTimestamp) : Number.NaN
  const longRunning = Boolean(input.longRunning) || (
    Number.isFinite(startedAt)
    && !input.endTimestamp
    && ctx.nowMs - startedAt > 90 * 24 * 60 * 60 * 1000
  )
  const notOnPermittedRoad = offPermit || bw

  const holdEligible = !nearby
    && !unclearGeometry
    && kind === 'mainline'
    && !offPermit
    && direction !== 'against'
    && !longRunning
    && !bw

  let state: EvidenceState = 'warning'
  let reason = 'On-route disruption needs a dispatcher check.'
  let category: ClassifiedEvidence['category'] = input.category === 'closures' ? 'closures' : input.category === 'parking' ? 'observations' : 'roadworks'
  let title = input.title
  let blocker = true

  if (input.category === 'parking') {
    state = input.isBlocked ? 'warning' : 'clear'
    category = 'observations'
    reason = input.isBlocked
      ? 'Lorry parking on corridor is blocked — informational, does not HOLD.'
      : 'Lorry parking on corridor — informational.'
    blocker = false
    title = input.title
  } else if (nearby && notOnPermittedRoad) {
    state = 'info'
    blocker = false
    reason = `Nearby, not on route (${distanceKm?.toFixed(1)} km). Other Autobahn, off-corridor ramp/AS, or BW state road — shown for context, not a VERIFY blocker.`
    title = `${input.title} (nearby, not on route)`
  } else if (nearby || unclearGeometry) {
    state = 'warning'
    reason = unclearGeometry
      ? 'Geometry is unclear (no coordinates) — VERIFY, do not HOLD.'
      : `On the permitted corridor ${distanceKm?.toFixed(1)} km from the GPX line — VERIFY nearby.`
    title = unclearGeometry ? `${input.title} (unclear geometry)` : `${input.title} (nearby)`
  } else if (kind === 'ramp' || kind === 'parking') {
    state = 'warning'
    reason = kind === 'ramp'
      ? 'Ramp / AS / parking site — not a confirmed mainline carriageway block.'
      : 'Parking or rest area — verify, do not HOLD the mainline.'
    title = `${input.title} (${kind})`
  } else if (bw) {
    state = 'warning'
    reason = 'BW state road (BEMaS) is not the permitted Autobahn carriageway — VERIFY only.'
    category = input.category === 'closures' || /ROAD_CLOSED/i.test(input.description) ? 'closures' : 'roadworks'
  } else if (offPermit) {
    state = 'warning'
    reason = `Item is on ${road || 'another road'}, not the permitted ${ctx.permittedRoads.join(', ') || 'corridor'}.`
    title = `${input.title} (other road)`
  } else if (direction === 'against') {
    state = 'warning'
    reason = 'Feed direction is opposite the permitted travel direction.'
  } else if (longRunning) {
    state = 'warning'
    reason = 'Long-running item with no published end — verify on site, never HOLD from this alone.'
  } else if (dims.verify && dims.type === 'minLaneWidth') {
    state = 'warning'
    reason = `minLaneWidth ${dims.restriction} m is ambiguous remaining lane width, not a confirmed vehicle limit.`
    title = `Lane width ${dims.restriction} m — verify`
  } else if (dims.verify) {
    state = 'warning'
    reason = `${dims.type} limit ${dims.restriction} is published but the vehicle ${dims.type} is not recorded — VERIFY.`
    title = `${dims.type} limit ${dims.restriction} — verify`
  } else if (dims.hold && holdEligible) {
    state = 'danger'
    const vehicleValue = dims.type === 'height'
      ? ctx.vehicle.height
      : dims.type === 'weight'
        ? ctx.vehicle.grossWeight
        : ctx.vehicle.width
    const unit = dims.type === 'weight' ? 't' : 'm'
    reason = `Hard ${dims.type} limit ${dims.restriction} ${unit} vs vehicle ${vehicleValue} ${unit} on the mainline carriageway.`
    title = dims.type === 'width'
      ? `Width restriction ${dims.restriction} m vs vehicle ${ctx.vehicle.width} m`
      : dims.type === 'height'
        ? `Height restriction ${dims.restriction} m vs vehicle ${ctx.vehicle.height} m`
        : `Weight restriction ${dims.restriction} t vs vehicle ${ctx.vehicle.grossWeight} t`
    category = 'roadworks'
  } else if (dims.hold) {
    state = 'warning'
    reason = `${dims.type} restriction ${dims.restriction} is not a confirmed mainline HOLD (ramp, nearby, or other road).`
  } else if (fullClosure && holdEligible) {
    state = 'danger'
    reason = 'Confirmed full mainline carriageway closure on the permitted route during the departure window.'
    title = 'Full mainline closure on permitted route'
    category = 'closures'
  } else if (fullClosure || input.isBlocked) {
    state = 'warning'
    reason = 'Closure is ambiguous (ramp, direction, or not clearly the permitted carriageway).'
    category = 'closures'
  } else {
    state = 'warning'
    reason = 'Works on or near the permitted corridor — not a confirmed mainline block.'
  }

  if (state === 'clear' || state === 'info') blocker = false
  if (state === 'danger') blocker = true

  const detail = splitConcatenatedPlaces([input.description, reason].filter(Boolean).join(' · '))
  return {
    id: input.id,
    title: splitConcatenatedPlaces(title),
    detail,
    source: input.source,
    confidence: state === 'danger' ? 'high' : 'medium',
    state,
    category,
    lat: input.lat,
    lng: input.lng,
    startTimestamp: input.startTimestamp ?? null,
    endTimestamp: input.endTimestamp ?? null,
    retrievedAt: input.retrievedAt,
    longRunning,
    distanceKm: distanceKm != null && Number.isFinite(distanceKm) ? Math.round(distanceKm * 1000) / 1000 : null,
    reason,
    locationKind: kind,
    road,
    blocker: state === 'danger' || (state === 'warning' && blocker),
  }
}

const SEVERITY_RANK: Record<EvidenceState, number> = { danger: 4, warning: 3, info: 2, clear: 1 }

export function dedupeClassified(items: ClassifiedEvidence[], maxKm = DEDUPE_KM): ClassifiedEvidence[] {
  const kept: ClassifiedEvidence[] = []
  for (const item of items) {
    const match = kept.find(existing => {
      const sameId = Boolean(item.id && existing.id && (existing.id === item.id || existing.id.includes(item.id) || item.id.includes(existing.id)))
      if (sameId) return true
      const sameRoad = (existing.road || '') === (item.road || '')
      const sameType = existing.category === item.category
      if (!sameRoad || !sameType) return false
      if (item.lat == null || item.lng == null || existing.lat == null || existing.lng == null) return false
      const km = turf.distance([item.lng, item.lat], [existing.lng, existing.lat], { units: 'kilometers' })
      return km <= maxKm
    })
    if (!match) {
      kept.push(item)
      continue
    }
    if (SEVERITY_RANK[item.state] > SEVERITY_RANK[match.state]) {
      const index = kept.indexOf(match)
      kept[index] = item
    }
  }
  return kept
}

export function isSystemNote(id: string) {
  return /^(mia-snapshot-|mia-deduped|bw-deduped|bw-unavailable|route-clear|bridge-clearance-|system-error)/.test(id)
}

export function isAcknowledgeable(
  item: Pick<ClassifiedEvidence, 'id' | 'state' | 'blocker'>,
): boolean {
  if (item.state === 'danger') return false
  if (item.state !== 'warning' || item.blocker === false) return false
  return !isSystemNote(item.id)
}

export function determineVerdict(
  evidence: Array<Pick<ClassifiedEvidence, 'id' | 'state' | 'blocker' | 'category'>>,
  opts: {
    degraded?: boolean
    clearanceConfirmed?: boolean
    acknowledgements?: SiteAcknowledgement[]
  } = {},
): {
  verdict: 'READY' | 'HOLD' | 'VERIFY'
  confidence: 'high' | 'medium'
  reasons: string[]
  acknowledgedCount: number
} {
  const reasons: string[] = []
  const ackIds = new Set((opts.acknowledgements || []).map(item => item.evidenceId))
  if (opts.degraded) {
    return { verdict: 'VERIFY', confidence: 'medium', reasons: ['Live Autobahn source unavailable.'], acknowledgedCount: 0 }
  }
  const hold = evidence.filter(item => item.state === 'danger')
  if (hold.length) {
    return {
      verdict: 'HOLD',
      confidence: 'high',
      reasons: [`${hold.length} confirmed mainline block${hold.length === 1 ? '' : 's'} on the permitted carriageway.`],
      acknowledgedCount: 0,
    }
  }
  const acknowledgeable = evidence.filter(item => isAcknowledgeable(item))
  const verifyBlockers = acknowledgeable.filter(item => !ackIds.has(item.id))
  const acknowledgedCount = acknowledgeable.filter(item => ackIds.has(item.id)).length
  const clearanceMissing = !opts.clearanceConfirmed
  if (verifyBlockers.length) reasons.push(`${verifyBlockers.length} unresolved VERIFY item${verifyBlockers.length === 1 ? '' : 's'}.`)
  if (clearanceMissing) reasons.push('Bridge and clearance are not dispatcher-confirmed.')
  if (verifyBlockers.length || clearanceMissing) {
    return { verdict: 'VERIFY', confidence: 'medium', reasons, acknowledgedCount }
  }
  if (acknowledgedCount) {
    return {
      verdict: 'READY',
      confidence: 'high',
      reasons: [`Dispatcher confirmed ${acknowledgedCount} item${acknowledgedCount === 1 ? '' : 's'}.`],
      acknowledgedCount,
    }
  }
  return {
    verdict: 'READY',
    confidence: 'high',
    reasons: ['No confirmed mainline block, no unresolved VERIFY items, and clearance is confirmed.'],
    acknowledgedCount: 0,
  }
}

export function verdictCopy(
  verdict: 'READY' | 'HOLD' | 'VERIFY',
  opts: {
    degraded?: boolean
    issueCount: number
    distanceKm: number
    clearanceConfirmed?: boolean
    acknowledgedCount?: number
  },
) {
  if (verdict === 'HOLD') {
    return {
      title: 'Hold departure – blocking issue on route',
      summary: `${opts.issueCount} blocking ${opts.issueCount === 1 ? 'issue' : 'issues'} on the permitted mainline.`,
    }
  }
  if (opts.degraded) {
    return {
      title: "Can't confirm route – data source unavailable",
      summary: 'The Autobahn data source is temporarily unavailable. Retry or verify manually.',
    }
  }
  if (verdict === 'READY') {
    const confirmed = opts.acknowledgedCount || 0
    if (confirmed) {
      return {
        title: `READY – dispatcher confirmed ${confirmed} item${confirmed === 1 ? '' : 's'}`,
        summary: `Dispatcher confirmed ${confirmed} VERIFY item${confirmed === 1 ? '' : 's'} on site. No HOLD remains and clearance is confirmed.`,
      }
    }
    return {
      title: 'Ready to depart – no confirmed mainline block',
      summary: `No HOLD-level disruption on the ${opts.distanceKm} km route. Dispatcher confirmed bridge/clearance.`,
    }
  }
  return {
    title: opts.clearanceConfirmed
      ? 'Verification required – potential issue detected'
      : 'Verification required – bridge and clearance not confirmed',
    summary: opts.clearanceConfirmed
      ? 'Nearby or ambiguous items remain. They are not confirmed mainline blocks.'
      : `No confirmed mainline block on ${opts.distanceKm} km, but clearance is unconfirmed so READY is not available.`,
  }
}

export function routeLineFromPoints(points: Array<{ lat: number; lng: number }>): Feature<LineString> {
  return turf.lineString(points.map(point => [point.lng, point.lat]))
}
