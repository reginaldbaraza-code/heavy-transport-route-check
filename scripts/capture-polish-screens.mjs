import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4174)
const base = `http://127.0.0.1:${port}`
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts/polish-before'
const prefix = process.env.SHOT_PREFIX || 'before'

mkdirSync(outDir, { recursive: true })

async function waitForPreview(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview server did not start')), 20000)
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
  if (await skip.count()) await skip.first().click()
}

async function shot(page, name) {
  const path = `${outDir}/${prefix}-${name}.png`
  await page.screenshot({ path, fullPage: false })
  console.log(`wrote ${path}`)
}

async function waitForMap(page) {
  await page.locator('.route-map-gl-container canvas').first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1600)
}

async function runCheck(page, nameRe) {
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  const toggle = page.getByRole('button', { name: /show test permits/i })
  if (await toggle.count()) await toggle.click()
  await page.getByRole('button', { name: nameRe }).click()
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  await waitForMap(page)
  await page.locator('.verdict-banner').scrollIntoViewIfNeeded()
}

async function main() {
  const preview = spawn('pnpm', ['exec', 'tsx', 'scripts/qa-preview.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)

  const browser = await chromium.launch({ headless: true })
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await desktop.newPage()

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  await page.waitForTimeout(800)
  await shot(page, 'overview')

  await runCheck(page, /Simulated READY/)
  await page.waitForTimeout(400)
  await shot(page, 'route-ready')

  await runCheck(page, /Hamburg → Hannover/)
  await page.waitForTimeout(400)
  await shot(page, 'route-verify')

  await runCheck(page, /Simulated HOLD — A8 height/)
  await page.waitForTimeout(400)
  await shot(page, 'route-hold')

  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await shot(page, 'saved-jobs')

  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot(page, 'corridor-monitor')

  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 } })
  const tpage = await tablet.newPage()
  await tpage.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(tpage)
  await tpage.waitForTimeout(800)
  await tpage.screenshot({ path: `${outDir}/${prefix}-overview-1024.png`, fullPage: false })
  console.log(`wrote ${outDir}/${prefix}-overview-1024.png`)
  await tablet.close()

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mpage = await mobile.newPage()
  await mpage.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(mpage)
  await mpage.waitForTimeout(800)
  await mpage.screenshot({ path: `${outDir}/${prefix}-overview-mobile.png`, fullPage: false })
  console.log(`wrote ${outDir}/${prefix}-overview-mobile.png`)

  await browser.close()
  preview.kill('SIGTERM')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
