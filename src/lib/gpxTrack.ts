export type LatLng = [number, number]

const trackCache = new Map<string, Promise<LatLng[]>>()

export function parseGpxTrack(xml: string): LatLng[] {
  const points: LatLng[] = []
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) {
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng])
  }
  return points
}

export function downsampleTrack(points: LatLng[], maxPoints = 240): LatLng[] {
  if (points.length <= maxPoints) return points
  const out: LatLng[] = []
  const last = maxPoints - 1
  for (let i = 0; i <= last; i++) {
    const next = points[Math.round((i * (points.length - 1)) / last)]
    const prev = out[out.length - 1]
    if (!prev || prev[0] !== next[0] || prev[1] !== next[1]) out.push(next)
  }
  return out
}

export function loadGpxTrack(url: string): Promise<LatLng[]> {
  let pending = trackCache.get(url)
  if (!pending) {
    pending = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Failed to load ${url}`)
      return parseGpxTrack(await response.text())
    })
    trackCache.set(url, pending)
  }
  return pending
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ))
}
