import { bboxFromPoints, type LatLngPoint } from './corridor.js'
import { roadVectors, type RoadVector } from './roadVectors.js'

/** Match threshold against coarse Autobahn polylines (control points are sparse). */
export const ROAD_MATCH_THRESHOLD_KM = 12
/** Absolute floor: a candidate must cover at least this fraction of the track. */
export const ROAD_MATCH_MIN_COVERAGE = 0.2
/** Keep secondary roads only when coverage is within this ratio of the best match. */
export const ROAD_MATCH_RELATIVE_COVERAGE = 0.85
/** Secondary roads may not be much farther from the track than the best match. */
export const ROAD_MATCH_MEDIAN_SLACK_KM = 3

const M_PER_DEG_LAT = 111_320

export type RoadMatchScore = {
  road: string
  coverage: number
  contig: number
  medianKm: number
}

function mPerDegLng(lat: number) {
  return M_PER_DEG_LAT * Math.max(0.2, Math.cos((lat * Math.PI) / 180))
}

function perpendicularDistanceM(point: LatLngPoint, start: LatLngPoint, end: LatLngPoint): number {
  const lat0 = (start.lat + end.lat) / 2
  const mx = mPerDegLng(lat0)
  const my = M_PER_DEG_LAT
  const x0 = (point.lng - start.lng) * mx
  const y0 = (point.lat - start.lat) * my
  const dx = (end.lng - start.lng) * mx
  const dy = (end.lat - start.lat) * my
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(x0, y0)
  const t = Math.max(0, Math.min(1, (x0 * dx + y0 * dy) / len2))
  return Math.hypot(x0 - t * dx, y0 - t * dy)
}

/** Distance to a coarse polyline with a generous segment pad (not the 2 km evidence pad). */
export function distanceToPolylineKm(
  point: LatLngPoint,
  poly: LatLngPoint[],
  padKm = ROAD_MATCH_THRESHOLD_KM + 5,
): number {
  if (poly.length < 2) return Number.POSITIVE_INFINITY
  let minM = Infinity
  const padLat = padKm / 111.32
  const padLng = padKm / (111.32 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)))
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i]
    const b = poly[i + 1]
    if (
      point.lat < Math.min(a.lat, b.lat) - padLat
      || point.lat > Math.max(a.lat, b.lat) + padLat
      || point.lng < Math.min(a.lng, b.lng) - padLng
      || point.lng > Math.max(a.lng, b.lng) + padLng
    ) continue
    const dist = perpendicularDistanceM(point, a, b)
    if (dist < minM) minM = dist
  }
  return minM === Infinity ? Number.POSITIVE_INFINITY : minM / 1000
}

function toLatLng(points: Array<[number, number]>): LatLngPoint[] {
  return points.map(([lat, lng]) => ({ lat, lng }))
}

function bboxesOverlap(
  a: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  b: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): boolean {
  return !(a.maxLat < b.minLat || a.minLat > b.maxLat || a.maxLng < b.minLng || a.minLng > b.maxLng)
}

export function scoreRouteAgainstRoad(
  routePoints: LatLngPoint[],
  road: RoadVector,
  thresholdKm = ROAD_MATCH_THRESHOLD_KM,
): RoadMatchScore | null {
  if (routePoints.length < 2 || road.points.length < 2) return null
  const poly = toLatLng(road.points)
  const roadBbox = bboxFromPoints(poly, thresholdKm + 5)
  const routeBbox = bboxFromPoints(routePoints, 0)
  if (!bboxesOverlap(routeBbox, roadBbox)) return null

  let near = 0
  let run = 0
  let bestRun = 0
  const distances: number[] = []
  for (const point of routePoints) {
    const dist = distanceToPolylineKm(point, poly, thresholdKm + 5)
    const finite = Number.isFinite(dist) ? dist : Number.POSITIVE_INFINITY
    distances.push(finite)
    if (finite <= thresholdKm) {
      near += 1
      run += 1
      if (run > bestRun) bestRun = run
    } else {
      run = 0
    }
  }

  const coverage = near / routePoints.length
  if (coverage < 0.08) return null
  const sorted = [...distances].sort((a, b) => a - b)
  const medianKm = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY
  return {
    road: road.name.toUpperCase(),
    coverage,
    contig: bestRun / routePoints.length,
    medianKm,
  }
}

/**
 * Detect Autobahn corridors from GPX geometry alone by matching the track
 * against coarse reference polylines. Returns [] when nothing is confident —
 * callers must not invent a fallback motorway.
 */
export function determineAffectedRoads(
  points: LatLngPoint[],
  roads: RoadVector[] = roadVectors,
): string[] {
  if (points.length < 2) return []

  const scores: RoadMatchScore[] = []
  for (const road of roads) {
    const scored = scoreRouteAgainstRoad(points, road)
    if (scored) scores.push(scored)
  }
  if (!scores.length) return []

  scores.sort((a, b) => b.coverage - a.coverage || a.medianKm - b.medianKm)
  const best = scores[0]
  if (best.coverage < ROAD_MATCH_MIN_COVERAGE) return []

  const nearBest = scores.filter(
    score =>
      score.coverage >= best.coverage * ROAD_MATCH_RELATIVE_COVERAGE
      && score.medianKm <= best.medianKm + ROAD_MATCH_MEDIAN_SLACK_KM,
  )
  const bestMedian = Math.min(...nearBest.map(score => score.medianKm))
  return nearBest
    .filter(score => score.medianKm <= bestMedian + 2.5)
    .map(score => score.road)
}
