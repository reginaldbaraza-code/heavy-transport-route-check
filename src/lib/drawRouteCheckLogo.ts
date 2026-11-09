import { jsPDF, GState } from 'jspdf'

/** Draw the route-check mark in the 64×64 viewBox, scaled into a square of `size` mm. */
export function drawRouteCheckLogo(doc: jsPDF, x: number, y: number, size: number) {
  const k = size / 64
  const px = (n: number) => x + n * k
  const py = (n: number) => y + n * k
  const rx = 14 * k

  doc.saveGraphicsState()
  doc.setFillColor(10, 26, 51)
  doc.roundedRect(x, y, size, size, rx, rx, 'F')
  doc.roundedRect(x, y, size, size, rx, rx, null)
  doc.clip()

  doc.setLineCap('round')
  doc.setLineJoin('round')

  doc.setGState(new GState({ 'stroke-opacity': 0.7 }))
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1.12 * k)
  doc.setLineDashPattern([2.4 * k, 2.75 * k], 0)
  doc.moveTo(px(19.2), py(43.6))
  doc.curveTo(px(24.8), py(42), px(28.6), py(37.4), px(29.6), py(30.6))
  doc.stroke()
  doc.moveTo(px(33), py(54.4))
  doc.curveTo(px(40.6), py(49.6), px(44.8), py(43.2), px(42.6), py(36.8))
  doc.stroke()
  doc.setLineDashPattern([], 0)
  doc.setGState(new GState({ 'stroke-opacity': 1 }))

  doc.setDrawColor(245, 197, 24)
  doc.setLineWidth(5 * k)
  doc.moveTo(px(-2), py(51.8))
  doc.curveTo(px(14), py(51.8), px(20), py(51.5), px(26), py(48.4))
  doc.curveTo(px(35.2), py(43.8), px(43.2), py(40.4), px(40.2), py(33.8))
  doc.curveTo(px(37.4), py(27.8), px(33), py(26.2), px(31.5), py(22.8))
  doc.curveTo(px(30), py(19), px(34.2), py(15.4), px(39.8), py(13.35))
  doc.lineTo(px(46.5), py(19.7))
  doc.lineTo(px(56.75), py(10.05))
  doc.stroke()
  doc.restoreGraphicsState()
}
