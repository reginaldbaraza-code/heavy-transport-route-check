import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import * as turf from '@turf/turf'
import {
  BW_CACHE_MS,
  BW_SOURCE,
  MIA_SOURCE,
  MIA_STALE_MS,
  MOBIDATA_FEEDS,
  MOBIDATA_USER_AGENT,
} from './mobidata.js'

export type VehicleDimensions = {
  width: number
  height: number
  length: number
  grossWeight: number
}

export type MiaItem = {
  id: string
  term: 'short' | 'long'
  type: string
  road: string
  lat: number
  lng: number
  start: string | null
  end: string | null
  description: string
  residualWidth?: number
  minLaneWidth?: number
  height?: number
  weight?: number
  lanesRestricted?: number
  originalLanes?: number
  maintenance?: string
  management?: string
}

export type MiaSnapshot = {
  snapshotAt: string
  publicationTime?: { short?: string | null; long?: string | null }
  source: string
  license: string
  attribution: string
  counts?: { kept?: number }
  items: MiaItem[]
}

export type BwRoadwork = {
  id: string
  type: string
  subtype: string
  description: string
  street: string
  start: string | null
  end: string | null
  lat: number
  lng: number
  coordinates: [number, number][]
  retrievedAt: string
}

export type DimConflict = {
  exceeds: boolean
  type?: string
  restriction?: number
}

type BwCache = { at: number; items: BwRoadwork[]; retrievedAt: string }
let bwCache: BwCache | null = null
let miaCache: MiaSnapshot | null | undefined

function parseTime(value?: string | null): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

export function isExpired(end?: string | null, now = Date.now()) {
  const at = parseTime(end)
  return Boolean(at && at < now)
}

function flattenCoords(geometry: { type?: string; coordinates?: unknown } | null | undefined): [number, number][] {
  if (!geometry?.coordinates) return []
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[]
    return Number.isFinite(lat) && Number.isFinite(lng) ? [[lng, lat]] : []
  }
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as number[][]).filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1])) as [number, number][]
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as number[][][]).flat().filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1])) as [number, number][]
  }
  return []
}

