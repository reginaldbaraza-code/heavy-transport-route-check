/** Newest-first cap for account-synced check history. */
export const CHECK_HISTORY_MAX_RECORDS = 50

/** Soft target so a full account payload stays under the 256 KB server limit. */
export const CHECK_HISTORY_SOFT_MAX_BYTES = 200 * 1024

/** Mirror of api/_lib/storageKeys STATE_BODY_MAX_BYTES — never PUT more than this. */
export const STATE_BODY_MAX_BYTES = 256 * 1024

/**
 * Chrome rejects keepalive / sendBeacon bodies over ~64 KB, and that quota is
 * SHARED across all in-flight keepalive requests in the tab. Stay under with
 * margin for a single body; unload flushes must also track a running budget.
 */
export const KEEPALIVE_BODY_MAX_BYTES = 60 * 1024

const CHECK_HISTORY_KEY = 'htr-route-check-history'

/** Any history-shaped record that may carry a heavy evidence payload. */
export type HistoryPersistInput = { evidence?: unknown; [key: string]: unknown }

export type KeepaliveBudget = { limit: number; used: number }

export type PersistStartDecision = 'start' | 'skip-same-inflight' | 'abort-and-replace'

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return Buffer.byteLength(text, 'utf8')
}

export function encodeStateWriteBody(user: string, key: string, value: unknown): string {
  return JSON.stringify({ user, key, value })
}

/** True when a single body could use keepalive in isolation (≤ 60 KB). */
export function shouldUseKeepalive(bodyBytes: number): boolean {
  return bodyBytes <= KEEPALIVE_BODY_MAX_BYTES
}

/** Shared in-flight keepalive budget for pagehide / visibility hidden flushes. */
export function createKeepaliveBudget(limit = KEEPALIVE_BODY_MAX_BYTES): KeepaliveBudget {
  return { limit, used: 0 }
}

/**
 * Reserve `bodyBytes` from the shared keepalive budget. Returns false when the
 * body alone exceeds the per-request cap or the remaining shared budget.
 */
export function reserveKeepaliveBytes(budget: KeepaliveBudget, bodyBytes: number): boolean {
  if (!shouldUseKeepalive(bodyBytes)) return false
  if (budget.used + bodyBytes > budget.limit) return false
  budget.used += bodyBytes
  return true
}

/**
 * At most one in-flight PUT per key: skip if the same body is already flying,
 * otherwise abort the older attempt and replace it with the newer value.
 */
export function decidePersistStart(opts: {
  hasInflight: boolean
  inflightSerialized: string | null
  nextSerialized: string
}): PersistStartDecision {
  if (!opts.hasInflight) return 'start'
  if (opts.inflightSerialized === opts.nextSerialized) return 'skip-same-inflight'
  return 'abort-and-replace'
}

/** Retries must not start while another PUT for the same key is still in flight. */
export function shouldScheduleRetry(opts: {
  hasInflight: boolean
  cacheSerialized: string | undefined
  attemptedSerialized: string
}): boolean {
  if (opts.hasInflight) return false
  if (opts.cacheSerialized == null) return false
  if (opts.cacheSerialized !== opts.attemptedSerialized) return false
  return true
}

/** Drop raw evidence (and any nested geometry) before account sync. */
export function compactCheckHistoryRecord<T extends HistoryPersistInput>(record: T): Omit<T, 'evidence'> {
  const { evidence: _evidence, ...rest } = record
  return rest
}

/**
 * Compact + cap history for account sync. Drops oldest entries if the PUT body
 * would still exceed the server limit. Newest records stay first.
 */
export function prepareCheckHistoryForPersist(
  history: HistoryPersistInput[],
  opts?: { userId?: string; maxBodyBytes?: number },
): Array<Omit<HistoryPersistInput, 'evidence'>> {
  const userId = opts?.userId || 'user'
  const maxBodyBytes = opts?.maxBodyBytes ?? STATE_BODY_MAX_BYTES
  let records = history.slice(0, CHECK_HISTORY_MAX_RECORDS).map(compactCheckHistoryRecord)

  while (records.length > 0) {
    const body = encodeStateWriteBody(userId, CHECK_HISTORY_KEY, records)
    if (utf8ByteLength(body) <= maxBodyBytes) break
    records = records.slice(0, -1)
  }
  return records
}
