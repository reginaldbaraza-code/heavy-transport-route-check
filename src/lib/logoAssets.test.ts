import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"
import { test } from "node:test"
import { pdfBytesFromSnapshot, type ExportSnapshot } from "./exportCheck.ts"
import {
  CHECK_16,
  CHECK_RING_16,
  CHECKPOINT,
  DASH_16,
  DASHES_64,
  DIAMOND_64,
  NAVY,
  PLATE,
  ROAD_16,
  ROAD_64,
  logoDetailForSize,
} from "../components/RouteCheckLogo.tsx"

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const LFS_PREFIX = "version https://git-lfs"

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

function assertNotLfsPointer(path: string, bytes: Buffer) {
  const head = bytes.subarray(0, Math.min(bytes.length, 80)).toString("utf8")
  assert.doesNotMatch(
    head,
    /^version https:\/\/git-lfs/,
    `${path} is a Git LFS pointer, not file contents`,
  )
}

function assertPngBlob(path: string) {
  const bytes = readFileSync(path)
  assertNotLfsPointer(path, bytes)
  assert.ok(
    bytes.length >= PNG_SIG.length &&
      bytes.subarray(0, PNG_SIG.length).equals(PNG_SIG),
    `${path} does not start with a PNG signature (got ${bytes.subarray(0, 16).toString("latin1")})`,
  )
}

test("public logo PNGs are regular git blobs, not LFS pointers", () => {
  const files = walk("public").filter(
    (path) => extname(path).toLowerCase() === ".png",
  )
  assert.ok(
    files.length >= 4,
    `expected public icon PNGs, found ${files.length}`,
  )
  for (const path of files) assertPngBlob(path)
  for (const path of walk("public")) {
    assertNotLfsPointer(path, readFileSync(path))
  }
})

test("built dist/ PNGs keep a valid PNG signature when dist exists", () => {
  if (!existsSync("dist")) return
  const files = walk("dist").filter(
    (path) => extname(path).toLowerCase() === ".png",
  )
  assert.ok(
    files.length >= 4,
    `expected dist icon PNGs after build, found ${files.length}`,
  )
  for (const path of files) assertPngBlob(path)
})

test("logo detail tiers match size breakpoints", () => {
  assert.equal(logoDetailForSize(16), "small")
  assert.equal(logoDetailForSize(20), "small")
  assert.equal(logoDetailForSize(21), "full")
  assert.equal(logoDetailForSize(24), "full")
  assert.equal(logoDetailForSize(32), "full")
  assert.equal(logoDetailForSize(64), "full")
})

test("in-app logo and favicon have no Gaussian blur", () => {
  const favicon = readFileSync("public/favicon.svg", "utf8")
  const source = readFileSync("src/components/RouteCheckLogo.tsx", "utf8")
  assert.doesNotMatch(favicon, /feGaussianBlur/)
  assert.doesNotMatch(source, /feGaussianBlur/)
  assert.doesNotMatch(favicon, /clipPath|clip-path/)
})

