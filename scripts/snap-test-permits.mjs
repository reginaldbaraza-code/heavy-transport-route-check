import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/**
 * Origin/dest from the pre-snap GPX. Vias must sit on the named Autobahn
 * carriageway — never on scenario fixtures, exits, rest areas, or junction loops.
 */
const ROUTES = [
  {
    file: 'hof-bayreuth-a9.gpx',
    origin: { lat: 50.317, lng: 11.877 },
    dest: { lat: 49.946, lng: 11.578 },
    vias: [],
  },
  {
    file: 'duisburg-koln-a3.gpx',
    origin: { lat: 51.4344, lng: 6.7623 },
    dest: { lat: 50.9419, lng: 6.9603 },
    vias: [],
  },
  {
    file: 'bremen-dortmund-a1.gpx',
    origin: { lat: 53.0793, lng: 8.8017 },
    dest: { lat: 51.5136, lng: 7.4653 },
    vias: [],
  },
  {
    file: 'lubeck-rostock-a20.gpx',
    origin: { lat: 53.821, lng: 10.639 },
    dest: { lat: 54.078, lng: 12.125 },
    vias: [],
  },
  {
    file: 'leipzig-nurnberg-a9.gpx',
    origin: { lat: 51.3397, lng: 12.3731 },
    dest: { lat: 49.4522, lng: 11.0767 },
    vias: [],
  },
  {
    file: 'hamburg-hannover-a7.gpx',
    origin: { lat: 53.5511, lng: 9.9937 },
    dest: { lat: 52.3737, lng: 9.7381 },
    vias: [],
  },
  {
    file: 'munchen-stuttgart-a8.gpx',
    origin: { lat: 48.1351, lng: 11.582 },
    dest: { lat: 48.7758, lng: 9.1829 },
    vias: [],
  },
]

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function bearingDeg(a, b) {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLon = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function angDiff(a, b) {
  const d = Math.abs(a - b) % 360
  return d <= 180 ? d : 360 - d
}

function destinationPoint(p, bearing, distKm) {
  const R = 6371
  const δ = distKm / R
  const θ = (bearing * Math.PI) / 180
  const φ1 = (p.lat * Math.PI) / 180
  const λ1 = (p.lng * Math.PI) / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 }
}

