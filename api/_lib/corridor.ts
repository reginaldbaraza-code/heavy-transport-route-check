export type LatLngPoint = { lat: number; lng: number }

export const GPX_DRAW_MAX_POINTS = 2000
export const CORRIDOR_MATCH_MAX_POINTS = 400
export const CORRIDOR_DP_TOLERANCE_M = 50
export const CORRIDOR_PAD_KM = 2

export type RouteBbox = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type CorridorSegment = {
  lat1: number
  lng1: number
  lat2: number
  lng2: number
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type CorridorIndex = {
  points: LatLngPoint[]
  segments: CorridorSegment[]
  bbox: RouteBbox
}

const M_PER_DEG_LAT = 111_320

function mPerDegLng(lat: number) {
  return M_PER_DEG_LAT * Math.max(0.2, Math.cos((lat * Math.PI) / 180))
}

function padBbox(bbox: RouteBbox, padKm: number): RouteBbox {
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  const dLat = padKm / 111.32
  const dLng = padKm / (111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)))
  return {
    minLat: bbox.minLat - dLat,
    maxLat: bbox.maxLat + dLat,
    minLng: bbox.minLng - dLng,
    maxLng: bbox.maxLng + dLng,
  }
}

export function bboxFromPoints(points: LatLngPoint[], padKm = 0): RouteBbox {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
    if (point.lng < minLng) minLng = point.lng
    if (point.lng > maxLng) maxLng = point.lng
  }
  const bbox = { minLat, maxLat, minLng, maxLng }
  return padKm > 0 ? padBbox(bbox, padKm) : bbox
}

export function inBbox(lat: number, lng: number, bbox: RouteBbox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng
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

export function douglasPeuckerMeters(points: LatLngPoint[], toleranceM: number): LatLngPoint[] {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop() as [number, number]
    let maxDist = 0
    let index = start
    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistanceM(points[i], points[start], points[end])
      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }
    if (maxDist > toleranceM) {
      keep[index] = 1
      if (index - start > 1) stack.push([start, index])
      if (end - index > 1) stack.push([index, end])
    }
  }
  return points.filter((_, i) => keep[i])
}

export function uniformDownsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points
  const out: T[] = []
  const last = maxPoints - 1
  for (let i = 0; i <= last; i++) {
    const next = points[Math.round((i * (points.length - 1)) / last)]
    const prev = out[out.length - 1]
    if (prev !== next) out.push(next)
  }
  return out.length >= 2 ? out : [points[0], points[points.length - 1]]
}

export function simplifyForCorridor(
  points: LatLngPoint[],
  maxPoints = CORRIDOR_MATCH_MAX_POINTS,
  toleranceM = CORRIDOR_DP_TOLERANCE_M,
): LatLngPoint[] {
  if (points.length <= maxPoints) return points
  const simplified = douglasPeuckerMeters(points, toleranceM)
  if (simplified.length <= maxPoints) return simplified
  return uniformDownsample(simplified, maxPoints)
}

export function pathLengthKm(points: LatLngPoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const s = Math.sin(dLat / 2) ** 2
      + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
    total += 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)))
  }
  return total
}

export function buildCorridorIndex(points: LatLngPoint[], padKm = CORRIDOR_PAD_KM): CorridorIndex {
  const segments: CorridorSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    segments.push({
      lat1: a.lat,
      lng1: a.lng,
      lat2: b.lat,
      lng2: b.lng,
      minLat: Math.min(a.lat, b.lat),
      maxLat: Math.max(a.lat, b.lat),
      minLng: Math.min(a.lng, b.lng),
      maxLng: Math.max(a.lng, b.lng),
    })
  }
  return {
    points,
    segments,
    bbox: bboxFromPoints(points, padKm),
  }
}

export function distanceToCorridorKm(index: CorridorIndex, lat: number, lng: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || index.segments.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (!inBbox(lat, lng, index.bbox)) return Number.POSITIVE_INFINITY
  let minM = Infinity
  const padDegLat = CORRIDOR_PAD_KM / 111.32
  const padDegLng = CORRIDOR_PAD_KM / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  for (const segment of index.segments) {
    if (
      lat < segment.minLat - padDegLat
      || lat > segment.maxLat + padDegLat
      || lng < segment.minLng - padDegLng
      || lng > segment.maxLng + padDegLng
    ) continue
    const dist = perpendicularDistanceM({ lat, lng }, { lat: segment.lat1, lng: segment.lng1 }, { lat: segment.lat2, lng: segment.lng2 })
    if (dist < minM) minM = dist
  }
  return minM === Infinity ? Number.POSITIVE_INFINITY : minM / 1000
}

export function prepareRouteGeometry(points: LatLngPoint[]) {
  const drawPoints = uniformDownsample(points, GPX_DRAW_MAX_POINTS)
  const matchPoints = simplifyForCorridor(points)
  const corridor = buildCorridorIndex(matchPoints)
  return {
    drawPoints,
    matchPoints,
    corridor,
    distanceKm: Math.round(pathLengthKm(drawPoints.length >= 2 ? drawPoints : matchPoints)),
  }
}