function sampleCoords(coords: [number, number][], max = 8): [number, number][] {
  if (coords.length <= max) return coords
  const step = Math.max(1, Math.floor((coords.length - 1) / (max - 1)))
  const out: [number, number][] = []
  for (let i = 0; i < coords.length; i += step) out.push(coords[i])
  const last = coords[coords.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

export async function fetchBwRoadworks(retrievedAt: string, now = Date.now()): Promise<BwRoadwork[]> {
  if (bwCache && now - bwCache.at < BW_CACHE_MS) return bwCache.items
  const response = await fetch(MOBIDATA_FEEDS.bwGeojson, {
    headers: { 'User-Agent': MOBIDATA_USER_AGENT, Accept: 'application/geo+json, application/json' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`BEMaS GeoJSON HTTP ${response.status}`)
  const data = await response.json() as { features?: Array<{ geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, string> }> }
  const items: BwRoadwork[] = []
  for (const feature of data.features || []) {
    const props = feature.properties || {}
    if (isExpired(props.endtime, now)) continue
    const coordinates = flattenCoords(feature.geometry)
    if (!coordinates.length) continue
    const mid = coordinates[Math.floor(coordinates.length / 2)]
    items.push({
      id: props.id || `bw-${items.length}`,
      type: props.type || 'CONSTRUCTION',
      subtype: props.subtype || '',
      description: props.description || props.street || 'Roadworks',
      street: props.street || '',
      start: props.starttime || null,
      end: props.endtime || null,
      lat: mid[1],
      lng: mid[0],
      coordinates: sampleCoords(coordinates),
      retrievedAt,
    })
  }
  bwCache = { at: now, items, retrievedAt }
  return items
}

function snapshotCandidates(): string[] {
  return [
    join(process.cwd(), 'public/data/mia-roadworks.json'),
    join(process.cwd(), 'data/mia-roadworks.json'),
    join(process.cwd(), 'api/_data/mia-roadworks.json'),
  ]
}

export function loadMiaSnapshot(): MiaSnapshot | null {
  if (miaCache !== undefined) return miaCache
  for (const file of snapshotCandidates()) {
    if (!existsSync(file)) continue
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as MiaSnapshot
      if (parsed && Array.isArray(parsed.items)) {
        miaCache = parsed
        return parsed
      }
    } catch (error) {
      console.error('Failed to read MIA snapshot', file, error)
    }
  }
  miaCache = null
  return null
}

export function miaSnapshotAgeMs(snapshot: MiaSnapshot, now = Date.now()) {
  const at = parseTime(snapshot.snapshotAt)
  return at ? now - at : Number.POSITIVE_INFINITY
}

export function miaSnapshotIsStale(snapshot: MiaSnapshot, now = Date.now()) {
  return miaSnapshotAgeMs(snapshot, now) > MIA_STALE_MS
}

export function corridorBbox(corridor: Feature<Polygon | MultiPolygon>) {
  return turf.bbox(corridor)
}

export function pointInCorridor(
  corridor: Feature<Polygon | MultiPolygon>,
  lat: number,
  lng: number,
  bbox?: number[],
) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (bbox && (lng < bbox[0] || lat < bbox[1] || lng > bbox[2] || lat > bbox[3])) return false
  return turf.booleanPointInPolygon(turf.point([lng, lat]), corridor)
}

export function sampledLineHitsCorridor(
  corridor: Feature<Polygon | MultiPolygon>,
  coords: [number, number][],
  bbox?: number[],
) {
  for (const [lng, lat] of coords) {
    if (pointInCorridor(corridor, lat, lng, bbox)) return true
  }
  return false
}

export function dimConflictFromMia(item: MiaItem, vehicle: VehicleDimensions): DimConflict {
  if (item.management === 'roadClosed' || item.management === 'carriagewayClosures' || item.management === 'carriagewayClosed') {
    return { exceeds: true, type: 'full closure' }
  }
  if (item.originalLanes && item.lanesRestricted && item.lanesRestricted >= item.originalLanes) {
    return { exceeds: true, type: 'full closure' }
  }
  if (item.residualWidth && vehicle.width > item.residualWidth) {
    return { exceeds: true, type: 'width', restriction: item.residualWidth }
  }
  if (item.minLaneWidth && vehicle.width > item.minLaneWidth) {
    return { exceeds: true, type: 'width', restriction: item.minLaneWidth }
  }
  if (item.height && vehicle.height > item.height) {
    return { exceeds: true, type: 'height', restriction: item.height }
  }
  if (item.weight && vehicle.grossWeight > item.weight) {
    return { exceeds: true, type: 'weight', restriction: item.weight }
  }
  return { exceeds: false }
}

export function dimConflictFromBw(item: BwRoadwork, _vehicle: VehicleDimensions): DimConflict {
  if (item.type === 'ROAD_CLOSED' || /ROAD_CLOSED/i.test(item.subtype || '')) {
    return { exceeds: true, type: 'full closure' }
  }
  return { exceeds: false }
}

export function isLocationDuplicate(
  lat: number,
  lng: number,
  existing: Array<{ id?: string; lat?: number; lng?: number }>,
  id?: string,
  maxKm = 0.25,
) {
  for (const item of existing) {
    if (id && item.id && (item.id === id || item.id.includes(id) || id.includes(item.id))) return true
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue
    const km = turf.distance([lng, lat], [item.lng as number, item.lat as number], { units: 'kilometers' })
    if (km <= maxKm) return true
  }
  return false
}

export function miaItemsOnCorridor(snapshot: MiaSnapshot, corridor: Feature<Polygon | MultiPolygon>, now = Date.now()) {
  const bbox = corridorBbox(corridor)
  return snapshot.items.filter(item => !isExpired(item.end, now) && pointInCorridor(corridor, item.lat, item.lng, bbox))
}

export { BW_SOURCE, MIA_SOURCE, MOBIDATA_FEEDS, MOBIDATA_USER_AGENT }
