/**
 * Focused regression check for Layers panel collapse/expand in .live-map-end-stack.
 * Runs corridor overlay overlap + height asserts for Layers open and closed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4181)
const base = `http://127.0.0.1:${port}`
const outDir = '/opt/cursor/artifacts/layers-panel-fix'
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
  { name: '390x800', width: 390, height: 800 },
]

async function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 30000)
    const onData = chunk => {
      const text = String(chunk)
      process.stdout.write(text)
      if (text.includes('QA preview listening')) {
        clearTimeout(timer)
        child.stdout?.off('data', onData)
        resolve()
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', chunk => process.stderr.write(chunk))
    child.on('exit', code => {
      clearTimeout(timer)
      reject(new Error(`Preview server exited ${code}`))
    })
  })
}

async function skipOnboarding(page) {
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) {
    try { await skip.first().click({ timeout: 1500 }) } catch {}
  }
}

async function checkCorridor(page, vp, layersOpen) {
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  await page.locator('.live-layer-panel').waitFor({ timeout: 20000 })
  await page.waitForTimeout(2000)

  const heading = page.locator('.layer-panel-heading')
  const open = await page.locator('.live-layer-panel.open').count()
  if (layersOpen && !open) await heading.click()
  if (!layersOpen && open) await heading.click()
  await page.waitForTimeout(400)

  const result = await page.evaluate(({ layersOpen }) => {
    const q = s => document.querySelector(s)
    const box = el => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return null
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null
      return { t: r.top, l: r.left, b: r.bottom, r: r.right, w: r.width, h: r.height }
    }
    const overlaps = (a, b) => {
      if (!a || !b) return false
      return !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    }

    const panel = q('.live-layer-panel')
    const stack = q('.live-map-end-stack')
    const layers = box(panel)
    const kpi = box(q('.live-map-kpis'))
    const legend = box(q('.live-map-legend'))
    const scale = box(q('.maplibregl-ctrl-scale'))
    const zoom = box(q('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group, .maplibregl-ctrl-top-right .maplibregl-ctrl-group'))
    const attrib = box(q('.maplibregl-ctrl-attrib'))
    const heading = q('.layer-panel-heading')
    const headingH = heading ? heading.getBoundingClientRect().height : 48
    const footer = q('.layer-panel-footer')
    const footerVisible = footer ? (() => {
      const r = footer.getBoundingClientRect()
      const p = panel.getBoundingClientRect()
      return r.height > 0 && r.bottom <= p.bottom + 1 && r.top >= p.top - 1
    })() : !layersOpen
    const list = q('.layer-panel-list')
    const listH = list ? list.getBoundingClientRect().height : 0
    const stackDisplay = stack ? getComputedStyle(stack).display : null
    const stackRows = stack ? getComputedStyle(stack).gridTemplateRows : null

    const issues = []
    if (overlaps(layers, kpi)) issues.push('Layers/KPI overlap')
    if (overlaps(layers, legend)) issues.push('Layers/legend overlap')
    if (overlaps(kpi, legend)) issues.push('KPI/legend overlap')
    if (overlaps(kpi, scale)) issues.push('KPI/scale overlap')
    if (overlaps(kpi, zoom)) issues.push('KPI/zoom overlap')
    if (overlaps(kpi, attrib)) issues.push('KPI/attribution overlap')
    if (overlaps(layers, scale)) issues.push('Layers/scale overlap')
    if (overlaps(legend, scale)) issues.push('legend/scale overlap')
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      issues.push('horizontal-scroll')
    }
    if (layersOpen && !footerVisible) issues.push('Layers footer not visible')
    if (!layersOpen && layers && layers.h > headingH + 12) {
      issues.push(`collapsed Layers too tall (${Math.round(layers.h)}px, heading ${Math.round(headingH)}px)`)
    }
    if (layersOpen && list && listH < 28) {
      issues.push(`Layers list squashed (${Math.round(listH)}px)`)
    }
    if (kpi) {
      const rows = [...document.querySelectorAll('.live-map-kpis div')]
      if (rows.length && rows.some(row => row.getBoundingClientRect().height < 1)) {
        issues.push('KPI row clipped')
      }
    }

    return {
      issues,
      boxes: { layers, kpi, legend, scale, zoom, attrib },
      headingH,
      listH,
      footerVisible,
      stackDisplay,
      stackRows,
      layersOpen,
    }
  }, { layersOpen })

  const tag = layersOpen ? 'layers-open' : 'layers-closed'
  const file = `${outDir}/after-${vp.name}-${tag}.png`
  await page.screenshot({ path: file, fullPage: false })
  return { vp: vp.name, tag, file, ...result }
}

async function main() {
  const preview = spawn('pnpm', ['exec', 'tsx', 'scripts/qa-preview.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)

  const browser = await chromium.launch({ headless: true })
  const report = []
  let failed = 0

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()

    for (const open of [true, false]) {
      const res = await checkCorridor(page, vp, open)
      report.push(res)
      const h = res.boxes.layers ? Math.round(res.boxes.layers.h) : null
      if (res.issues.length) {
        failed += 1
        console.log(`FAIL ${vp.name} ${res.tag} h=${h} rows=${res.stackRows}:`, res.issues.join(', '))
      } else {
        console.log(`PASS ${vp.name} ${res.tag} h=${h} list=${Math.round(res.listH || 0)} rows=${res.stackRows}`)
      }
    }

    await context.close()
  }

  writeFileSync(`${outDir}/layers-collapse-report.json`, JSON.stringify({ failed, report }, null, 2))
  console.log(`wrote ${outDir}/layers-collapse-report.json failed=${failed}`)
  await browser.close()
  preview.kill('SIGTERM')
  if (failed) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
