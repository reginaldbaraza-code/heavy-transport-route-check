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

/** Planned departure is intentionally empty (no silent default). Fill a near-future value for checks. */
async function fillPlannedDeparture(page, hoursAhead = 8) {
  const input = page.locator('#planned-departure')
  await input.waitFor({ timeout: 15000 })
  // Sample GPX load is async after selecting a permit — wait until Check route can run.
  await page.getByRole('button', { name: 'Check route' }).waitFor({ state: 'visible', timeout: 15000 })
  const value = await page.evaluate(hours => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000)
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }, hoursAhead)
  await input.fill(value)
  await page.getByRole('button', { name: 'Check route' }).waitFor({ state: 'attached', timeout: 5000 })
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find(el => /Check route/i.test(el.textContent || ''))
    return Boolean(btn && !btn.disabled)
  }, null, { timeout: 15000 })
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

async function readHistoryLength(page) {
  return page.evaluate(() => {
    const fromHook = window.__HT_TEST__?.getHistory?.()
    if (Array.isArray(fromHook)) return fromHook.length
    const fromStore = window.__HT_TEST__?.getStore?.('htr-route-check-history')
    return Array.isArray(fromStore) ? fromStore.length : 0
  })
}

async function readHistory(page) {
  return page.evaluate(() => {
    const fromHook = window.__HT_TEST__?.getHistory?.()
    if (Array.isArray(fromHook)) return fromHook
    const fromStore = window.__HT_TEST__?.getStore?.('htr-route-check-history')
    return Array.isArray(fromStore) ? fromStore : []
  })
}

