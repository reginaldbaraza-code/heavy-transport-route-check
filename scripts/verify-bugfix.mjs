import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const port = Number(process.env.QA_PORT || 4177)
const base = `http://127.0.0.1:${port}`
const prod = 'https://heavy-transport-route-check.vercel.app'
const outDir = '/opt/cursor/artifacts/bugfix-after'
const beforeOut = '/opt/cursor/artifacts/bugfix-before'
const report = []

function log(name, ok, detail = '') {
  report.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
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

async function captureProductionBefores(browser) {
  const page = await browser.newPage()
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(prod + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: join(beforeOut, 'bug-map1440-kpis-over-attribution.png') })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(prod + '/map-explorer', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(beforeOut, 'bug-map390-header-clipped-viewport.png') })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(prod + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.locator('input[placeholder="e.g. RheinLift Logistics"]').fill('Acme')
    await page.locator('input[placeholder="https://example.com"]').fill('notaurl')
    await page.getByRole('button', { name: /Save changes/i }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(beforeOut, 'settings-badurl-after-reload-1440.png'), fullPage: true })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(prod + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Leipzig → Nürnberg/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    await page.locator('.evidence-card').first().waitFor({ timeout: 15000 })
    await page.locator('.evidence-section').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(beforeOut, 'bug-evidence-card-viewport-390.png') })
    await page.locator('.mobile-route-actions').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    await page.screenshot({ path: join(beforeOut, 'bug-390-test-trigger-over-confirm.png') })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(prod + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Simulated HOLD — A7 Vollsperrung/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    await page.getByRole('button', { name: 'Save as job' }).click()
    await page.locator('[data-testid="save-job-form"]').waitFor()
    await page.getByRole('button', { name: 'Save job' }).click()
    await page.getByText(/Job saved/i).waitFor({ timeout: 10000 })
    await page.goto(prod + '/route-checks', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Simulated VERIFY — nearby AS ramp/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    await page.goto(prod + '/activity', { waitUntil: 'domcontentloaded' })
    await page.locator('.route-alert-filter-row select').selectOption({ label: 'SCENARIO-HOLD-CLOSURE' }).catch(async () => {
      await page.locator('.route-alert-filter-row select').selectOption({ label: /SCENARIO-HOLD-CLOSURE/ }).catch(() => {})
    })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(beforeOut, 'activity-routefilter-hold-1440.png'), fullPage: true })
  } finally {
    await page.close()
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  mkdirSync(beforeOut, { recursive: true })

  const child = spawn('npx', ['tsx', 'scripts/qa-preview.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, QA_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitForPreview(child)

  const browser = await chromium.launch({ headless: true })
  console.log('Capturing production before screenshots…')
  await captureProductionBefores(browser)
  const page = await browser.newPage()

  try {
    // Bug 1: activity route filter
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Simulated HOLD — A7 Vollsperrung/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    await page.getByRole('button', { name: 'Save as job' }).click()
    await page.locator('[data-testid="save-job-form"]').waitFor()
    await page.getByRole('button', { name: 'Save job' }).click()
    await page.getByText(/Job saved and monitoring started/i).waitFor({ timeout: 10000 })

    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Simulated VERIFY — nearby AS ramp/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })

    await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' })
    await page.locator('.route-alert-filter-row select').selectOption({ label: 'SCENARIO-HOLD-CLOSURE' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(outDir, '01-activity-routefilter-hold-1440.png'), fullPage: true })
    const activityText = await page.locator('.route-alert-page').innerText()
    const alertCount = await page.locator('.route-alert-log').first().locator('header span').innerText()
    const historyCount = await page.locator('.check-history-log header span').innerText()
    const historyNames = await page.locator('.check-history-log .route-alert-meta b').allInnerTexts()
    log(
      'Bug1 activity alerts show for SCENARIO-HOLD-CLOSURE',
      /[1-9]\d* alerts/.test(alertCount) && !/Nothing in this view/.test(activityText),
      `${alertCount} · ${activityText.replace(/\s+/g, ' ').slice(0, 160)}`,
    )
    log(
      'Bug1 history respects route filter',
      historyNames.length > 0
        && historyNames.every(name => name.includes('SCENARIO-HOLD-CLOSURE'))
        && !historyNames.some(name => name.includes('SCENARIO-VERIFY')),
      `${historyCount} · ${historyNames.join(' | ')}`,
    )

    // Bug 2: map header at 390
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded' })
    await page.locator('.live-map-header').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(outDir, '02-map390-header.png') })
    const headerMetrics = await page.evaluate(() => {
      const header = document.querySelector('.live-map-header')
      const tabs = document.querySelector('.live-map-tabs')
      const refresh = Array.from(document.querySelectorAll('.live-map-header button')).find(btn => /Refresh/i.test(btn.textContent || ''))
      const subtitle = header?.querySelector('p')
      if (!header || !tabs || !refresh || !subtitle) return { ok: false, reason: 'missing nodes' }
      const h = header.getBoundingClientRect()
      const t = tabs.getBoundingClientRect()
      const r = refresh.getBoundingClientRect()
      const s = subtitle.getBoundingClientRect()
      return {
        ok: h.bottom <= t.top + 1 && s.bottom <= t.top + 1 && r.bottom <= t.top + 1 && h.height > 140,
        headerHeight: Math.round(h.height),
        headerBottom: Math.round(h.bottom),
        tabsTop: Math.round(t.top),
        subtitleBottom: Math.round(s.bottom),
        refreshBottom: Math.round(r.bottom),
      }
    })
    log('Bug2 map header not clipped under tabs at 390', headerMetrics.ok, JSON.stringify(headerMetrics))

    // Bug 3: overlays at 1440 / 1024 / 390
    for (const viewport of [
      { w: 1440, h: 900, name: '1440' },
      { w: 1024, h: 768, name: '1024' },
      { w: 390, h: 844, name: '390' },
    ]) {
      await page.setViewportSize({ width: viewport.w, height: viewport.h })
      await page.goto(base + '/map-explorer', { waitUntil: 'domcontentloaded' })
      await page.locator('.live-map-stage, .maplibregl-map').first().waitFor({ timeout: 20000 })
      await page.waitForTimeout(2500)
      await page.screenshot({ path: join(outDir, `03-map-overlays-${viewport.name}.png`) })
      const overlap = await page.evaluate(() => {
        const box = el => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          if (r.width < 2 || r.height < 2) return null
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
        }
        const overlaps = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
        const legend = box(document.querySelector('.live-map-legend'))
        const kpis = box(document.querySelector('.live-map-kpis'))
        const attrib = box(document.querySelector('.maplibregl-ctrl-attrib'))
        const zoom = box(document.querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group'))
        const scale = box(document.querySelector('.maplibregl-ctrl-scale'))
        return {
          legend,
          kpis,
          attrib,
          zoom,
          scale,
          legendKpis: overlaps(legend, kpis),
          kpisAttrib: overlaps(kpis, attrib),
          legendAttrib: overlaps(legend, attrib),
          legendZoom: overlaps(legend, zoom),
          legendScale: overlaps(legend, scale),
          kpisZoom: overlaps(kpis, zoom),
        }
      })
      const ok = !overlap.legendKpis && !overlap.kpisAttrib && !overlap.legendAttrib && !overlap.legendZoom && !overlap.legendScale && !overlap.kpisZoom
      log(`Bug3 no overlay collisions at ${viewport.name}`, ok, JSON.stringify(overlap))
    }

    // Bug 4: evidence chip overflow — Leipzig → Nürnberg sample
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /show sample permits/i }).click()
    await page.getByRole('button', { name: /Leipzig → Nürnberg/ }).click()
    await page.getByRole('button', { name: 'Check route' }).click()
    await page.locator('.verdict-banner').waitFor({ timeout: 90000 })
    await page.locator('.evidence-card').first().waitFor({ timeout: 15000 })
    await page.locator('.evidence-section').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(outDir, '04-evidence-card-390.png'), fullPage: false })
    const chip390 = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.evidence-card'))
      return cards.slice(0, 8).map(card => {
        const chip = card.querySelector('.source-chip')
        const header = card.querySelector('.evidence-header')
        if (!chip || !header) return { overflow: false }
        const c = chip.getBoundingClientRect()
        const h = header.getBoundingClientRect()
        const cardBox = card.getBoundingClientRect()
        return {
          overflow: c.right > cardBox.right + 1 || c.right > window.innerWidth + 1 || header.scrollWidth > header.clientWidth + 1,
          chipRight: Math.round(c.right),
          cardRight: Math.round(cardBox.right),
          viewport: window.innerWidth,
          headerScroll: header.scrollWidth,
          headerClient: header.clientWidth,
        }
      })
    })
    log('Bug4 evidence chips stay inside card at 390', chip390.every(item => !item.overflow), JSON.stringify(chip390.slice(0, 3)))

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(outDir, '04-evidence-card-1440.png'), fullPage: false })
    const chip1440 = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.evidence-card'))
      return {
        total: cards.length,
        clipped: cards.filter(card => {
          const chip = card.querySelector('.source-chip')
          if (!chip) return false
          const c = chip.getBoundingClientRect()
          const cardBox = card.getBoundingClientRect()
          return c.right > cardBox.right + 1
        }).length,
      }
    })
    log('Bug4 evidence chips stay inside card at 1440', chip1440.clipped === 0, JSON.stringify(chip1440))

    // Bug 5: test trigger vs confirm button at 390
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.mobile-route-actions').waitFor({ state: 'visible', timeout: 10000 })
    await page.screenshot({ path: join(outDir, '05-test-trigger-390.png') })
    const triggerCheck = await page.evaluate(() => {
      const trigger = document.querySelector('.test-scenarios-trigger')
      const confirm = Array.from(document.querySelectorAll('.mobile-route-actions button'))
        .find(btn => /Confirm on site/i.test(btn.textContent || ''))
      if (!trigger || !confirm) return { ok: false, reason: 'missing nodes' }
      const t = trigger.getBoundingClientRect()
      const c = confirm.getBoundingClientRect()
      const overlaps = !(t.right <= c.left || c.right <= t.left || t.bottom <= c.top || c.bottom <= t.top)
      return {
        ok: !overlaps && t.bottom <= c.top + 1,
        overlaps,
        triggerBottom: Math.round(t.bottom),
        confirmTop: Math.round(c.top),
        opacity: getComputedStyle(trigger).opacity,
      }
    })
    log('Bug5 test trigger clear of Confirm on site', triggerCheck.ok, JSON.stringify(triggerCheck))

    // Bug 6: settings URL validation + nested main
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' })
    await page.locator('input[placeholder="e.g. RheinLift Logistics"]').fill('Acme')
    await page.locator('input[placeholder="https://example.com"]').fill('notaurl')
    await page.getByRole('button', { name: /Save changes/i }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(outDir, '06-settings-badurl-1440.png'), fullPage: true })
    const settingsState = await page.evaluate(() => {
      const alert = document.querySelector('.settings-error, [role="alert"]')
      const toast = document.querySelector('.app-toast')
      const mains = document.querySelectorAll('main')
      return {
        errorText: alert?.textContent || '',
        toastText: toast?.textContent || '',
        mainCount: mains.length,
      }
    })
    log(
      'Bug6 invalid website blocked with inline error',
      /Website URL is not valid/i.test(settingsState.errorText) && !settingsState.toastText,
      JSON.stringify(settingsState),
    )
    log('Bug6 settings has a single main landmark', settingsState.mainCount === 1, `mains=${settingsState.mainCount}`)

    await page.reload({ waitUntil: 'domcontentloaded' })
    const websiteAfterReload = await page.locator('input[placeholder="https://example.com"]').inputValue()
    log('Bug6 invalid website did not persist', websiteAfterReload !== 'notaurl', `value=${websiteAfterReload}`)
  } finally {
    await browser.close()
    child.kill('SIGTERM')
  }

  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  const failed = report.filter(item => !item.ok)
  console.log(`\n=== BUGFIX VERIFY ${report.length - failed.length}/${report.length} passed ===`)
  if (failed.length) {
    console.error(failed)
    process.exit(1)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
