import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { test } from 'node:test'
import { pdfBytesFromSnapshot, type ExportSnapshot } from './exportCheck.ts'
import { logoDetailForSize } from '../components/RouteCheckLogo.tsx'

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
