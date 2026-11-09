import { chromium } from 'playwright'

const base = process.env.QA_URL || 'http://127.0.0.1:4173'
const results = []

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`))
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 60000 })
  const badgeOnFresh = await page.locator('.notification-count').count()
  const emptySaved = await page.getByRole('heading', { name: 'No saved routes yet' }).isVisible()
  const exampleBanner = await page.getByText(/Made-up routes and verdicts, never live, never saved/i).isVisible()
  const exampleHold = await page.getByRole('heading', { name: /Duisburg Logistics Yard/ }).isVisible()
  const headerOrg = await page.getByRole('button', { name: 'Open organization settings' }).innerText()
  record('Fresh profile: no notification badge', badgeOnFresh === 0, `badge count=${badgeOnFresh}`)
  record('Fresh profile: no saved checks empty state', emptySaved)
  record('Overview example banner visible', exampleBanner)
  record('Overview example next-transport card restored', exampleHold)
  record('Header is not RheinLift Logistics', !headerOrg.includes('RheinLift'), headerOrg.replace(/\s+/g, ' ').trim())

  await page.getByRole('tab', { name: 'Try a sample permit' }).click()
  const hamburgSample = await page.getByRole('link', { name: /Hamburg → Hannover/ }).first().isVisible()
  const sampleBadgeStillZero = await page.locator('.notification-count').count()
  record('Sample-permit toggle lists Hamburg sample', hamburgSample)
  record('Sample-permit toggle does not create a badge', sampleBadgeStillZero === 0)

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  const activityText = await page.locator('main').innerText()
  const fakeAlert = /New closure on A7|Verdict changed READY|RheinLift/.test(activityText)
  record('Alerts empty on fresh profile', activityText.includes('No alerts yet') && !fakeAlert, fakeAlert ? 'found fixture alert' : '')
  record('History empty on fresh profile', activityText.includes('No checks in this browser'))

  await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
  const togglePersisted = await page.getByRole('tab', { name: 'Try a sample permit' }).getAttribute('aria-selected')
  record('Overview toggle remembered in localStorage', togglePersisted === 'true', `aria-selected=${togglePersisted}`)
  if (togglePersisted !== 'true') await page.getByRole('tab', { name: 'Try a sample permit' }).click()
  await page.getByRole('link', { name: /Run live check on this sample/i }).click()
  await page.waitForURL('**/route-checks?permit=hamburg-hannover')
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  const verdictText = (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ').trim()
  const started = await page.getByText(/Started /).count()
  const retrieved = await page.getByText(/Retrieved /).count()
  const age376 = await page.getByText(/376d/).count()
  record('Hamburg sample check finished with a verdict', /VERIFY|HOLD|Ready/i.test(verdictText), verdictText.slice(0, 180))
  record('Evidence shows start/retrieved dates (not 376d)', retrieved > 0 && age376 === 0, `started=${started} retrieved=${retrieved} age376=${age376}`)

  await page.getByRole('link', { name: 'Alerts' }).first().click().catch(() => page.goto(base + '/activity'))
  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  const historyItems = await page.locator('.check-history-log .route-alert-item').count()
  const alertItems = await page.locator('.route-alert-log').first().locator('.route-alert-item').count()
  const badgeAfterCheck = await page.locator('.notification-count').textContent().catch(() => null)
  record('History has one saved check after Hamburg run', historyItems >= 1, `history=${historyItems}`)
  record('Badge matches unread alerts', Number(badgeAfterCheck || '0') === alertItems, `badge=${badgeAfterCheck} alerts=${alertItems}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  const badgeAfterReload = await page.locator('.notification-count').textContent().catch(() => null)
  const historyAfterReload = await page.locator('.check-history-log .route-alert-item').count()
  record('Badge and history survive reload', badgeAfterReload === badgeAfterCheck && historyAfterReload >= 1, `badge=${badgeAfterReload} history=${historyAfterReload}`)

  const corridorErrorsBefore = consoleErrors.length
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('heading', { name: 'Corridor monitor' }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(2500)
  const corridorHeading = await page.getByRole('heading', { name: 'Corridor monitor' }).isVisible()
  const corridorErrors = consoleErrors.slice(corridorErrorsBefore).filter(text =>
    !/Failed to fetch events|net::ERR|tile.openstreetmap|favicon/.test(text)
  )
  record('Corridor monitor renders', corridorHeading, corridorErrors.length ? corridorErrors.slice(0, 3).join(' | ') : '')

  const routeErrorsBefore = consoleErrors.length
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  const routeHeading = await page.getByRole('heading', { name: 'Route Check' }).isVisible()
  const routeErrors = consoleErrors.slice(routeErrorsBefore)
  record('Route Checks renders', routeHeading, routeErrors.length ? routeErrors.slice(0, 3).join(' | ') : '')

  await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' })
  const setupRequired = await page.getByText('Setup required').isVisible()
  const upToDate = await page.getByText('Your organisation profile is up to date').count()
  const browserOnly = await page.getByText(/saved in this browser only/i).first().isVisible()
  record('Settings status is incomplete, not contradictory', setupRequired && upToDate === 0)
  record('Settings state browser-only storage', browserOnly)

  await browser.close()

  const failed = results.filter(item => !item.ok)
  console.log('\n=== QA SUMMARY ===')
  console.log(`${results.length - failed.length}/${results.length} checks passed`)
  if (consoleErrors.length) {
    console.log('Console errors captured:')
    for (const err of consoleErrors.slice(0, 12)) console.log('  -', err)
  }
  if (failed.length) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
