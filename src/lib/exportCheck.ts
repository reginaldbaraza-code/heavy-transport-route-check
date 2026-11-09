import { jsPDF } from 'jspdf'
import type { RouteEvidence, RouteVerdict } from '../data/routeChecks'
import { formatBerlinDateTime } from './formatTime'
import { formatVehicleDims, type VehicleDims } from './jobs'
import type { RouteCheckResult } from './routeCheck'
import { formatOnSiteConfirmationLine, stripUnresolvedVerifyCopy } from './siteAcknowledgements'

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
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export type ExportAcknowledgement = {
  title: string
  acknowledgedBy: string
  acknowledgedAt: string
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
  onSiteConfirmations: ExportAcknowledgement[]
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
    acknowledgedBy: item.acknowledgedBy || '',
    acknowledgedAt: item.acknowledgedAt ? formatBerlinDateTime(item.acknowledgedAt) : '',
  }
}

function acknowledgementRows(evidence: RouteEvidence[]): ExportAcknowledgement[] {
  return evidence
    .filter(item => item.acknowledgedBy && item.acknowledgedAt)
    .map(item => ({
      title: item.title,
      acknowledgedBy: item.acknowledgedBy || '',
      acknowledgedAt: formatBerlinDateTime(item.acknowledgedAt) || item.acknowledgedAt || '',
    }))
}

function readyCopy(verdict: RouteVerdict | string, summary: string, impact: string, acks: Array<{ acknowledgedBy?: string; acknowledgedAt?: string }>) {
  if (verdict !== 'READY') return { summary, impact }
  return {
    summary: acks.length ? formatOnSiteConfirmationLine(acks) : summary,
    impact: stripUnresolvedVerifyCopy(impact || ''),
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
  const sourceEvidence = result.evidence || []
  const evidence = sourceEvidence.map(item => evidenceRow(item, result.retrievedAt))
  const onSiteConfirmations = acknowledgementRows(sourceEvidence)
  const copy = readyCopy(result.verdict, result.summary, result.impact, sourceEvidence.filter(item => item.acknowledgedBy))
  return {
    verdict: result.verdict,
    title: result.title,
    summary: copy.summary,
    impact: copy.impact,
    permitNumber: meta.permitNumber || '',
    permitName: meta.permitName || `${result.route.origin} → ${result.route.destination}`,
    routeLabel: `${result.route.origin} → ${result.route.destination}`,
    vehicle: meta.vehicle ?? null,
    source: result.source || 'Autobahn GmbH',
    runAt: meta.runAt || result.retrievedAt || new Date().toISOString(),
    retrievedAt: result.retrievedAt || meta.runAt || new Date().toISOString(),
    confidence: result.confidence,
    evidence,
    confirmOnSite: confirmOnSiteTitles(sourceEvidence),
    onSiteConfirmations,
  }
}

export function snapshotFromHistory(record: HistoryExportRecord): ExportSnapshot {
  const sourceEvidence = (record.evidence || []) as RouteEvidence[]
  const evidence = sourceEvidence.map(item => evidenceRow(item, record.retrievedAt))
  const onSiteConfirmations = acknowledgementRows(sourceEvidence)
  const copy = readyCopy(record.verdict, record.summary, record.impact || '', sourceEvidence.filter(item => item.acknowledgedBy))
  return {
    verdict: record.verdict,
    title: record.title || `Route check: ${record.verdict}`,
    summary: copy.summary,
    impact: copy.impact,
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
    onSiteConfirmations,
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
    ['On-site confirmations', snapshot.onSiteConfirmations?.length
      ? formatOnSiteConfirmationLine(snapshot.onSiteConfirmations)
      : 'None listed'],
    [],
    ['On-site confirmation title', 'Confirmed by', 'Confirmed at'],
    ...(snapshot.onSiteConfirmations || []).map(item => [item.title, item.acknowledgedBy, item.acknowledgedAt]),
    [],
    ['Evidence title', 'Source', 'Start', 'Retrieved', 'Confidence', 'Category', 'State', 'Confirm on site', 'Confirmed by', 'Confirmed at', 'Detail'],
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
    item.acknowledgedBy || '',
    item.acknowledgedAt || '',
    item.detail,
  ])
  return [...header, ...evidenceRows].map(row => row.map(csvCell).join(',')).join('\n')
}

