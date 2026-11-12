/**
 * Autobahn GmbH live feed fetch helpers.
 *
 * Failures must not be silently collapsed to empty arrays — callers need to
 * know when evidence is missing so the route check can mark itself degraded.
 */

export const AUTOBAHN_API_BASE = 'https://verkehr.autobahn.de/o/autobahn'

export type AutobahnFeedType = 'roadworks' | 'closure' | 'warning' | 'parking_lorry'

/** Feeds that can drive HOLD / VERIFY. Parking is informational only. */
export const CRITICAL_AUTOBAHN_FEEDS: AutobahnFeedType[] = ['roadworks', 'closure', 'warning']

export type AutobahnFeedFailure = {
  road: string
  type: AutobahnFeedType
  error: string
}

export type AutobahnFeedResult = {
  ok: boolean
  items: any[]
  error?: string
}

export type AutobahnRoadFeeds = {
  road: string
  roadworks: any[]
  closures: any[]
  warnings: any[]
  parking: any[]
  failures: AutobahnFeedFailure[]
}

export type AutobahnFetchHealth = {
  /** True when any critical feed for any requested road failed. */
  degraded: boolean
  /**
   * True when some critical feeds succeeded and some failed.
   * False when every critical feed failed (total outage) or none failed.
   */
  partial: boolean
  failures: AutobahnFeedFailure[]
  criticalAttempted: number
  criticalSucceeded: number
}

export type AutobahnFetchOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const FEED_JSON_KEY: Record<AutobahnFeedType, string> = {
  roadworks: 'roadworks',
  closure: 'closure',
  warning: 'warning',
  parking_lorry: 'parking_lorry',
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'fetch failed'
  return String(error || 'fetch failed')
}

export async function fetchAutobahnFeed(
  road: string,
  type: AutobahnFeedType,
  options: AutobahnFetchOptions = {},
): Promise<AutobahnFeedResult> {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 5000
  const url = `${AUTOBAHN_API_BASE}/${road}/services/${type}`

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return { ok: false, items: [], error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { ok: true, items: data[FEED_JSON_KEY[type]] || [] }
  } catch (error) {
    console.error(`Error fetching ${type} for ${road}:`, error)
    return { ok: false, items: [], error: errorMessage(error) }
  }
}

export async function fetchAutobahnRoadFeeds(
  road: string,
  options: AutobahnFetchOptions = {},
): Promise<AutobahnRoadFeeds> {
  const [roadworks, closures, warnings, parking] = await Promise.all([
    fetchAutobahnFeed(road, 'roadworks', options),
    fetchAutobahnFeed(road, 'closure', options),
    fetchAutobahnFeed(road, 'warning', options),
    fetchAutobahnFeed(road, 'parking_lorry', options),
  ])

  const failures: AutobahnFeedFailure[] = []
  const collect = (type: AutobahnFeedType, result: AutobahnFeedResult) => {
    if (!result.ok) {
      failures.push({ road, type, error: result.error || 'fetch failed' })
    }
    return result.items
  }

  return {
    road,
    roadworks: collect('roadworks', roadworks),
    closures: collect('closure', closures),
    warnings: collect('warning', warnings),
    parking: collect('parking_lorry', parking),
    failures,
  }
}

export function summarizeAutobahnFetchHealth(roads: AutobahnRoadFeeds[]): AutobahnFetchHealth {
  const failures = roads.flatMap(road =>
    road.failures.filter(failure => CRITICAL_AUTOBAHN_FEEDS.includes(failure.type)),
  )
  const criticalAttempted = roads.length * CRITICAL_AUTOBAHN_FEEDS.length
  const criticalSucceeded = criticalAttempted - failures.length
  const degraded = failures.length > 0
  const partial = degraded && criticalSucceeded > 0

  return {
    degraded,
    partial,
    failures,
    criticalAttempted,
    criticalSucceeded,
  }
}

export function formatAutobahnFailureDetail(health: AutobahnFetchHealth): string {
  if (!health.failures.length) return ''
  const labels = health.failures.map(failure => `${failure.road} ${failure.type}`)
  const unique = [...new Set(labels)]
  const listed = unique.slice(0, 6).join(', ')
  const more = unique.length > 6 ? ` (+${unique.length - 6} more)` : ''
  if (health.partial) {
    return `Partial Autobahn GmbH outage: failed feeds ${listed}${more}. Remaining live evidence is incomplete.`
  }
  return `Autobahn GmbH live feeds unavailable (${listed}${more}). Retry or verify manually.`
}
