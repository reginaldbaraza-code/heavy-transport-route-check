export const UA: string
export const FEEDS: { short: string; long: string }
export const MIA_SNAPSHOT_SOURCE: string
export const MIA_SNAPSHOT_LICENSE: string
export const MIA_SNAPSHOT_ATTRIBUTION: string

export type MiaDatexItem = {
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

export type MiaDatexSnapshot = {
  snapshotAt: string
  publicationTime?: { short?: string | null; long?: string | null }
  source: string
  license: string
  attribution: string
  feeds?: { short: string; long: string }
  counts?: {
    short?: number
    long?: number
    kept?: number
    expired?: number
    skipped?: number
    records?: number
  }
  runtimeMs?: number
  items: MiaDatexItem[]
  live?: boolean
}

export type MiaFeedParseResult = {
  items: MiaDatexItem[]
  publicationTime: string | null
  stats: { records: number; kept: number; expired: number; skipped: number }
  bytes?: number
  ms?: number
}

export function extractRecord(
  xml: string,
  term: 'short' | 'long',
  now: number,
): { item?: MiaDatexItem; skip?: string }

export function parseFeedXml(xml: string, term: 'short' | 'long', now?: number): MiaFeedParseResult

export function parseFeed(
  term: 'short' | 'long',
  url: string,
  now: number,
  options?: {
    timeoutMs?: number
    fetchImpl?: typeof fetch
    signal?: AbortSignal
  },
): Promise<MiaFeedParseResult>

export function dedupeMiaItems(items: MiaDatexItem[]): MiaDatexItem[]
export function snapshotContentKey(snapshot: unknown): string
export function snapshotContentUnchanged(prev: unknown, next: unknown): boolean

export function buildMiaSnapshot(options?: {
  now?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}): Promise<MiaDatexSnapshot>

export function buildMiaSnapshotFromXml(
  shortXml: string,
  longXml: string,
  now?: number,
): MiaDatexSnapshot
