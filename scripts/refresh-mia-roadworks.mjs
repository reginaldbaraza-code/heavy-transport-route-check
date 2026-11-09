#!/usr/bin/env node
/**
 * Stream Autobahn GmbH MIA DATEX II feeds republished by MobiData BW,
 * keep a compact JSON snapshot for route checks.
 *
 * Zero npm deps so GitHub Actions can run without pnpm install.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UA = 'heavy-transport-route-check/1.0 (MIA snapshot; https://github.com/reginaldbaraza-code/heavy-transport-route-check)'
const FEEDS = {
  short: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_short_term.datex2.xml',
  long: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_long_term.datex2.xml',
}
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/mia-roadworks.json')
const RECORD_OPEN = '<situationRecord '
const RECORD_CLOSE = '</situationRecord>'
const MAX_DESCRIPTION = 180

function round(value, places = 5) {
  const f = 10 ** places
  return Math.round(value * f) / f
}

function parseNum(value) {
  if (value == null || value === '') return undefined
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function firstTag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`))
  return match ? match[1].trim() : ''
}

function firstAttr(xml, name) {
  const match = xml.match(new RegExp(`\\s${name}="([^"]+)"`))
  return match ? match[1] : ''
}

function isoOrNull(value) {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function midpoint(posList) {
  const nums = posList.trim().split(/\s+/).map(Number).filter(Number.isFinite)
  if (nums.length < 2) return null
  const points = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push([nums[i], nums[i + 1]])
  }
  if (!points.length) return null
  const mid = points[Math.floor(points.length / 2)]
  if (!Number.isFinite(mid[0]) || !Number.isFinite(mid[1])) return null
  return { lat: round(mid[0]), lng: round(mid[1]) }
}

function restrictionNumber(xml, names) {
  for (const name of names) {
    const raw = firstTag(xml, name)
    const n = parseNum(raw)
    if (n != null && n > 0) return n
  }
  return undefined
}

function extractRecord(xml, term, now) {
  const id = firstAttr(xml, 'id')
  if (!id) return { skip: 'no-id' }
  const end = isoOrNull(firstTag(xml, 'overallEndTime'))
  if (end && Date.parse(end) < now) return { skip: 'expired' }
  const pos = firstTag(xml, 'posList')
  if (!pos) return { skip: 'no-coords' }
  const point = midpoint(pos)
  if (!point) return { skip: 'no-coords' }

  const type = firstAttr(xml, 'xsi:type') || 'MaintenanceWorks'
  const item = {
    id,
    term,
    type,
    road: firstTag(xml, 'roadNumber'),
    lat: point.lat,
    lng: point.lng,
    start: isoOrNull(firstTag(xml, 'overallStartTime')),
    end,
    description: (firstTag(xml, 'value') || type).slice(0, MAX_DESCRIPTION),
  }

  const residualWidth = restrictionNumber(xml, ['residualRoadWidth'])
  const minLaneWidth = restrictionNumber(xml, ['minLaneWidth'])
  const height = restrictionNumber(xml, ['heightCharacteristicValue', 'maximumHeight', 'vehicleHeight'])
  const weight = restrictionNumber(xml, ['grossVehicleWeightCharacteristicValue', 'maxGrossVehicleWeight', 'maximumWeight'])
  const lanesRestricted = restrictionNumber(xml, ['numberOfLanesRestricted'])
  const originalLanes = restrictionNumber(xml, ['originalNumberOfLanes'])
  const maintenance = firstTag(xml, 'roadMaintenanceType')
  const management = firstTag(xml, 'roadOrCarriagewayOrLaneManagementType')

  if (residualWidth != null) item.residualWidth = residualWidth
  if (minLaneWidth != null) item.minLaneWidth = minLaneWidth
  if (height != null) item.height = height
  if (weight != null) item.weight = weight
  if (lanesRestricted != null) item.lanesRestricted = lanesRestricted
  if (originalLanes != null) item.originalLanes = originalLanes
  if (maintenance) item.maintenance = maintenance
  if (management) item.management = management

  return { item }
}

async function parseFeed(term, url, now) {
  const started = Date.now()
  console.log(`Fetching ${term} ${url}`)
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/xml, text/xml, */*' },
  })
  if (!response.ok || !response.body) {
    throw new Error(`${term} feed HTTP ${response.status}`)
  }

  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let publicationTime = null
  let scanned = 0
  const stats = { records: 0, kept: 0, expired: 0, skipped: 0 }
  const items = []

  const flush = () => {
    if (!publicationTime) {
      const match = buf.match(/<publicationTime>([^<]+)/)
      if (match) publicationTime = isoOrNull(match[1]) || match[1]
    }
    while (true) {
      const close = buf.indexOf(RECORD_CLOSE)
      if (close < 0) break
      const start = buf.lastIndexOf(RECORD_OPEN, close)
      if (start < 0) {
        buf = buf.slice(close + RECORD_CLOSE.length)
        continue
      }
      const xml = buf.slice(start, close + RECORD_CLOSE.length)
      buf = buf.slice(close + RECORD_CLOSE.length)
      stats.records += 1
      const extracted = extractRecord(xml, term, now)
      if (extracted.item) {
        items.push(extracted.item)
        stats.kept += 1
      } else if (extracted.skip === 'expired') {
        stats.expired += 1
      } else {
        stats.skipped += 1
      }
    }
    if (buf.length > 1_500_000) buf = buf.slice(-400_000)
  }

  for await (const chunk of response.body) {
    scanned += chunk.length
    buf += decoder.decode(chunk, { stream: true })
    flush()
    if (scanned % 20_000_000 < chunk.length) {
      const rss = Math.round(process.memoryUsage().rss / 1024 / 1024)
      console.log(`  ${term} ${(scanned / 1_048_576).toFixed(1)} MB read, ${stats.records} records, rss ${rss} MB`)
    }
  }
  buf += decoder.decode()
  flush()

  console.log(
    `${term}: ${stats.records} records, kept ${stats.kept}, expired ${stats.expired}, skipped ${stats.skipped}, ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )
  return { items, publicationTime, stats, bytes: scanned, ms: Date.now() - started }
}

function dedupe(items) {
  const byId = new Map()
  for (const item of items) {
    const current = byId.get(item.id)
    if (!current || (current.term === 'long' && item.term === 'short')) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()]
}

async function main() {
  const now = Date.now()
  const short = await parseFeed('short', FEEDS.short, now)
  const long = await parseFeed('long', FEEDS.long, now)
  const items = dedupe([...short.items, ...long.items])
  const snapshot = {
    snapshotAt: new Date().toISOString(),
    publicationTime: { short: short.publicationTime, long: long.publicationTime },
    source: 'Autobahn GmbH MIA via Mobilithek/MobiData BW',
    license: 'dl-de/by-2.0',
    attribution: 'Autobahn GmbH des Bundes / Mobilithek, republished by MobiData BW. License: Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2.0).',
    feeds: FEEDS,
    counts: {
      short: short.stats.kept,
      long: long.stats.kept,
      kept: items.length,
      expired: short.stats.expired + long.stats.expired,
      skipped: short.stats.skipped + long.stats.skipped,
      records: short.stats.records + long.stats.records,
    },
    runtimeMs: short.ms + long.ms,
    items,
  }

  mkdirSync(dirname(OUT), { recursive: true })
  const json = JSON.stringify(snapshot)
  writeFileSync(OUT, json)
  console.log(`Wrote ${OUT}`)
  console.log(`items ${items.length}  bytes ${json.length}  gzip-target ~${(json.length / 4 / 1_048_576).toFixed(2)} MB`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