function parseGpx(xml) {
  const meta = {
    name: xml.match(/<metadata>[\s\S]*?<name>([^<]*)<\/name>/)?.[1] || '',
    desc: xml.match(/<metadata>[\s\S]*?<desc>([^<]*)<\/desc>/)?.[1]?.replace(/ Track pre-snapped[\s\S]*$/, '') || '',
    time: xml.match(/<metadata>[\s\S]*?<time>([^<]*)<\/time>/)?.[1] || '',
    trkName: xml.match(/<trk>\s*<name>([^<]*)<\/name>/)?.[1] || '',
  }
  const points = []
  const re = /<trkpt lat="([^"]+)" lon="([^"]+)">([\s\S]*?)<\/trkpt>/g
  let m
  while ((m = re.exec(xml))) {
    const name = m[3].match(/<name>([^<]*)<\/name>/)?.[1]
    const ele = m[3].match(/<ele>([^<]*)<\/ele>/)?.[1]
    points.push({
      lat: Number(m[1]),
      lng: Number(m[2]),
      name,
      ele: ele ? Number(ele) : undefined,
    })
  }
  return { meta, points }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function writeGpx(meta, origin, dest, points) {
  const rows = points.map((p, i) => {
    const name = i === 0 ? origin.name : i === points.length - 1 ? dest.name : null
    const nameXml = name ? `\n      <name>${escapeXml(name)}</name>` : ''
    const eleXml = Number.isFinite(p.ele) ? `\n      <ele>${p.ele}</ele>` : ''
    return `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">${eleXml}${nameXml}\n    </trkpt>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VEMAGS Route Export" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(meta.name)}</name>
    <desc>${escapeXml(meta.desc)} Track pre-snapped to OSM roads via OSRM (© OpenStreetMap contributors, ODbL).</desc>
    <time>${escapeXml(meta.time)}</time>
    <copyright author="OpenStreetMap contributors">
      <license>https://opendatacommons.org/licenses/odbl/</license>
    </copyright>
  </metadata>
  <trk>
    <name>${escapeXml(meta.trkName)}</name>
    <trkseg>
${rows.join('\n')}
    </trkseg>
  </trk>
</gpx>
`
}

function trackDistanceKm(points) {
  let d = 0
  for (let i = 1; i < points.length; i++) d += haversineKm(points[i - 1], points[i])
  return d
}

function perpendicularDistanceKm(p, a, b) {
  const ab = haversineKm(a, b)
  if (ab < 1e-6) return haversineKm(p, a)
  const ap = haversineKm(a, p)
  const bp = haversineKm(b, p)
  const s = (ab + ap + bp) / 2
  const area2 = Math.max(0, s * (s - ab) * (s - ap) * (s - bp))
  return (2 * Math.sqrt(area2)) / ab
}

function douglasPeucker(points, tolKm) {
  if (points.length <= 2) return points
  let maxD = -1
  let idx = -1
  const a = points[0]
  const b = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistanceKm(points[i], a, b)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > tolKm) {
    const left = douglasPeucker(points.slice(0, idx + 1), tolKm)
    const right = douglasPeucker(points.slice(idx), tolKm)
    return left.slice(0, -1).concat(right)
  }
  return [a, b]
}

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
}

function densify(points, minCount, maxGapKm) {
  let pts = points.slice()
  let changed = true
  while (changed) {
    changed = false
    const next = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const gap = haversineKm(pts[i - 1], pts[i])
      if (gap > maxGapKm) {
        const n = Math.ceil(gap / maxGapKm)
        for (let k = 1; k < n; k++) next.push(interpolate(pts[i - 1], pts[i], k / n))
        changed = true
      }
      next.push(pts[i])
    }
    pts = next
  }
  while (pts.length < minCount) {
    let longest = 0
    let at = 1
    for (let i = 1; i < pts.length; i++) {
      const g = haversineKm(pts[i - 1], pts[i])
      if (g > longest) {
        longest = g
        at = i
      }
    }
    pts.splice(at, 0, interpolate(pts[at - 1], pts[at], 0.5))
  }
  return pts
}

/** Drop leave-and-rejoin loops (rest area / junction) where the path returns to itself. */
function cutRejoinLoops(points, joinKm = 0.08, minDetourKm = 0.5) {
  const out = [points[0]]
  let i = 0
  while (i < points.length - 1) {
    let cutTo = -1
    let path = 0
    const limit = Math.min(points.length - 1, i + 80)
    for (let j = i + 1; j <= limit; j++) {
      path += haversineKm(points[j - 1], points[j])
      if (path > 8) break
      if (j > i + 6 && haversineKm(points[i], points[j]) < joinKm && path > minDetourKm) {
        cutTo = j
      }
    }
    if (cutTo > 0) i = cutTo
    else i += 1
    out.push(points[i])
  }
  return out
}

/** Drop a sharp vertex left by Douglas–Peucker so a smooth ramp is not a 120° kink. */
function softenReversals(points, minDeg = 120, endExemptKm = 2) {
  let pts = points.slice()
  for (let pass = 0; pass < 12; pass++) {
    const hits = headingReversals(pts, minDeg, endExemptKm)
    if (!hits.length) return pts
    for (const h of [...hits].reverse()) {
      const corner = h.i - 1
      if (corner <= 0 || corner >= pts.length - 1) continue
      const gap = haversineKm(pts[corner - 1], pts[corner + 1])
      if (gap > 1.9) continue
      pts.splice(corner, 1)
    }
  }
  return pts
}

function headingReversals(points, minDeg = 120, endExemptKm = 2) {
  const total = trackDistanceKm(points)
  const hits = []
  let along = 0
  for (let i = 2; i < points.length; i++) {
    along += haversineKm(points[i - 2], points[i - 1])
    const delta = angDiff(bearingDeg(points[i - 2], points[i - 1]), bearingDeg(points[i - 1], points[i]))
    const fromEnd = total - along
    if (delta > minDeg && along > endExemptKm && fromEnd > endExemptKm) {
      hits.push({ i, delta, lat: points[i].lat, lng: points[i].lng, along, fromEnd })
    }
  }
  return hits
}

function nearestOnTrack(p, points) {
  let best = { dist: Infinity, lat: points[0].lat, lng: points[0].lng, index: 0 }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const abLat = b.lat - a.lat
    const abLng = b.lng - a.lng
    const len2 = abLat * abLat + abLng * abLng
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.lat - a.lat) * abLat + (p.lng - a.lng) * abLng) / len2))
    const q = { lat: a.lat + t * abLat, lng: a.lng + t * abLng }
    const dist = haversineKm(p, q)
    if (dist < best.dist) best = { dist, lat: q.lat, lng: q.lng, index: i }
  }
  return best
}

