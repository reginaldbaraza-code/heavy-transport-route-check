import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.AUDIT_BASE || 'http://127.0.0.1:8443'
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts/audit-before'
const prefix = process.env.SHOT_PREFIX || 'before'

mkdirSync(outDir, { recursive: true })

const pages = [
  { name: 'overview', path: '/' },
  { name: 'route-checks', path: '/route-checks' },
  { name: 'jobs', path: '/jobs' },
  { name: 'corridor', path: '/map-explorer' },
  { name: 'alerts', path: '/activity' },
  { name: 'settings', path: '/settings' },
  { name: 'data-partners', path: '/data-partners' },
  { name: 'search', path: '/search?q=hamburg' },
  { name: '404', path: '/this-page-does-not-exist' },
]

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
]

async function skipOnboarding(page) {
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) {
    try { await skip.first().click({ timeout: 2000 }) } catch {}
  }
  // Also dismiss if there's a later primary CTA
  const later = page.getByRole('button', { name: /later|not now|continue without/i })
  if (await later.count()) {
    try { await later.first().click({ timeout: 1500 }) } catch {}
  }
}

async function collectIssues(page, label) {
  const issues = await page.evaluate(() => {
    const out = []
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 2) {
      out.push(`horizontal-scroll: scrollWidth=${doc.scrollWidth} clientWidth=${doc.clientWidth}`)
    }
    const styles = getComputedStyle(document.body)
    out.push(`font-family: ${styles.fontFamily}`)
    out.push(`bg: ${styles.backgroundColor}`)

    // Sample common sizes
    const h1 = document.querySelector('h1')
    if (h1) out.push(`h1: ${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).fontWeight} tracking=${getComputedStyle(h1).letterSpacing}`)

    const buttons = [...document.querySelectorAll('button')].slice(0, 40)
    const smallTaps = buttons.filter(b => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40) && getComputedStyle(b).display !== 'none'
    }).length
    if (smallTaps) out.push(`small-tap-targets: ${smallTaps}/${buttons.length} sampled buttons <40px`)

    // Overlap heuristic for corridor overlays
    const kpi = document.querySelector('.live-map-kpis')
    const layers = document.querySelector('.live-layer-panel')
    if (kpi && layers) {
      const a = kpi.getBoundingClientRect()
      const b = layers.getBoundingClientRect()
      const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
      if (overlap) out.push('OVERLAP: KPI box vs Layers panel')
    }
    return out
  })
  return { label, issues }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = []
  const consoleErrors = []

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()
    page.on('pageerror', err => consoleErrors.push(`${vp.name}: ${err.message}`))
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`${vp.name}: ${msg.text()}`)
    })

    for (const route of pages) {
      const label = `${prefix}-${route.name}-${vp.name}`
      await page.goto(base + route.path, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await skipOnboarding(page)
      if (route.name === 'corridor') {
        await page.waitForTimeout(2500)
      } else {
        await page.waitForTimeout(900)
      }
      const path = `${outDir}/${label}.png`
      await page.screenshot({ path, fullPage: false })
      console.log(`wrote ${path}`)
      report.push(await collectIssues(page, label))
    }

    // Route check result (best-effort on local; may need API)
    if (vp.name === '1440x900' || vp.name === '390x844') {
      await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
      await skipOnboarding(page)
      const toggle = page.getByRole('button', { name: /show sample permits/i })
      if (await toggle.count()) await toggle.click()
      const sample = page.getByRole('button', { name: /Simulated READY/i })
      if (await sample.count()) {
        await sample.click()
        const check = page.getByRole('button', { name: 'Check route' })
        if (await check.count()) {
          await check.click()
          try {
            await page.locator('.verdict-banner, .dispatcher-verdict-banner').first().waitFor({ timeout: 45000 })
            await page.waitForTimeout(1500)
            const path = `${outDir}/${prefix}-route-result-${vp.name}.png`
            await page.screenshot({ path, fullPage: false })
            console.log(`wrote ${path}`)
            report.push(await collectIssues(page, `${prefix}-route-result-${vp.name}`))
          } catch (e) {
            console.log(`route result skipped (${vp.name}): ${e.message}`)
            report.push({ label: `${prefix}-route-result-${vp.name}`, issues: [`skipped: ${e.message}`] })
          }
        }
      }
    }

    await context.close()
  }

  writeFileSync(`${outDir}/audit-report.json`, JSON.stringify({ base, report, consoleErrors }, null, 2))
  console.log(`wrote ${outDir}/audit-report.json`)
  console.log('console errors:', consoleErrors.length)
  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
