import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = process.env.AUDIT_BASE || 'http://127.0.0.1:8443'
const outDir = process.env.SHOT_DIR || '/opt/cursor/artifacts/dark-contrast'
const prefix = process.env.SHOT_PREFIX || 'dark'
const colorScheme = process.env.COLOR_SCHEME === 'light' ? 'light' : 'dark'
const failOnViolations = process.env.FAIL_ON_VIOLATIONS !== '0'

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
]

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
]

const verdictSamples = [
  { key: 'ready', name: /Simulated READY/i },
  { key: 'verify', name: /Simulated VERIFY/i },
  { key: 'hold', name: /Simulated HOLD.*A1 weight/i },
]

async function skipOnboarding(page) {
  const skip = page.getByRole('button', { name: /skip/i })
  if (await skip.count()) {
    try { await skip.first().click({ timeout: 2000 }) } catch {}
  }
  const later = page.getByRole('button', { name: /later|not now|continue without/i })
  if (await later.count()) {
    try { await later.first().click({ timeout: 1500 }) } catch {}
  }
}

async function collectContrast(page, label, extraSelectors = []) {
  return page.evaluate(({ label, extraSelectors }) => {
    const parse = (input) => {
      if (!input || input === 'transparent') return null
      const rgba = String(input).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
      if (rgba) {
        const a = rgba[4] === undefined ? 1 : Number(rgba[4])
        if (a <= 0.01) return null
        return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a }
      }
      // Chromium resolves color-mix() gradient stops to color(srgb r g b)
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
    const blend = (fg, bg) => {
      const a = fg.a ?? 1
      return {
        r: fg.r * a + bg.r * (1 - a),
        g: fg.g * a + bg.g * (1 - a),
        b: fg.b * a + bg.b * (1 - a),
        a: 1,
      }
    }
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
      const lighter = Math.max(L1, L2)
      const darker = Math.min(L1, L2)
      return (lighter + 0.05) / (darker + 0.05)
    }
    // Gradients report transparent background-color; sample stops so light-on-light
    // banner bugs are not scored against the page body instead.
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
      if (gradient) {
        // Treat averaged gradient as opaque surface for contrast checks
        return underlay ? blend({ ...gradient, a: 0.92 }, underlay) : gradient
      }
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

    const selectors = [
      'h1', 'h2', 'h3',
      '.card-header h2', '.card-header p',
      '.upload-dropzone', '.upload-dropzone strong',
      '.info-note p', '.info-note strong',
      '.step-label', '.route-polished-back',
      '.overview-mode-banner p', '.overview-mode-hint',
      '.overview-mode-toggle button',
      '.heatmap-map-caption strong', '.heatmap-map-caption span',
      '.permit-map-pill strong', '.permit-map-pill small',
      '.live-event-list-heading span', '.live-event-list-heading b',
      '.live-map-legend > span', '.live-map-legend small',
      '.layer-panel-heading > span',
      '.empty-state-card h2', '.empty-state-card p',
      '.settings-card h2', '.settings-card p',
      '.verdict-banner h2',
      '.verdict-banner p',
      '.verdict-banner .scenario-banner',
      '.verdict-banner .outcome-match',
      '.verdict-content h2',
      '.verdict-content p',
      '.transport-source-list > div > span',
      'button', 'a', 'p', 'span', 'strong', 'small', 'label',
      ...extraSelectors,
    ]

    const seen = new Set()
    const violations = []
    const samples = []

    for (const sel of selectors) {
      const nodes = [...document.querySelectorAll(sel)].slice(0, sel === 'button' || sel === 'span' || sel === 'p' || sel === 'a' ? 40 : 12)
      for (const el of nodes) {
        const rect = el.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) continue
        if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.2) continue
        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        if (!text || text.length < 2) continue
        const fg = parse(cs.color)
        if (!fg) continue
        const bg = effectiveBg(el)
        const cr = ratio(fg, bg)
        const fontSize = parseFloat(cs.fontSize) || 14
        const weight = parseInt(cs.fontWeight, 10) || 400
        const large = fontSize >= 18 || (fontSize >= 14 && weight >= 700)
        const min = large ? 3 : 4.5
        const key = `${sel}|${text.slice(0, 40)}|${Math.round(cr * 100)}`
        if (seen.has(key)) continue
        seen.add(key)
        const entry = {
          selector: sel,
          text: text.slice(0, 80),
          ratio: Number(cr.toFixed(2)),
          min,
          large,
          fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
          bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        }
        samples.push(entry)
        if (cr < min) violations.push(entry)
      }
    }

    // Hard fail: near-invisible light-on-light / dark-on-dark (< 1.5)
    const critical = violations.filter((v) => v.ratio < 1.5)
    return { label, violations, critical, sampleCount: samples.length }
  }, { label, extraSelectors })
}

async function ensureDeparture(page) {
  const departure = page.locator('input[type="datetime-local"], input[name*="depart" i]').first()
  if (await departure.count()) {
    const value = await departure.inputValue().catch(() => '')
    if (!value) {
      const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      await departure.fill(local).catch(() => {})
    }
  }
}