function offsetFromLine(points, seed, distKm, toward) {
  const n = nearestOnTrack(seed, points)
  const a = points[n.index]
  const b = points[Math.min(points.length - 1, n.index + 1)]
  const heading = bearingDeg(a, b)
  const left = destinationPoint({ lat: n.lat, lng: n.lng }, heading - 90, distKm)
  const right = destinationPoint({ lat: n.lat, lng: n.lng }, heading + 90, distKm)
  const pick = toward
    ? haversineKm(left, toward) <= haversineKm(right, toward)
      ? left
      : right
    : left
  const dist = nearestOnTrack(pick, points).dist
  return { ...pick, dist, onLine: { lat: n.lat, lng: n.lng } }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function osrmRoute(waypoints) {
  const coords = waypoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson&continue_straight=true`
  let last
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'htr-test-permit-snap/1.0' } })
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`OSRM ${res.status}`)
        await sleep(1500 * 2 ** i)
        continue
      }
      if (!res.ok) throw new Error(`OSRM ${res.status} ${await res.text()}`)
      const data = await res.json()
      if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
        throw new Error(`OSRM ${data.code || 'empty'}: ${data.message || ''}`)
      }
      return {
        points: data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        km: data.routes[0].distance / 1000,
      }
    } catch (err) {
      last = err
      await sleep(1500 * 2 ** i)
    }
  }
  throw last
}

async function snapOne(spec) {
  const path = join(root, 'public/test-permits', spec.file)
  const xml = readFileSync(path, 'utf8')
  const { meta, points } = parseGpx(xml)
  const origin = { ...spec.origin, name: points[0]?.name, ele: points[0]?.ele }
  const dest = { ...spec.dest, name: points[points.length - 1]?.name, ele: points[points.length - 1]?.ele }
  const waypoints = [spec.origin, ...spec.vias, spec.dest]
  console.log(`${spec.file}: ${waypoints.length} OSRM waypoints (vias=${spec.vias.length})`)
  const routed = await osrmRoute(waypoints)
  const cut = cutRejoinLoops(routed.points)
  const simplified = softenReversals(douglasPeucker(cut, 0.02), 100, 2)
  const dense = densify(simplified, 200, 2)
  dense[0] = { ...dense[0], name: origin.name, ele: origin.ele }
  dense[dense.length - 1] = { ...dense[dense.length - 1], name: dest.name, ele: dest.ele }
  const km = trackDistanceKm(dense)
  const gaps = dense.slice(1).map((p, i) => haversineKm(dense[i], p))
  const maxGap = Math.max(...gaps)
  const reversals = headingReversals(dense, 120, 2)
  console.log(
    `  OSRM ${routed.km.toFixed(1)} km → ${dense.length} pts, ${km.toFixed(1)} km, max gap ${(maxGap * 1000).toFixed(0)} m, reversals>120° ${reversals.length}`,
  )
  if (reversals.length) {
    for (const h of reversals) {
      console.log(`    pt ${h.i} Δ${h.delta.toFixed(0)}° at ${h.lat.toFixed(5)},${h.lng.toFixed(5)} along=${h.along.toFixed(1)}`)
    }
    throw new Error(`${spec.file} still has heading reversals over 120° away from the ends`)
  }
  writeFileSync(path, writeGpx(meta, origin, dest, dense))
  return { file: spec.file, count: dense.length, km, maxGap, points: dense }
}

const results = []
for (const spec of ROUTES) {
  results.push(await snapOne(spec))
  await sleep(300)
}

const byFile = Object.fromEntries(results.map(r => [r.file, r.points]))
const a7 = byFile['hamburg-hannover-a7.gpx']
const a3 = byFile['duisburg-koln-a3.gpx']
const a8 = byFile['munchen-stuttgart-a8.gpx']
const a1 = byFile['bremen-dortmund-a1.gpx']

const a7Hold = offsetFromLine(a7, { lat: 52.85, lng: 9.75 }, 0.04, { lat: 52.85, lng: 9.75 })
const a7Ramp = offsetFromLine(a7, { lat: 52.85, lng: 9.75 }, 0.9, { lat: 52.85, lng: 9.76 })
const a3Width = offsetFromLine(a3, { lat: 51.05, lng: 6.95 }, 0.04)
const a8Height = offsetFromLine(a8, { lat: 48.4, lng: 10.25 }, 0.04)
const a1Weight = offsetFromLine(a1, { lat: 52.20185, lng: 7.81021 }, 0.04)

console.log('\nPlace scenario fixtures on the clean line (do not re-route through them):')
for (const row of [
  ['A7 HOLD', a7Hold],
  ['A7 VERIFY ramp', a7Ramp],
  ['A3 width', a3Width],
  ['A8 height', a8Height],
  ['A1 weight', a1Weight],
]) {
  const [name, p] = row
  console.log(`  ${name}: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}  (${p.dist.toFixed(3)} km from line)`)
}

console.log(
  JSON.stringify(
    results.map(({ file, count, km, maxGap }) => ({ file, count, km: +km.toFixed(1), maxGap: +maxGap.toFixed(3) })),
    null,
    2,
  ),
)
