import { jsPDF, GState } from 'jspdf'
import {
  LANE_DASHOFFSET_LEFT,
  LANE_DASHOFFSET_RIGHT,
  LANE_LEFT_PATH,
  LANE_RIGHT_PATH,
  ROUTE_PATH,
} from '../components/RouteCheckLogo'

function parsePath(d: string) {
  const tokens = d.replace(/,/g, ' ').trim().split(/\s+/)
  const ops: Array<{ cmd: string; nums: number[] }> = []
  let i = 0
  while (i < tokens.length) {
    const cmd = tokens[i]
    if (cmd === 'M' || cmd === 'L') {
      ops.push({ cmd, nums: [Number(tokens[i + 1]), Number(tokens[i + 2])] })
      i += 3
    } else if (cmd === 'C') {
      ops.push({
        cmd,
        nums: [Number(tokens[i + 1]), Number(tokens[i + 2]), Number(tokens[i + 3]), Number(tokens[i + 4]), Number(tokens[i + 5]), Number(tokens[i + 6])],
      })
      i += 7
    } else {
      i += 1
    }
  }
  return ops
}

function strokePath(doc: jsPDF, px: (n: number) => number, py: (n: number) => number, d: string) {
  const ops = parsePath(d)
  for (const op of ops) {
    if (op.cmd === 'M') doc.moveTo(px(op.nums[0]), py(op.nums[1]))
    else if (op.cmd === 'L') doc.lineTo(px(op.nums[0]), py(op.nums[1]))
    else if (op.cmd === 'C') {
      doc.curveTo(px(op.nums[0]), py(op.nums[1]), px(op.nums[2]), py(op.nums[3]), px(op.nums[4]), py(op.nums[5]))
    }
  }
  doc.stroke()
}

/** Draw the route-check mark in the 64×64 viewBox, scaled into a square of `size` mm. */
export function drawRouteCheckLogo(doc: jsPDF, x: number, y: number, size: number) {
  const k = size / 64
  const px = (n: number) => x + n * k
  const py = (n: number) => y + n * k
  const rx = 14.5 * k

  doc.setFillColor(10, 26, 51)
  doc.roundedRect(x, y, size, size, rx, rx, 'F')

  doc.saveGraphicsState()
  doc.setGState(new GState({ 'stroke-opacity': 0.08 }))
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.2)
  doc.roundedRect(x + 0.15, y + 0.15, size - 0.3, size - 0.3, 14 * k, 14 * k, 'S')
  doc.restoreGraphicsState()

  doc.setLineCap('round')
  doc.setLineJoin('round')

  doc.setDrawColor(245, 197, 24)
  doc.setLineWidth(3.2 * k)
  strokePath(doc, px, py, ROUTE_PATH)

  doc.saveGraphicsState()
  doc.setGState(new GState({ 'stroke-opacity': 0.9 }))
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1.1 * k)
  doc.setLineDashPattern([2.2 * k, 2.4 * k], Number(LANE_DASHOFFSET_LEFT) * k)
  strokePath(doc, px, py, LANE_LEFT_PATH)
  doc.setLineDashPattern([2.2 * k, 2.4 * k], Number(LANE_DASHOFFSET_RIGHT) * k)
  strokePath(doc, px, py, LANE_RIGHT_PATH)
  doc.setLineDashPattern([], 0)
  doc.restoreGraphicsState()
}
