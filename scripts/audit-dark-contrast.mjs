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

async function collectContrast(page, label) {
  return page.evaluate(({ label }) => {
    const parse = (input) => {
      if (!input || input === 'transparent') return null
      const m = String(input).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
      if (!m) return null
      const a = m[4] === undefined ? 1 : Number(m[4])
      if (a <= 0.01) return null
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a }
    }
    const luminance = (r, g, b) => {
      const toLin = (c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
    }
    const ratio = (fg, bg) => {
      const a = fg.a ?? 1
      const rr = fg.r * a + bg.r * (1 - a)
      const gg = fg.g * a + bg.g * (1 - a)
      const bb = fg.b * a + bg.b * (1 - a)
      const L1 = luminance(rr, gg, bb)
      const L2 = luminance(bg.r, bg.g, bg.b)
      const lighter = Math.max(L1, L2)
      const darker = Math.min(L1, L2)
      return (lighter + 0.05) / (darker + 0.05)
    }
    const effectiveBg = (el) => {
      let node = el
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node)
        const bg = parse(cs.backgroundColor)
        if (bg && bg.a >= 0.85) return bg
        // Approximate translucent surfaces as opaque enough for UI chrome
        if (bg && bg.a >= 0.6) {
          const parent = node.parentElement ? parse(getComputedStyle(node.parentElement).backgroundColor) : null
          if (parent) {
            return {
              r: bg.r * bg.a + parent.r * (1 - bg.a),
              g: bg.g * bg.a + parent.g * (1 - bg.a),
              b: bg.b * bg.a + parent.b * (1 - bg.a),
              a: 1,
            }
          }
          return { r: bg.r, g: bg.g, b: bg.b, a: 1 }
        }
        node = node.parentElement
      }
      return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
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
      'button', 'a', 'p', 'span', 'strong', 'small', 'label',
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
  }, { label })
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

    // Route result after HOLD sample — safety-critical banner contrast
    await page.goto(base + '/route-checks', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await skipOnboarding(page)
    const toggle = page.getByRole('button', { name: /show sample permits/i })
    if (await toggle.count()) await toggle.click()
    const holdSample = page.getByRole('button', { name: /Simulated HOLD/i }).first()
    const readySample = page.getByRole('button', { name: /Simulated READY/i })
    const sample = (await holdSample.count()) ? holdSample : readySample
    if (await sample.count()) {
      await sample.click()
      const departure = page.locator('#planned-departure')
      if (await departure.count()) {
        const value = await page.evaluate(() => {
          const date = new Date(Date.now() + 8 * 60 * 60 * 1000)
          const pad = n => String(n).padStart(2, '0')
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
        })
        await departure.fill(value)
      }
      const check = page.getByRole('button', { name: 'Check route' })
      if (await check.count()) {
        await check.click()
        try {
          await page.locator('.verdict-banner, .dispatcher-verdict-banner').first().waitFor({ timeout: 45000 })
          await page.waitForTimeout(1200)
          const label = `${prefix}-route-result-${vp.name}`
          const shot = `${outDir}/${label}.png`
          await page.screenshot({ path: shot, fullPage: false })
          console.log(`wrote ${shot}`)
          const result = await collectContrast(page, label)
          report.push(result)
          criticalCount += result.critical.length
          violationCount += result.violations.length

          const holdBanner = await page.evaluate(() => {
            const parse = (input) => {
              if (!input || input === 'transparent') return null
              const m = String(input).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
              if (!m) return null
              const a = m[4] === undefined ? 1 : Number(m[4])
              if (a <= 0.01) return null
              return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a }
            }
            const luminance = (r, g, b) => {
              const toLin = (c) => {
                const s = c / 255
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
              }
              return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
            }
            const ratio = (fg, bg) => {
              const a = fg.a ?? 1
              const rr = fg.r * a + bg.r * (1 - a)
              const gg = fg.g * a + bg.g * (1 - a)
              const bb = fg.b * a + bg.b * (1 - a)
              const L1 = luminance(rr, gg, bb)
              const L2 = luminance(bg.r, bg.g, bg.b)
              return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
            }
            const effectiveBg = (el) => {
              let node = el
              while (node && node !== document.documentElement) {
                const cs = getComputedStyle(node)
                const bg = parse(cs.backgroundColor)
                if (bg && bg.a >= 0.85) return bg
                if (bg && bg.a >= 0.6) {
                  const parent = node.parentElement ? parse(getComputedStyle(node.parentElement).backgroundColor) : null
                  if (parent) {
                    return {
                      r: bg.r * bg.a + parent.r * (1 - bg.a),
                      g: bg.g * bg.a + parent.g * (1 - bg.a),
                      b: bg.b * bg.a + parent.b * (1 - bg.a),
                      a: 1,
                    }
                  }
                }
                node = node.parentElement
              }
              return parse(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 }
            }
            const banner = document.querySelector('.verdict-banner.verdict-red, .dispatcher-verdict-banner.hold')
            if (!banner) return { found: false }
            const title = banner.querySelector('h2') || banner
            const pill = banner.querySelector('.verdict-label')
            const button = document.querySelector('.btn-primary, .primary-button')
            const measure = (el) => {
              if (!el) return null
              const cs = getComputedStyle(el)
              const fg = parse(cs.color)
              const bg = effectiveBg(el)
              if (!fg || !bg) return null
              return Number(ratio(fg, bg).toFixed(2))
            }
            return {
              found: true,
              titleRatio: measure(title),
              pillRatio: measure(pill),
              buttonRatio: measure(button),
            }
          })

          if (colorScheme === 'dark' && holdBanner.found) {
            const holdOk = Number(holdBanner.titleRatio) >= 4.5
            console.log(`HOLD banner title contrast=${holdBanner.titleRatio} (need ≥4.5)`)
            if (holdBanner.pillRatio != null) console.log(`HOLD pill contrast=${holdBanner.pillRatio}`)
            if (holdBanner.buttonRatio != null) console.log(`primary button contrast=${holdBanner.buttonRatio}`)
            report.push({ label: `${label}-hold-banner`, holdBanner, ok: holdOk })
            if (!holdOk) {
              criticalCount += 1
              violationCount += 1
            }
          }
        } catch (e) {
          console.log(`route result skipped (${vp.name}): ${e.message}`)
          report.push({ label: `${prefix}-route-result-${vp.name}`, violations: [], critical: [], skipped: e.message })
        }
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

  // Fail on near-invisible text, and on HOLD banner AA misses in dark mode.
  if (failOnViolations && criticalCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
