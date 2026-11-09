export type LatLng = [number, number]

export type RouteBounds = {
  west: number
  south: number
  east: number
  north: number
}

/** Coordinates are stored as [lat, lng]. */
export function routeBounds(coordinates: LatLng[] | undefined | null): RouteBounds | null {
  if (!coordinates || coordinates.length < 2) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const pair of coordinates) {
    if (!pair || pair.length < 2) continue
    const lat = Number(pair[0])
    const lng = Number(pair[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }
  if (!Number.isFinite(minLat) || (minLat === maxLat && minLng === maxLng)) return null
  return { west: minLng, south: minLat, east: maxLng, north: maxLat }
}

export function boundsFromEvidence(
  evidence: Array<{ lat?: number | null; lng?: number | null }>,
): RouteBounds | null {
  const points: LatLng[] = []
  for (const item of evidence) {
    if (item.lat == null || item.lng == null) continue
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue
    points.push([item.lat, item.lng])
  }
  return routeBounds(points)
}