export function downloadCsv(snapshot: ExportSnapshot) {
  const blob = new Blob([snapshotToCsv(snapshot)], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename(snapshot, 'csv'))
}

/** jsPDF Helvetica is WinAnsi. Keep German umlauts; replace arrows and other Unicode. */
export function sanitizePdfText(value: string | number | boolean | null | undefined): string {
  let text = String(value ?? '')
  text = text
    .replace(/\u2192|\u21D2|\u2794|\u279C|\u27A1|\uFFEB/g, '->')
    .replace(/\u2190|\u21D0/g, '<-')
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2026/g, '...')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, ' ')
  // Keep Latin-1 (ä ö ü ß ·) and ASCII; drop the rest so jsPDF does not emit '!' or char spacing.
  text = text.replace(/[^\t\n\r\x20-\x7E\u00A0-\u00FF]/g, '')
  return text
}

function pdfText(doc: jsPDF, text: string | string[], x: number, y: number) {
  doc.setCharSpace(0)
  const value = Array.isArray(text) ? text.map(sanitizePdfText) : sanitizePdfText(text)
  doc.text(value, x, y)
}

const PAGE_TOP = 16
const PAGE_BOTTOM = 282

function wrapLines(doc: jsPDF, text: string, maxWidth: number) {
  return doc.splitTextToSize(sanitizePdfText(text || '-'), maxWidth) as string[]
}

function startPage(doc: jsPDF) {
  doc.addPage()
  doc.setCharSpace(0)
  return PAGE_TOP
}

function writeLines(doc: jsPDF, lines: string[], x: number, y: number, lineHeight: number, paginate = true) {
  if (!paginate) {
    pdfText(doc, lines, x, y)
    return y + lines.length * lineHeight
  }
  for (const line of lines) {
    if (y + lineHeight > PAGE_BOTTOM) y = startPage(doc)
    pdfText(doc, line, x, y)
    y += lineHeight
  }
  return y
}

function wrap(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  return writeLines(doc, wrapLines(doc, text, maxWidth), x, y, lineHeight)
}

function drawEvidenceCard(
  doc: jsPDF,
  item: ExportEvidence,
  index: number,
  y: number,
  margin: number,
  width: number,
) {
  const innerW = width - 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const titleLines = wrapLines(doc, item.title, innerW)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const meta = `${item.source} · start ${item.start} · retrieved ${item.retrieved} · ${item.confidence} · ${item.confirmOnSite ? 'confirm on site' : item.state}`
  const metaLines = wrapLines(doc, meta, innerW)
  const detailLines = wrapLines(doc, item.detail, innerW)
  const ackLine = item.acknowledgedBy
    ? `Confirmed on site by ${item.acknowledgedBy} at ${item.acknowledgedAt}`
    : ''
  const ackLines = ackLine ? wrapLines(doc, ackLine, innerW) : []
  const titleH = 4.8
  const bodyH = 4.2
  const padTop = 5.5
  const padBottom = 4
  const textHeight = titleLines.length * titleH
    + metaLines.length * bodyH
    + detailLines.length * bodyH
    + ackLines.length * bodyH
  const cardHeight = padTop + textHeight + padBottom
  const usable = PAGE_BOTTOM - PAGE_TOP
  const even = index % 2 === 0
  const fill: [number, number, number] = even ? [255, 255, 255] : [250, 251, 252]

  const paintCard = (top: number, height: number) => {
    doc.setDrawColor(228, 231, 236)
    doc.setFillColor(...fill)
    doc.roundedRect(margin, top, width, height, 1.5, 1.5, 'FD')
  }

  const writeBody = (startY: number, paginate: boolean) => {
    let ty = startY
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(16, 24, 40)
    ty = writeLines(doc, titleLines, margin + 4, ty, titleH, paginate)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 84, 103)
    ty = writeLines(doc, metaLines, margin + 4, ty, bodyH, paginate)
    ty = writeLines(doc, detailLines, margin + 4, ty, bodyH, paginate)
    if (ackLines.length) {
      doc.setTextColor(22, 101, 52)
      ty = writeLines(doc, ackLines, margin + 4, ty, bodyH, paginate)
    }
    return ty
  }

  if (cardHeight + 2 <= usable) {
    if (y + cardHeight > PAGE_BOTTOM) y = startPage(doc)
    paintCard(y, cardHeight)
    writeBody(y + padTop, false)
    return y + cardHeight + 3
  }

  if (y + 24 > PAGE_BOTTOM) y = startPage(doc)
  const after = writeBody(y + padTop, true)
  return after + 4
}

