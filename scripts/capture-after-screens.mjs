import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4175)
const base = `http://127.0.0.1:${port}`
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts/audit-after'
const prefix = process.env.SHOT_PREFIX || 'after'

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
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
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
    try { await skip.first().click({ timeout: 2000 }) } catch {}
  }
}

async function collectIssues(page, label) {
  return page.evaluate(label => {
    const out = { label, issues: [] }
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 2) {
      out.issues.push(`horizontal-scroll: ${doc.scrollWidth}>${doc.clientWidth}`)
    }
    const kpi = document.querySelector('.live-map-kpis')
    const layers = document.querySelector('.live-layer-panel')
    if (kpi && layers) {
      const a = kpi.getBoundingClientRect()
      const b = layers.getBoundingClientRect()
      const overlap = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
      if (overlap) out.issues.push('OVERLAP: KPI vs Layers')
    }
    const h1 = document.querySelector('h1')
    if (h1) {
      const s = getComputedStyle(h1)
      out.issues.push(`h1=${s.fontSize}/${s.fontWeight}`)
    }
    out.issues.push(`font=${getComputedStyle(document.body).fontFamily.split(',')[0]}`)
    return out
  }, label)
}

async function runCheck(page) {
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  const toggle = page.getByRole('button', { name: /show sample permits/i })
  if (await toggle.count()) await toggle.click()
  await page.waitForTimeout(400)
  const sample = page.getByRole('button', { name: /Simulated READY/i })
  if (!(await sample.count())) {
    // fallback first sample card
    const any = page.locator('.sample-permit-list button, .permit-sample-list button, [class*="sample"] button').first()
    if (await any.count()) await any.click()
  } else {
    await sample.click()
  }
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner, .dispatcher-verdict-banner').first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(1800)
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
  const consoleErrors = []

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()
    page.on('pageerror', err => consoleErrors.push(`${vp.name}: ${err.message}`))
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`${vp.name}: ${msg.text()}`)
    })

    for (const route of pages) {
      // Skip some pages on tablet to keep artifact set focused but still cover required sizes for key pages
      if (vp.name === '1280x800' && !['overview', 'corridor', 'route-checks'].includes(route.name)) continue
      await page.goto(base + route.path, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await skipOnboarding(page)
      await page.waitForTimeout(route.name === 'corridor' ? 2800 : 900)
      const file = `${outDir}/${prefix}-${route.name}-${vp.name}.png`
      await page.screenshot({ path: file, fullPage: false })
      console.log(`wrote ${file}`)
      report.push(await collectIssues(page, `${prefix}-${route.name}-${vp.name}`))
    }

    try {
      await runCheck(page)
      const file = `${outDir}/${prefix}-route-result-${vp.name}.png`
      await page.screenshot({ path: file, fullPage: false })
      console.log(`wrote ${file}`)
      report.push(await collectIssues(page, `${prefix}-route-result-${vp.name}`))
    } catch (e) {
      console.log(`route result failed (${vp.name}): ${e.message}`)
      report.push({ label: `${prefix}-route-result-${vp.name}`, issues: [`failed: ${e.message}`] })
    }

    await context.close()
  }

  writeFileSync(`${outDir}/audit-report.json`, JSON.stringify({ base, report, consoleErrors }, null, 2))
  console.log(`wrote ${outDir}/audit-report.json`)
  console.log('console errors:', consoleErrors.length)
  await browser.close()
  preview.kill('SIGTERM')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