async function runRouteSample(page, sample, vpName) {
  await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  const toggle = page.getByRole('button', { name: /show sample permits/i })
  try {
    await toggle.waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    return { label: `${prefix}-route-${sample.key}-${vpName}`, violations: [], critical: [], skipped: 'show sample permits missing' }
  }
  await toggle.click()
  await page.locator('.test-permits-grid').first().waitFor({ state: 'visible', timeout: 15000 })
  const card = page.getByRole('button', { name: sample.name })
  try {
    await card.first().waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    return { label: `${prefix}-route-${sample.key}-${vpName}`, violations: [], critical: [], skipped: 'sample not found' }
  }
  await card.first().scrollIntoViewIfNeeded()
  await card.first().click()
  await ensureDeparture(page)
  const check = page.getByRole('button', { name: 'Check route' })
  try {
    await check.waitFor({ state: 'visible', timeout: 15000 })
  } catch {
    return { label: `${prefix}-route-${sample.key}-${vpName}`, violations: [], critical: [], skipped: 'check button missing' }
  }
  await check.click()
  const banner = page.locator('.verdict-banner, .dispatcher-verdict-banner').first()
  await banner.waitFor({ timeout: 90000 })
  await page.waitForTimeout(1200)
  await banner.scrollIntoViewIfNeeded()
  const label = `${prefix}-route-${sample.key}-${vpName}`
  const shot = `${outDir}/${label}.png`
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`wrote ${shot}`)
  return collectContrast(page, label, [
    '.verdict-banner h2',
    '.verdict-banner p',
    '.verdict-banner .scenario-banner',
    '.verdict-banner .outcome-match',
  ])
}

async function auditOverviewSampleSources(page, vpName) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await skipOnboarding(page)
  const sampleTab = page.locator('#overview-tab-sample')
  await sampleTab.waitFor({ state: 'visible', timeout: 15000 })
  await sampleTab.scrollIntoViewIfNeeded()
  if ((await sampleTab.getAttribute('aria-selected')) !== 'true') {
    await sampleTab.click()
  }
  await page.waitForTimeout(500)
  const list = page.locator('.transport-source-list').first()
  await list.waitFor({ state: 'visible', timeout: 15000 })
  await list.scrollIntoViewIfNeeded()
  const label = `${prefix}-overview-sample-sources-${vpName}`
  const shot = `${outDir}/${label}.png`
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`wrote ${shot}`)
  return collectContrast(page, label, ['.transport-source-list > div > span'])
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = []
  let criticalCount = 0
  let violationCount = 0

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme,
    })
    const page = await context.newPage()
    await page.emulateMedia({ colorScheme })

    for (const route of pages) {
      const label = `${prefix}-${route.name}-${vp.name}`
      await page.goto(base + route.path, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await skipOnboarding(page)
      await page.waitForTimeout(route.name === 'corridor' || route.name === 'overview' ? 2500 : 900)
      const shot = `${outDir}/${label}.png`
      await page.screenshot({ path: shot, fullPage: false })
      console.log(`wrote ${shot}`)
      const result = await collectContrast(page, label)
      report.push(result)
      criticalCount += result.critical.length
      violationCount += result.violations.length
      if (result.critical.length) {
        console.log(`CRITICAL ${label}: ${result.critical.length}`)
        for (const v of result.critical.slice(0, 8)) {
          console.log(`  ${v.ratio}: "${v.text}" ${v.fg} on ${v.bg}`)
        }
      } else if (result.violations.length) {
        console.log(`violations ${label}: ${result.violations.length} (no critical <1.5)`)
      } else {
        console.log(`ok ${label}`)
      }
    }

    // Overview sample-source monogram badges (Bug 2)
    try {
      const sourceResult = await auditOverviewSampleSources(page, vp.name)
      report.push(sourceResult)
      criticalCount += sourceResult.critical.length
      violationCount += sourceResult.violations.length
      if (sourceResult.critical.length) {
        console.log(`CRITICAL ${sourceResult.label}: ${sourceResult.critical.length}`)
        for (const v of sourceResult.critical.slice(0, 8)) {
          console.log(`  ${v.ratio}: "${v.text}" ${v.fg} on ${v.bg}`)
        }
      }
    } catch (e) {
      console.log(`overview sample sources skipped (${vp.name}): ${e.message}`)
      report.push({ label: `${prefix}-overview-sample-sources-${vp.name}`, violations: [], critical: [], skipped: e.message })
    }

    // Route results for READY / VERIFY / HOLD (Bug 1) — gradient-aware
    for (const sample of verdictSamples) {
      try {
        const result = await runRouteSample(page, sample, vp.name)
        report.push(result)
        criticalCount += (result.critical || []).length
        violationCount += (result.violations || []).length
        if (result.skipped) {
          console.log(`route ${sample.key} skipped (${vp.name}): ${result.skipped}`)
        } else if (result.critical?.length) {
          console.log(`CRITICAL ${result.label}: ${result.critical.length}`)
          for (const v of result.critical.slice(0, 8)) {
            console.log(`  ${v.ratio}: "${v.text}" ${v.fg} on ${v.bg}`)
          }
        } else if (result.violations?.length) {
          console.log(`violations ${result.label}: ${result.violations.length} (no critical <1.5)`)
        } else {
          console.log(`ok ${result.label}`)
        }
      } catch (e) {
        console.log(`route ${sample.key} skipped (${vp.name}): ${e.message}`)
        report.push({ label: `${prefix}-route-${sample.key}-${vp.name}`, violations: [], critical: [], skipped: e.message })
      }
    }

    await context.close()
  }

  const summary = {
    base,
    colorScheme,
    criticalCount,
    violationCount,
    report,
  }
  writeFileSync(`${outDir}/contrast-report.json`, JSON.stringify(summary, null, 2))
  console.log(`wrote ${outDir}/contrast-report.json`)
  console.log(`critical=${criticalCount} violations=${violationCount}`)

  await browser.close()

  // Fail only on near-invisible text (ratio < 1.5). Soft AA misses can be noisy on icons/maps.
  if (failOnViolations && criticalCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
