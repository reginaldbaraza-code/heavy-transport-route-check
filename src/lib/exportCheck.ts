import { jsPDF } from 'jspdf'
import type { RouteEvidence, RouteVerdict } from '../data/routeChecks'
import type { RouteCheckResult } from './routeCheck'
import { formatBerlinDateTime } from './formatTime'
import { formatVehicleDims, type VehicleDims } from './jobs'

export type HistoryExportRecord = {
  verdict: RouteVerdict | string
  title?: string
  summary: string
  impact?: string
  permitNumber?: string
  permitName: string
  routeLabel: string
  vehicle?: VehicleDims | null
  source: string
  runAt: string
  retrievedAt: string
  confidence?: string
  evidence?: RouteEvidence[]
  confirmOnSite?: string[]
}

export type ExportEvidence = {
  title: string
  detail: string
  source: string
  start: string
  retrieved: string
  confidence: string
  category: string
  state: string
  confirmOnSite: boolean
}

export type ExportSnapshot = {
  verdict: RouteVerdict | string
  title: string
  summary: string
  impact: string
  permitNumber: string
  permitName: string
  routeLabel: string
  vehicle: VehicleDims | null
  source: string
  runAt: string
  retrievedAt: string
  confidence: string
  evidence: ExportEvidence[]
  confirmOnSite: string[]
}

function isConfirmOnSite(item: Pick<RouteEvidence, 'id' | 'title' | 'detail' | 'longRunning' | 'category'>) {
  const text = `${item.title} ${item.detail}`
  return Boolean(item.longRunning)
    || item.id === 'bridge-clearance-unknown'
    || /verify on site|confirm on site|bridge and clearance/i.test(text)
}

function evidenceRow(item: RouteEvidence, fallbackRetrieved?: string): ExportEvidence {
  return {
    title: item.title,
    detail: item.detail,
    source: item.source,
    start: item.startTimestamp ? formatBerlinDateTime(item.startTimestamp) : 'Start not published',
    retrieved: formatBerlinDateTime(item.retrievedAt || fallbackRetrieved) || 'Not recorded',
    confidence: String(item.confidence),
    category: item.category,
    state: item.state,
    confirmOnSite: isConfirmOnSite(item),
  }
}

export function confirmOnSiteTitles(evidence: RouteEvidence[]) {
  return evidence.filter(item => isConfirmOnSite(item)).map(item => item.title)
}

export function snapshotFromResult(
  result: RouteCheckResult,
  meta: {
    permitNumber?: string
    permitName?: string
    vehicle?: VehicleDims | null
    runAt?: string
  } = {},
): ExportSnapshot {
  const evidence = (result.evidence || []).map(item => evidenceRow(item, result.retrievedAt))
  return {
    verdict: result.verdict,
    title: result.title,
    summary: result.summary,
    impact: result.impact,
    permitNumber: meta.permitNumber || '',
    permitName: meta.permitName || `${result.route.origin} → ${result.route.destination}`,
    routeLabel: `${result.route.origin} → ${result.route.destination}`,
    vehicle: meta.vehicle ?? null,
    source: result.source || 'Autobahn GmbH',
    runAt: meta.runAt || result.retrievedAt || new Date().toISOString(),
    retrievedAt: result.retrievedAt || meta.runAt || new Date().toISOString(),
    confidence: result.confidence,
    evidence,
    confirmOnSite: confirmOnSiteTitles(result.evidence || []),
  }
}

export function snapshotFromHistory(record: HistoryExportRecord): ExportSnapshot {
  const evidence = (record.evidence || []).map(item => evidenceRow(item as RouteEvidence, record.retrievedAt))
  return {
    verdict: record.verdict,
    title: record.title || `Route check: ${record.verdict}`,
    summary: record.summary,
    impact: record.impact || '',
    permitNumber: record.permitNumber || '',
    permitName: record.permitName,
    routeLabel: record.routeLabel,
    vehicle: record.vehicle ?? null,
    source: record.source,
    runAt: record.runAt,
    retrievedAt: record.retrievedAt,
    confidence: record.confidence || 'medium',
    evidence,
    confirmOnSite: record.confirmOnSite || evidence.filter(item => item.confirmOnSite).map(item => item.title),
  }
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'route-check'
}

