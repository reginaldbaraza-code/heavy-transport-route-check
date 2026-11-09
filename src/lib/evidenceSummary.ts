import { formatBerlinDateTime } from './formatTime'
import type { RouteEvidence } from '../data/routeChecks'

const GERMAN_HINT = /[äöüÄÖÜß]|\b(Sperrung|Vollsperrung|Fahrbahn|Richtung|Baustelle|Sperr|Restbreite|Durchfahrtshöhe|Auffahrt|Abfahrt|beide)\b/

export function splitConcatenatedPlaces(text: string): string {
  return text
    .replace(/([a-zäöüß])([A-ZÄÖÜ])/g, '$1 – $2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function joinLocationParts(parts: unknown): string {
  const list = (Array.isArray(parts) ? parts : parts ? [parts] : [])
    .flatMap(part => String(part || '').split(/\s*[·|/]\s*/))
    .map(part => splitConcatenatedPlaces(part.trim()))
    .filter(Boolean)
  return [...new Set(list)].join(' / ')
}

function typeLabel(item: RouteEvidence): string {
  if (item.category === 'closures' || item.state === 'danger') return 'Closure'
  if (/height|Durchfahrtshöhe|lichte Höhe|clearance/i.test(`${item.title} ${item.detail}`)) return 'Height restriction'
  if (/weight|Gewicht|t vs/i.test(`${item.title} ${item.detail}`)) return 'Weight restriction'
  if (/width|Restbreite|Breite/i.test(`${item.title} ${item.detail}`)) return 'Width restriction'
  if (item.category === 'observations') return 'On-site report'
  return 'Roadworks'
}

function extractRoad(text: string): string {
  const match = text.match(/\bA\s?(\d{1,3})\b/i)
  return match ? `A${match[1]}` : ''
}

function extractDirection(text: string): string {
  if (/beide Richtungen|both directions/i.test(text)) return 'both directions'
  if (/Gegenrichtung|opposite/i.test(text)) return 'opposite direction'
  if (/Fahrtrichtung Süd|southbound/i.test(text)) return 'southbound'
  if (/Fahrtrichtung Nord|northbound/i.test(text)) return 'northbound'
  if (/Fahrtrichtung West|westbound/i.test(text)) return 'westbound'
  if (/Fahrtrichtung Ost|eastbound/i.test(text)) return 'eastbound'
  const dir = text.match(/(?:^|[\s,./])Richtung\s+([A-ZÄÖÜ][\w\-äöü]+)/i)
  if (dir) return `towards ${splitConcatenatedPlaces(dir[1])}`
  return ''
}

function extractRestriction(text: string): string {
  const height = text.match(/(?:Durchfahrtshöhe|Höhe|height|clearance)[^\d]{0,12}(\d+[.,]\d+)\s*m/i)
  if (height) return `height ${height[1].replace(',', '.')} m`
  const width = text.match(/(?:Restbreite|Breite|width)[^\d]{0,12}(\d+[.,]\d+)\s*m/i)
  if (width) return `width ${width[1].replace(',', '.')} m`
  const weight = text.match(/(?:Gewicht|weight)[^\d]{0,12}(\d+[.,]?\d*)\s*t/i)
  if (weight) return `weight ${weight[1]} t`
  return ''
}

export function looksGerman(text: string): boolean {
  return GERMAN_HINT.test(text)
}

export function looksTechnical(text: string): boolean {
  return /situationRecord|publicationTime|latitude|longitude|gml:|DATEX|locationDescriptor|payloadPublication|Long-term MIA record|Short-term MIA record|Snapshot 20\d{2}-/i.test(text)
}

const KEEP_ORIGINAL_TITLE = /^(bridge-clearance-|mia-snapshot-|mia-deduped|bw-deduped|bw-unavailable|route-clear|system-error)/

export function displayEvidenceTitle(item: RouteEvidence): string {
  if (KEEP_ORIGINAL_TITLE.test(item.id) || item.source === 'Dispatcher confirmation' || item.state === 'clear') {
    return splitConcatenatedPlaces(item.title || '')
  }
  return evidenceEnglishSummary(item) || splitConcatenatedPlaces(item.title || '')
}

function concatenatedPlacePhrase(text: string): string {
  const match = splitConcatenatedPlaces(text).match(/[A-ZÄÖÜ][a-zäöüß]+(?: – [A-ZÄÖÜ][a-zäöüß]+)+/)
  return match ? match[0] : ''
}

export function evidenceEnglishSummary(item: RouteEvidence): string {
  const blob = splitConcatenatedPlaces(`${item.title} ${item.detail}`)
  const bits = [
    typeLabel(item),
    extractRoad(blob) || extractRoad(item.title),
    concatenatedPlacePhrase(blob),
    extractDirection(blob),
    extractRestriction(blob),
  ]
  const start = item.startTimestamp ? formatBerlinDateTime(item.startTimestamp) : ''
  const end = item.endTimestamp ? formatBerlinDateTime(item.endTimestamp) : ''
  if (start && end) bits.push(`${start} – ${end}`)
  else if (start) bits.push(`from ${start}`)
  else if (end) bits.push(`until ${end}`)
  return bits.filter(Boolean).join(' · ')
}

export function evidenceOriginalGerman(item: RouteEvidence): string {
  return splitConcatenatedPlaces([item.title, item.detail].filter(Boolean).join('\n'))
}
