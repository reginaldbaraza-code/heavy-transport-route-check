import {
  downsampleGpxPoints,
  parseGpxDocument,
  serializeGpxTrack,
  type GpxPoint,
} from './gpxParse'
import type { SavedJob } from './jobs'
import {
  encodeStateWriteBody,
  STATE_BODY_MAX_BYTES,
  utf8ByteLength,
} from './checkHistoryPersist'

/** Newest-first hard cap for account-synced saved jobs. */
export const SAVED_JOBS_MAX_RECORDS = 50

/** Soft target so a full account payload stays under the 256 KB server limit. */
export const SAVED_JOBS_SOFT_MAX_BYTES = 200 * 1024

/**
 * Downsampled track points kept inside persisted GPX.
 * Full evidence / check payloads live in check history — jobs only need a
 * route geometry that Jobs / Overview / re-run can use.
 */
export const SAVED_JOB_TRACK_MAX_POINTS = 60

const SAVED_JOBS_KEY = 'htr-saved-jobs'

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

/** Compact GPX for account sync — drop elevation/names and downsample. */
export function compactJobGpx(gpxContent: string): string {
  if (!gpxContent || typeof gpxContent !== 'string') return gpxContent || ''
  try {
    const parsed = parseGpxDocument(gpxContent, { downsample: false })
    const points = downsampleGpxPoints(parsed.points, SAVED_JOB_TRACK_MAX_POINTS).map((point): GpxPoint => ({
      lat: roundCoord(point.lat),
      lng: roundCoord(point.lng),
    }))
    if (points.length < 2) return gpxContent
    return serializeGpxTrack(points, parsed.creator || 'HTR')
  } catch {
    // Keep original if parse fails — persist layer may still trim by count/bytes.
    return gpxContent
  }
}

/**
 * Persist only what Jobs / Overview need. Drops bulky GPX detail; verdict
 * evidence stays in check history and is recomputed on re-run.
 */
export function compactSavedJob(job: SavedJob): SavedJob {
  return {
    ...job,
    gpxContent: compactJobGpx(job.gpxContent),
    // Cap summary length — full evidence text belongs in check history.
    lastSummary: job.lastSummary ? String(job.lastSummary).slice(0, 280) : job.lastSummary,
  }
}

export type PrepareSavedJobsResult = {
  jobs: SavedJob[]
  dropped: number
}

/**
 * Compact + cap jobs for account sync. Newest first. Drops oldest when over
 * the hard cap or when the PUT body would exceed the server limit.
 */
export function prepareSavedJobsForPersist(
  jobs: SavedJob[],
  opts?: { userId?: string; maxBodyBytes?: number; maxRecords?: number },
): PrepareSavedJobsResult {
  const userId = opts?.userId || 'user'
  const maxBodyBytes = opts?.maxBodyBytes ?? STATE_BODY_MAX_BYTES
  const maxRecords = opts?.maxRecords ?? SAVED_JOBS_MAX_RECORDS
  const originalCount = jobs.length
  let records = jobs.slice(0, maxRecords).map(compactSavedJob)
  const droppedByCap = Math.max(0, originalCount - records.length)

  while (records.length > 0) {
    const body = encodeStateWriteBody(userId, SAVED_JOBS_KEY, records)
    if (utf8ByteLength(body) <= maxBodyBytes) break
    records = records.slice(0, -1)
  }

  const droppedByBytes = Math.max(0, Math.min(originalCount, maxRecords) - records.length)
  return {
    jobs: records,
    dropped: droppedByCap + droppedByBytes,
  }
}