function filename(snapshot: ExportSnapshot, ext: string) {
  return `route-check-${slug(snapshot.permitNumber || snapshot.permitName)}-${snapshot.verdict}.${ext}`
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function csvCell(value: string | number | boolean | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function snapshotToCsv(snapshot: ExportSnapshot) {
  const header = [
    ['Field', 'Value'],
    ['Verdict', snapshot.verdict],
    ['Title', snapshot.title],
    ['Summary', snapshot.summary],
    ['Impact', snapshot.impact],
    ['Permit number', snapshot.permitNumber],
    ['Permit / file', snapshot.permitName],
    ['Route', snapshot.routeLabel],
    ['Vehicle', snapshot.vehicle ? formatVehicleDims(snapshot.vehicle) : 'Not recorded'],
    ['Source', snapshot.source],
    ['Run at', formatBerlinDateTime(snapshot.runAt) || snapshot.runAt],
    ['Retrieved', formatBerlinDateTime(snapshot.retrievedAt) || snapshot.retrievedAt],
    ['Confidence', snapshot.confidence],
    ['Confirm on site', snapshot.confirmOnSite.join('; ') || 'None listed'],
    [],
    ['Evidence title', 'Source', 'Start', 'Retrieved', 'Confidence', 'Category', 'State', 'Confirm on site', 'Detail'],
  ]
  const evidenceRows = snapshot.evidence.map(item => [
    item.title,
    item.source,
    item.start,
    item.retrieved,
    item.confidence,
    item.category,
    item.state,
    item.confirmOnSite ? 'yes' : 'no',
    item.detail,
  ])
  return [...header, ...evidenceRows].map(row => row.map(csvCell).join(',')).join('\n')
}

export function downloadCsv(snapshot: ExportSnapshot) {
  const blob = new Blob([snapshotToCsv(snapshot)], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename(snapshot, 'csv'))
}

function wrap(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text || '—', maxWidth) as string[]
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export function downloadPdf(snapshot: ExportSnapshot) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  const width = 210 - margin * 2
  let y = 18

  doc.setFillColor(16, 42, 67)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Heavy transport route check', margin, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`${snapshot.verdict}  ·  ${snapshot.permitName}`, margin, 20)

  y = 38
  doc.setTextColor(16, 24, 40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  y = wrap(doc, snapshot.title, margin, y, width, 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y = wrap(doc, snapshot.summary, margin, y + 2, width)
  if (snapshot.impact) y = wrap(doc, snapshot.impact, margin, y + 1, width)

  y += 6
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(margin, y, width, 42, 2, 2, 'F')
  doc.setFontSize(9)
  const facts: Array<[string, string]> = [
    ['Permit', snapshot.permitNumber || 'Not recorded'],
    ['Route', snapshot.routeLabel],
    ['Vehicle', snapshot.vehicle ? formatVehicleDims(snapshot.vehicle) : 'Not recorded'],
    ['Source', snapshot.source],
    ['Run at', formatBerlinDateTime(snapshot.runAt) || snapshot.runAt],
    ['Retrieved', formatBerlinDateTime(snapshot.retrievedAt) || snapshot.retrievedAt],
    ['Confidence', snapshot.confidence],
    ['Confirm on site', snapshot.confirmOnSite.join('; ') || 'Bridge/clearance still a manual verify item'],
  ]
  facts.forEach((fact, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = margin + 4 + col * (width / 2)
    const fy = y + 6 + row * 9
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 84, 103)
    doc.text(fact[0], x, fy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(16, 24, 40)
    const lines = doc.splitTextToSize(fact[1], width / 2 - 10) as string[]
    doc.text(lines[0] || '—', x, fy + 4)
  })
  y += 50

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Evidence', margin, y)
  y += 6
  doc.setFontSize(9)

  snapshot.evidence.forEach((item, index) => {
    if (y > 270) {
      doc.addPage()
      y = 18
    }
    doc.setDrawColor(228, 231, 236)
    doc.setFillColor(index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 251, index % 2 === 0 ? 255 : 252)
    const blockHeight = 22
    doc.roundedRect(margin, y, width, blockHeight, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(16, 24, 40)
    doc.text(item.title.slice(0, 90), margin + 3, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 84, 103)
    const meta = `${item.source} · start ${item.start} · retrieved ${item.retrieved} · ${item.confidence} · ${item.confirmOnSite ? 'confirm on site' : item.state}`
    y = wrap(doc, meta, margin + 3, y + 10, width - 6, 4)
    y = wrap(doc, item.detail, margin + 3, y, width - 6, 4)
    y += 6
  })

  if (y > 270) {
    doc.addPage()
    y = 18
  }
  doc.setFontSize(8)
  doc.setTextColor(102, 112, 133)
  y = wrap(
    doc,
    'Informational snapshot only. It does not grant permission to depart. Bridge and clearance remain a manual verify item. Monitoring while a tab is open does not replace on-site confirmation.',
    margin,
    y + 4,
    width,
    4,
  )

  doc.save(filename(snapshot, 'pdf'))
}

export function downloadSnapshot(snapshot: ExportSnapshot, format: 'pdf' | 'csv') {
  if (format === 'csv') downloadCsv(snapshot)
  else downloadPdf(snapshot)
}