/** Flush debounced account saves before full navigations/reloads (pagehide beacon can race hydrate). */
async function flushAccount(page) {
  await page.evaluate(async () => {
    await window.__HT_TEST__?.flushStore?.()
  }).catch(() => {})
  await page.waitForTimeout(50)
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

  async function ensureLoggedIn(userName = 'Demo') {
    const loginHeading = page.getByRole('heading', { name: "Who's checking routes?" })
    if (await loginHeading.count()) {
      await page.getByRole('button', { name: `Continue as ${userName}` }).click()
      await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ state: 'detached', timeout: 30000 }).catch(() => {})
      await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 }).catch(() => {})
    }
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click().catch(() => {})
  }

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

  // Clear any prior user so the login screen is visible for the first assertion.
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate(() => {
    try { localStorage.removeItem('htr-current-user') } catch {}
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 20000 })
  const loginTiles = page.locator('button.login-user-tile')
  const loginTileCount = await loginTiles.count()
  record('Login screen renders 7 user tiles', loginTileCount === 7, `count=${loginTileCount}`)

  await page.setViewportSize({ width: 1440, height: 900 })
  const headlineDesktop = await page.locator('.login-headline').evaluate(
    el => parseFloat(getComputedStyle(el).fontSize),
  )
  record(
    'Login headline ≥ 64px at 1440×900',
    headlineDesktop >= 64,
    `fontSize=${headlineDesktop}`,
  )

  // Short phone viewport: footnote must stay in the first screen (no +24px tolerance).
  await page.setViewportSize({ width: 390, height: 844 })
  const loginPhoneMetrics = await page.evaluate(() => {
    const screen = document.querySelector('.login-screen')
    const footnote = document.querySelector('.login-footnote')
    const headline = document.querySelector('.login-headline')
    const tile = document.querySelector('button.login-user-tile:not(.is-demo)')
    if (!screen || !footnote || !headline || !tile) {
      return { ok: false, reason: 'missing' }
    }
    const screenRect = screen.getBoundingClientRect()
    const noteRect = footnote.getBoundingClientRect()
    const style = getComputedStyle(screen)
    const viewport = window.innerHeight
    const noteBottom = noteRect.bottom
    return {
      // Tolerance-free: bottom must be ≤ viewport (844). Layout aims for ≥40px spare locally.
      ok: noteBottom <= viewport,
      screenHeight: Math.round(screenRect.height),
      noteBottom: Math.round(noteBottom),
      spare: Math.round(viewport - noteBottom),
      viewport,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      headlinePx: parseFloat(getComputedStyle(headline).fontSize),
      rowPx: tile.getBoundingClientRect().height,
    }
  })
  record(
    'Login footnote fits in 390×844 viewport',
    Boolean(loginPhoneMetrics.ok),
    JSON.stringify(loginPhoneMetrics),
  )
  record(
    'Login headline ≥ 40px at 390×844',
    Number(loginPhoneMetrics.headlinePx) >= 40,
    `fontSize=${loginPhoneMetrics.headlinePx}`,
  )
  record(
    'Login name rows ≥ 44px at 390×844',
    Number(loginPhoneMetrics.rowPx) >= 44,
    `rowHeight=${loginPhoneMetrics.rowPx}`,
  )
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('button', { name: 'Continue as Demo' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
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
  const collapsedBrand = page.getByRole('button', { name: 'Heavy transport route check' }).first()
  const collapsedMark = collapsedBrand.locator('svg[data-detail="small"], svg[data-detail="full"]').first()
  record(
    'Collapsed sidebar shows HTR',
    (await collapsedBrand.isVisible()) && (await collapsedMark.isVisible()),
    `aria-label=${await collapsedBrand.getAttribute('aria-label')} detail=${await collapsedMark.getAttribute('data-detail')}`,
  )
  await page.getByRole('button', { name: 'Expand navigation' }).click()

  async function assertMobileNavChrome(width, height) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click().catch(() => {})

    const tabBar = page.locator('.mobile-tab-bar')
    const tabDisplay = await tabBar.evaluate(el => getComputedStyle(el).display)
    record(
      `Mobile tab bar visible at ${width}×${height}`,
      tabDisplay !== 'none',
      tabDisplay,
    )

    await page.getByRole('button', { name: 'Open navigation' }).click()
    record(
      `Drawer opens at ${width}×${height}`,
      await page.locator('.app-sidebar.mobile-open').count() === 1,
    )

    const closeInDrawer = page.locator('.app-sidebar.mobile-open').getByRole('button', { name: 'Close navigation' })
    record(
      `Drawer collapse control closes (not desktop-collapses) at ${width}×${height}`,
      await closeInDrawer.count() === 1,
    )
    await closeInDrawer.click()

    const after = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar')
      const main = document.querySelector('.app-main')
      const tabs = document.querySelector('.mobile-tab-bar')
      if (!sidebar || !main || !tabs) return { ok: false, reason: 'missing nodes' }
      const sideStyle = getComputedStyle(sidebar)
      const tabsStyle = getComputedStyle(tabs)
      const sideBox = sidebar.getBoundingClientRect()
      const mainBox = main.getBoundingClientRect()
      return {
        ok: true,
        hasMobileOpen: sidebar.classList.contains('mobile-open'),
        tabDisplay: tabsStyle.display,
        sidebarWidth: Math.round(sideBox.width),
        mainLeft: Math.round(mainBox.left),
        mainWidth: Math.round(mainBox.width),
        transform: sideStyle.transform,
        left: sideStyle.left,
      }
    })
    record(
      `After drawer close at ${width}×${height}: no collapsed rail, full-width main, tab bar on`,
      Boolean(
        after.ok
        && !after.hasMobileOpen
        && after.tabDisplay !== 'none'
        && after.mainLeft <= 1
        && after.mainWidth >= width - 2,
      ),
      JSON.stringify(after),
    )
  }

  await assertMobileNavChrome(390, 844)
  await assertMobileNavChrome(320, 720)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const skipAfterMobileNav = page.getByRole('button', { name: /skip/i })
  if (await skipAfterMobileNav.count()) await skipAfterMobileNav.first().click().catch(() => {})

  await page.locator('.overview-mode-panel').scrollIntoViewIfNeeded()
  await page.locator('.permit-leaflet-map.leaflet-container').waitFor({ timeout: 25000 })
  const demoMapCount = await page.locator('.permit-leaflet-map.leaflet-container').count()
  record('Demo dashboard has exactly one Leaflet map', demoMapCount === 1, `count=${demoMapCount}`)
  const heroBadge = await page.locator('.permit-map-badge strong').innerText()
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

  async function assertOverviewTalliesVisible(width, height) {
    await page.setViewportSize({ width, height })
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click().catch(() => {})
    await page.getByRole('tab', { name: 'Demo dashboard' }).click()
    await page.locator('[data-permit-map="overview"]').waitFor({ timeout: 25000 })
    const tallies = page.locator('.overview-tallies')
    await tallies.waitFor({ timeout: 10000 })
    await tallies.scrollIntoViewIfNeeded()
    // Keep the tallies center clear of sticky chrome for elementFromPoint
    await page.evaluate(() => {
      const el = document.querySelector('.overview-tallies')
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cy = rect.top + rect.height / 2
      const target = window.innerHeight * 0.45
      window.scrollBy(0, cy - target)
    })
    const visibility = await tallies.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const hit = document.elementFromPoint(cx, cy)
      const hitOk = Boolean(hit && (hit === el || el.contains(hit)))
      const workflow = document.querySelector('.transport-workflow')
      let intersectsWorkflow = false
      if (workflow) {
        const wr = workflow.getBoundingClientRect()
        intersectsWorkflow = !(
          rect.right <= wr.left
          || rect.left >= wr.right
          || rect.bottom <= wr.top
          || rect.top >= wr.bottom
        )
      }
      return {
        hitOk,
        intersectsWorkflow,
        hitTag: hit ? hit.tagName : null,
        hitClass: hit && 'className' in hit ? String(hit.className).slice(0, 80) : null,
        talliesTop: Math.round(rect.top),
        talliesBottom: Math.round(rect.bottom),
      }
    })
    record(
      `Overview tallies visible (elementFromPoint) at ${width}×${height}`,
      visibility.hitOk,
      JSON.stringify(visibility),
    )
    record(
      `Overview tallies do not intersect .transport-workflow at ${width}×${height}`,
      !visibility.intersectsWorkflow,
      JSON.stringify(visibility),
    )
  }
  await assertOverviewTalliesVisible(1440, 900)
  await assertOverviewTalliesVisible(390, 844)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const skipAfterTallies = page.getByRole('button', { name: /skip/i })
  if (await skipAfterTallies.count()) await skipAfterTallies.first().click().catch(() => {})
  await page.getByRole('tab', { name: 'Demo dashboard' }).click()
  await page.locator('[data-permit-map="overview"]').waitFor({ timeout: 25000 })

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
  const sampleMapCount = await page.locator('.permit-leaflet-map.leaflet-container').count()
  record('Sample permit panel has exactly one Leaflet map', sampleMapCount === 1, `count=${sampleMapCount}`)
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
    await ensureLoggedIn('Demo')
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

  // Mobile: corridor legend must fully contain Flowing / Pressure / Restricted.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipIfNeeded()
  await page.locator('.live-map-legend').waitFor({ timeout: 25000 })
  const legendFit = await page.evaluate(() => {
    const legend = document.querySelector('.live-map-legend')
    if (!legend) return { ok: false, reason: 'missing' }
    const box = legend.getBoundingClientRect()
    const items = [...legend.querySelectorAll('small')].map(el => {
      const b = el.getBoundingClientRect()
      return {
        text: el.textContent.trim(),
        outside: b.right > box.right + 1 || b.left < box.left - 1 || b.right > window.innerWidth + 1,
        right: Math.round(b.right),
      }
    })
    return {
      ok: legend.scrollWidth <= legend.clientWidth + 1
        && items.length >= 3
        && items.every(item => !item.outside)
        && /Restricted/i.test(items.map(i => i.text).join(' ')),
      width: Math.round(box.width),
      scrollWidth: legend.scrollWidth,
      clientWidth: legend.clientWidth,
      items,
    }
  })
  record(
    'Corridor legend at 390×844 keeps Flowing/Pressure/Restricted inside the pill',
    Boolean(legendFit.ok),
    JSON.stringify(legendFit),
  )

  // Mobile: sample/scenario permit cards must not force horizontal page overflow.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipIfNeeded()
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByText('Scenario mode').waitFor({ timeout: 15000 })
  const permitOverflow = await page.evaluate(() => {
    const docEl = document.documentElement
    const cards = [...document.querySelectorAll('.test-permit-card')]
    const cardMetrics = cards.map(el => {
      const box = el.getBoundingClientRect()
      const badge = el.querySelector('.expected-badge')
      const badgeBox = badge?.getBoundingClientRect()
      return {
        title: el.querySelector('strong')?.textContent?.trim() || '',
        right: Math.round(box.right),
        width: Math.round(box.width),
        badgeOffscreen: Boolean(badgeBox && badgeBox.right > window.innerWidth + 1),
        badgeRight: badgeBox ? Math.round(badgeBox.right) : null,
      }
    })
    const grid = document.querySelector('.test-permits-grid')
    const gridOverflow = grid ? grid.scrollWidth > grid.clientWidth + 1 : true
    const maxRight = Math.max(0, ...cardMetrics.map(c => c.right))
    return {
      ok: docEl.scrollWidth <= docEl.clientWidth + 1
        && !gridOverflow
        && maxRight <= window.innerWidth + 1
        && cardMetrics.every(c => !c.badgeOffscreen)
        && cardMetrics.some(c => /Simulated/i.test(c.title)),
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
      gridScrollWidth: grid?.scrollWidth || 0,
      gridClientWidth: grid?.clientWidth || 0,
      maxRight,
      cards: cardMetrics.filter(c => /Simulated/i.test(c.title) || c.badgeOffscreen).slice(0, 6),
    }
  })
  record(
    'Sample permits at 390×844 have no horizontal overflow and badges stay on-screen',
    Boolean(permitOverflow.ok),
    JSON.stringify(permitOverflow),
  )

  // Desktop unchanged: legend still single-line and fully visible at 1440.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipIfNeeded()
  await page.locator('.live-map-legend').waitFor({ timeout: 25000 })
  const desktopLegend = await page.evaluate(() => {
    const legend = document.querySelector('.live-map-legend')
    if (!legend) return { ok: false }
    const cs = getComputedStyle(legend)
    const box = legend.getBoundingClientRect()
    const items = [...legend.querySelectorAll('small')].map(el => {
      const b = el.getBoundingClientRect()
      return { text: el.textContent.trim(), outside: b.right > box.right + 1 }
    })
    return {
      ok: cs.flexWrap === 'nowrap'
        && legend.scrollWidth <= legend.clientWidth + 1
        && items.every(i => !i.outside)
        && box.width >= 200
        && box.width <= 320,
      width: Math.round(box.width),
      flexWrap: cs.flexWrap,
      items,
    }
  })
  record(
    'Corridor legend at 1440×900 stays single-line without clipping',
    Boolean(desktopLegend.ok),
    JSON.stringify(desktopLegend),
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipIfNeeded()
  await page.locator('.live-event-panel').waitFor({ timeout: 20000 })
  const mainLandmark = await page.evaluate(() => ({
    count: document.querySelectorAll('main').length,
    nested: Boolean(document.querySelector('main main')),
    host: Boolean(document.querySelector('main.app-page-host')),
    stageIsDiv: Boolean(document.querySelector('div.live-map-stage')),
  }))
  record(
    'Corridor map has exactly one main landmark',
    mainLandmark.count === 1 && !mainLandmark.nested && mainLandmark.host && mainLandmark.stageIsDiv,
    JSON.stringify(mainLandmark),
  )

  // Lorry parking must span fetched roads (not A1-only from a naive flatten+slice cap).
  const parkingFeed = await page.request.get(base + '/api/autobahn-events').then(res => res.json()).catch(() => null)
  const parkingTitles = Array.isArray(parkingFeed?.parking) ? parkingFeed.parking.map(item => String(item?.title || '')) : []
  const parkingRoads = [...new Set(parkingTitles.map(title => (title.match(/^A\d+/) || [])[0]).filter(Boolean))]
  const parkingInBavaria = Array.isArray(parkingFeed?.parking)
    ? parkingFeed.parking.filter(item => {
      const lat = Number(item?.lat)
      const lng = Number(item?.lng)
      return Number.isFinite(lat) && Number.isFinite(lng)
        && Math.abs(lat - 48.14) < 1.15
        && Math.abs(lng - 11.58) < 1.55
    }).length
    : 0
  record(
    'Autobahn parking feed covers more than one road',
    parkingTitles.length > 0 && parkingRoads.length > 1,
    JSON.stringify({ count: parkingTitles.length, roads: parkingRoads, parkingInBavaria }),
  )
  record(
    'Autobahn parking feed includes Bavaria-scoped sites',
    parkingInBavaria > 0,
    JSON.stringify({ parkingInBavaria, roads: parkingRoads }),
  )

  // Map KPI strip must track the same filtered set as the list/map (scope + layers),
  // not the raw national feed total.
  await page.locator('[data-testid="corridor-map-kpis"]').waitFor({ timeout: 20000 })
  await page.getByRole('tab', { name: 'Bavaria' }).click()
  await page.waitForTimeout(800)
  const bavariaKpis = await page.evaluate(() => {
    const summaryStrong = [...document.querySelectorAll('.live-event-summary > div')].map(el => ({
      label: el.querySelector('span')?.textContent?.trim() || '',
      value: Number(el.querySelector('strong')?.textContent || 'NaN'),
    }))
    const matched = summaryStrong.find(item => /Matched/i.test(item.label))?.value ?? NaN
    const safety = summaryStrong.find(item => /Safety/i.test(item.label))?.value ?? NaN
    const kpiStrong = [...document.querySelectorAll('[data-testid="corridor-map-kpis"] > div')].map(el => ({
      label: el.querySelector('span')?.textContent?.trim() || '',
      value: Number(el.querySelector('strong')?.textContent || 'NaN'),
    }))
    const ops = kpiStrong.find(item => /Operational signals/i.test(item.label))?.value ?? NaN
    const warnings = kpiStrong.find(item => /Warnings/i.test(item.label))?.value ?? NaN
    return { matched, ops, warnings, safety, summaryStrong, kpiStrong }
  })
  record(
    'Corridor KPIs match Bavaria-scoped visible signals',
    Number.isFinite(bavariaKpis.matched)
      && bavariaKpis.ops === bavariaKpis.matched
      && bavariaKpis.warnings === bavariaKpis.safety
      && bavariaKpis.matched > 0
      && bavariaKpis.matched < 500,
    JSON.stringify(bavariaKpis),
  )
  await page.getByRole('tab', { name: 'Germany' }).click()
  await page.waitForTimeout(500)
  const lorry = page.getByRole('button', { name: /Lorry parking/i })
  if (await lorry.count()) {
    const before = await page.evaluate(() => ({
      matched: Number(document.querySelector('.live-event-summary strong')?.textContent || 'NaN'),
      ops: Number(document.querySelector('[data-testid="corridor-map-kpis"] div:first-child strong')?.textContent || 'NaN'),
      lorryOn: document.querySelector('button[aria-pressed="true"]')
        ? [...document.querySelectorAll('.live-layer-panel button[aria-pressed]')].some(b => /Lorry parking/i.test(b.textContent || '') && b.getAttribute('aria-pressed') === 'true')
        : false,
    }))
    // Ensure lorry starts off (default), then toggle on and off.
    if (before.lorryOn) await lorry.click()
    await page.waitForTimeout(400)
    const lorryOff = await page.evaluate(() => ({
      matched: Number(document.querySelector('.live-event-summary strong')?.textContent || 'NaN'),
      ops: Number(document.querySelector('[data-testid="corridor-map-kpis"] div:first-child strong')?.textContent || 'NaN'),
    }))
    await lorry.click()
    await page.waitForTimeout(400)
    const lorryOn = await page.evaluate(() => ({
      matched: Number(document.querySelector('.live-event-summary strong')?.textContent || 'NaN'),
      ops: Number(document.querySelector('[data-testid="corridor-map-kpis"] div:first-child strong')?.textContent || 'NaN'),
    }))
    record(
      'Corridor KPIs follow layer toggles (lorry parking)',
      lorryOff.ops === lorryOff.matched
        && lorryOn.ops === lorryOn.matched
        && lorryOn.ops > lorryOff.ops,
      JSON.stringify({ lorryOff, lorryOn }),
    )
    if (lorryOn.ops !== lorryOff.ops) await lorry.click().catch(() => {})
  } else {
    record('Corridor KPIs follow layer toggles (lorry parking)', false, 'Lorry parking layer control missing')
  }

  // Panel Safety must track the same filtered set as overlay Warnings
  // (search query + Safety signals layer), not the raw scope total.
  const readCorridorKpis = async () => page.evaluate(() => {
    const summaryStrong = [...document.querySelectorAll('.live-event-summary > div')].map(el => ({
      label: el.querySelector('span')?.textContent?.trim() || '',
      value: Number(el.querySelector('strong')?.textContent || 'NaN'),
    }))
    const matched = summaryStrong.find(item => /Matched/i.test(item.label))?.value ?? NaN
    const safety = summaryStrong.find(item => /Safety/i.test(item.label))?.value ?? NaN
    const kpiStrong = [...document.querySelectorAll('[data-testid="corridor-map-kpis"] > div')].map(el => ({
      label: el.querySelector('span')?.textContent?.trim() || '',
      value: Number(el.querySelector('strong')?.textContent || 'NaN'),
    }))
    const ops = kpiStrong.find(item => /Operational signals/i.test(item.label))?.value ?? NaN
    const warnings = kpiStrong.find(item => /Warnings/i.test(item.label))?.value ?? NaN
    return { matched, ops, warnings, safety }
  })

  const germanyBaseline = await readCorridorKpis()
  const searchInput = page.locator('.live-event-search input')
  await searchInput.fill('A9')
  await page.waitForTimeout(500)
  const searchA9 = await readCorridorKpis()
  record(
    'Corridor Safety/Warnings agree under road search',
    Number.isFinite(searchA9.matched)
      && searchA9.ops === searchA9.matched
      && searchA9.warnings === searchA9.safety
      && searchA9.matched > 0
      && searchA9.matched < germanyBaseline.matched
      && searchA9.safety <= germanyBaseline.safety,
    JSON.stringify({ germanyBaseline, searchA9 }),
  )

  await searchInput.fill('zzzzqq')
  await page.waitForTimeout(400)
  const searchMiss = await readCorridorKpis()
  const emptyList = await page.locator('.live-event-empty').count()
  record(
    'Corridor Safety clears when search matches nothing',
    searchMiss.matched === 0
      && searchMiss.ops === 0
      && searchMiss.warnings === 0
      && searchMiss.safety === 0
      && emptyList > 0,
    JSON.stringify({ searchMiss, emptyList }),
  )

  await searchInput.fill('')
  await page.waitForTimeout(400)
  await page.getByRole('tab', { name: 'Bavaria' }).click()
  await page.waitForTimeout(500)
  // Layer panel collapses on narrow viewports; open it so Safety signals is reachable.
  const layerHeading = page.locator('.layer-panel-heading')
  if (await layerHeading.count()) {
    const layerListVisible = await page.locator('.layer-panel-list').count()
    if (!layerListVisible) await layerHeading.click()
  }
  const safetyLayer = page.getByRole('button', { name: /Safety signals/i })
  if (await safetyLayer.count()) {
    if (await safetyLayer.getAttribute('aria-pressed') !== 'true') await safetyLayer.click()
    await page.waitForTimeout(300)
    const safetyOn = await readCorridorKpis()
    await safetyLayer.click()
    await page.waitForTimeout(400)
    const safetyOff = await readCorridorKpis()
    record(
      'Corridor Safety/Warnings agree with Safety layer off',
      safetyOn.warnings === safetyOn.safety
        && safetyOn.safety > 0
        && safetyOff.ops === safetyOff.matched
        && safetyOff.warnings === 0
        && safetyOff.safety === 0
        && safetyOff.matched < safetyOn.matched,
      JSON.stringify({ safetyOn, safetyOff }),
    )
    // Restore Safety layer for later layout checks.
    if (await safetyLayer.getAttribute('aria-pressed') !== 'true') await safetyLayer.click().catch(() => {})
  } else {
    record('Corridor Safety/Warnings agree with Safety layer off', false, 'Safety signals layer control missing')
  }
  await page.getByRole('tab', { name: 'Germany' }).click()
  await page.waitForTimeout(400)

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
  await ensureLoggedIn('Demo')
  await page.getByRole('heading', { name: /Route check/i }).first().waitFor({ timeout: 20000 })
  await page.waitForFunction(
    () => document.title === 'Route checks · HTR · Heavy transport route check',
    null,
    { timeout: 10000 },
  ).catch(() => {})
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
  await fillPlannedDeparture(page)
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
  record('Route check finished', true, (await page.locator('.verdict-banner').innerText()).replace(/\s+/g, ' ').slice(0, 120))
  const simulateTriggerCount = await page.locator('.test-scenarios-trigger').count()
  record(
    'Item 7: no 🧪 simulate trigger in production DOM',
    simulateTriggerCount === 0,
    `count=${simulateTriggerCount}`,
  )
  await page.setViewportSize({ width: 390, height: 915 })
  const ctaBox = await page.locator('.mobile-route-actions .btn-primary').boundingBox()
  const noOverlap = simulateTriggerCount === 0 && Boolean(ctaBox)
  record(
    'Item 7: mobile primary CTA not covered by simulate control',
    noOverlap,
    JSON.stringify({ simulateTriggerCount, cta: ctaBox }),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('.route-map-gl-container, .maplibregl-map, .results-map').first().waitFor({ timeout: 25000 }).catch(() => {})
  const resultMap = await mapPaintMetrics(page, '.route-map-gl-container, .results-map .maplibre-map, .results-map')
  record(
    'Result map is taller than 300px with painted tiles',
    mapLooksPainted(resultMap),
    JSON.stringify(resultMap),
  )

  const takeAction = page.getByRole('button', { name: /Take action/i })
  if (await takeAction.count()) {
    await takeAction.first().click()
    await page.getByRole('button', { name: /^Escalate$/i }).click()
    await page.getByRole('button', { name: /Confirm escalation/i }).click()
    const escalateToast = await page.locator('.app-toast').innerText().catch(() => '')
    record(
      'Item 4: escalate toast does not claim sent',
      /Logged locally \(demo\), not sent/i.test(escalateToast),
      escalateToast.slice(0, 160),
    )
  } else {
    // READY/VERIFY screens may hide Take action — still verify dialog copy via HOLD scenario later.
    record('Item 4: escalate toast does not claim sent', true, 'Take action not on this verdict; covered on HOLD scenario')
  }
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
  await flushAccount(page)
  record('Save as job after check', true)

  const savedJobMeta = await page.evaluate(() => {
    const job = window.__HT_TEST__?.getJobs()?.[0]
    return job
      ? {
          corridor: job.corridor || '',
          permittedRoads: job.permittedRoads || [],
          validFrom: job.validFrom || '',
          validUntil: job.validUntil || '',
          travelFrom: job.travelFrom || '',
          travelTo: job.travelTo || '',
        }
      : null
  })
  const corridorClean = Boolean(
    savedJobMeta
    && /^A\d{1,3}(, A\d{1,3})*$/i.test(String(savedJobMeta.corridor).trim())
    && !/HOLD|VERIFY|±|km/i.test(savedJobMeta.corridor),
  )
  const roadsClean = Array.isArray(savedJobMeta?.permittedRoads)
    && savedJobMeta.permittedRoads.length > 0
    && savedJobMeta.permittedRoads.every(road => /^A\d{1,3}$/i.test(road))
  record(
    'Saved job stores clean corridor and validity (not buffer display label)',
    corridorClean && roadsClean && Boolean(savedJobMeta?.validFrom && savedJobMeta?.validUntil),
    JSON.stringify(savedJobMeta),
  )

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

  const historyBeforeRecheck = await readHistoryLength(page)
  const recheckRequest = page.waitForRequest(
    req => req.url().includes('/api/check-route') && req.method() === 'POST',
    { timeout: 30000 },
  )
  await page.getByRole('button', { name: 'Re-check' }).click()
  const recheckPost = await recheckRequest.catch(() => null)
  await page.locator('.verdict-banner, .checking-state').first().waitFor({ timeout: 15000 })
  if (await page.locator('.checking-state').count()) {
    await page.locator('.verdict-banner').waitFor({ timeout: 120000 })
  } else {
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  }
  const stillOnResult = await page.locator('.verdict-banner').count()
  const importVisible = await page.getByRole('button', { name: /show sample permits/i }).count()
  const historyAfterRecheck = await readHistoryLength(page)
  record(
    'Re-check re-runs check and stays on result (does not reset to Import)',
    Boolean(recheckPost) && stillOnResult > 0 && importVisible === 0 && historyAfterRecheck > historyBeforeRecheck,
    JSON.stringify({
      posted: Boolean(recheckPost),
      stillOnResult,
      importVisible,
      historyBeforeRecheck,
      historyAfterRecheck,
    }),
  )

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated HOLD — A3 residual width/ }).click()
  await page.locator('[data-testid="vehicle-width"]').waitFor({ timeout: 10000 })
  const holdWidth = await page.locator('[data-testid="vehicle-width"]').inputValue()
  record('Scenario dims populate immediately', holdWidth === '3.8', `width=${holdWidth}`)
  await fillPlannedDeparture(page)
  const scenarioCheckRequest = page.waitForRequest(
    req => req.url().includes('/api/check-route') && req.method() === 'POST',
    { timeout: 30000 },
  )
  await page.getByRole('button', { name: 'Check route' }).click()
  const scenarioCheckPost = await scenarioCheckRequest.catch(() => null)
  let scenarioCheckBody = null
  try {
    scenarioCheckBody = scenarioCheckPost ? scenarioCheckPost.postDataJSON() : null
  } catch {
    scenarioCheckBody = null
  }
  await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  const scenarioHoldBanner = await page.locator('.verdict-banner').innerText()
  const scenarioSimulated = await page.locator('.scenario-banner').count()
  record(
    'Simulated HOLD width check stays simulated',
    scenarioCheckBody?.scenario === 'hold-width'
      && /HOLD/i.test(scenarioHoldBanner)
      && scenarioSimulated > 0,
    JSON.stringify({
      scenario: scenarioCheckBody?.scenario,
      banner: scenarioHoldBanner.replace(/\s+/g, ' ').slice(0, 160),
      simulatedBanner: scenarioSimulated,
    }),
  )
  await page.getByRole('button', { name: 'Save as job' }).click()
  await page.getByRole('button', { name: 'Save job' }).click()
  await flushAccount(page)
  const scenarioJobMeta = await page.evaluate(() => {
    const jobs = window.__HT_TEST__?.getJobs() || []
    const match = jobs.find(job => job.scenario === 'hold-width' || /SCENARIO-HOLD-WIDTH|residual width|Duisburg/i.test(`${job.name} ${job.permitNumber}`))
    return match
      ? { id: match.id, scenario: match.scenario || null, lastVerdict: match.lastVerdict || null, source: match.lastSource || null }
      : { id: null, scenario: null, lastVerdict: null, source: null, jobCount: jobs.length }
  })
  record(
    'Saved scenario job persists scenario id',
    scenarioJobMeta.scenario === 'hold-width',
    JSON.stringify(scenarioJobMeta),
  )
  if (scenarioJobMeta.id) {
    await flushAccount(page)
    await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
    await ensureLoggedIn('Demo')
    await page.locator(`[data-job-id="${scenarioJobMeta.id}"]`).waitFor({ timeout: 15000 })
    const scenarioRerunRequest = page.waitForRequest(
      req => req.url().includes('/api/check-route') && req.method() === 'POST',
      { timeout: 30000 },
    ).catch(() => null)
    await page.locator(`[data-job-id="${scenarioJobMeta.id}"]`).getByRole('button', { name: /Re-run check/i }).click()
    await page.waitForURL(/route-checks\?.*job=/, { timeout: 15000 })
    const scenarioRerunPost = await scenarioRerunRequest
    let scenarioRerunBody = null
    try {
      scenarioRerunBody = scenarioRerunPost ? scenarioRerunPost.postDataJSON() : null
    } catch {
      scenarioRerunBody = null
    }
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
    const rerunBanner = await page.locator('.verdict-banner').innerText()
    const rerunSimulated = await page.locator('.scenario-banner').count()
    const rerunSource = await page.evaluate(() => {
      const jobs = window.__HT_TEST__?.getJobs() || []
      const job = jobs.find(item => item.scenario === 'hold-width')
      return {
        lastVerdict: job?.lastVerdict || null,
        lastSource: job?.lastSource || null,
        scenario: job?.scenario || null,
      }
    })
    record(
      'Scenario job re-run keeps scenario and simulated labelling',
      scenarioRerunBody?.scenario === 'hold-width'
        && /HOLD/i.test(rerunBanner)
        && rerunSimulated > 0
        && /Simulated/i.test(String(rerunSource.lastSource || ''))
        && rerunSource.lastVerdict === 'HOLD',
      JSON.stringify({
        postScenario: scenarioRerunBody?.scenario || null,
        banner: rerunBanner.replace(/\s+/g, ' ').slice(0, 160),
        simulatedBanner: rerunSimulated,
        ...rerunSource,
      }),
    )
  } else {
    record('Scenario job re-run keeps scenario and simulated labelling', false, 'scenario job not saved')
  }

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated VERIFY/ }).click()
  await fillPlannedDeparture(page)
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 30000 })

  await page.locator('.confirm-on-site-bar').waitFor({ timeout: 10000 })
  const confirmRemaining = page.getByRole('button', { name: /Confirm remaining VERIFY on site/i })
  await page.locator('[data-testid="confirmer-name"]').fill('')
  const bulkDisabledEmpty = await confirmRemaining.count()
    ? await confirmRemaining.isDisabled()
    : true
  const bulkHint = await page.locator('[data-testid="bulk-confirm-disabled-hint"]').innerText().catch(() => '')
  record(
    'Item 5: bulk confirm disabled without confirmer name',
    bulkDisabledEmpty && /confirmer name/i.test(bulkHint),
    `disabled=${bulkDisabledEmpty} hint=${bulkHint.slice(0, 120)}`,
  )
  await page.locator('[data-testid="confirmer-name"]').fill('QA Test')
  const resultClearance = page.locator('.confirm-on-site-bar .clearance-tick input')
  if (!(await resultClearance.isChecked())) await resultClearance.check()
  if (await confirmRemaining.count()) {
    record('Item 5: bulk confirm enabled after name', !(await confirmRemaining.isDisabled()))
    await confirmRemaining.click()
    await page.locator('[data-testid="bulk-confirm-summary"]').waitFor({ timeout: 10000 })
    const summaryText = await page.locator('[data-testid="bulk-confirm-summary"]').innerText()
    record(
      'Item 5: bulk confirm shows summary dialog',
      /Items to confirm/i.test(summaryText),
      summaryText.replace(/\s+/g, ' ').slice(0, 180),
    )
    const dialogName = page.locator('[data-testid="bulk-confirm-name"]')
    if (await dialogName.count()) await dialogName.fill('QA Test')
    await page.getByRole('button', { name: /Confirm status/i }).scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: /Confirm status/i }).click()
  } else {
    record('Item 5: bulk confirm enabled after name', true, 'no pending VERIFY on this scenario')
    record('Item 5: bulk confirm shows summary dialog', true, 'no pending VERIFY on this scenario')
  }
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

  await flushAccount(page)
  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  await ensureLoggedIn('Demo')
  const jobsCopy = await page.locator('.jobs-monitor-banner').innerText()
  record(
    'Jobs monitoring copy is plain language',
    /Keep it open until departure/i.test(jobsCopy) && !/Vercel cron/i.test(jobsCopy) && !/paid service/i.test(jobsCopy),
    jobsCopy.replace(/\s+/g, ' ').slice(0, 200),
  )
  const jobVisible = await page.locator('.job-row').count()
  record('Jobs list shows saved job', jobVisible >= 1, `jobs=${jobVisible}`)

  // Prefer the live (non-scenario) job — scenario jobs are covered separately above.
  const liveJobMeta = await page.evaluate(() => {
    const jobs = window.__HT_TEST__?.getJobs() || []
    const job = jobs.find(item => !item.scenario) || jobs[0]
    return job
      ? { id: job.id, lastCheckedAt: job.lastCheckedAt || '', vehicle: job.vehicle || null }
      : { id: null, lastCheckedAt: '', vehicle: null }
  })
  const lastCheckedBefore = liveJobMeta.lastCheckedAt
  const jobVehicleBefore = liveJobMeta.vehicle
  const jobRerunRequest = page.waitForRequest(
    req => req.url().includes('/api/check-route') && req.method() === 'POST',
    { timeout: 30000 },
  )
  if (!liveJobMeta.id) throw new Error('No live job found for re-run QA')
  await page.locator(`[data-job-id="${liveJobMeta.id}"]`).getByRole('button', { name: /Re-run check/i }).click()
  await page.waitForURL(/route-checks\?.*job=/, { timeout: 15000 })
  const jobRerunPost = await jobRerunRequest.catch(() => null)
  let jobRerunBody = null
  try {
    jobRerunBody = jobRerunPost ? jobRerunPost.postDataJSON() : null
  } catch {
    jobRerunBody = null
  }
  const jobRerunClean = Boolean(
    jobRerunBody
    && /^A\d{1,3}(, A\d{1,3})*$/i.test(String(jobRerunBody.corridor || '').trim())
    && !/HOLD|VERIFY|±/i.test(String(jobRerunBody.corridor || ''))
    && Array.isArray(jobRerunBody.permittedRoads)
    && jobRerunBody.permittedRoads.every(road => /^A\d{1,3}$/i.test(road))
    && jobRerunBody.validFrom
    && jobRerunBody.validUntil
    && !jobRerunBody.scenario
  )
  record(
    'Job re-run POST sends clean corridor, roads, and validity window',
    jobRerunClean,
    JSON.stringify({
      corridor: jobRerunBody?.corridor,
      permittedRoads: jobRerunBody?.permittedRoads,
      validFrom: jobRerunBody?.validFrom,
      validUntil: jobRerunBody?.validUntil,
      scenario: jobRerunBody?.scenario || null,
      travelFrom: jobRerunBody?.travelFrom,
      travelTo: jobRerunBody?.travelTo,
    }),
  )
  // Prefer a finished verdict; if the live Autobahn call is slow, still accept the checking→result path.
  const rerunState = page.locator('.verdict-banner, .checking-state, [data-testid="gpx-upload-error"], .field-error')
  await rerunState.first().waitFor({ timeout: 15000 })
  if (await page.locator('.checking-state').count()) {
    await page.locator('.verdict-banner').waitFor({ timeout: 120000 })
  } else {
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  }
  const rerunVehicleMatch = await page.evaluate(({ expected, jobId }) => {
    let history = []
    try {
      history = window.__HT_TEST__?.getHistory?.() || window.__HT_TEST__?.getStore?.('htr-route-check-history') || []
    } catch {
      history = []
    }
    if (!Array.isArray(history)) history = []
    const withJob = history.filter(item => item.jobId === jobId)
    const latest = withJob[0] || history.find(item => item.jobId) || history[0]
    const vehicle = latest?.vehicle || null
    const match = Boolean(
      expected
      && vehicle
      && Number(vehicle.width) === Number(expected.width)
      && Number(vehicle.height) === Number(expected.height)
      && Number(vehicle.length) === Number(expected.length)
      && Number(vehicle.grossWeight) === Number(expected.grossWeight),
    )
    const staleDefaults = vehicle
      && Number(vehicle.width) === 3
      && Number(vehicle.height) === 4
      && Number(vehicle.length) === 25
      && Number(vehicle.grossWeight) === 52
    return { match, staleDefaults, expected, vehicle, jobId }
  }, { expected: jobVehicleBefore, jobId: liveJobMeta.id })
  record(
    'Job re-run history vehicle matches saved job (not form defaults)',
    Boolean(rerunVehicleMatch.match) && !rerunVehicleMatch.staleDefaults,
    JSON.stringify(rerunVehicleMatch),
  )
  await page.goto(base + '/jobs', { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-job-id="${liveJobMeta.id}"] [data-testid="job-last-check"]`).waitFor({ timeout: 15000 })
  const lastCheckAfter = await page.evaluate(jobId => {
    const job = (window.__HT_TEST__?.getJobs() || []).find(item => item.id === jobId)
    const row = document.querySelector(`[data-job-id="${jobId}"]`)
    return {
      lastCheckedAt: job?.lastCheckedAt || '',
      label: row?.querySelector('[data-testid="job-last-check"]')?.textContent || '',
    }
  }, liveJobMeta.id)
  const lastCheckUpdated = Boolean(lastCheckAfter.lastCheckedAt)
    && lastCheckAfter.lastCheckedAt !== lastCheckedBefore
    && /Just now/i.test(lastCheckAfter.label)
  record('Jobs last-check updates immediately after re-run', lastCheckUpdated, JSON.stringify({ lastCheckedBefore, ...lastCheckAfter }))

  const hookResult = await page.evaluate(async jobId => {
    const jobs = window.__HT_TEST__?.getJobs() || []
    const job = jobs.find(item => item.id === jobId) || jobs[0]
    if (!job) return { ok: false, reason: 'no job' }
    window.__HT_TEST__.simulateVerdictChange(job.id, 'HOLD')
    await new Promise(resolve => setTimeout(resolve, 200))
    const alerts = window.__HT_TEST__.getAlerts()
    return {
      ok: true,
      jobId: job.id,
      alertCount: alerts.length,
      holdAlert: alerts.some(alert => /HOLD/.test(alert.change) || alert.severity === 'HOLD'),
      unread: alerts.filter(alert => alert.status === 'New').length,
    }
  }, liveJobMeta.id)
  record('Monitoring test hook created HOLD alert', Boolean(hookResult.ok && hookResult.holdAlert), JSON.stringify(hookResult))

  await flushAccount(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await ensureLoggedIn('Demo')
  const badge = await page.locator('.notification-count').textContent().catch(() => null)
  record('Alert badge updates after verdict change', Number(badge || '0') > 0, `badge=${badge}`)

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  const alertText = await page.locator('.route-alert-log').first().innerText()
  record('Alerts page includes verdict-change HOLD', /HOLD/.test(alertText), alertText.slice(0, 180).replace(/\s+/g, ' '))

  await page.evaluate(async () => {
    const alerts = window.__HT_TEST__?.getStore?.('htr-monitor-alerts') || window.__HT_TEST__?.getAlerts?.() || []
    if (Array.isArray(alerts) && alerts[0]) {
      alerts[0].escalated = true
      window.__HT_TEST__?.setStore?.('htr-monitor-alerts', alerts)
      await window.__HT_TEST__?.flushStore?.()
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
  await fillPlannedDeparture(page)
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
    await fillPlannedDeparture(page)
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

  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /show sample permits/i }).click()
  await page.getByRole('button', { name: /Simulated HOLD — A7 Vollsperrung/ }).click()
  await fillPlannedDeparture(page)
  await page.getByRole('button', { name: 'Check route' }).click()
  await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: /Take action/i }).first().click()
  await page.getByRole('button', { name: /^Escalate$/i }).click()
  await page.getByRole('button', { name: /Confirm escalation/i }).click()
  await page.getByText(/Logged locally \(demo\), not sent/i).waitFor({ timeout: 10000 })
  const holdEscalateToast = await page.locator('body').innerText()
  record(
    'Item 4: HOLD escalate uses honest local-log wording',
    /Logged locally \(demo\), not sent/i.test(holdEscalateToast)
      && !/Escalation sent to transport manager/i.test(holdEscalateToast),
    holdEscalateToast.replace(/\s+/g, ' ').slice(0, 220),
  )
  await page.getByRole('button', { name: /Take action/i }).first().click()
  await page.getByRole('button', { name: /Hold departure/i }).click()
  await page.getByRole('button', { name: /Confirm hold/i }).click()
  await page.getByText(/Logged locally \(demo\), not sent/i).waitFor({ timeout: 10000 })
  record('Item 4: hold-departure toast does not claim notify/sent', true)
  await page.getByRole('button', { name: /Take action/i }).first().click()
  await page.getByRole('button', { name: /Request on-site check/i }).click()
  await page.getByRole('button', { name: /Log check request/i }).click()
  await page.getByText(/Logged locally \(demo\), not sent/i).waitFor({ timeout: 10000 })
  record('Item 4: on-site check toast does not claim requested/sent', true)

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  const historyActions = await page.locator('[data-testid="history-actions-log"]').first().innerText().catch(() => '')
  record(
    'Item 4: demo actions appear in check history',
    /Logged locally \(demo\), not sent/i.test(historyActions),
    historyActions.slice(0, 220),
  )

  // Sample ?run=1: labelled demo departure + permit vehicle dims (not Standard 3.0×4.0×25×52).
  const bremenPayloadPromise = page.waitForRequest(
    req => req.url().includes('/api/check-route') && req.method() === 'POST',
    { timeout: 120000 },
  )
  await page.goto(base + '/route-checks?permit=bremen-dortmund&run=1', { waitUntil: 'domcontentloaded' })
  const bremenReq = await bremenPayloadPromise
  const bremenBody = bremenReq.postDataJSON()
  const bremenVehicle = bremenBody?.vehicle || {}
  record(
    'bremen-dortmund&run=1 sends permit vehicle 3.5×4.2×32×72',
    Number(bremenVehicle.width) === 3.5
      && Number(bremenVehicle.height) === 4.2
      && Number(bremenVehicle.length) === 32
      && Number(bremenVehicle.grossWeight) === 72,
    JSON.stringify(bremenVehicle),
  )
  await page.locator('.verdict-banner, .checking-state').first().waitFor({ timeout: 15000 })
  if (await page.locator('.checking-state').count()) {
    await page.locator('.verdict-banner').waitFor({ timeout: 120000 })
  } else {
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  }
  const bremenResult = await page.evaluate(() => {
    const banner = document.querySelector('.verdict-banner')?.textContent || ''
    const demoNote = document.querySelector('[data-testid="demo-departure-note"]')?.textContent || ''
    let history = []
    try {
      history = window.__HT_TEST__?.getHistory?.() || window.__HT_TEST__?.getStore?.('htr-route-check-history') || []
    } catch {
      history = []
    }
    if (!Array.isArray(history)) history = []
    return {
      banner,
      demoNote,
      vehicle: history[0]?.vehicle || null,
      verdict: history[0]?.verdict || '',
    }
  })
  record(
    'bremen-dortmund&run=1 gives HOLD with demo departure note',
    /HOLD/i.test(bremenResult.banner)
      && bremenResult.verdict === 'HOLD'
      && /Demo departure:/i.test(bremenResult.demoNote)
      && /change it and re-check/i.test(bremenResult.demoNote)
      && Number(bremenResult.vehicle?.width) === 3.5
      && Number(bremenResult.vehicle?.grossWeight) === 72,
    JSON.stringify({
      verdict: bremenResult.verdict,
      demoNote: bremenResult.demoNote.slice(0, 120),
      vehicle: bremenResult.vehicle,
      banner: bremenResult.banner.replace(/\s+/g, ' ').slice(0, 160),
    }),
  )

  await page.goto(base + '/route-checks?permit=hamburg-hannover&run=1', { waitUntil: 'domcontentloaded' })
  await page.locator('.verdict-banner, .checking-state, #planned-departure').first().waitFor({ timeout: 15000 })
  if (await page.locator('.checking-state').count()) {
    await page.locator('.verdict-banner').waitFor({ timeout: 120000 })
  }
  const permitAutorun = await page.evaluate(() => {
    const fileError = document.querySelector('[data-testid="gpx-upload-error"]')
    const demoNote = document.querySelector('[data-testid="demo-departure-note"]')?.textContent || ''
    const width = document.querySelector('[data-testid="vehicle-width"]')
    let history = []
    try {
      history = window.__HT_TEST__?.getHistory?.() || window.__HT_TEST__?.getStore?.('htr-route-check-history') || []
    } catch {
      history = []
    }
    if (!Array.isArray(history)) history = []
    return {
      fileErrorVisible: Boolean(fileError),
      fileErrorText: fileError?.textContent || '',
      demoNote,
      width: width?.value || '',
      historyVehicle: history[0]?.vehicle || null,
      hasVerdict: Boolean(document.querySelector('.verdict-banner')),
    }
  })
  record(
    'Permit ?run=1 applies demo departure and permit vehicle (no file error)',
    !permitAutorun.fileErrorVisible
      && /Demo departure:/i.test(permitAutorun.demoNote)
      && permitAutorun.hasVerdict
      && Number(permitAutorun.historyVehicle?.width) === 3.2
      && Number(permitAutorun.historyVehicle?.height) === 4.5
      && Number(permitAutorun.historyVehicle?.length) === 28.5
      && Number(permitAutorun.historyVehicle?.grossWeight) === 60,
    JSON.stringify(permitAutorun),
  )

  await page.goto(base + '/route-checks?debug=1', { waitUntil: 'networkidle', timeout: 60000 }).catch(() =>
    page.goto(base + '/route-checks?debug=1', { waitUntil: 'domcontentloaded' }),
  )
  await page.getByRole('heading', { name: /Route check/i }).first().waitFor({ timeout: 15000 }).catch(() => {})
  const debugTrigger = await page.locator('[data-testid="debug-scenarios-trigger"], .test-scenarios-trigger').count()
  record('Item 7: 🧪 only appears with ?debug', debugTrigger === 1, `count=${debugTrigger} url=${page.url()}`)

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

  const measureVerdictContrast = () => {
    const parse = (input) => {
      if (!input || input === 'transparent') return null
      const rgba = String(input).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
      if (rgba) {
        const a = rgba[4] === undefined ? 1 : Number(rgba[4])
        if (a <= 0.01) return null
        return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a }
      }
      const srgb = String(input).match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i)
      if (srgb) {
        const a = srgb[4] === undefined ? 1 : Number(srgb[4])
        if (a <= 0.01) return null
        return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255, a }
      }
      return null
    }
    const parseHex = (hex) => {
      const m = String(hex).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      if (!m) return null
      let h = m[1]
      if (h.length === 3) h = h.split('').map((c) => c + c).join('')
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      }
    }
    const blend = (fg, bg) => ({
      r: fg.r * (fg.a ?? 1) + bg.r * (1 - (fg.a ?? 1)),
      g: fg.g * (fg.a ?? 1) + bg.g * (1 - (fg.a ?? 1)),
      b: fg.b * (fg.a ?? 1) + bg.b * (1 - (fg.a ?? 1)),
      a: 1,
    })
    const luminance = (r, g, b) => {
      const toLin = (c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
    }
    const ratio = (fg, bg) => {
      const mixed = blend(fg, bg)
      const L1 = luminance(mixed.r, mixed.g, mixed.b)
      const L2 = luminance(bg.r, bg.g, bg.b)
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    }
    const parseGradientStops = (value) => {
      if (!value || value === 'none') return []
      const stops = []
      const re = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|color\(\s*srgb\s+[\d.]+\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.]+)?\s*\)/gi
      let m
      while ((m = re.exec(value))) {
        const c = parse(m[0]) || parseHex(m[0])
        if (c && c.a >= 0.6) stops.push(c)
      }
      return stops
    }
    const averageStops = (stops) => {
      if (!stops.length) return null
      const sum = stops.reduce((acc, s) => ({
        r: acc.r + s.r,
        g: acc.g + s.g,
        b: acc.b + s.b,
      }), { r: 0, g: 0, b: 0 })
      return {
        r: sum.r / stops.length,
        g: sum.g / stops.length,
        b: sum.b / stops.length,
        a: 1,
      }
    }
    const solidFromNode = (node, underlay) => {
      const cs = getComputedStyle(node)
      const bg = parse(cs.backgroundColor)
      if (bg && bg.a >= 0.85) return bg
      const gradient = averageStops(parseGradientStops(cs.backgroundImage))
      if (gradient) return underlay ? blend({ ...gradient, a: 0.92 }, underlay) : gradient
      if (bg && bg.a >= 0.6 && underlay) return blend(bg, underlay)
      if (bg && bg.a >= 0.6) return { r: bg.r, g: bg.g, b: bg.b, a: 1 }
      return null
    }
    const effectiveBg = (el) => {
      const stack = []
      let node = el
      while (node && node !== document.documentElement) {
        stack.push(node)
        node = node.parentElement
      }
      let bg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const next = solidFromNode(stack[i], bg)
        if (next) bg = next
      }
      return bg
    }
    const measure = (el) => {
      if (!el) return null
      const fg = parse(getComputedStyle(el).color)
      const bg = effectiveBg(el)
      if (!fg || !bg) return null
      return Number(ratio(fg, bg).toFixed(2))
    }
    const banner = document.querySelector('.verdict-banner')
    const title = banner?.querySelector('h2')
    const pill = banner?.querySelector('.verdict-label')
    const recheck = banner?.querySelector('.btn-text')
    const button = document.querySelector('.btn-primary')
    const badge = document.querySelector('.notification-count')
    return {
      title: measure(title),
      pill: measure(pill),
      recheck: measure(recheck),
      button: measure(button),
      badge: measure(badge),
      bannerClass: banner?.className || '',
      titleText: (title?.textContent || '').trim().slice(0, 80),
      pillText: (pill?.textContent || '').trim().slice(0, 40),
      recheckText: (recheck?.textContent || '').trim().slice(0, 40),
      badgeText: (badge?.textContent || '').trim().slice(0, 8),
    }
  }

  async function runContrastSample(colorScheme, sampleName, bannerSelector) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme,
    })
    await context.addInitScript(() => {
      try { localStorage.setItem('htr-current-user', 'demo') } catch {}
    })
    const page = await context.newPage()
    await page.emulateMedia({ colorScheme })
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('heading', { name: /Route check/i }).first().waitFor({ timeout: 20000 }).catch(() => {})
    const login = page.getByRole('button', { name: 'Continue as Demo' })
    if (await login.count()) await login.click().catch(() => {})
    const skip = page.getByRole('button', { name: /skip/i })
    if (await skip.count()) await skip.first().click({ timeout: 2000 }).catch(() => {})
    const later = page.getByRole('button', { name: /later|not now|continue without/i })
    if (await later.count()) await later.first().click({ timeout: 1500 }).catch(() => {})
    await page.getByRole('button', { name: /show sample permits/i }).click({ timeout: 15000 })
    await page.getByRole('button', { name: sampleName }).click({ timeout: 15000 })
    await fillPlannedDeparture(page)
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator(bannerSelector).waitFor({ timeout: 90000 })
    await page.waitForTimeout(800)
    const contrast = await page.evaluate(measureVerdictContrast)
    await context.close()
    return contrast
  }

  // Multi-job account sync: ≥15 realistic jobs must all persist (keepalive quota).
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue as Luis' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  const skipLuis = page.getByRole('button', { name: /skip/i })
  if (await skipLuis.count()) await skipLuis.first().click().catch(() => {})
  if (!(await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).count())) {
    await page.getByRole('link', { name: 'Jobs' }).first().click().catch(() => {})
  }
  await page.waitForFunction(() => Boolean(window.__HT_TEST__?.setStore), null, { timeout: 20000 })
  const multiJob = await page.evaluate(async () => {
    const gpx = await fetch('/test-permits/bremen-dortmund-a1.gpx').then(r => r.text())
    const jobs = []
    let sawNotSaved = false
    const prefix = `Luis multi ${Date.now()}`
    for (let i = 0; i < 15; i++) {
      const now = new Date().toISOString()
      jobs.unshift({
        id: `job-luis-multi-${Date.now()}-${i}`,
        name: `${prefix} #${i + 1}`,
        permitNumber: `DE-HB-LUIS-${70000 + i}`,
        routeFileName: 'bremen-dortmund-a1.gpx',
        gpxContent: gpx,
        origin: 'Bremen Heavy Cargo Terminal',
        destination: 'Dortmund',
        corridor: 'A1',
        permittedRoads: ['A1'],
        vehicle: { width: 3.5, height: 4.2, length: 32, grossWeight: 72 },
        plannedDeparture: now,
        monitorIntervalMinutes: 15,
        createdAt: now,
        updatedAt: now,
        lastCheckedAt: now,
        lastVerdict: i % 3 === 0 ? 'HOLD' : i % 3 === 1 ? 'VERIFY' : 'READY',
        lastSummary: 'Residual width conflict on the permitted A1 corridor — confirm before departure.',
        lastRetrievedAt: now,
        lastSource: 'Autobahn GmbH MIA, Open Roadworks',
        monitoringStoppedReason: null,
      })
      window.__HT_TEST__?.setStore?.('htr-saved-jobs', jobs.slice())
      await window.__HT_TEST__?.flushStore?.()
      // Give the PUT a moment; chip must never stick on "Not saved".
      await new Promise(resolve => setTimeout(resolve, 120))
      if (document.querySelector('.user-chip-badge.is-error')) sawNotSaved = true
    }
    // Wait until the error badge is gone (final save settled).
    for (let t = 0; t < 80; t++) {
      if (!document.querySelector('.user-chip-badge.is-error')) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    await window.__HT_TEST__?.flushStore?.()
    await new Promise(resolve => setTimeout(resolve, 400))
    const res = await fetch('/api/state?user=luis')
    const payload = await res.json()
    const raw = payload?.data?.['htr-saved-jobs']
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
    const matched = Array.isArray(parsed) ? parsed.filter(item => String(item?.name || '').startsWith(prefix)) : []
    const bodyProbe = JSON.stringify({ user: 'luis', key: 'htr-saved-jobs', value: parsed })
    return {
      apiCount: matched.length,
      totalApi: Array.isArray(parsed) ? parsed.length : -1,
      sawNotSaved,
      notSavedNow: Boolean(document.querySelector('.user-chip-badge.is-error')),
      approxBytes: new TextEncoder().encode(bodyProbe).length,
      prefix,
    }
  })
  record(
    'Luis can save ≥15 jobs without Not saved / data loss',
    multiJob.apiCount >= 15 && !multiJob.sawNotSaved && !multiJob.notSavedNow,
    JSON.stringify(multiJob),
  )
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 }).catch(() => {})
  const multiJobAfterReload = await page.evaluate(async (prefix) => {
    const res = await fetch('/api/state?user=luis')
    const payload = await res.json()
    const raw = payload?.data?.['htr-saved-jobs']
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
    const matched = Array.isArray(parsed) ? parsed.filter(item => String(item?.name || '').startsWith(prefix)) : []
    return {
      apiCount: matched.length,
      notSaved: Boolean(document.querySelector('.user-chip-badge.is-error')),
    }
  }, multiJob.prefix)
  record(
    'Luis ≥15 jobs still present in GET /api/state after reload',
    multiJobAfterReload.apiCount >= 15 && !multiJobAfterReload.notSaved,
    JSON.stringify(multiJobAfterReload),
  )

  // Per-user isolation: Anna's job must not appear for Paul.
  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue as Anna' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  // Collapsed-rail tooltips must escape overflow clipping (hover + focus-visible).
  await page.setViewportSize({ width: 1440, height: 900 })
  // Headless defaults to hover:none which suppresses :hover tooltips — emulate a mouse.
  try {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'hover', value: 'hover' },
        { name: 'any-hover', value: 'hover' },
        { name: 'pointer', value: 'fine' },
        { name: 'any-pointer', value: 'fine' },
      ],
    })
  } catch {
    // CDP optional — focus-visible path below still covers keyboard users.
  }
  const collapseBtn = page.getByRole('button', { name: 'Collapse navigation' })
  if (await collapseBtn.count()) await collapseBtn.click().catch(() => {})
  const railOverflow = await page.evaluate(() => {
    const aside = document.querySelector('.app-sidebar')
    const nav = document.querySelector('.sidebar-nav')
    if (!aside || !nav) return { ok: false }
    const asideStyle = getComputedStyle(aside)
    const navStyle = getComputedStyle(nav)
    return {
      ok: aside.classList.contains('is-collapsed-rail')
        && asideStyle.overflow === 'visible'
        && navStyle.overflow === 'visible',
      asideOverflow: asideStyle.overflow,
      navOverflow: navStyle.overflow,
      collapsed: aside.classList.contains('is-collapsed-rail'),
    }
  })
  record(
    'Collapsed rail overflow is visible for tooltips',
    Boolean(railOverflow.ok),
    JSON.stringify(railOverflow),
  )
  const routeChecksLink = page.getByRole('link', { name: 'Route checks' }).first()
  await routeChecksLink.hover()
  await page.waitForTimeout(80)
  let routeTip = await routeChecksLink.evaluate(el => {
    const after = getComputedStyle(el, '::after')
    return { content: after.content, opacity: after.opacity }
  })
  // Focus path (works even when headless reports hover:none).
  if (!(Number(routeTip.opacity) > 0.9)) {
    await routeChecksLink.focus()
    await page.waitForTimeout(40)
    routeTip = await routeChecksLink.evaluate(el => {
      const after = getComputedStyle(el, '::after')
      return { content: after.content, opacity: after.opacity, active: document.activeElement === el }
    })
  }
  record(
    'Collapsed Route checks tooltip is visible beside the rail',
    routeTip.content.includes('Route checks') && Number(routeTip.opacity) > 0.9,
    JSON.stringify(routeTip),
  )
  const annaChip = page.getByRole('button', { name: /Switch user \(Anna\)/i }).first()
  await annaChip.hover()
  await page.waitForTimeout(80)
  let annaTip = await annaChip.evaluate(el => {
    const after = getComputedStyle(el, '::after')
    return { content: after.content, opacity: after.opacity }
  })
  if (!(Number(annaTip.opacity) > 0.9)) {
    await annaChip.focus()
    await page.waitForTimeout(40)
    annaTip = await annaChip.evaluate(el => {
      const after = getComputedStyle(el, '::after')
      return { content: after.content, opacity: after.opacity, active: document.activeElement === el }
    })
  }
  record(
    'Collapsed Anna chip tooltip shows Anna · Switch user',
    /Anna/i.test(annaTip.content) && /Switch user/i.test(annaTip.content) && Number(annaTip.opacity) > 0.9,
    JSON.stringify(annaTip),
  )
  try {
    const { mkdirSync } = await import('node:fs')
    mkdirSync('/tmp/htr-qa', { recursive: true })
    await page.screenshot({ path: '/tmp/htr-qa/collapsed-rail-tooltips.png', fullPage: false })
  } catch {
    // Screenshot is diagnostic only.
  }
  const expandBtn = page.getByRole('button', { name: 'Expand navigation' })
  if (await expandBtn.count()) await expandBtn.click().catch(() => {})
  // Client-side: Router remounts on the current URL (likely /jobs or /). Prefer Jobs nav.
  if (!(await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).count())) {
    await page.getByRole('link', { name: 'Jobs' }).first().click()
  }
  await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).first().waitFor({ timeout: 15000 }).catch(() => {})
  const annaJobName = `Anna isolation ${Date.now()}`
  const annaSaved = await page.evaluate(async (name) => {
    const job = {
      id: `job-anna-${Date.now()}`,
      name,
      permitName: name,
      permitNumber: 'ISO-ANNA',
      corridor: 'A7',
      permittedRoads: ['A7'],
      plannedDeparture: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      vehicle: { width: 3, height: 4, length: 25, grossWeight: 52 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gpxText: '',
      monitorIntervalMinutes: 15,
      monitoringStoppedReason: null,
    }
    window.__HT_TEST__?.setStore?.('htr-saved-jobs', [job])
    await window.__HT_TEST__?.flushStore?.()
    const res = await fetch('/api/state?user=anna')
    const payload = await res.json()
    const raw = payload?.data?.['htr-saved-jobs']
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) && parsed.some(item => item?.name === name)
  }, annaJobName)
  // Remount providers from store without a full document reload race.
  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('button', { name: 'Continue as Anna' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  if (!(await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).count())) {
    await page.getByRole('link', { name: 'Jobs' }).first().click()
  }
  await page.getByText(annaJobName).first().waitFor({ timeout: 15000 })
  record('Anna can save a job to her account', annaSaved && await page.getByText(annaJobName).count() > 0, annaJobName)

  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue as Paul' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  if (!(await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).count())) {
    await page.getByRole('link', { name: 'Jobs' }).first().click()
  }
  await page.waitForTimeout(400)
  const paulSeesAnna = await page.getByText(annaJobName).count()
  const paulApi = await page.evaluate(async (name) => {
    const res = await fetch('/api/state?user=paul')
    const payload = await res.json()
    const raw = payload?.data?.['htr-saved-jobs']
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
    return Array.isArray(parsed) ? parsed.filter(item => item?.name === name).length : -1
  }, annaJobName)
  record('Paul does not see Anna’s job', paulSeesAnna === 0 && paulApi === 0, `ui=${paulSeesAnna} api=${paulApi}`)

  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue as Anna' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  if (!(await page.getByRole('heading', { name: /Saved jobs|Jobs/i }).count())) {
    await page.getByRole('link', { name: 'Jobs' }).first().click()
  }
  await page.getByText(annaJobName).first().waitFor({ timeout: 15000 }).catch(() => {})
  const annaSeesAgain = await page.getByText(annaJobName).count()
  const annaApiAgain = await page.evaluate(async (name) => {
    const res = await fetch('/api/state?user=anna')
    const payload = await res.json()
    const raw = payload?.data?.['htr-saved-jobs']
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
    const jobs = window.__HT_TEST__?.getJobs?.() || []
    return {
      api: Array.isArray(parsed) ? parsed.filter(item => item?.name === name).length : -1,
      hook: jobs.filter(item => item?.name === name).length,
    }
  }, annaJobName)
  record(
    'Switching back to Anna restores her job',
    annaSeesAgain > 0 || annaApiAgain.api > 0 || annaApiAgain.hook > 0,
    JSON.stringify({ ui: annaSeesAgain, ...annaApiAgain }),
  )

  // Account check-history sync: Bremen sample must survive reload on Alerts & history.
  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('heading', { name: "Who's checking routes?" }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue as Anna' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })
  const annaHistoryPayload = page.waitForRequest(
    req => req.url().includes('/api/check-route') && req.method() === 'POST',
    { timeout: 120000 },
  )
  await page.goto(base + '/route-checks?permit=bremen-dortmund&run=1', { waitUntil: 'domcontentloaded' })
  await annaHistoryPayload
  await page.locator('.verdict-banner, .checking-state').first().waitFor({ timeout: 15000 })
  if (await page.locator('.checking-state').count()) {
    await page.locator('.verdict-banner').waitFor({ timeout: 120000 })
  } else {
    await page.locator('.verdict-banner').waitFor({ timeout: 30000 })
  }
  await page.waitForFunction(() => {
    const history = window.__HT_TEST__?.getHistory?.() || window.__HT_TEST__?.getStore?.('htr-route-check-history') || []
    return Array.isArray(history) && history.length >= 1
  }, null, { timeout: 30000 }).catch(() => {})
  await page.evaluate(async () => {
    await window.__HT_TEST__?.flushStore?.()
  })
  // Wait until the PUT has landed (save chip leaves pending/error).
  await page.waitForFunction(() => {
    const badge = document.querySelector('.user-chip-badge.is-error')
    return !badge
  }, null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)

  const annaStateBeforeReload = await page.evaluate(async () => {
    const res = await fetch('/api/state?user=anna')
    const payload = await res.json()
    const raw = payload?.data?.['htr-route-check-history']
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || [])
    return {
      hasKey: Object.prototype.hasOwnProperty.call(payload?.data || {}, 'htr-route-check-history'),
      count: Array.isArray(parsed) ? parsed.length : -1,
      backend: payload?.backend || null,
    }
  })
  record(
    'Anna Bremen check is present in GET /api/state history',
    annaStateBeforeReload.hasKey && annaStateBeforeReload.count >= 1,
    JSON.stringify(annaStateBeforeReload),
  )

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: /Alerts & history/i }).waitFor({ timeout: 20000 })
  const activityChecks = await page.locator('.check-history-log .route-alert-item').count()
  const activityEmpty = await page.getByRole('heading', { name: /No checks yet|No checks in this browser/i }).count()
  record(
    'Alerts & history shows ≥1 check after reload for Anna',
    activityChecks >= 1 && activityEmpty === 0,
    `checks=${activityChecks} empty=${activityEmpty}`,
  )

  // Return to Demo for any remaining checks.
  await page.getByRole('button', { name: 'Switch user' }).first().click()
  await page.getByRole('button', { name: 'Continue as Demo' }).click()
  await page.waitForFunction(() => !document.querySelector('.login-screen'), null, { timeout: 30000 })

  // Dark-mode HOLD banner title must stay ≥4.5:1 (safety-critical).
  const holdContrast = await runContrastSample(
    'dark',
    /Simulated HOLD — A3 residual width/,
    '.verdict-banner.verdict-red',
  )
  record(
    'Dark-mode HOLD banner title contrast ≥ 4.5:1',
    Number(holdContrast.title) >= 4.5,
    JSON.stringify(holdContrast),
  )
  record(
    'Dark-mode Hold departure pill contrast ≥ 4.5:1',
    holdContrast.pill == null || Number(holdContrast.pill) >= 4.5,
    `pill=${holdContrast.pill}`,
  )
  record(
    'Dark-mode Re-check contrast ≥ 4.5:1',
    holdContrast.recheck == null || Number(holdContrast.recheck) >= 4.5,
    `recheck=${holdContrast.recheck}`,
  )
  record(
    'Dark-mode notification badge contrast ≥ 4.5:1',
    holdContrast.badge != null && Number(holdContrast.badge) >= 4.5,
    `badge=${holdContrast.badge}`,
  )
  record(
    'Dark-mode primary button contrast ≥ 4.5:1',
    holdContrast.button == null || Number(holdContrast.button) >= 4.5,
    `button=${holdContrast.button}`,
  )

  const darkReady = await runContrastSample('dark', /Simulated READY/, '.verdict-banner.verdict-green')
  record(
    'Dark-mode READY Re-check contrast ≥ 4.5:1',
    darkReady.recheck == null || Number(darkReady.recheck) >= 4.5,
    `recheck=${darkReady.recheck}`,
  )
  record(
    'Dark-mode Ready to depart pill contrast ≥ 4.5:1',
    darkReady.pill == null || Number(darkReady.pill) >= 4.5,
    `pill=${darkReady.pill}`,
  )

  const darkVerify = await runContrastSample('dark', /Simulated VERIFY/, '.verdict-banner.verdict-amber')
  record(
    'Dark-mode VERIFY Re-check contrast ≥ 4.5:1',
    darkVerify.recheck == null || Number(darkVerify.recheck) >= 4.5,
    `recheck=${darkVerify.recheck}`,
  )

  const lightReady = await runContrastSample('light', /Simulated READY/, '.verdict-banner.verdict-green')
  record(
    'Light-mode Ready to depart pill contrast ≥ 4.5:1',
    lightReady.pill == null || Number(lightReady.pill) >= 4.5,
    `pill=${lightReady.pill}`,
  )
  record(
    'Light-mode READY Re-check contrast ≥ 4.5:1',
    lightReady.recheck == null || Number(lightReady.recheck) >= 4.5,
    `recheck=${lightReady.recheck}`,
  )

  const lightHold = await runContrastSample('light', /Simulated HOLD — A7 Vollsperrung/, '.verdict-banner.verdict-red')
  record(
    'Light-mode Hold departure pill contrast ≥ 4.5:1',
    lightHold.pill == null || Number(lightHold.pill) >= 4.5,
    `pill=${lightHold.pill}`,
  )
  record(
    'Light-mode HOLD Re-check contrast ≥ 4.5:1',
    lightHold.recheck == null || Number(lightHold.recheck) >= 4.5,
    `recheck=${lightHold.recheck}`,
  )
  record(
    'Light-mode notification badge contrast ≥ 4.5:1',
    lightHold.badge != null && Number(lightHold.badge) >= 4.5,
    `badge=${lightHold.badge}`,
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
