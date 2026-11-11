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

async function overflowReport(page, selectors) {
  return page.evaluate(sels => sels.map(sel => {
    const el = document.querySelector(sel)
    if (!el) return { sel, missing: true, overflow: false, scrollWidth: 0, clientWidth: 0 }
    return {
      sel,
      missing: false,
      overflow: el.scrollWidth > el.clientWidth + 1,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }
  }), selectors)
}

function permitMapCounts(root) {
  return {
    tiles: root.querySelectorAll('img.leaflet-tile').length,
    paths: root.querySelectorAll('.leaflet-overlay-pane path').length,
    height: root.clientHeight,
    width: root.clientWidth,
  }
}

async function mapPaintMetrics(page, selector) {
  await page.locator(selector).first().waitFor({ timeout: 25000 })
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel)
    return Boolean(el && el.clientHeight > 8)
  }, selector, { timeout: 20000 }).catch(() => {})
  const box = await page.locator(selector).first().evaluate(el => {
    const canvas = el.querySelector('canvas')
    const tiles = el.querySelectorAll('img.leaflet-tile').length
    return {
      width: Math.round(el.clientWidth),
      height: Math.round(el.clientHeight),
      canvasWidth: canvas ? Math.round(canvas.clientWidth) : 0,
      canvasHeight: canvas ? Math.round(canvas.clientHeight) : 0,
      tiles,
    }
  })
  let pngSize = 0
  let unique = 0
  try {
    const buf = await page.locator(selector).first().screenshot({ timeout: 15000 })
    pngSize = buf.length
    unique = new Set(buf.subarray(0, Math.min(buf.length, 8000))).size
  } catch {
    // Screenshot can fail if the node has 0 height.
  }
  return { ...box, pngSize, unique }
}