export function createPdfDocument(snapshot: ExportSnapshot) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setCharSpace(0)
  const margin = 16
  const width = 210 - margin * 2
  let y = 18
  const confirmations = snapshot.onSiteConfirmations
    || snapshot.evidence.filter(item => item.acknowledgedBy).map(item => ({
      title: item.title,
      acknowledgedBy: item.acknowledgedBy || '',
      acknowledgedAt: item.acknowledgedAt || '',
    }))

  doc.setFillColor(16, 42, 67)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  pdfText(doc, 'Heavy transport route check', margin, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  pdfText(doc, wrapLines(doc, `${snapshot.verdict}  ·  ${snapshot.permitName}`, width)[0], margin, 20)

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
  const colW = width / 2 - 10
  const factRows: Array<Array<{ label: string; lines: string[] }>> = []
  for (let i = 0; i < facts.length; i += 2) {
    const left = facts[i]
    const right = facts[i + 1]
    factRows.push([
      { label: left[0], lines: wrapLines(doc, left[1], colW) },
      ...(right ? [{ label: right[0], lines: wrapLines(doc, right[1], colW) }] : []),
    ])
  }
  const factHeight = factRows.reduce((sum, row) => {
    const lines = Math.max(...row.map(cell => cell.lines.length), 1)
    return sum + 7 + lines * 4
  }, 8)
  if (y + factHeight > PAGE_BOTTOM) y = startPage(doc)
  doc.roundedRect(margin, y, width, factHeight, 2, 2, 'F')
  let fy = y + 6
  factRows.forEach(row => {
    row.forEach((cell, col) => {
      const x = margin + 4 + col * (width / 2)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 84, 103)
      pdfText(doc, cell.label, x, fy)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(16, 24, 40)
      pdfText(doc, cell.lines, x, fy + 4)
    })
    const lines = Math.max(...row.map(cell => cell.lines.length), 1)
    fy += 7 + lines * 4
  })
  y += factHeight + 8

  if (confirmations.length) {
    if (y + 16 > PAGE_BOTTOM) y = startPage(doc)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(16, 24, 40)
    pdfText(doc, 'On-site confirmations', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const summaryLine = formatOnSiteConfirmationLine(confirmations)
    if (summaryLine) y = wrap(doc, summaryLine, margin, y, width, 4.5)
    confirmations.forEach(item => {
      y = wrap(doc, `${item.title} - confirmed by ${item.acknowledgedBy} at ${item.acknowledgedAt}`, margin, y, width, 4.2)
    })
    y += 4
  }

  if (y + 12 > PAGE_BOTTOM) y = startPage(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(16, 24, 40)
  pdfText(doc, 'Evidence', margin, y)
  y += 6

  snapshot.evidence.forEach((item, index) => {
    y = drawEvidenceCard(doc, item, index, y, margin, width)
  })

  if (y + 16 > PAGE_BOTTOM) y = startPage(doc)
  doc.setFontSize(8)
  doc.setTextColor(102, 112, 133)
  wrap(
    doc,
    'Informational snapshot only. It does not grant permission to depart. Bridge and clearance remain a manual verify item. Monitoring while a tab is open does not replace on-site confirmation.',
    margin,
    y + 4,
    width,
    4,
  )

  return doc
}

export function pdfBytesFromSnapshot(snapshot: ExportSnapshot): ArrayBuffer {
  return createPdfDocument({
    ...snapshot,
    evidence: snapshot.evidence || [],
    confirmOnSite: snapshot.confirmOnSite || [],
    onSiteConfirmations: snapshot.onSiteConfirmations || [],
  }).output('arraybuffer')
}

export function downloadPdf(snapshot: ExportSnapshot) {
  createPdfDocument(snapshot).save(filename(snapshot, 'pdf'))
}

export function downloadSnapshot(snapshot: ExportSnapshot, format: 'pdf' | 'csv') {
  if (format === 'csv') downloadCsv(snapshot)
  else downloadPdf(snapshot)
}
