import type { Feature, LineString } from 'geojson'
import * as turf from '@turf/turf'
import { splitConcatenatedPlaces } from './autobahnTimes.js'
import {
  buildCorridorIndex,
  distanceToCorridorKm,
  inBbox,
  type CorridorIndex,
} from './corridor.js'

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

export type RelatedRecord = {
  id: string
  title: string
}

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
  /** Travel direction relative to the permitted route, used to keep opposite-direction records distinct in dedupe. */
  travelDirection?: TravelDirection
  /** Records absorbed by proximity dedupe — surfaced on the surviving card. */
  relatedRecords?: RelatedRecord[]
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
  corridor?: CorridorIndex
  permittedRoads: string[]
  vehicle: VehicleDimensions
  windowStartMs: number
  windowEndMs: number
  nowMs: number
  /**
   * Route travel endpoints from the track (GPX start/end names or heading),
   * used to detect opposite-direction feed text (e.g. "Hannover -> Hamburg").
   * Prefer track-derived values over permit metadata so custom GPX matches samples.
   */
  travelFrom?: string
  travelTo?: string
  /** Overall route bearing in degrees (-180..180), start→end of the GPX line. */
  routeBearing?: number
}

export const HOLD_DISTANCE_KM = 0.5
export const VERIFY_DISTANCE_KM = 1.5
export const DEDUPE_KM = 0.25

const PARKING_RE = /\b(Parkplatz|Rastanlage|Rastplatz|Raststätte|\bPWC\b)/i
const RAMP_EXPLICIT_RE = /\b(Rampe|Auffahrt|Abfahrt|Ausfahrt|Anschlussstelle)\b/i
const MAINLINE_SPAN_RE = /\b(zwischen|between)\b[\s\S]{0,100}\b(AS|Anschlussstelle)\b|\bAS\b[\s\S]{0,60}\b(und|and|bis|–|-)\s*(AS\b|Anschlussstelle)/i
const LONG_SECTION_RE = /\b\d{1,3}[.,]\d+\s*km\b/i
/**
 * Shared junction-ramp detector for every source (MIA closures, roadworks, warnings, samples, GPX).
 * Explicit ramp language wins over "AS X bis AS Y" section naming so record type cannot flip the verdict.
 * Bare "AS <name>" alone is handled later via RAMP_RE after mainline-span checks.
 */