function mapLooksPainted(metrics) {
  const tallEnough = metrics.height > 300
  const leafletPainted = metrics.tiles > 0
  const canvasPainted = metrics.canvasHeight > 300 && metrics.pngSize > 8000 && metrics.unique > 16
  return tallEnough && (leafletPainted || canvasPainted)
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

  for (const iconPath of ['/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']) {
    const res = await page.goto(base + iconPath, { timeout: 15000 })
    const buf = res ? Buffer.from(await res.body()) : Buffer.alloc(0)
    const png = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const head = buf.subarray(0, 40).toString('latin1')
    record(
      `Served ${iconPath} is a PNG blob, not an LFS pointer`,
      Boolean(res?.ok()) && png,
      `status=${res?.status()} head=${JSON.stringify(head.slice(0, 32))}`,
    )
  }

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const skipOnboarding = page.getByRole('button', { name: /skip/i })
  if (await skipOnboarding.count()) {
    await skipOnboarding.first().click()
  }
  const homeTitle = await page.title()
  record(
    'Document title uses HTR brand',
    homeTitle === 'HTR · Heavy transport route check',
    homeTitle,
  )
  record(
    'Sidebar wordmark is Heavy transport route check',
    await page.getByRole('button', { name: 'Heavy transport route check' }).first().isVisible(),
  )
  const homeText = await page.locator('body').innerText()
  record('No user-facing MSD brand text', !/\bMSD\b/.test(homeText), (homeText.match(/\bMSD\b/) || [''])[0])
  await page.getByRole('button', { name: 'Collapse navigation' }).click()
  record(
    'Collapsed sidebar shows HTR',
    await page.getByRole('button', { name: 'Heavy transport route check' }).filter({ hasText: 'HTR' }).first().isVisible(),
  )
  await page.getByRole('button', { name: 'Expand navigation' }).click()

  await page.locator('.overview-mode-panel').scrollIntoViewIfNeeded()
  await page.locator('.permit-leaflet-map.leaflet-container').waitFor({ timeout: 25000 })
  const heroBadge = await page.locator('.permit-map-badge strong').first().innerText()
  record('Homepage hero uses Demo: 4 monitored routes badge', heroBadge.includes('Demo: 4 monitored routes'), heroBadge)
  record(
    'Demo dashboard tab is selected on load',
    (await page.getByRole('tab', { name: 'Demo dashboard' }).getAttribute('aria-selected')) === 'true',
  )
  record('Demo mode shows DEMO badge', (await page.locator('.overview-mode-badge').innerText()).includes('DEMO'))
  record(
    'Demo mode copy explains it is not live',
    await page.getByText(/Made-up routes and verdicts, never live, never saved/i).isVisible(),
  )
  const osmAttr = await page.locator('.permit-leaflet-map .leaflet-control-attribution').innerText()
  record('Homepage map keeps OSM attribution', /OpenStreetMap/i.test(osmAttr), osmAttr)
  const tileDisplay = await page.locator('.permit-leaflet-map .leaflet-tile-pane').evaluate(el => getComputedStyle(el).display)
  record('Homepage map shows tile layer', tileDisplay !== 'none', tileDisplay)
  record(
    'Homepage hero is not the illustrated Germany map',
    (await page.locator('.transport-readiness-map .shared-leaflet-map').count()) === 0,
  )
  const heroCard = await page.locator('.transport-readiness-copy').innerText()
  record(
    'Hero card matches a drawn route, not Duisburg→Munich',
    /München|Stuttgart/.test(heroCard) && !/Duisburg Logistics/.test(heroCard),
    heroCard.replace(/\s+/g, ' ').slice(0, 180),
  )
  const tileFilter = await page.locator('.permit-leaflet-map .leaflet-tile-pane').evaluate(el => getComputedStyle(el).filter)
  record('Homepage tiles are desaturated', /grayscale/i.test(tileFilter), tileFilter)

  await page.getByRole('tab', { name: 'Try a sample permit' }).click()
  record(
    'Sample permit tab is selected',
    (await page.getByRole('tab', { name: 'Try a sample permit' }).getAttribute('aria-selected')) === 'true',
  )
  record('Sample mode shows SAMPLE PERMIT badge', (await page.locator('.overview-mode-badge').innerText()).includes('SAMPLE PERMIT'))
  record(
    'Sample mode copy explains live check is saved',
    await page.getByText(/that check is saved to your history/i).isVisible(),
  )
  record(
    'Sample mode CTA runs a live check',
    await page.getByRole('link', { name: /Run live check on this sample/i }).isVisible(),
  )
  const sampleMap = page.locator('[data-permit-map="sample"]')
  await sampleMap.waitFor({ timeout: 15000 })
  await page.locator('[data-permit-map="overview"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  record(
    'Sample permit panel defaults to Hamburg→Hannover',
    (await page.locator('[data-permit-map="sample"][data-selected-permit="hamburg-hannover"]').count()) > 0,
  )
  await sampleMap.locator('.permit-map-pill small', { hasText: /^START$/ }).waitFor({ timeout: 20000 })
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('[data-permit-map="sample"] .permit-map-pill strong')]
      .map(node => (node.textContent || '').trim())
    return labels.length === 2 && labels.some(text => /Hamburg/i.test(text)) && labels.some(text => /Hannover/i.test(text))
  }, { timeout: 20000 })
  const hamburgLabels = await sampleMap.locator('.permit-map-pill strong').allInnerTexts()
  record(
    'Hamburg→Hannover map labels match the selected permit',
    hamburgLabels.length === 2
      && hamburgLabels.some(text => /Hamburg/i.test(text))
      && hamburgLabels.some(text => /Hannover/i.test(text))
      && !hamburgLabels.some(text => /Munich|München/i.test(text)),
    hamburgLabels.join(' | '),
  )
  record(
    'Fake Duisburg→Munich sample-corridor caption is gone',
    (await page.getByText('Hamburg, Bremen, Leipzig, Duisburg, München').count()) === 0,
  )

  await page.getByRole('button', { name: /Bremen → Dortmund/ }).click()
  await page.locator('[data-permit-map="sample"][data-selected-permit="bremen-dortmund"]').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('[data-permit-map="sample"] .permit-map-pill strong')]
      .map(node => (node.textContent || '').trim())
    return labels.length === 2 && labels.some(text => /Bremen/i.test(text)) && labels.some(text => /Dortmund/i.test(text))
  }, { timeout: 20000 })
  const bremenLabels = await sampleMap.locator('.permit-map-pill strong').allInnerTexts()
  record(
    'Selecting Bremen→Dortmund updates the sample map labels',
    bremenLabels.some(text => /Bremen/i.test(text)) && bremenLabels.some(text => /Dortmund/i.test(text)),
    bremenLabels.join(' | '),
  )

  async function assertDesktopPermitMaps(width, height) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click()
    await page.getByRole('tab', { name: 'Demo dashboard' }).click()
    await page.locator('[data-permit-map="overview"]').waitFor({ timeout: 25000 })
    await page.locator('.transport-readiness').scrollIntoViewIfNeeded()
    await page.locator('[data-permit-map="overview"] .leaflet-container').waitFor({ timeout: 25000 })
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-permit-map="overview"]')
      if (!root) return false
      const tiles = root.querySelectorAll('img.leaflet-tile').length
      const paths = root.querySelectorAll('.leaflet-overlay-pane path').length
      return tiles > 0 && paths >= 4
    }, { timeout: 25000 })
    const hero = await page.locator('[data-permit-map="overview"]').evaluate(permitMapCounts)
    record(
      `Hero map at ${width}×${height} has tiles and ≥4 route paths`,
      hero.tiles > 0 && hero.paths >= 4,
      JSON.stringify(hero),
    )
    record(
      `Hero map at ${width}×${height} is taller than 300px`,
      hero.height > 300,
      JSON.stringify(hero),
    )
    await page.getByRole('tab', { name: 'Try a sample permit' }).click()
    await page.locator('[data-permit-map="sample"]').waitFor({ timeout: 20000 })
    await page.locator('.transport-readiness').scrollIntoViewIfNeeded()
    await page.locator('[data-permit-map="sample"] .leaflet-container').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-permit-map="sample"]')
      if (!root) return false
      const tiles = root.querySelectorAll('img.leaflet-tile').length
      const paths = root.querySelectorAll('.leaflet-overlay-pane path').length
      return tiles > 0 && paths >= 1
    }, { timeout: 25000 })
    const sample = await page.locator('[data-permit-map="sample"]').evaluate(permitMapCounts)
    record(
      `Sample-permit map at ${width}×${height} has tiles and ≥1 route path`,
      sample.tiles > 0 && sample.paths >= 1,
      JSON.stringify(sample),
    )
    record(
      `Sample-permit map at ${width}×${height} is taller than 300px`,
      sample.height > 300,
      JSON.stringify(sample),
    )
  }
  await assertDesktopPermitMaps(1280, 800)
  await assertDesktopPermitMaps(1920, 1200)
  await page.setViewportSize({ width: 1440, height: 900 })

  async function skipIfNeeded() {
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click().catch(() => {})
  }

  const corridorViewports = [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ]
  for (const [width, height] of corridorViewports) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await skipIfNeeded()
    await page.getByRole('heading', { name: 'Corridor monitor' }).waitFor({ timeout: 20000 })
    await page.locator('[data-testid="corridor-map"]').waitFor({ timeout: 25000 })
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="corridor-map"]')
      const canvas = el?.querySelector('canvas')
      return Boolean(el && el.clientHeight > 300 && canvas && canvas.clientHeight > 300)
    }, { timeout: 25000 }).catch(() => {})
    const metrics = await mapPaintMetrics(page, '[data-testid="corridor-map"]')
    record(
      `Corridor map at ${width}×${height} is taller than 300px with painted tiles`,
      mapLooksPainted(metrics),
      JSON.stringify(metrics),
    )
    const panelOverflow = await overflowReport(page, ['.live-event-panel', '.live-event-summary', '.live-event-search'])
    record(
      `Corridor panel at ${width}×${height} has no horizontal overflow`,
      panelOverflow.every(item => !item.missing && !item.overflow),
      JSON.stringify(panelOverflow),
    )
    const searchInner = await page.evaluate(() => {
      const wrap = document.querySelector('.live-event-search')
      const input = wrap?.querySelector('input')
      if (!wrap || !input) return { ok: false }
      const wrapStyle = getComputedStyle(wrap)
      const inputStyle = getComputedStyle(input)
      const wrapBox = wrap.getBoundingClientRect()
      const inputBox = input.getBoundingClientRect()
      const innerBorder = Number.parseFloat(inputStyle.borderTopWidth) + Number.parseFloat(inputStyle.borderBottomWidth)
      return {
        ok: inputStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
          && innerBorder === 0
          && wrapBox.height >= 40
          && inputBox.height <= wrapBox.height
          && inputBox.left >= wrapBox.left
          && inputBox.right <= wrapBox.right,
        wrapH: Math.round(wrapBox.height),
        inputH: Math.round(inputBox.height),
        border: innerBorder,
        bg: inputStyle.backgroundColor,
        wrapBorder: wrapStyle.borderTopWidth,
      }
    })
    record(
      `Corridor search input at ${width}×${height} fills the wrapper without an inner box`,
      Boolean(searchInner.ok),
      JSON.stringify(searchInner),
    )
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipIfNeeded()
  await page.locator('.live-event-panel').waitFor({ timeout: 20000 })
  for (const panelWidth of [280, 320, 360, 400]) {
    await page.locator('.live-event-panel').evaluate((el, width) => {
      el.style.width = `${width}px`
      el.style.minWidth = `${width}px`
      el.style.maxWidth = `${width}px`
      el.style.flex = 'none'
    }, panelWidth)
    const sized = await overflowReport(page, ['.live-event-panel', '.live-event-summary', '.live-event-search'])
    const labels = await page.evaluate(() => [...document.querySelectorAll('.live-event-summary span')].map(el => ({
      text: el.textContent.trim(),
      overflow: el.scrollWidth > el.clientWidth + 1,
    })))
    record(
      `Corridor panel at forced ${panelWidth}px has no horizontal overflow`,
      sized.every(item => !item.missing && !item.overflow) && labels.every(item => !item.overflow),
      JSON.stringify({ sized, labels }),
    )
  }
  await page.locator('.live-event-panel').evaluate(el => {
    el.style.width = ''
    el.style.minWidth = ''
    el.style.maxWidth = ''
    el.style.flex = ''
  })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto(base + '/robots.txt', { waitUntil: 'domcontentloaded', timeout: 15000 })
  const robots = await page.locator('body').innerText()
  record('robots.txt is served as text, not the SPA', /User-agent/i.test(robots) && !/Know whether the permitted route/i.test(robots), robots.slice(0, 120))

  await page.goto(base + '/this-route-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 15000 })
  const notFoundHeading = page.getByRole('heading', { name: /that page is not in this app/i })
  await notFoundHeading.waitFor({ timeout: 15000 })
  record(
    'Unknown routes show a Not Found page',
    await notFoundHeading.isVisible(),
  )

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (await page.getByRole('button', { name: /skip/i }).count()) await page.getByRole('button', { name: /skip/i }).first().click()
  await page.getByLabel(/search permits/i).fill('A9')
  await page.locator('.app-search-dropdown').waitFor({ timeout: 10000 })
  const searchText = await page.locator('.app-search-dropdown').innerText()
  record('Top search finds app data for A9', /Leipzig|Nürnberg|A9/i.test(searchText), searchText.replace(/\s+/g, ' ').slice(0, 180))

  await page.goto(base + '/data-partners', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: /^Data partners$/i }).waitFor({ timeout: 15000 })
  const partners = await page.locator('body').innerText()
  record(
    'Data partners explains MDS is later and breadcrumb is Overview',
    /Coming later/i.test(partners) && /Mobility Data Space/i.test(partners) && !/Operations overview/i.test(partners),
    partners.replace(/\s+/g, ' ').slice(0, 220),
  )

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  record(
    'Per-page title keeps HTR suffix',
    (await page.title()) === 'Route checks · HTR · Heavy transport route check',
    await page.title(),
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: 'not-a-route.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('this is not a GPX file'),
  })
  const uploadError = await page.locator('[data-testid="gpx-upload-error"]').innerText()
  record(
    'Invalid file fails at upload with a plain-language error',
    /valid GPX route/i.test(uploadError) && /Technical details/i.test(uploadError),
    uploadError.replace(/\s+/g, ' ').slice(0, 220),
  )
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Hamburg → Hannover/ }).click()
  await page.locator('.clearance-tick input').waitFor({ timeout: 15000 })
  if (await page.locator('.clearance-tick input').isChecked()) {
    await page.locator('.clearance-tick input').uncheck()
  }
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  record('Route check finished', true, (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ').slice(0, 120))
  await page.locator('.route-map-gl-container, .maplibregl-map, .results-map').first().waitFor({ timeout: 25000 }).catch(() => {})
  const resultMap = await mapPaintMetrics(page, '.route-map-gl-container, .results-map .maplibre-map, .results-map')
  record(
    'Result map is taller than 300px with painted tiles',
    mapLooksPainted(resultMap),
    JSON.stringify(resultMap),
  )
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
  await page.getByText(/Job saved and monitoring started/i).waitFor({ timeout: 10000 })
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
  record(
    'PDF does not duplicate start Start wording',
    !/start\s+Start/i.test(extracted.compact) && !/Start:\s*Start/.test(extracted.compact),
    extracted.compact.replace(/\s+/g, ' ').slice(0, 240),
  )

  const umlautPdf = await page.evaluate(async () => {
    const bytes = await window.__HT_TEST__.pdfBytesFromSnapshot({
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

  await page.setViewportSize({ width: 390, height: 915 })
  await page.locator('.mobile-route-actions').waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('.app-page-host').evaluate(el => {
    el.scrollTop = el.scrollHeight
  })
  const mobileScrollClearance = await page.evaluate(() => {
    const host = document.querySelector('.app-page-host')
    const bar = document.querySelector('.mobile-route-actions')
    const details = document.querySelector('.evidence-section') || document.querySelector('.results-sidebar')
    if (!host || !bar || !details) return { ok: false, detail: 'missing nodes' }
    const barBox = bar.getBoundingClientRect()
    const detailsBox = details.getBoundingClientRect()
    return {
      ok: detailsBox.bottom <= barBox.top + 1,
      detailsBottom: Math.round(detailsBox.bottom),
      barTop: Math.round(barBox.top),
      paddingBottom: getComputedStyle(host).paddingBottom,
    }
  })
  record(
    'Mobile results scroll padding clears the action bar',
    mobileScrollClearance.ok,
    JSON.stringify(mobileScrollClearance),
  )
  await page.setViewportSize({ width: 1440, height: 900 })

  const csv = await downloadFile(page, 'Export CSV')
  record('Result CSV download is non-empty', csv.size > 50, `${csv.suggested} ${csv.size} bytes`)

  await page.getByRole('button', { name: 'Re-check' }).click()
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated HOLD — A3 residual width/ }).click()
  await page.locator('[data-testid="vehicle-width"]').waitFor({ timeout: 10000 })
  const holdWidth = await page.locator('[data-testid="vehicle-width"]').inputValue()
  record('Scenario dims populate immediately', holdWidth === '3.8', `width=${holdWidth}`)
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated VERIFY/ }).click()
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 30000 })

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
  const jobsCopy = await page.locator('.jobs-monitor-banner').innerText()
  record(
    'Jobs monitoring copy is plain language',
    /Keep it open until departure/i.test(jobsCopy) && !/Vercel cron/i.test(jobsCopy) && !/paid service/i.test(jobsCopy),
    jobsCopy.replace(/\s+/g, ' ').slice(0, 200),
  )
  const jobVisible = await page.locator('.job-row').count()
  record('Jobs list shows saved job', jobVisible >= 1, `jobs=${jobVisible}`)

  const lastCheckedBefore = await page.evaluate(() => window.__HT_TEST__?.getJobs()?.[0]?.lastCheckedAt || '')
  await page.getByRole('button', { name: /Re-run check/i }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="job-last-check"]').waitFor({ timeout: 15000 })
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

  await page.evaluate(() => {
    const raw = window.localStorage.getItem('htr-monitor-alerts')
    const alerts = raw ? JSON.parse(raw) : []
    if (alerts[0]) {
      alerts[0].escalated = true
      window.localStorage.setItem('htr-monitor-alerts', JSON.stringify(alerts))
    }
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await skipIfNeeded()
  const alertLayoutViewports = [
    [1440, 900],
    [1024, 768],
    [390, 844],
  ]
  for (const [width, height] of alertLayoutViewports) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
    await skipIfNeeded()
    await page.locator('.route-alert-item').first().waitFor({ timeout: 15000 })
    const layout = await page.evaluate(() => {
      const item = document.querySelector('.route-alert-item')
      const main = document.querySelector('.route-alert-main')
      const chevron = document.querySelector('.route-alert-chevron')
      const badges = [...document.querySelectorAll('.route-alert-item .alert-status')]
      const truncated = badges.filter(el => el.scrollWidth > el.clientWidth + 1 || el.textContent.trim().length <= 1)
      const chevronInRow = Boolean(item && chevron && Math.abs(chevron.getBoundingClientRect().top - item.getBoundingClientRect().top) < item.getBoundingClientRect().height)
      return {
        itemOverflow: Boolean(item && item.scrollWidth > item.clientWidth + 1),
        mainOverflow: Boolean(main && main.scrollWidth > main.clientWidth + 1),
        itemScroll: item ? [item.scrollWidth, item.clientWidth] : [],
        badges: badges.map(el => el.textContent.trim()),
        truncated: truncated.map(el => el.textContent.trim()),
        chevronInRow,
      }
    })
    record(
      `Alert rows at ${width}×${height} keep Escalated untruncated with in-row chevron and no overflow`,
      !layout.itemOverflow
        && !layout.mainOverflow
        && layout.badges.includes('Escalated')
        && layout.truncated.length === 0
        && layout.chevronInRow,
      JSON.stringify(layout),
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  const historyPdf = await downloadFile(page, 'PDF')
  record('History PDF download is non-empty', historyPdf.size > 200, `${historyPdf.suggested} ${historyPdf.size} bytes`)
  const historyCsv = await downloadFile(page, 'CSV')
  record('History CSV download is non-empty', historyCsv.size > 50, `${historyCsv.suggested} ${historyCsv.size} bytes`)

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show sample permits/i }).click()
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
    await page.getByRole('button', { name: /show sample permits/i }).click()
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
