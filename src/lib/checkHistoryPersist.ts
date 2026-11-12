/** Newest-first cap for account-synced check history. */
export const CHECK_HISTORY_MAX_RECORDS = 50

/** Soft target so a full account payload stays under the 256 KB server limit. */
export const CHECK_HISTORY_SOFT_MAX_BYTES = 200 * 1024

/** Mirror of api/_lib/storageKeys STATE_BODY_MAX_BYTES — never PUT more than this. */
export const STATE_BODY_MAX_BYTES = 256 * 1024

/** Chrome rejects keepalive / sendBeacon bodies over ~64 KB; stay under with margin. */
export const KEEPALIVE_BODY_MAX_BYTES = 60 * 1024

const CHECK_HISTORY_KEY = 'htr-route-check-history'

/** Any history-shaped record that may carry a heavy evidence payload. */
export type HistoryPersistInput = { evidence?: unknown; [key: string]: unknown }

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return Buffer.byteLength(text, 'utf8')
}

export function encodeStateWriteBody(user: string, key: string, value: unknown): string {
  return JSON.stringify({ user, key, value })
}

export function shouldUseKeepalive(bodyBytes: number): boolean {
  return bodyBytes <= KEEPALIVE_BODY_MAX_BYTES
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