const JUNCTION_RAMP_EXPLICIT_RE = new RegExp(
  [
    String.raw`Sperrung\s+(?:der\s+)?(?:Abfahrt|Auffahrt|Ausfahrt)`,
    String.raw`(?:Abfahrt|Auffahrt|Ausfahrt)\s+[A-Za-zÄÖÜäöüß]`,
    String.raw`nach\s+Abfahrt\s+von\s+der\s+A\s?\d+`,
    String.raw`Von\s+Auffahrt\s+auf\s+die\s+A\s?\d+`,
    String.raw`Vollsperrung\s+AS\b`,
    String.raw`\bAnschlussstelle\b`,
    String.raw`\b(?:Rampe|Zubringer|Überfahrt|Tangente|Ohr|Verf(?:le|el)chtung|Knotenpunkt|Betriebsumfahrung)\b`,
    String.raw`Sperrung\s+im\s+Knotenpunkt`,
  ].join('|'),
  'i',
)
// Junction abbreviations AK/AD must be uppercase — lowercase "Ak – D …" is a MIA work-code, not Autobahnkreuz.
const RAMP_RE = /(?:^|\s|,|-|\()(?:AS\b|Auffahrt|Abfahrt|Ausfahrt|Anschlussstelle|Parkplatz|Rastanlage|Rastplatz|Raststätte|PWC\b|Rampe|Zubringer|Überfahrt|Tangente|Ohr|Verf(?:le|el)chtung|Knotenpunkt|Betriebsumfahrung|Sperrung\s+im\s+Knotenpunkt)(?:\b|$|\s|,|-)/i
const JUNCTION_RE = /(?:^|[\s,(/-])(?:AK|AD)(?=[\s,)/-]|$)/
const FULL_CLOSURE_RE = /\b(Vollsperrung|volle?\s+Sperrung|carriagewayClosed|roadClosed|both directions|beide Richtungen|gesamt(e)? Fahrbahn)\b/i
const OPPOSITE_RE = /\b(Gegenrichtung|entgegen|opposite direction|Gegenfahrbahn)\b/i
const CARDINAL_RE = /\b(?:RF|FR|Richtung)\s+(Nord|Süd|Sud|Ost|West|N|S|O|W)\b/i
const FR_PLACE_RE = /\b(?:FR|RF|Rifa|Fahrtrichtung|Richtung)\s+([A-Za-zÄÖÜäöüß][\w\-ÄÖÜäöüß]*)/gi
const NIGHT_RE = /(?:von\s+)?(\d{1,2}):(\d{2})\s*(?:Uhr\s*)?(?:–|-|bis)\s*(\d{1,2}):(\d{2})/gi
const ROAD_RE = /\bA\s?(\d{1,3})\b/gi
const HARD_WIDTH_RE = /(?:Restbreite|residual(?:\s*road)?\s*width|(?:maximale\s+)?Durchfahrtsbreite|max(?:imale)?\s*(?:Fahrbahn)?breite|lichte\s*Breite|Fahrbahnbreite(?:\s*max)?)\s*[:=]?\s*(\d+[.,]\d+)\s*m/i
const HARD_HEIGHT_RE = /(?:(?:maximale\s+)?Durchfahrtshöhe|lichte\s*Höhe|height\s*limit|clearance(?:\s*height)?)\s*[:=]?\s*(\d+[.,]\d+)\s*m/i
const HARD_WEIGHT_RE = /(?:(?:maximale[sn]?\s+)?(?:Achslast|Gewicht(?:sbeschränkung)?)|weight\s*limit|max(?:imum)?\s*weight)\s*[:=]?\s*(\d+[.,]?\d*)\s*t\b/i

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
  // Always extract Autobahn codes — polluted display labels like
  // "A1·±0.5kmHOLD/±1.5kmVERIFY" must not become permitted-road tokens.
  const fromExtra = extra.flatMap(road => {
    const extracted = extractRoadNumbers(road)
    if (extracted.length) return extracted
    const cleaned = String(road || '').toUpperCase().replace(/\s+/g, '')
    return /^A\d{1,3}$/.test(cleaned) ? [cleaned] : []
  })
  return [...new Set([...extractRoadNumbers(corridor), ...fromExtra])]
}

export function distanceToRouteKm(routeLine: Feature<LineString>, lat: number, lng: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY
  const points = routeLine.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
  return distanceToCorridorKm(buildCorridorIndex(points, 50), lat, lng)
}

/** True when the text names a junction ramp / AS exit-entry, shared across all feed types. */
export function isJunctionRampText(text: string): boolean {
  return JUNCTION_RAMP_EXPLICIT_RE.test(text) || JUNCTION_RE.test(text)
}

export function classifyLocationKind(text: string): LocationKind {
  if (PARKING_RE.test(text) && !MAINLINE_SPAN_RE.test(text) && !LONG_SECTION_RE.test(text)) return 'parking'
  // Explicit junction-ramp language wins over "AS X bis AS Y" section naming in the same sentence.
  if (isJunctionRampText(text)) return 'ramp'
  // Multi-km mainline sections often name endpoint junctions ("zwischen AS X und AS Y") — not ramps.
  if (MAINLINE_SPAN_RE.test(text) || (LONG_SECTION_RE.test(text) && !RAMP_EXPLICIT_RE.test(text) && !JUNCTION_RE.test(text))) {
    return 'mainline'
  }
  if (RAMP_RE.test(text)) return 'ramp'
  return 'mainline'
}

