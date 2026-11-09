const BERLIN = 'Europe/Berlin'

export function parseIso(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
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
  const mins = Math.round(abs / 60000)
  if (mins < 1) return diffMs >= 0 ? 'Just now' : 'Just now'
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
