const LONG_RUNNING_MS = 90 * 24 * 60 * 60 * 1000
const BERLIN = 'Europe/Berlin'

export type AutobahnFreshness = {
  startTimestamp: string | null
  endTimestamp: string | null
  retrievedAt: string
  expired: boolean
  longRunning: boolean
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function yearFromGerman(yearToken: string): number {
  const year = Number(yearToken)
  if (!Number.isFinite(year)) return NaN
  return yearToken.length <= 2 ? 2000 + year : year
}

/** Interpret a civil Berlin datetime as a UTC Date. One-hour DST error is acceptable for expiry checks. */
export function berlinDate(year: number, month: number, day: number, hour = 0, minute = 0): Date | null {
  if (![year, month, day, hour, minute].every(n => Number.isFinite(n))) return null
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcGuess))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  const asBerlin = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return new Date(utcGuess - (asBerlin - utcGuess))
}

export function parseIsoTimestamp(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function joinDescription(description: unknown): string {
  if (Array.isArray(description)) return description.filter(Boolean).join('\n')
  return typeof description === 'string' ? description : ''
}

function collectEndDates(text: string): Date[] {
  const ends: Date[] = []

  const ende = /Ende:\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s*um\s*(\d{1,2}):(\d{2}))?/gi
  let match: RegExpExecArray | null
  while ((match = ende.exec(text))) {
    const date = berlinDate(
      yearFromGerman(match[3]),
      Number(match[2]),
      Number(match[1]),
      match[4] ? Number(match[4]) : 23,
      match[5] ? Number(match[5]) : 59,
    )
    if (date) ends.push(date)
  }

  const window = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+von\s+(\d{1,2}):(\d{2})\s+bis\s+(\d{1,2}):(\d{2})/gi
  while ((match = window.exec(text))) {
    const date = berlinDate(
      yearFromGerman(match[3]),
      Number(match[2]),
      Number(match[1]),
      Number(match[6]),
      Number(match[7]),
    )
    if (date) ends.push(date)
  }

  const until = /bis\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\s*(?:um\s*)?(\d{1,2}):(\d{2}))?/gi
  while ((match = until.exec(text))) {
    const date = berlinDate(
      yearFromGerman(match[3]),
      Number(match[2]),
      Number(match[1]),
      match[4] ? Number(match[4]) : 23,
      match[5] ? Number(match[5]) : 59,
    )
    if (date) ends.push(date)
  }

  return ends
}

export function latestEndTimestamp(description: unknown, explicitEnd?: string | null): string | null {
  const parsed = parseIsoTimestamp(explicitEnd)
  const ends = collectEndDates(joinDescription(description))
  if (parsed) ends.push(parsed)
  if (ends.length === 0) return null
  const latest = ends.reduce((max, date) => (date.getTime() > max.getTime() ? date : max))
  return latest.toISOString()
}

export function eventFreshness(item: {
  startTimestamp?: string | null
  endTimestamp?: string | null
  description?: unknown
  retrievedAt?: string
}): AutobahnFreshness {
  const retrievedAt = item.retrievedAt || new Date().toISOString()
  const start = parseIsoTimestamp(item.startTimestamp)
  const endIso = latestEndTimestamp(item.description, item.endTimestamp)
  const end = parseIsoTimestamp(endIso)
  const retrieved = parseIsoTimestamp(retrievedAt) || new Date()
  const expired = Boolean(end && end.getTime() < retrieved.getTime())
  const longRunning = Boolean(
    !expired
    && start
    && !end
    && retrieved.getTime() - start.getTime() > LONG_RUNNING_MS,
  )

  return {
    startTimestamp: start ? start.toISOString() : (item.startTimestamp || null),
    endTimestamp: endIso,
    retrievedAt,
    expired,
    longRunning,
  }
}

export function formatBerlinDateTime(iso?: string | null): string {
  const date = parseIsoTimestamp(iso)
  if (!date) return ''
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function evidenceAgeLabel(freshness: AutobahnFreshness): string {
  const started = formatBerlinDateTime(freshness.startTimestamp)
  const retrieved = formatBerlinDateTime(freshness.retrievedAt)
  const until = formatBerlinDateTime(freshness.endTimestamp)
  const parts: string[] = []
  parts.push(started ? `Started ${started}` : 'Start not published')
  if (until) parts.push(`Until ${until}`)
  if (retrieved) parts.push(`Retrieved ${retrieved}`)
  if (freshness.longRunning) parts.push('Long-running / verify on site')
  return parts.join(' · ')
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function berlinClock(iso?: string | null): string {
  const date = parseIsoTimestamp(iso) || new Date()
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function descriptionFromAutobahnItem(item: { subtitle?: unknown; description?: unknown }): string {
  const parts = [
    ...(Array.isArray(item.subtitle) ? item.subtitle : item.subtitle ? [item.subtitle] : []),
    ...(Array.isArray(item.description) ? item.description : item.description ? [item.description] : []),
  ]
  return parts.filter(Boolean).join(' · ')
}

export { pad }