function placeToken(value?: string | null): string {
  if (!value) return ''
  const token = value.trim().split(/[\s,/·|()]+/).find(Boolean) || ''
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const CARDINAL_BEARING: Record<string, number> = {
  nord: 0,
  n: 0,
  ost: 90,
  o: 90,
  sud: 180,
  süd: 180,
  s: 180,
  west: 270,
  w: 270,
}

export function routeBearingDegrees(routeLine: Feature<LineString>): number {
  const coords = routeLine.geometry.coordinates
  if (coords.length < 2) return 0
  const start = coords[0]
  const end = coords[coords.length - 1]
  return turf.bearing(turf.point(start), turf.point(end))
}

function cardinalVsBearing(cardinal: string, bearing: number): TravelDirection {
  const target = CARDINAL_BEARING[cardinal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
  if (target == null) return 'unknown'
  const normalized = ((bearing % 360) + 360) % 360
  const diff = Math.min(Math.abs(normalized - target), 360 - Math.abs(normalized - target))
  if (diff <= 55) return 'with'
  if (diff >= 125) return 'against'
  return 'unknown'
}

export function parseTravelDirection(
  text: string,
  travel?: { from?: string; to?: string },
  routeBearing?: number,
): TravelDirection {
  if (OPPOSITE_RE.test(text)) return 'against'
  if (/\b(beide Richtungen|both directions|beide Fahrtrichtungen)\b/i.test(text)) return 'both'

  const from = placeToken(travel?.from)
  const to = placeToken(travel?.to)
  if (from && to) {
    const arrowRe = /([A-Za-zÄÖÜäöüß][\w\-ÄÖÜäöüß]*)\s*(?:->|→|⇒)\s*([A-Za-zÄÖÜäöüß][\w\-ÄÖÜäöüß]*)/g
    let match: RegExpExecArray | null
    while ((match = arrowRe.exec(text))) {
      const a = placeToken(match[1])
      const b = placeToken(match[2])
      if (a && b) {
        if (a === to && b === from) return 'against'
        if (a === from && b === to) return 'with'
      }
    }
    const frRe = new RegExp(FR_PLACE_RE.source, 'gi')
    while ((match = frRe.exec(text))) {
      const place = placeToken(match[1])
      if (!place || CARDINAL_BEARING[place] != null) continue
      if (place === from || place.startsWith(from) || from.startsWith(place)) return 'against'
      if (place === to || place.startsWith(to) || to.startsWith(place)) return 'with'
    }
  }

  if (routeBearing != null && Number.isFinite(routeBearing)) {
    const cardinal = text.match(CARDINAL_RE)
    if (cardinal) return cardinalVsBearing(cardinal[1], routeBearing)
  }

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

export function extractHardHeightLimit(text: string): number | null {
  const match = text.match(HARD_HEIGHT_RE)
  if (!match) return null
  const value = parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value < 12 ? value : null
}

export function extractHardWeightLimit(text: string): number | null {
  const match = text.match(HARD_WEIGHT_RE)
  if (!match) return null
  const value = parseFloat(match[1].replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value < 1000 ? value : null
}

function unknownDim(value?: number) {
  return !Number.isFinite(value) || !value || value <= 0
}

export function dimDecision(
  vehicle: VehicleDimensions,
  input: Pick<CandidateInput, 'residualWidth' | 'minLaneWidth' | 'heightLimit' | 'weightLimit' | 'description' | 'title'>,
): { hold: boolean; verify: boolean; type?: string; restriction?: number } {
  const text = `${input.title || ''} ${input.description || ''}`
  if (input.residualWidth && vehicle.width > input.residualWidth) {
    return { hold: true, verify: false, type: 'width', restriction: input.residualWidth }
  }
  const hardWidth = extractHardWidthLimit(text)
  if (hardWidth && vehicle.width > hardWidth) {
    return { hold: true, verify: false, type: 'width', restriction: hardWidth }
  }
  const heightLimit = input.heightLimit || extractHardHeightLimit(text) || undefined
  if (heightLimit) {
    if (unknownDim(vehicle.height)) {
      return { hold: false, verify: true, type: 'height', restriction: heightLimit }
    }
    if (vehicle.height > heightLimit) {
      return { hold: true, verify: false, type: 'height', restriction: heightLimit }
    }
  }
  const weightLimit = input.weightLimit || extractHardWeightLimit(text) || undefined
  if (weightLimit) {
    if (unknownDim(vehicle.grossWeight)) {
      return { hold: false, verify: true, type: 'weight', restriction: weightLimit }
    }
    if (vehicle.grossWeight > weightLimit) {
      return { hold: true, verify: false, type: 'weight', restriction: weightLimit }
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
  const titleRoads = extractRoadNumbers(input.title)
  const descRoads = extractRoadNumbers(input.description)

  // Prefer input.road if present, otherwise take the first road from title, then description
  const road = input.road?.toUpperCase().replace(/\s+/g, '') || titleRoads[0] || descRoads[0]

  if (!permittedRoads.length || !road) return { road, offPermit: false }

  const permitted = new Set(permittedRoads.map(item => item.toUpperCase()))

  // Only the primary road (not all mentioned roads) determines permit match
  const offPermit = !permitted.has(road)

  return { road, offPermit }
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

  let distanceKm: number | null = null
  if (input.lat != null && input.lng != null) {
    if (ctx.corridor && !inBbox(input.lat, input.lng, ctx.corridor.bbox)) return null
    distanceKm = ctx.corridor
      ? distanceToCorridorKm(ctx.corridor, input.lat, input.lng)
      : distanceToRouteKm(ctx.routeLine, input.lat, input.lng)
    if (distanceKm > VERIFY_DISTANCE_KM) return null
  }

  const kind = classifyLocationKind(text)
  const direction = parseTravelDirection(
    text,
    { from: ctx.travelFrom, to: ctx.travelTo },
    ctx.routeBearing ?? routeBearingDegrees(ctx.routeLine),
  )
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

  // Opposite-direction ramp/AS stays visible as info — never HOLD/VERIFY, never dropped silently.
  if ((kind === 'ramp' || kind === 'parking') && direction === 'against') {
    state = 'info'
    blocker = false
    reason = 'Opposite direction — junction ramp/AS is against the route travel direction.'
    title = `${input.title} (Opposite direction)`
    category = input.category === 'closures' ? 'closures' : input.category === 'parking' ? 'observations' : 'roadworks'
    const detail = splitConcatenatedPlaces([input.description, reason].filter(Boolean).join(' · '))
    return {
      id: input.id,
      title: splitConcatenatedPlaces(title),
      detail,
      source: input.source,
      confidence: 'medium',
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
      blocker: false,
      travelDirection: direction,
    }
  }

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
      ? `Width limit ${dims.restriction} m vs vehicle ${ctx.vehicle.width} m`
      : dims.type === 'height'
        ? `Height limit ${dims.restriction} m vs vehicle ${ctx.vehicle.height} m`
        : `Weight limit ${dims.restriction} t vs vehicle ${ctx.vehicle.grossWeight} t`
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
    travelDirection: direction,
  }
}

const SEVERITY_RANK: Record<EvidenceState, number> = { danger: 4, warning: 3, info: 2, clear: 1 }

function relatedNote(count: number): string {
  return count === 1 ? '+1 related record' : `+${count} related records`
}

function withRelatedTrace(survivor: ClassifiedEvidence, absorbed: ClassifiedEvidence): ClassifiedEvidence {
  const related = [
    ...(survivor.relatedRecords || []),
    ...(absorbed.relatedRecords || []),
    { id: absorbed.id, title: absorbed.title },
  ]
  const note = relatedNote(related.length)
  const reason = /\+\d+ related records?/.test(survivor.reason)
    ? survivor.reason.replace(/\+\d+ related records?/g, note)
    : `${survivor.reason} (${note})`
  return { ...survivor, relatedRecords: related, reason }
}

function directionsMatch(a?: TravelDirection, b?: TravelDirection): boolean {
  return (a ?? 'unknown') === (b ?? 'unknown')
}

export function dedupeClassified(items: ClassifiedEvidence[], maxKm = DEDUPE_KM): ClassifiedEvidence[] {
  const kept: ClassifiedEvidence[] = []
  const bySourceId = new Map<string, ClassifiedEvidence>()
  for (const item of items) {
    if (item.id) {
      const prior = bySourceId.get(item.id)
      if (prior) {
        if (SEVERITY_RANK[item.state] > SEVERITY_RANK[prior.state]) {
          const index = kept.indexOf(prior)
          if (index >= 0) kept[index] = item
          bySourceId.set(item.id, item)
        }
        continue
      }
    }
    const match = kept.find(existing => {
      if (item.id && existing.id && item.id === existing.id) return true
      const sameRoad = (existing.road || '') === (item.road || '')
      const sameType = existing.category === item.category
      const sameKind = existing.locationKind === item.locationKind
      const sameDirection = directionsMatch(existing.travelDirection, item.travelDirection)
      // Never absorb a record that differs in ramp/mainline kind or travel direction.
      if (!sameRoad || !sameType || !sameKind || !sameDirection) return false
      if (item.lat == null || item.lng == null || existing.lat == null || existing.lng == null) return false
      const km = turf.distance([item.lng, item.lat], [existing.lng, existing.lat], { units: 'kilometers' })
      return km <= maxKm
    })
    if (!match) {
      kept.push(item)
      if (item.id) bySourceId.set(item.id, item)
      continue
    }
    const index = kept.indexOf(match)
    if (SEVERITY_RANK[item.state] > SEVERITY_RANK[match.state]) {
      const merged = withRelatedTrace(item, match)
      kept[index] = merged
      if (item.id) bySourceId.set(item.id, merged)
      if (match.id) bySourceId.set(match.id, merged)
    } else {
      const merged = withRelatedTrace(match, item)
      kept[index] = merged
      if (match.id) bySourceId.set(match.id, merged)
      if (item.id) bySourceId.set(item.id, merged)
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
    /** Override the default degraded reason (e.g. corridor undetected). */
    degradedReason?: string
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
  // Confirmed HOLD from remaining evidence must never be silently downgraded
  // when a live Autobahn feed is degraded or unavailable.
  const hold = evidence.filter(item => item.state === 'danger')
  if (hold.length) {
    return {
      verdict: 'HOLD',
      confidence: 'high',
      reasons: [`${hold.length} confirmed mainline block${hold.length === 1 ? '' : 's'} on the permitted carriageway.`],
      acknowledgedCount: 0,
    }
  }
  if (opts.degraded) {
    return {
      verdict: 'VERIFY',
      confidence: 'medium',
      reasons: [opts.degradedReason || 'Live Autobahn source unavailable.'],
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
    degradedPartial?: boolean
    corridorUndetected?: boolean
    issueCount: number
    distanceKm: number
    clearanceConfirmed?: boolean
    acknowledgedCount?: number
  },
) {
  if (verdict === 'HOLD') {
    const blocking = `${opts.issueCount} blocking ${opts.issueCount === 1 ? 'issue' : 'issues'} on the permitted mainline.`
    if (!opts.degraded) {
      return { title: 'Hold departure – blocking issue on route', summary: blocking }
    }
    const feedNote = opts.degradedPartial
      ? 'Autobahn live feed is partially unavailable — treat as incomplete evidence.'
      : 'Autobahn live feed is unavailable — treat as incomplete evidence.'
    return {
      title: 'Hold departure – blocking issue on route',
      summary: `${blocking} ${feedNote}`,
    }
  }
  if (opts.degraded) {
    if (opts.corridorUndetected) {
      return {
        title: "Can't confirm route – motorway not detected",
        summary: 'Could not identify which Autobahn the GPX follows. Pass a corridor hint (e.g. A20) or verify manually.',
      }
    }
    return {
      title: opts.degradedPartial
        ? "Can't confirm route – some Autobahn feeds unavailable"
        : "Can't confirm route – data source unavailable",
      summary: opts.degradedPartial
        ? 'Some Autobahn live feeds failed. Remaining evidence is incomplete — retry or verify manually.'
        : 'The Autobahn data source is temporarily unavailable. Retry or verify manually.',
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
