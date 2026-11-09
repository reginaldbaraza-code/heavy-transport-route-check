import { spawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4173)
const base = process.env.QA_URL || `http://127.0.0.1:${port}`
const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

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

async function downloadFile(page, buttonName) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: buttonName }).first().click(),
  ])
  const path = await download.path()
  const size = path ? statSync(path).size : 0
  const buffer = path ? readFileSync(path) : Buffer.alloc(0)
  return { size, suggested: download.suggestedFilename(), path, buffer }
}

function decodePdfStrings(buffer) {
  const latin1 = Buffer.from(buffer).toString('latin1')
  const strings = []
  const re = /\((?:\\.|[^\\)])*\)/g
  let match
  while ((match = re.exec(latin1))) {
    strings.push(
      match[0]
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1'),
    )
  }
  return { latin1, text: strings.join('\n'), compact: strings.join('') }
}

async function main() {
  const preview = spawn('pnpm', ['exec', 'tsx', 'scripts/qa-preview.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(preview)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  })
  await context.grantPermissions(['notifications'])
  const page = await context.newPage()

  await page.goto(base + '/discover', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const discoverBanner = await page.getByText(/leftover marketplace example data/i).isVisible()
  const discoverBadge = await page.getByText('Example data', { exact: true }).first().isVisible()
  record('Discover example-data banner visible', discoverBanner && discoverBadge)

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show test permits/i }).click()
  await page.getByRole('button', { name: /Hamburg → Hannover/ }).click()
  await page.locator('.clearance-tick input').waitFor({ timeout: 15000 })
  if (await page.locator('.clearance-tick input').isChecked()) {
    await page.locator('.clearance-tick input').uncheck()
  }
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  record('Route check finished', true, (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ').slice(0, 120))
  await page.locator('.nearby-off-route-group').evaluateAll(nodes => nodes.forEach(node => { node.open = true })).catch(() => {})
  const hamburgEvidence = await page.locator('.evidence-section').innerText()
  record(
    'Hamburg→Hannover shows MIA roadworks source',
    /Autobahn GmbH MIA via Mobilithek\/MobiData BW/.test(hamburgEvidence),
    hamburgEvidence.replace(/\s+/g, ' ').slice(0, 280),
  )

  await page.getByRole('button', { name: 'Save as job' }).click()
  await page.locator('[data-testid="save-job-form"]').waitFor()
  await page.getByRole('button', { name: 'Save job' }).click()
  await page.getByText(/Job saved in this browser only/i).waitFor({ timeout: 10000 })
  record('Save as job after check', true)

  const pdf = await downloadFile(page, 'Export PDF')
  record('Result PDF download is non-empty', pdf.size > 200, `${pdf.suggested} ${pdf.size} bytes`)
  const extracted = decodePdfStrings(pdf.buffer)
  const hasArrow = /Hamburg\s*->\s*Hannover/.test(extracted.compact) || extracted.compact.includes('->')
  const hasBangArrow = /Hamburg\s*!\s*Hannover/.test(extracted.text) || /Hamburg\s*!\s*Hannover/.test(extracted.compact)
  const headerTogether = extracted.compact.includes('Heavy transport route check')
  const headerSpaced = /H\s+e\s+a\s+v\s+y\s+t\s+r\s+a\s+n\s+s\s+p\s+o\s+r\s+t/.test(extracted.text)
  record('PDF text uses -> not bang-arrow', hasArrow && !hasBangArrow, extracted.compact.replace(/\s+/g, ' ').slice(0, 220))
  record('PDF header is not letter-spaced', headerTogether && !headerSpaced, headerTogether ? 'header intact' : extracted.compact.slice(0, 160))

  const umlautPdf = await page.evaluate(() => {
    const bytes = window.__HT_TEST__.pdfBytesFromSnapshot({
      verdict: 'HOLD',
      title: 'Prüfung Nürnberg',
      summary: 'München to Nürnberg corridor',
      impact: '',
      permitNumber: 'HH-TEST',
      permitName: 'Hamburg → Hannover (A7)',
      routeLabel: 'München → Nürnberg',
      vehicle: null,
      source: 'Autobahn GmbH',
      runAt: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
      confidence: 'medium',
      evidence: [],
      confirmOnSite: [],
    })
    const view = new Uint8Array(bytes)
    let binary = ''
    for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i])
    return btoa(binary)
  })
  const umlautExtracted = decodePdfStrings(Buffer.from(umlautPdf, 'base64'))
  const keepsUmlauts = /Nürnberg|München|Prüfung/.test(umlautExtracted.text) || /Nürnberg|München|Prüfung/.test(umlautExtracted.compact)
  const umlautArrow = umlautExtracted.compact.includes('->') && !/Hamburg\s*!\s*Hannover/.test(umlautExtracted.compact)
  record('PDF keeps German umlauts and sanitizes arrows', keepsUmlauts && umlautArrow, umlautExtracted.compact.replace(/\s+/g, ' ').slice(0, 220))

  await page.setViewportSize({ width: 400, height: 720 })
  const zoomVisibleOnMobile = await page.locator('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group').first().isVisible().catch(() => false)
  record('Mobile map zoom control is hidden at 400px', zoomVisibleOnMobile === false)
  await page.setViewportSize({ width: 1440, height: 900 })

  const csv = await downloadFile(page, 'Export CSV')
  record('Result CSV download is non-empty', csv.size > 50, `${csv.suggested} ${csv.size} bytes`)

  await page.locator('.confirm-on-site-bar').waitFor({ timeout: 10000 })
  await page.locator('.confirm-on-site-bar input').first().fill('QA Test')
  const resultClearance = page.locator('.confirm-on-site-bar .clearance-tick input')
  if (!(await resultClearance.isChecked())) await resultClearance.check()
  const confirmRemaining = page.getByRole('button', { name: /Confirm remaining VERIFY on site/i })
  if (await confirmRemaining.count()) await confirmRemaining.click()
  await page.waitForFunction(() => /READY/i.test(document.querySelector('.verdict-banner')?.innerText || ''), null, { timeout: 15000 }).catch(() => {})
  const readyBanner = (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ')
  record('Result READY after result-screen clearance + acks', /READY/i.test(readyBanner), readyBanner.slice(0, 180))
  const readyScreen = await page.locator('.evidence-section').innerText()
  record(
    'On-screen bridge card marked confirmed after result-screen tick',
    /Bridge and clearance confirmed by dispatcher/i.test(readyScreen)
      && !/Bridge and clearance data not available/i.test(readyScreen),
    readyScreen.replace(/\s+/g, ' ').slice(0, 280),
  )

  const readyPdf = await downloadFile(page, 'Export PDF')
  const readyCsv = await downloadFile(page, 'Export CSV')
  const readyPdfText = decodePdfStrings(readyPdf.buffer)
  const readyCsvText = readyCsv.buffer.toString('utf8')
  const pdfCompact = readyPdfText.compact.replace(/\s+/g, ' ')
  const swappedPdf = /11\.09\.2026/.test(pdfCompact) && /09\.11\.2026/.test(pdfCompact)
  const swappedCsv = /11\.09\.2026/.test(readyCsvText) && /09\.11\.2026/.test(readyCsvText)
  const pdfAckDates = [...pdfCompact.matchAll(/QA Test at (\d{2}\.\d{2}\.\d{4})/g)].map(match => match[1])
  const csvAckDates = [...readyCsvText.matchAll(/QA Test at (\d{2}\.\d{2}\.\d{4})/g)].map(match => match[1])
  record(
    'PDF/CSV on-site dates stay de-DE without day/month swap',
    !swappedPdf && !swappedCsv
      && (pdfAckDates.length + csvAckDates.length) > 0
      && [...pdfAckDates, ...csvAckDates].every(date => date !== '11.09.2026'),
    `pdf=${pdfAckDates.join('|') || 'none'} csv=${csvAckDates.join('|') || 'none'}`,
  )
  record(
    'PDF export uses post-ack clearance state',
    /Clearance confirmed by QA Test at/i.test(pdfCompact)
      && /Bridge and clearance confirmed by dispatcher/i.test(pdfCompact)
      && !/Bridge and clearance are not dispatcher-confirmed/i.test(pdfCompact)
      && !/Bridge and clearance data not available/i.test(pdfCompact),
    pdfCompact.slice(0, 280),
  )
  record(
    'CSV export uses post-ack clearance state',
    /Clearance confirmed by QA Test at/i.test(readyCsvText)
      && /Bridge and clearance confirmed by dispatcher/i.test(readyCsvText)
      && !/Bridge and clearance are not dispatcher-confirmed/i.test(readyCsvText)
      && !/Bridge and clearance data not available/i.test(readyCsvText),
    readyCsvText.replace(/\s+/g, ' ').slice(0, 280),
  )
  record(
    'CSV and PDF filenames use the current READY verdict',
    /READY\.csv$/i.test(readyCsv.suggested)
      && /READY\.pdf$/i.test(readyPdf.suggested)
      && !/HOLD/i.test(readyCsv.suggested)
      && !/HOLD/i.test(readyPdf.suggested),
    `pdf=${readyPdf.suggested} csv=${readyCsv.suggested}`,
  )
  const csvImpactRow = (readyCsvText.split(/\r?\n/).find(row => row.startsWith('"Impact",')) || '').replace(/^"Impact",/, '')
  const pdfImpactStart = pdfCompact.indexOf('Selected vehicle:')
  const pdfImpactEnd = pdfCompact.indexOf('Permit', pdfImpactStart)
  const pdfImpactText = pdfImpactStart < 0
    ? ''
    : pdfCompact.slice(pdfImpactStart, pdfImpactEnd < 0 ? undefined : pdfImpactEnd)
  const csvClearanceHits = (csvImpactRow.match(/Clearance confirmed by QA Test at/g) || []).length
  const pdfClearanceHits = (pdfImpactText.match(/Clearance confirmed by QA Test at/g) || []).length
  record(
    'Clearance confirmed text appears exactly once in CSV Impact and PDF impact',
    csvClearanceHits === 1 && pdfClearanceHits === 1,
    `csvImpact=${csvClearanceHits} pdfImpact=${pdfClearanceHits} csv=${csvImpactRow.slice(0, 180)} pdf=${pdfImpactText.slice(0, 180)}`,
  )

  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  const jobVisible = await page.locator('.job-row').count()
  record('Jobs list shows saved job', jobVisible >= 1, `jobs=${jobVisible}`)

  const lastCheckedBefore = await page.evaluate(() => window.__HT_TEST__?.getJobs()?.[0]?.lastCheckedAt || '')
  await page.getByRole('button', { name: /Re-run check/i }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  const lastCheckAfter = await page.evaluate(() => {
    const job = window.__HT_TEST__?.getJobs()?.[0]
    return { lastCheckedAt: job?.lastCheckedAt || '', label: document.querySelector('[data-testid="job-last-check"]')?.textContent || '' }
  })
  const lastCheckUpdated = Boolean(lastCheckAfter.lastCheckedAt)
    && lastCheckAfter.lastCheckedAt !== lastCheckedBefore
    && /Just now/i.test(lastCheckAfter.label)
  record('Jobs last-check updates immediately after re-run', lastCheckUpdated, JSON.stringify({ lastCheckedBefore, ...lastCheckAfter }))

  const hookResult = await page.evaluate(async () => {
    const jobs = window.__HT_TEST__?.getJobs() || []
    if (!jobs[0]) return { ok: false, reason: 'no job' }
    window.__HT_TEST__.simulateVerdictChange(jobs[0].id, 'HOLD')
    await new Promise(resolve => setTimeout(resolve, 200))
    const alerts = window.__HT_TEST__.getAlerts()
    return {
      ok: true,
      jobId: jobs[0].id,
      alertCount: alerts.length,
      holdAlert: alerts.some(alert => /HOLD/.test(alert.change) || alert.severity === 'HOLD'),
      unread: alerts.filter(alert => alert.status === 'New').length,
    }
  })
  record('Monitoring test hook created HOLD alert', Boolean(hookResult.ok && hookResult.holdAlert), JSON.stringify(hookResult))

  await page.reload({ waitUntil: 'domcontentloaded' })
  const badge = await page.locator('.notification-count').textContent().catch(() => null)
  record('Alert badge updates after verdict change', Number(badge || '0') > 0, `badge=${badge}`)

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  const alertText = await page.locator('.route-alert-log').first().innerText()
  record('Alerts page includes verdict-change HOLD', /HOLD/.test(alertText), alertText.slice(0, 180).replace(/\s+/g, ' '))
  const historyPdf = await downloadFile(page, 'PDF')
  record('History PDF download is non-empty', historyPdf.size > 200, `${historyPdf.suggested} ${historyPdf.size} bytes`)
  const historyCsv = await downloadFile(page, 'CSV')
  record('History CSV download is non-empty', historyCsv.size > 50, `${historyCsv.suggested} ${historyCsv.size} bytes`)

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show test permits/i }).click()
  await page.getByRole('button', { name: /München → Stuttgart|Munchen → Stuttgart/ }).click()
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  await page.locator('.nearby-off-route-group').evaluateAll(nodes => nodes.forEach(node => { node.open = true })).catch(() => {})
  const stuttgartEvidence = await page.locator('.evidence-section').innerText()
  record(
    'Stuttgart-area route shows MobiData BW BEMaS evidence',
    /MobiData BW \(BEMaS\)/.test(stuttgartEvidence),
    stuttgartEvidence.replace(/\s+/g, ' ').slice(0, 280),
  )
  record(
    'Stuttgart-area route shows MIA roadworks source',
    /Autobahn GmbH MIA via Mobilithek\/MobiData BW/.test(stuttgartEvidence),
    stuttgartEvidence.replace(/\s+/g, ' ').slice(0, 280),
  )

  async function runHoldScenario(nameRe) {
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /show test permits/i }).click()
    await page.getByRole('button', { name: nameRe }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
    const banner = (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ')
    const evidence = (await page.locator('.evidence-section').innerText()).replace(/\s+/g, ' ')
    const chip = (await page.locator('.outcome-match').innerText().catch(() => '')).replace(/\s+/g, ' ')
    return { banner, evidence, chip }
  }

  const heightHold = await runHoldScenario(/Simulated HOLD — A8 height/)
  record(
    'Scenario HOLD height shows Expected HOLD and limit vs vehicle',
    /HOLD/i.test(heightHold.banner)
      && /Expected HOLD — actual HOLD/i.test(heightHold.chip)
      && /4\.00 m vs vehicle 4\.30 m/.test(heightHold.evidence)
      && /HOLD items cannot be acknowledged away/i.test(heightHold.evidence)
      && !/Confirm remaining VERIFY on site/i.test(heightHold.evidence),
    `${heightHold.chip} ${heightHold.evidence.slice(0, 220)}`,
  )

  const weightHold = await runHoldScenario(/Simulated HOLD — A1 weight/)
  record(
    'Scenario HOLD weight shows Expected HOLD and limit vs vehicle',
    /HOLD/i.test(weightHold.banner)
      && /Expected HOLD — actual HOLD/i.test(weightHold.chip)
      && /40 t vs vehicle 72 t/.test(weightHold.evidence)
      && /HOLD items cannot be acknowledged away/i.test(weightHold.evidence)
      && !/Confirm remaining VERIFY on site/i.test(weightHold.evidence),
    `${weightHold.chip} ${weightHold.evidence.slice(0, 220)}`,
  )

  await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Data sources/i }).click()
  const sourcesText = await page.locator('.data-source-list').innerText()
  record(
    'Settings lists Mobilithek as integrated via MobiData BW',
    /Integrated via MobiData BW open republication/.test(sourcesText)
      && /dl-de\/by-2\.0/i.test(sourcesText)
      && !/No keyless public dataset was found/.test(sourcesText),
    sourcesText.replace(/\s+/g, ' ').slice(0, 400),
  )

  await browser.close()
  preview.kill('SIGTERM')

  const failed = results.filter(item => !item.ok)
  console.log('\n=== QA FEATURES SUMMARY ===')
  console.log(`${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
