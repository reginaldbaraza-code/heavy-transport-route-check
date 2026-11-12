import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4180)
const base = `http://127.0.0.1:${port}`
const outDir = '/opt/cursor/artifacts/audit-after-v2'
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

function box(el) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return null
  return { t: r.top, l: r.left, b: r.bottom, r: r.right, w: r.width, h: r.height }
}

function overlaps(a, b, pad = 0) {
  if (!a || !b) return false
  return !(a.r <= b.l + pad || a.l >= b.r - pad || a.b <= b.t + pad || a.t >= b.b - pad)
}

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
  await page.waitForTimeout(2500)

  const heading = page.locator('.layer-panel-heading')
  if (await heading.count()) {
    const open = await page.locator('.live-layer-panel.open').count()
    if (layersOpen && !open) await heading.click()
    if (!layersOpen && open) await heading.click()
    await page.waitForTimeout(400)
  }

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

    const layers = box(q('.live-layer-panel'))
    const kpi = box(q('.live-map-kpis'))
    const legend = box(q('.live-map-legend'))
    const scale = box(q('.maplibregl-ctrl-scale'))
    const zoom = box(q('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group, .maplibregl-ctrl-top-right .maplibregl-ctrl-group'))
    const attrib = box(q('.maplibregl-ctrl-attrib'))
    const footer = q('.layer-panel-footer')
    const footerVisible = footer ? (() => {
      const r = footer.getBoundingClientRect()
      const panel = q('.live-layer-panel')
      if (!panel) return false
      const p = panel.getBoundingClientRect()
      return r.height > 0 && r.bottom <= p.bottom + 1 && r.top >= p.top - 1
    })() : !layersOpen

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
    if (kpi) {
      const rows = [...document.querySelectorAll('.live-map-kpis div')]
      if (rows.length && rows.some(row => row.getBoundingClientRect().height < 1)) {
        issues.push('KPI row clipped')
      }
    }

    // Header / legend single-line checks
    const actionButtons = [...document.querySelectorAll('.live-map-header-actions button')]
    for (const btn of actionButtons) {
      const r = btn.getBoundingClientRect()
      if (r.height > 44) issues.push(`header button wrapped (${btn.getAttribute('aria-label') || btn.textContent})`)
    }
    const legendEl = q('.live-map-legend')
    if (legendEl) {
      const r = legendEl.getBoundingClientRect()
      // more than ~2 lines of 12px text
      if (r.height > 40) issues.push(`legend wrapped height=${Math.round(r.height)}`)
    }

    return { issues, boxes: { layers, kpi, legend, scale, zoom, attrib }, footerVisible, layersOpen }
  }, { layersOpen })

  const tag = layersOpen ? 'layers-open' : 'layers-closed'
  const file = `${outDir}/corridor-${vp.name}-${tag}.png`
  await page.screenshot({ path: file, fullPage: false })
  return { vp: vp.name, tag, file, ...result }
}

async function checkRouteResult(page, vp) {
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated READY/i }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner, .dispatcher-verdict-banner').first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(1800)

  const result = await page.evaluate(() => {
    const q = s => document.querySelector(s)
    const box = el => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return null
      return { t: r.top, l: r.left, b: r.bottom, r: r.right, w: r.width, h: r.height }
    }
    const overlaps = (a, b) => {
      if (!a || !b) return false
      return !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    }
    const card = box(q('.route-map-gl-legend'))
    const zoom = box(q('.route-map-gl .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group, .route-map-gl .maplibregl-ctrl-group'))
    const attrib = box(q('.route-map-gl .maplibregl-ctrl-attrib'))
    const issues = []
    if (overlaps(card, zoom)) issues.push('route-card/zoom overlap')
    if (overlaps(card, attrib)) issues.push('route-card/attribution overlap')
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      issues.push('horizontal-scroll')
    }
    return { issues, boxes: { card, zoom, attrib } }
  })

  const file = `${outDir}/route-result-${vp.name}.png`
  await page.screenshot({ path: file, fullPage: false })
  return { vp: vp.name, file, ...result }
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

    // Overview / other pages for screenshots at key sizes
    if (['1440x900', '1280x800', '390x844'].includes(vp.name)) {
      for (const route of [
        { name: 'overview', path: '/' },
        { name: 'route-checks', path: '/route-checks' },
        { name: 'jobs', path: '/jobs' },
        { name: 'alerts', path: '/activity' },
        { name: 'settings', path: '/settings' },
        { name: 'data-partners', path: '/data-partners' },
        { name: 'search', path: '/search?q=hamburg' },
        { name: '404', path: '/missing-page' },
      ]) {
        await page.goto(base + route.path, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await skipOnboarding(page)
        await page.waitForTimeout(700)
        await page.screenshot({ path: `${outDir}/${route.name}-${vp.name}.png`, fullPage: false })
      }
    }

    for (const open of [true, false]) {
      const res = await checkCorridor(page, vp, open)
      report.push({ kind: 'corridor', ...res })
      if (res.issues.length) {
        failed += 1
        console.log(`FAIL corridor ${vp.name} ${res.tag}:`, res.issues.join(', '))
      } else {
        console.log(`PASS corridor ${vp.name} ${res.tag}`)
      }
    }

    if (['1440x900', '1280x800', '390x844'].includes(vp.name)) {
      const res = await checkRouteResult(page, vp)
      report.push({ kind: 'route-result', ...res })
      if (res.issues.length) {
        failed += 1
        console.log(`FAIL route-result ${vp.name}:`, res.issues.join(', '))
      } else {
        console.log(`PASS route-result ${vp.name}`)
      }
    }

    await context.close()
  }

  writeFileSync(`${outDir}/overlap-report.json`, JSON.stringify({ failed, report }, null, 2))
  console.log(`wrote ${outDir}/overlap-report.json failed=${failed}`)
  await browser.close()
  preview.kill('SIGTERM')
  if (failed) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
