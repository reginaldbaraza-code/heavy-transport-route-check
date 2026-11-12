import { jsPDF } from "jspdf"

// Direction B "Autobahn Plate" — 64-unit master, vector only (no images, no gradients, no GState).
// Keep these literals in sync with src/components/RouteCheckLogo.tsx (asserted in logoAssets.test.ts).
const BLUE: [number, number, number] = [0, 113, 227] // --accent #0071e3
const NAVY: [number, number, number] = [12, 36, 57] // --navy #0c2439
const WHITE: [number, number, number] = [255, 255, 255]
const YELLOW: [number, number, number] = [245, 197, 24] // #f5c518
const ROAD = [
  [30, 24],
  [34, 24],
  [50, 52],
  [14, 52],
] as const
const DASHES = [
  [30, 38, 4, 5],
  [30, 46, 4, 6],
] as const
const DIAMOND = [
  [32, 15],
  [42, 25],
  [32, 35],
  [22, 25],
] as const

function polygon(
  doc: jsPDF,
  pts: ReadonlyArray<readonly [number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
  style: "F" | "FD",
) {
  const [x0, y0] = pts[0]
  const segs = pts
    .slice(1)
    .map(([x, y], i) => [px(x) - px(pts[i][0]), py(y) - py(pts[i][1])])
  doc.lines(segs, px(x0), py(y0), [1, 1], style, true)
}

/** Draw the Autobahn Plate mark into a `size` mm square. tone 'dark' = on dark backgrounds (white rim). */
export function drawRouteCheckLogo(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  tone: "dark" | "light" = "dark",
) {
  const k = size / 64
  const px = (n: number) => x + n * k
  const py = (n: number) => y + n * k
  if (tone === "dark") {
    doc.setFillColor(...WHITE)
    doc.roundedRect(x, y, size, size, 14 * k, 14 * k, "F")
    doc.setFillColor(...BLUE)
    doc.roundedRect(px(3), py(3), 58 * k, 58 * k, 11 * k, 11 * k, "F")
  } else {
    doc.setFillColor(...BLUE)
    doc.roundedRect(x, y, size, size, 14 * k, 14 * k, "F")
    doc.setDrawColor(...WHITE)
    doc.setLineWidth(3 * k)
    doc.roundedRect(px(5.5), py(5.5), 53 * k, 53 * k, 9 * k, 9 * k, "S")
  }
  doc.setFillColor(...WHITE)
  polygon(doc, ROAD, px, py, "F")
  doc.setFillColor(...BLUE)
  for (const [dx, dy, w, h] of DASHES)
    doc.rect(px(dx), py(dy), w * k, h * k, "F")
  // Checkpoint diamond: yellow fill + navy stroke (9.7:1 vs yellow; separates it from road and plate)
  doc.setFillColor(...YELLOW)
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(3 * k)
  doc.setLineJoin("miter")
  polygon(doc, DIAMOND, px, py, "FD")
  doc.setLineJoin("round")
}
