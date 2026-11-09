import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://127.0.0.1:4174'
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts/restyle-after'
const prefix = process.env.SHOT_PREFIX || 'after'

mkdirSync(outDir, { recursive: true })

async function skipOnboarding(page) {
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) await skip.first().click().catch(() => {})
  await page.addStyleTag({
    content: `
      #boot-lcp { display: none !important; }
      .market-page-header > div:first-child,
      .settings-heading > span,
      .settings-heading h1,
      .settings-heading p,
      .route-polished-header-content { visibility: visible !important; }
    `,
  }).catch(() => {})
}

async function shot(page, name) {
  const path = `${outDir}/${prefix}-${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`wrote ${path}`)
}

async function waitSettled(page, ms = 700) {
  await page.waitForTimeout(ms)
}

async function openOverviewSample(page) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  const sampleTab = page.locator('#overview-tab-sample')
  await sampleTab.waitFor({ timeout: 15000 })
  await sampleTab.click()
  await page.locator('.overview-mode-badge').filter({ hasText: /SAMPLE PERMIT/i }).waitFor({ timeout: 10000 })
  await waitSettled(page, 900)
}

async function runSimulatedReady(page) {
  await page.goto(base + '/route-checks', { waitUntil: 'networkidle', timeout: 60000 })
  await skipOnboarding(page)
  const toggle = page.getByRole('button', { name: /show sample permits/i })
  await toggle.waitFor({ timeout: 15000 })
  await toggle.click()
  const scenario = page.getByRole('button', { name: /Simulated READY/i })
  await scenario.waitFor({ timeout: 15000 })
  await scenario.scrollIntoViewIfNeeded()
  await scenario.click()
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  await page.locator('.route-map-gl-container canvas').first().waitFor({ timeout: 20000 }).catch(() => {})
  await waitSettled(page, 1600)
}

async function captureViewport(browser, width, height, suffix) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  await waitSettled(page, 900)
  await shot(page, `overview-demo-${suffix}`)

  await openOverviewSample(page)
  await shot(page, `overview-sample-${suffix}`)

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  await waitSettled(page, 700)
  await shot(page, `import-${suffix}`)

  await runSimulatedReady(page)
  await page.locator('.verdict-banner').scrollIntoViewIfNeeded()
  await shot(page, `result-${suffix}`)

  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 500)
  await shot(page, `jobs-${suffix}`)

  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitSettled(page, 1600)
  await shot(page, `corridor-${suffix}`)

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 500)
  await shot(page, `alerts-${suffix}`)

  await page.goto(base + '/data-partners', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 400)
  await shot(page, `partners-${suffix}`)

  await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 400)
  await shot(page, `settings-${suffix}`)

  await page.goto(base + '/this-route-does-not-exist', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 400)
  await shot(page, `404-${suffix}`)

  await page.goto(base + '/search', { waitUntil: 'domcontentloaded' })
  await waitSettled(page, 400)
  await shot(page, `search-${suffix}`)

  if (width <= 430) {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await skipOnboarding(page)
    await waitSettled(page, 600)
    const wrap = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.mobile-tab-link span')]
      return links.map(el => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          text: el.textContent,
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          wrap: style.whiteSpace,
          overflow: el.scrollWidth > el.clientWidth + 1,
        }
      })
    })
    writeFileSync(`${outDir}/${prefix}-mobile-tab-metrics.json`, JSON.stringify(wrap, null, 2))
    console.log('mobile tab metrics', JSON.stringify(wrap))
    await shot(page, `mobile-nav-${suffix}`)
  }

  await context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  await captureViewport(browser, 1440, 900, '1440')
  await captureViewport(browser, 390, 844, '390')
  await browser.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
