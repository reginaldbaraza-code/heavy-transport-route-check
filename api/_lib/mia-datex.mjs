/**
 * Stream Autobahn GmbH MIA DATEX II feeds republished by MobiData BW.
 * Zero npm deps so GitHub Actions and the Vercel function can share this parser.
 */
export const UA =
  'heavy-transport-route-check/1.0 (MIA snapshot; https://github.com/reginaldbaraza-code/heavy-transport-route-check)'

export const FEEDS = {
  short: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_short_term.datex2.xml',
  long: 'https://api.mobidata-bw.de/datasets/traffic/roadworks/roadworks_adb_long_term.datex2.xml',
}

export const MIA_SNAPSHOT_SOURCE = 'Autobahn GmbH MIA via Mobilithek/MobiData BW'
export const MIA_SNAPSHOT_LICENSE = 'dl-de/by-2.0'
export const MIA_SNAPSHOT_ATTRIBUTION =
  'Autobahn GmbH des Bundes / Mobilithek, republished by MobiData BW. License: Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2.0).'

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

export function extractRecord(xml, term, now) {
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
  const weight = restrictionNumber(xml, [
    'grossVehicleWeightCharacteristicValue',
    'maxGrossVehicleWeight',
    'maximumWeight',
  ])
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

function createParserState(term, now) {
  return {
    term,
    now,
    buf: '',
    publicationTime: null,
    stats: { records: 0, kept: 0, expired: 0, skipped: 0 },
    items: [],
  }
}

function flushParser(state) {
  if (!state.publicationTime) {
    const match = state.buf.match(/<publicationTime>([^<]+)/)
    if (match) state.publicationTime = isoOrNull(match[1]) || match[1]
  }
  while (true) {
    const close = state.buf.indexOf(RECORD_CLOSE)
    if (close < 0) break
    const start = state.buf.lastIndexOf(RECORD_OPEN, close)
    if (start < 0) {
      state.buf = state.buf.slice(close + RECORD_CLOSE.length)
      continue
    }
    const xml = state.buf.slice(start, close + RECORD_CLOSE.length)
    state.buf = state.buf.slice(close + RECORD_CLOSE.length)
    state.stats.records += 1
    const extracted = extractRecord(xml, state.term, state.now)
    if (extracted.item) {
      state.items.push(extracted.item)
      state.stats.kept += 1
    } else if (extracted.skip === 'expired') {
      state.stats.expired += 1
    } else {
      state.stats.skipped += 1
    }
  }
  if (state.buf.length > 1_500_000) state.buf = state.buf.slice(-400_000)
}

export function parseFeedXml(xml, term, now = Date.now()) {
  const state = createParserState(term, now)
  state.buf = String(xml || '')
  flushParser(state)
  return {
    items: state.items,
    publicationTime: state.publicationTime,
    stats: state.stats,
  }
}

export async function parseFeed(term, url, now, options = {}) {
  const started = Date.now()
  const fetchImpl = options.fetchImpl || fetch
  const signal =
    options.signal ||
    (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined)
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': UA, Accept: 'application/xml, text/xml, */*' },
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(`${term} feed HTTP ${response.status}`)
  }

  const decoder = new TextDecoder('utf-8')
  const state = createParserState(term, now)
  let scanned = 0

  for await (const chunk of response.body) {
    scanned += chunk.length
    state.buf += decoder.decode(chunk, { stream: true })
    flushParser(state)
  }
  state.buf += decoder.decode()
  flushParser(state)

  return {
    items: state.items,
    publicationTime: state.publicationTime,
    stats: state.stats,
    bytes: scanned,
    ms: Date.now() - started,
  }
}

export function dedupeMiaItems(items) {
  const byId = new Map()
  for (const item of items) {
    const current = byId.get(item.id)
    if (!current || (current.term === 'long' && item.term === 'short')) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()]
}

export function snapshotContentKey(snapshot) {
  return JSON.stringify({
    publicationTime: snapshot?.publicationTime || null,
    items: snapshot?.items || [],
  })
}

export function snapshotContentUnchanged(prev, next) {
  if (!prev || !next) return false
  return snapshotContentKey(prev) === snapshotContentKey(next)
}

function assembleSnapshot(short, long, now = Date.now()) {
  const items = dedupeMiaItems([...(short.items || []), ...(long.items || [])])
  return {
    snapshotAt: new Date(now).toISOString(),
    publicationTime: { short: short.publicationTime, long: long.publicationTime },
    source: MIA_SNAPSHOT_SOURCE,
    license: MIA_SNAPSHOT_LICENSE,
    attribution: MIA_SNAPSHOT_ATTRIBUTION,
    feeds: FEEDS,
    counts: {
      short: short.stats?.kept || 0,
      long: long.stats?.kept || 0,
      kept: items.length,
      expired: (short.stats?.expired || 0) + (long.stats?.expired || 0),
      skipped: (short.stats?.skipped || 0) + (long.stats?.skipped || 0),
      records: (short.stats?.records || 0) + (long.stats?.records || 0),
    },
    runtimeMs: (short.ms || 0) + (long.ms || 0),
    items,
  }
}

export async function buildMiaSnapshot(options = {}) {
  const now = options.now || Date.now()
  const parseOptions = {
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  }
  const [short, long] = await Promise.all([
    parseFeed('short', FEEDS.short, now, parseOptions),
    parseFeed('long', FEEDS.long, now, parseOptions),
  ])
  return assembleSnapshot(short, long, now)
}

export function buildMiaSnapshotFromXml(shortXml, longXml, now = Date.now()) {
  const short = { ...parseFeedXml(shortXml, 'short', now), ms: 0 }
  const long = { ...parseFeedXml(longXml, 'long', now), ms: 0 }
  return assembleSnapshot(short, long, now)
}
