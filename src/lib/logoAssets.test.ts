import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { test } from 'node:test'
import { pdfBytesFromSnapshot, type ExportSnapshot } from './exportCheck.ts'
import {
  LANE_LEFT_PATH,
  LANE_RIGHT_PATH,
  ROUTE_PATH,
  ROUTE_PATH_SMALL,
  logoDetailForSize,
} from '../components/RouteCheckLogo.tsx'

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const LFS_PREFIX = 'version https://git-lfs'

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
  const head = bytes.subarray(0, Math.min(bytes.length, 80)).toString('utf8')
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
    bytes.length >= PNG_SIG.length && bytes.subarray(0, PNG_SIG.length).equals(PNG_SIG),
    `${path} does not start with a PNG signature (got ${bytes.subarray(0, 16).toString('latin1')})`,
  )
}

test('public logo PNGs are regular git blobs, not LFS pointers', () => {
  const files = walk('public').filter(path => extname(path).toLowerCase() === '.png')
  assert.ok(files.length >= 4, `expected public icon PNGs, found ${files.length}`)
  for (const path of files) assertPngBlob(path)
  for (const path of walk('public')) {
    assertNotLfsPointer(path, readFileSync(path))
  }
})

test('built dist/ PNGs keep a valid PNG signature when dist exists', () => {
  if (!existsSync('dist')) return
  const files = walk('dist').filter(path => extname(path).toLowerCase() === '.png')
  assert.ok(files.length >= 4, `expected dist icon PNGs after build, found ${files.length}`)
  for (const path of files) assertPngBlob(path)
})

test('logo detail tiers match size breakpoints', () => {
  assert.equal(logoDetailForSize(16), 'small')
  assert.equal(logoDetailForSize(24), 'small')
  assert.equal(logoDetailForSize(32), 'medium')
  assert.equal(logoDetailForSize(48), 'medium')
  assert.equal(logoDetailForSize(64), 'full')
})

test('in-app logo and favicon have no Gaussian blur', () => {
  const favicon = readFileSync('public/favicon.svg', 'utf8')
  const source = readFileSync('src/components/RouteCheckLogo.tsx', 'utf8')
  assert.doesNotMatch(favicon, /feGaussianBlur/)
  assert.doesNotMatch(source, /feGaussianBlur/)
  assert.doesNotMatch(favicon, /clipPath|clip-path/)
})

test('approved mark paths are used verbatim in the app, favicon, PDF, and rasterizer', () => {
  const favicon = readFileSync('public/favicon.svg', 'utf8')
  const source = readFileSync('src/components/RouteCheckLogo.tsx', 'utf8')
  const pdf = readFileSync('src/lib/drawRouteCheckLogo.ts', 'utf8')
  const raster = readFileSync('scripts/rasterize-logo.mjs', 'utf8')
  assert.equal(
    ROUTE_PATH,
    'M7 52 C22 52 36.5 48 36.5 39.5 C36.5 33.5 28.2 30.5 28.2 24.5 C28.2 19.6 34 15.6 39.6 11.8 L47.6 20 L56.6 11',
  )
  assert.equal(
    ROUTE_PATH_SMALL,
    'M8 52 C22 52 36 48 36 40 C36 34 27.5 31 27.5 24.5 C27.5 19.5 33.5 15.5 39 12 L47 20.5 L56 11.5',
  )
  assert.equal(
    LANE_LEFT_PATH,
    'M18.5 46.4 C24.6 44.6 29.4 40.6 30 35.6 C30.2 33.8 29.6 32.4 28.8 31.2',
  )
  assert.equal(
    LANE_RIGHT_PATH,
    'M38.6 31.6 C42.4 35 43.6 40 41.8 44.4 C40.8 47 38.8 49.4 36.2 51.4',
  )
  assert.ok(source.includes(ROUTE_PATH))
  assert.ok(source.includes(ROUTE_PATH_SMALL))
  assert.ok(source.includes(LANE_LEFT_PATH))
  assert.ok(source.includes(LANE_RIGHT_PATH))
  assert.ok(pdf.includes('LANE_LEFT_PATH') && pdf.includes('LANE_RIGHT_PATH'))
  assert.ok(favicon.includes(ROUTE_PATH_SMALL))
  assert.ok(!favicon.includes(ROUTE_PATH))
  assert.doesNotMatch(favicon, /stroke-dasharray/)
  assert.match(favicon, /stroke-width="5.2"/)
  assert.ok(raster.includes(ROUTE_PATH))
  assert.ok(raster.includes(LANE_LEFT_PATH))
  assert.ok(raster.includes(LANE_RIGHT_PATH))
  assert.match(source, /#F5C518/)
  assert.match(source, /#F0A500/)
  assert.match(source, /#13294B/)
  assert.match(source, /#0A1A33/)
})

test('PDF header draws the mark as vectors, not an LFS/PNG asset', () => {
  const snapshot = {
    verdict: 'VERIFY',
    title: 'Logo check',
    summary: 'Vector mark',
    impact: '',
    permitNumber: 'DE-TEST',
    permitName: 'Test',
    routeLabel: 'A7',
    vehicle: null,
    source: 'test',
    runAt: '2026-11-09T12:00:00Z',
    retrievedAt: '2026-11-09T12:00:00Z',
    confidence: 'medium',
    evidence: [],
    confirmOnSite: [],
    onSiteConfirmations: [],
  }
  const bytes = Buffer.from(new Uint8Array(pdfBytesFromSnapshot(snapshot as ExportSnapshot)))
  const latin1 = bytes.toString('latin1')
  assert.doesNotMatch(latin1, new RegExp(LFS_PREFIX))
  assert.doesNotMatch(latin1, /\/Subtype \/Image/)
  assert.match(latin1, /Heavy transport route check/)
  assert.doesNotMatch(latin1, /\bMSD\b/)
  assert.match(latin1, /\sc\n/)
})
