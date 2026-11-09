export const GPX_MAX_BYTES = 5 * 1024 * 1024
export const GPX_MAX_POINTS = 5000

export const GPX_FRIENDLY_INVALID =
  "This file isn't a valid GPX route. Export the route from VEMAGS as GPX and try again."
export const GPX_FRIENDLY_EMPTY =
  "This GPX doesn't contain a usable route (need at least two points). Export the route from VEMAGS as GPX and try again."
export const GPX_FRIENDLY_TOO_LARGE =
  'This file is larger than 5 MB. Export a smaller GPX from VEMAGS and try again.'

export type GpxPoint = {
  lat: number
  lng: number
  ele?: number
  name?: string
}

export type GpxParseResult = {
  points: GpxPoint[]
  source: 'trkpt' | 'rtept' | 'wpt'
  creator: string
  vemags: boolean
  downsampled: boolean
  originalCount: number
}

export class GpxParseError extends Error {
  technical: string
  constructor(message: string, technical: string) {
    super(message)
    this.name = 'GpxParseError'
    this.technical = technical
  }
}

function attr(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match?.[1] ?? ''
}

function collectPoints(xml: string, tag: string): GpxPoint[] {
  const points: GpxPoint[] = []
  const re = new RegExp(`<${tag}\\b([^>]*)`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) {
    const open = match[1] || ''
    const lat = Number(attr(open, 'lat'))
    const lng = Number(attr(open, 'lon') || attr(open, 'long'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const window = xml.slice(match.index, match.index + 180)
    const eleMatch = window.match(/<ele>\s*([^<]+)\s*<\/ele>/i)
    const nameMatch = window.match(/<name>\s*([^<]+)\s*<\/name>/i)
    points.push({
      lat,
      lng,
      ele: eleMatch ? Number(eleMatch[1]) : undefined,
      name: nameMatch?.[1]?.trim() || undefined,
    })
  }
  return points
}

function perpendicularDistance(point: GpxPoint, start: GpxPoint, end: GpxPoint): number {
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.lng - start.lng, point.lat - start.lat)
  }
  const t = Math.max(0, Math.min(1, ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(point.lng - (start.lng + t * dx), point.lat - (start.lat + t * dy))
}

function douglasPeucker(points: GpxPoint[], epsilon: number): GpxPoint[] {
  if (points.length <= 2) return points
  let maxDist = 0
  let index = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end])
    if (dist > maxDist) {
      index = i
      maxDist = dist
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon)
    const right = douglasPeucker(points.slice(index), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [points[0], points[end]]
}

export function downsampleGpxPoints(points: GpxPoint[], maxPoints = GPX_MAX_POINTS): GpxPoint[] {
  if (points.length <= maxPoints) return points
  // Uniform first so 80k-point tracks never spend 30s in recursive DP.
  const uniform: GpxPoint[] = []
  const last = maxPoints - 1
  for (let i = 0; i <= last; i++) {
    const next = points[Math.round((i * (points.length - 1)) / last)]
    const prev = uniform[uniform.length - 1]
    if (!prev || prev.lat !== next.lat || prev.lng !== next.lng) uniform.push(next)
  }
  if (uniform.length <= 2 || uniform.length <= maxPoints) return uniform
  let epsilon = 0.00004
  let simplified = douglasPeucker(uniform, epsilon)
  while (simplified.length > maxPoints && epsilon < 2) {
    epsilon *= 1.7
    simplified = douglasPeucker(uniform, epsilon)
  }
  return simplified.length >= 2 && simplified.length <= maxPoints ? simplified : uniform
}

export function parseGpxDocument(xml: string, opts?: { maxBytes?: number; downsample?: boolean }): GpxParseResult {
  const maxBytes = opts?.maxBytes ?? GPX_MAX_BYTES
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new GpxParseError(GPX_FRIENDLY_INVALID, 'File is empty.')
  }
  const bytes = typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function'
    ? Buffer.byteLength(xml, 'utf8')
    : new TextEncoder().encode(xml).length
  if (bytes > maxBytes) {
    throw new GpxParseError(GPX_FRIENDLY_TOO_LARGE, `Payload is ${bytes} bytes; limit is ${maxBytes}.`)
  }

  const creator = attr(xml.match(/<gpx\b[^>]*>/i)?.[0] || '', 'creator')
  const vemags = /vemags/i.test(creator) || /vemags/i.test(xml.slice(0, 800))

  if (!/<gpx\b/i.test(xml) || !/<\/gpx>/i.test(xml)) {
    throw new GpxParseError(GPX_FRIENDLY_INVALID, 'Root <gpx> element missing.')
  }

  const trackPoints = collectPoints(xml, 'trkpt')
  const routePoints = trackPoints.length >= 2 ? [] : collectPoints(xml, 'rtept')
  const wayPoints = trackPoints.length >= 2 || routePoints.length >= 2 ? [] : collectPoints(xml, 'wpt')
  const source: GpxParseResult['source'] = trackPoints.length >= 2 ? 'trkpt' : routePoints.length >= 2 ? 'rtept' : 'wpt'
  const raw = source === 'trkpt' ? trackPoints : source === 'rtept' ? routePoints : wayPoints

  if (raw.length < 2) {
    throw new GpxParseError(
      GPX_FRIENDLY_EMPTY,
      `Found ${trackPoints.length} trkpt, ${collectPoints(xml, 'rtept').length} rtept, ${collectPoints(xml, 'wpt').length} wpt.`,
    )
  }

  const shouldDownsample = opts?.downsample !== false && raw.length > GPX_MAX_POINTS
  const points = shouldDownsample ? downsampleGpxPoints(raw) : raw
  return { points, source, creator, vemags, downsampled: shouldDownsample, originalCount: raw.length }
}

export function serializeGpxTrack(points: GpxPoint[], creator = 'HTR simplified'): string {
  const body = points.map(point => {
    const name = point.name ? `<name>${point.name}</name>` : ''
    const ele = Number.isFinite(point.ele) ? `<ele>${point.ele}</ele>` : ''
    return `<trkpt lat="${point.lat}" lon="${point.lng}">${ele}${name}</trkpt>`
  }).join('')
  const safeCreator = String(creator || 'HTR simplified').replace(/[<>"]/g, '')
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="${safeCreator}"><trk><trkseg>${body}</trkseg></trk></gpx>`
}

export function validateGpxFileSize(bytes: number) {
  if (bytes > GPX_MAX_BYTES) {
    throw new GpxParseError(GPX_FRIENDLY_TOO_LARGE, `File is ${bytes} bytes; limit is ${GPX_MAX_BYTES}.`)
  }
}
