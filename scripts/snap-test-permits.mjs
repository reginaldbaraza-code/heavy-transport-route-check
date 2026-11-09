import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** Origin, dest, and only the Autobahn vias that keep the named motorway without a long detour. */
const ROUTES = [
  {
    file: 'hof-bayreuth-a9.gpx',
    vias: [],
  },
  {
    file: 'duisburg-koln-a3.gpx',
    vias: [{ lat: 51.05, lng: 6.95 }],
  },
  {
    file: 'bremen-dortmund-a1.gpx',
    vias: [{ lat: 52.27, lng: 7.92 }],
  },
  {
    file: 'lubeck-rostock-a20.gpx',
    vias: [{ lat: 53.89, lng: 11.5 }],
  },
  {
    file: 'leipzig-nurnberg-a9.gpx',
    vias: [
      { lat: 50.317, lng: 11.877 },
      { lat: 49.946, lng: 11.578 },
    ],
  },
  {
    file: 'hamburg-hannover-a7.gpx',
    vias: [{ lat: 52.85, lng: 9.75 }],
  },
  {
    file: 'munchen-stuttgart-a8.gpx',
    vias: [{ lat: 48.4, lng: 10.25 }],
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function osrmRoute(waypoints) {
  const coords = waypoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`
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
  const origin = points[0]
  const dest = points[points.length - 1]
  const waypoints = [origin, ...spec.vias, dest]
  console.log(`${spec.file}: ${points.length} sparse → ${waypoints.length} OSRM waypoints`)
  const routed = await osrmRoute(waypoints)
  const simplified = douglasPeucker(routed.points, 0.02)
  const dense = densify(simplified, 200, 2)
  dense[0] = { ...dense[0], name: origin.name, ele: origin.ele }
  dense[dense.length - 1] = { ...dense[dense.length - 1], name: dest.name, ele: dest.ele }
  const km = trackDistanceKm(dense)
  const gaps = dense.slice(1).map((p, i) => haversineKm(dense[i], p))
  const maxGap = Math.max(...gaps)
  console.log(`  OSRM ${routed.km.toFixed(1)} km → ${dense.length} pts, ${km.toFixed(1)} km, max gap ${(maxGap * 1000).toFixed(0)} m`)
  writeFileSync(path, writeGpx(meta, origin, dest, dense))
  return { file: spec.file, count: dense.length, km, maxGap, points: dense }
}

const results = []
for (const spec of ROUTES) {
  results.push(await snapOne(spec))
  await sleep(300)
}

const fixtures = [
  { name: 'A7 HOLD 52.85,9.75', lat: 52.85, lng: 9.75, file: 'hamburg-hannover-a7.gpx', want: 0.5 },
  { name: 'A7 VERIFY 52.85,9.76', lat: 52.85, lng: 9.76, file: 'hamburg-hannover-a7.gpx', want: 1.5 },
  { name: 'A3 51.05,6.95', lat: 51.05, lng: 6.95, file: 'duisburg-koln-a3.gpx', want: 0.5 },
  { name: 'A8 48.4,10.25', lat: 48.4, lng: 10.25, file: 'munchen-stuttgart-a8.gpx', want: 0.5 },
  { name: 'A1 52.2,8.25', lat: 52.2, lng: 8.25, file: 'bremen-dortmund-a1.gpx', want: 0.5 },
]
const byFile = Object.fromEntries(results.map(r => [r.file, r.points]))
console.log('\nFixture distances to snapped line:')
for (const f of fixtures) {
  const n = nearestOnTrack(f, byFile[f.file])
  console.log(`  ${f.name}: ${n.dist.toFixed(3)} km (cap ${f.want}) → ${n.lat.toFixed(5)},${n.lng.toFixed(5)}`)
}

console.log(JSON.stringify(results.map(({ file, count, km, maxGap }) => ({ file, count, km: +km.toFixed(1), maxGap: +maxGap.toFixed(3) })), null, 2))
