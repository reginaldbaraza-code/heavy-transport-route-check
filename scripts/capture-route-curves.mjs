import { mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4177)
const base = `http://127.0.0.1:${port}`
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts'
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

const shots = [
  {
    name: 'hamburg-hannover-curve',
    button: /Hamburg → Hannover \(A7\)/,
    lng: 9.73317,
    lat: 52.86568,
    zoom: 12,
  },
  {
    name: 'munchen-stuttgart-curve',
    button: /München → Stuttgart \(A8\)/,
    lng: 10.24917,
    lat: 48.42904,
    zoom: 13,
  },
  {
    name: 'munchen-stuttgart-framed',
    button: /München → Stuttgart \(A8\)/,
    lng: null,
    lat: null,
    zoom: null,
  },
]

async function main() {
  const preview = spawn('pnpm', ['exec', 'tsx', 'scripts/qa-preview.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  for (const shot of shots) {
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await skipOnboarding(page)
    const toggle = page.getByRole('button', { name: /show sample permits/i })
    if (await toggle.count()) await toggle.click()
    await page.getByRole('button', { name: shot.button }).first().click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    const mapEl = page.locator('.route-map-gl-container canvas').first()
    await mapEl.waitFor({ timeout: 20000 })
    await page.locator('.route-map-gl').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(1200)
    if (shot.lng != null && shot.lat != null && shot.zoom != null) {
      await page.evaluate(
        async ({ lng, lat, zoom }) => {
          const map = window.__TEST_MAP_INSTANCE__
          if (!map) throw new Error('map instance missing')
          map.stop()
          map.jumpTo({ center: [lng, lat], zoom })
          await new Promise(resolve => map.once('idle', resolve))
        },
        { lng: shot.lng, lat: shot.lat, zoom: shot.zoom },
      )
    } else {
      await page.waitForTimeout(600)
    }
    await page.waitForTimeout(1800)
    const path = `${outDir}/${prefix}-${shot.name}.png`
    await page.locator('.route-map-gl').first().screenshot({ path })
    console.log(`wrote ${path}`)
  }

  await browser.close()
  preview.kill('SIGTERM')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