test("Autobahn Plate geometry and colors are used verbatim", () => {
  const favicon = readFileSync("public/favicon.svg", "utf8")
  const source = readFileSync("src/components/RouteCheckLogo.tsx", "utf8")
  const pdf = readFileSync("src/lib/drawRouteCheckLogo.ts", "utf8")

  assert.equal(ROAD_64, "M30 24 H34 L50 52 H14 Z")
  assert.deepEqual(DASHES_64, [
    [30, 38, 4, 5],
    [30, 46, 4, 6],
  ])
  assert.equal(DIAMOND_64, "M32 15 L42 25 L32 35 L22 25 Z")
  assert.deepEqual(ROAD_16, [
    [7, 3, 2, 2],
    [6, 5, 4, 2],
    [5, 7, 6, 2],
    [4, 9, 8, 2],
    [3, 11, 10, 2],
  ])
  assert.deepEqual(DASH_16, [7, 11, 2, 2])
  assert.deepEqual(CHECK_RING_16, [5, 4, 6, 5])
  assert.deepEqual(CHECK_16, [6, 5, 4, 3])
  assert.equal(PLATE, "#0071e3")
  assert.equal(CHECKPOINT, "#f5c518")
  assert.equal(NAVY, "#0c2439")

  assert.ok(source.includes(ROAD_64))
  assert.ok(source.includes(DIAMOND_64))
  assert.ok(source.includes(PLATE))
  assert.ok(source.includes(CHECKPOINT))
  assert.ok(source.includes(NAVY))

  assert.ok(favicon.includes('x="7" y="3" width="2" height="2"'))
  assert.ok(favicon.includes('x="6" y="5" width="4" height="2"'))
  assert.ok(favicon.includes('x="5" y="7" width="6" height="2"'))
  assert.ok(favicon.includes('x="4" y="9" width="8" height="2"'))
  assert.ok(favicon.includes('x="3" y="11" width="10" height="2"'))
  assert.ok(favicon.includes('x="7" y="11" width="2" height="2"'))
  assert.ok(favicon.includes('x="5" y="4" width="6" height="5"'))
  assert.ok(favicon.includes('x="6" y="5" width="4" height="3"'))
  assert.doesNotMatch(favicon, /<path/)
  assert.doesNotMatch(favicon, /stroke-dasharray|stroke-width/)

  assert.ok(pdf.includes("[30, 24]") || pdf.includes("[30,24]"))
  assert.match(pdf, /\[30,\s*24\]/)
  assert.match(pdf, /\[34,\s*24\]/)
  assert.match(pdf, /\[50,\s*52\]/)
  assert.match(pdf, /\[14,\s*52\]/)
  assert.match(pdf, /\[32,\s*15\]/)
  assert.match(pdf, /\[42,\s*25\]/)
  assert.match(pdf, /\[32,\s*35\]/)
  assert.match(pdf, /\[22,\s*25\]/)

  for (const file of [source, favicon, pdf]) {
    assert.match(file, /#0071e3/i)
    assert.match(file, /#f5c518/i)
    assert.match(file, /#0c2439/i)
    assert.doesNotMatch(file, /#F0A500/i)
    assert.doesNotMatch(file, /#13294B/i)
    assert.doesNotMatch(file, /#0A1A33/i)
  }
})

test("PDF header draws the mark as vectors, not an LFS/PNG asset", () => {
  const snapshot = {
    verdict: "VERIFY",
    title: "Logo check",
    summary: "Vector mark",
    impact: "",
    permitNumber: "DE-TEST",
    permitName: "Test",
    routeLabel: "A7",
    vehicle: null,
    source: "test",
    runAt: "2026-11-09T12:00:00Z",
    retrievedAt: "2026-11-09T12:00:00Z",
    confidence: "medium",
    evidence: [],
    confirmOnSite: [],
    onSiteConfirmations: [],
  }
  const bytes = Buffer.from(
    new Uint8Array(pdfBytesFromSnapshot(snapshot as ExportSnapshot)),
  )
  const latin1 = bytes.toString("latin1")
  assert.doesNotMatch(latin1, new RegExp(LFS_PREFIX))
  assert.doesNotMatch(latin1, /\/Subtype \/Image/)
  assert.match(latin1, /Heavy transport route check/)
  assert.doesNotMatch(latin1, /\bMSD\b/)
  assert.match(latin1, /\sc\n/)
})

test("PDF bytes include a fill-and-stroke operator for the diamond", () => {
  const snapshot = {
    verdict: "VERIFY",
    title: "Logo check",
    summary: "Vector mark",
    impact: "",
    permitNumber: "DE-TEST",
    permitName: "Test",
    routeLabel: "A7",
    vehicle: null,
    source: "test",
    runAt: "2026-11-09T12:00:00Z",
    retrievedAt: "2026-11-09T12:00:00Z",
    confidence: "medium",
    evidence: [],
    confirmOnSite: [],
    onSiteConfirmations: [],
  }
  const bytes = Buffer.from(
    new Uint8Array(pdfBytesFromSnapshot(snapshot as ExportSnapshot)),
  )
  const latin1 = bytes.toString("latin1")
  assert.match(latin1, /(?:^|[\s])[Bb](?:[\s]|$)/m)
})
