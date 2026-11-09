const BERLIN = 'Europe/Berlin'

export function parseIso(value?: string | null): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  // Only ISO-8601 / RFC-3339. Reject de-DE display strings so they are never
  // re-parsed as MM.DD.YYYY (09.11.2026 would become 11 September).
  if (!/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(trimmed)) {
    return null
  }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatBerlinDateTime(iso?: string | null): string {
  const date = parseIso(iso)
  if (!date) return ''
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatBerlinDate(iso?: string | null): string {
  const date = parseIso(iso)
  if (!date) return ''
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN,
    dateStyle: 'medium',
  }).format(date)
}

export function relativeFromNow(iso?: string | null, now = new Date()): string {
  const date = parseIso(iso)
  if (!date) return ''
  const diffMs = now.getTime() - date.getTime()
  const abs = Math.abs(diffMs)
  if (abs < 60000) return 'Just now'
  const mins = Math.floor(abs / 60000)
  if (mins < 60) return diffMs >= 0 ? `${mins} min ago` : `in ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return diffMs >= 0 ? `${hours} h ago` : `in ${hours} h`
  const days = Math.round(hours / 24)
  return diffMs >= 0 ? `${days} d ago` : `in ${days} d`
}

export function orgInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'ORG'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

export const START_NOT_PUBLISHED = 'Start: not published'

export function formatStartLabel(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return START_NOT_PUBLISHED
  const stripped = raw.replace(/^starts?\s*:?\s*/i, '').trim()
  if (!stripped || /not published/i.test(stripped)) return START_NOT_PUBLISHED
  return `Start: ${stripped}`
}
