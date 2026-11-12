import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function parseHex(input: string): { r: number; g: number; b: number } | null {
  const hex = input.trim()
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

function contrastRatio(fgHex: string, bgHex: string) {
  const fg = parseHex(fgHex)
  const bg = parseHex(bgHex)
  assert.ok(fg, `invalid fg ${fgHex}`)
  assert.ok(bg, `invalid bg ${bgHex}`)
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

function rootBlockAt(css: string, fromIndex: number) {
  const rootStart = css.indexOf(':root', fromIndex)
  assert.ok(rootStart >= 0, 'missing :root block')
  const brace = css.indexOf('{', rootStart)
  let depth = 0
  for (let i = brace; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(brace + 1, i)
    }
  }
  throw new Error('unterminated :root block')
}

function tokenMap(block: string) {
  const map = new Map<string, string>()
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map.set(`--${match[1]}`, match[2].trim())
  }
  return map
}

function lightModeTokens(css: string) {
  return tokenMap(rootBlockAt(css, 0))
}

function darkModeTokens(css: string) {
  const light = tokenMap(rootBlockAt(css, 0))
  const darkMarker = css.indexOf('@media (prefers-color-scheme: dark)')
  assert.ok(darkMarker >= 0, 'missing dark prefers-color-scheme block')
  const dark = tokenMap(rootBlockAt(css, darkMarker))
  return new Map([...light, ...dark])
}

function resolve(map: Map<string, string>, name: string, depth = 0): string {
  assert.ok(depth < 8, `token cycle resolving ${name}`)
  const raw = map.get(name)
  assert.ok(raw, `missing token ${name}`)
  const varMatch = /^var\((--[a-z0-9-]+)\)$/i.exec(raw)
  if (varMatch) return resolve(map, varMatch[1], depth + 1)
  return raw
}

/** Average of polished light-mode verdict banner gradient stops (see index.css). */
const lightBannerSurfaces = {
  ready: '#eefaf3', // avg(#f4fcf7, #e8f8ef)
  hold: '#fff5f4', // avg(#fff7f6, #fef2f2)
  verify: '#fff9ee', // avg(#fffbf3, #fff7e8)
} as const

test('dark-mode verdict and button tokens meet WCAG AA contrast', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const tokens = darkModeTokens(css)

  const textPrimary = resolve(tokens, '--text-primary')
  const holdBg = resolve(tokens, '--hold-bg')
  const readyBg = resolve(tokens, '--ready-bg')
  const verifyBg = resolve(tokens, '--verify-bg')
  const holdText = resolve(tokens, '--hold-text')
  const readyText = resolve(tokens, '--ready-text')
  const verifyText = resolve(tokens, '--verify-text')
  const accentButton = resolve(tokens, '--accent-button')
  const textOnAccent = resolve(tokens, '--text-on-accent')
  const hold = resolve(tokens, '--hold')
  const ready = resolve(tokens, '--ready')
  const verify = resolve(tokens, '--verify')
  const blueText = resolve(tokens, '--blue-text')
  const pillInk = resolve(tokens, '--verdict-pill-ink')
  const badgeBg = resolve(tokens, '--badge-bg')
  const badgeFg = resolve(tokens, '--badge-fg')
  const border = resolve(tokens, '--border')
  const bgCard = resolve(tokens, '--bg-card')
  const bgBase = resolve(tokens, '--bg-base')

  assert.ok(contrastRatio(textPrimary, holdBg) >= 4.5, `HOLD banner title ${textPrimary} on ${holdBg}`)
  assert.ok(contrastRatio(textPrimary, readyBg) >= 4.5, `READY banner title on ${readyBg}`)
  assert.ok(contrastRatio(textPrimary, verifyBg) >= 4.5, `VERIFY banner title on ${verifyBg}`)
  assert.ok(contrastRatio(holdText, holdBg) >= 4.5, `HOLD tint text ${holdText} on ${holdBg}`)
  assert.ok(contrastRatio(readyText, readyBg) >= 4.5, `READY tint text on ${readyBg}`)
  assert.ok(contrastRatio(verifyText, verifyBg) >= 4.5, `VERIFY tint text on ${verifyBg}`)
  assert.ok(contrastRatio(textOnAccent, accentButton) >= 4.5, `primary button ${textOnAccent} on ${accentButton}`)
  // Verdict pills use dark ink on the bright semantic fill in dark mode
  assert.ok(contrastRatio(pillInk, hold) >= 4.5, `Hold departure pill on ${hold}`)
  assert.ok(contrastRatio(pillInk, ready) >= 4.5, `Ready pill on ${ready}`)
  assert.ok(contrastRatio(pillInk, verify) >= 4.5, `Verify pill on ${verify}`)
  // Re-check text button on tinted banner washes (#45 --blue-text)
  assert.ok(contrastRatio(blueText, holdBg) >= 4.5, `Re-check on HOLD ${blueText} / ${holdBg}`)
  assert.ok(contrastRatio(blueText, readyBg) >= 4.5, `Re-check on READY ${blueText} / ${readyBg}`)
  assert.ok(contrastRatio(blueText, verifyBg) >= 4.5, `Re-check on VERIFY ${blueText} / ${verifyBg}`)
  // Top-bar notification count badge
  assert.ok(contrastRatio(badgeFg, badgeBg) >= 4.5, `notification badge ${badgeFg} on ${badgeBg}`)

  // Non-text UI borders (toast, overview-tallies, permit-map-badge) ≥3:1 vs adjacent surfaces
  assert.ok(contrastRatio(border, bgCard) >= 3, `border ${border} on bg-card ${bgCard}`)
  assert.ok(contrastRatio(border, bgBase) >= 3, `border ${border} on bg-base ${bgBase}`)
  // permit-map-badge sits on glass over the map; glass channels match bg-card when opaque
  assert.ok(contrastRatio(border, bgCard) >= 3, `permit-map-badge border ${border} on glass/card ${bgCard}`)
})

function ruleDeclarations(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Exact selector before `{` (avoid `.alert-status` matching `.alert-status.escalated`).
  const re = new RegExp(`${escaped}(?![\\w.-])\\s*\\{([^}]+)\\}`, 'i')
  const match = re.exec(css)
  assert.ok(match, `missing rule for ${selector}`)
  const decls = new Map<string, string>()
  for (const part of match[1].split(';')) {
    const colon = part.indexOf(':')
    if (colon < 0) continue
    const prop = part.slice(0, colon).trim().toLowerCase()
    const value = part.slice(colon + 1).trim()
    if (prop && value) decls.set(prop, value)
  }
  return decls
}

function resolveColorValue(map: Map<string, string>, raw: string): string {
  const trimmed = raw.trim()
  if (/^#([0-9a-f]{6})$/i.test(trimmed)) return trimmed.toLowerCase()
  if (/^(white|#fff)$/i.test(trimmed)) return '#ffffff'
  if (/^black$/i.test(trimmed)) return '#000000'
  const varMatch = /^var\((--[a-z0-9-]+)\)$/i.exec(trimmed)
  assert.ok(varMatch, `expected hex or var() color, got ${raw}`)
  const resolved = resolve(map, varMatch[1])
  assert.ok(/^#([0-9a-f]{6})$/i.test(resolved), `resolved ${raw} to non-hex ${resolved}`)
  return resolved.toLowerCase()
}

test('dark-mode alert-status escalated and solid danger fills meet WCAG AA', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const tokens = darkModeTokens(css)

  // Escalated used --red-text (#ffb4ae) + white (~1.69:1) after dark tinting; must stay on solid AA red.
  const escalated = ruleDeclarations(css, '.alert-status.escalated')
  const escFg = resolveColorValue(tokens, escalated.get('color') || '')
  const escBg = resolveColorValue(
    tokens,
    escalated.get('background') || escalated.get('background-color') || '',
  )
  assert.ok(contrastRatio(escFg, escBg) >= 4.5, `Escalated badge ${escFg} on ${escBg}`)

  // Sibling tinted statuses (New / Acknowledged / Resolved) keep text-on-tint pairs.
  const tinted = [
    ['.alert-status', '--blue-text', '--blue-bg'],
    ['.alert-status.acknowledged', '--amber-text', '--amber-bg'],
    ['.alert-status.resolved', '--green-text', '--green-bg'],
  ] as const
  for (const [selector, fgToken, bgToken] of tinted) {
    const decls = ruleDeclarations(css, selector)
    const fg = resolveColorValue(tokens, decls.get('color') || `var(${fgToken})`)
    const bg = resolveColorValue(
      tokens,
      decls.get('background') || decls.get('background-color') || `var(${bgToken})`,
    )
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${selector} ${fg} on ${bg}`)
  }

  // Danger solid fills shared the same white-on--red-text bug.
  for (const selector of [
    '.no-response-banner button.danger',
    '.confirm-dialog-actions button.danger',
    '.hold-action-dialog-buttons button.danger',
  ]) {
    const decls = ruleDeclarations(css, selector)
    const bgRaw = decls.get('background') || decls.get('background-color')
    assert.ok(bgRaw, `missing background on ${selector}`)
    const bg = resolveColorValue(tokens, bgRaw)
    const fg = resolveColorValue(tokens, decls.get('color') || 'var(--badge-fg)')
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${selector} ${fg} on ${bg}`)
  }
})

function parseRgba(input: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(input.trim())
  if (!m) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] == null ? 1 : Number(m[4]) }
}

function blendOver(fg: { r: number; g: number; b: number; a: number }, bgHex: string): string {
  const bg = parseHex(bgHex)
  assert.ok(bg, `invalid blend bg ${bgHex}`)
  const a = fg.a
  const r = Math.round(fg.r * a + bg.r * (1 - a))
  const g = Math.round(fg.g * a + bg.g * (1 - a))
  const b = Math.round(fg.b * a + bg.b * (1 - a))
  return `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
}

test('light-mode verdict pills, Re-check, and badge meet WCAG AA contrast', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const tokens = lightModeTokens(css)

  const hold = resolve(tokens, '--hold')
  const ready = resolve(tokens, '--ready')
  const verify = resolve(tokens, '--verify')
  const blueText = resolve(tokens, '--blue-text')
  const pillInk = resolve(tokens, '--verdict-pill-ink')
  const badgeBg = resolve(tokens, '--badge-bg')
  const badgeFg = resolve(tokens, '--badge-fg')

  assert.ok(contrastRatio(pillInk, hold) >= 4.5, `Hold departure pill ${pillInk} on ${hold}`)
  assert.ok(contrastRatio(pillInk, ready) >= 4.5, `Ready to depart pill ${pillInk} on ${ready}`)
  assert.ok(contrastRatio(pillInk, verify) >= 4.5, `Verify on site pill ${pillInk} on ${verify}`)
  assert.ok(
    contrastRatio(blueText, lightBannerSurfaces.hold) >= 4.5,
    `Re-check on HOLD gradient ${blueText} / ${lightBannerSurfaces.hold}`,
  )
  assert.ok(
    contrastRatio(blueText, lightBannerSurfaces.ready) >= 4.5,
    `Re-check on READY gradient ${blueText} / ${lightBannerSurfaces.ready}`,
  )
  assert.ok(
    contrastRatio(blueText, lightBannerSurfaces.verify) >= 4.5,
    `Re-check on VERIFY gradient ${blueText} / ${lightBannerSurfaces.verify}`,
  )
  assert.ok(contrastRatio(badgeFg, badgeBg) >= 4.5, `notification badge ${badgeFg} on ${badgeBg}`)
})

test('Switch user chip link meets WCAG AA on --bg-fill in light and dark', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const switchRule = ruleDeclarations(css, '.user-chip-switch')
  assert.equal(switchRule.get('color'), 'var(--blue-text)')

  for (const [label, tokens, underlay] of [
    ['light', lightModeTokens(css), resolve(lightModeTokens(css), '--bg-elevated')] as const,
    ['dark', darkModeTokens(css), resolve(darkModeTokens(css), '--bg-card')] as const,
  ]) {
    const blueText = resolve(tokens, '--blue-text')
    const fillRaw = resolve(tokens, '--bg-fill')
    const fill = parseRgba(fillRaw)
    assert.ok(fill, `${label} --bg-fill should be rgba, got ${fillRaw}`)
    const chipSurface = blendOver(fill, underlay)
    assert.ok(
      contrastRatio(blueText, chipSurface) >= 4.5,
      `Switch user ${label}: ${blueText} on ${chipSurface} (bg-fill over ${underlay})`,
    )
  }
})

/** Light page wash behind polished verdict banners (prod measured). */
const lightPageBg = '#f2f2f7'
const lightIconChip = '#ffffff'
const lightBannerStops = {
  hold: ['#fff7f6', '#fef2f2'],
  verify: ['#fffbf3', '#fff7e8'],
  ready: ['#f4fcf7', '#e8f8ef'],
} as const

test('light-mode verdict banner border and icon meet WCAG 1.4.11 (≥3:1)', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const tokens = lightModeTokens(css)

  const holdText = resolve(tokens, '--hold-text')
  const verifyText = resolve(tokens, '--verify-text')
  const readyText = resolve(tokens, '--ready-text')

  // Polish block must wire borders to semantic text tokens (not translucent fills).
  assert.match(
    css,
    /\.verdict-banner\.verdict-red\s*\{[^}]*border:\s*1px\s+solid\s+var\(--hold-text\)/s,
    'HOLD banner border must use --hold-text',
  )
  assert.match(
    css,
    /\.verdict-banner\.verdict-amber\s*\{[^}]*border:\s*1px\s+solid\s+var\(--verify-text\)/s,
    'VERIFY banner border must use --verify-text',
  )
  assert.match(
    css,
    /\.verdict-banner\.verdict-green\s*\{[^}]*border:\s*1px\s+solid\s+var\(--ready-text\)/s,
    'READY banner border must use --ready-text',
  )
  assert.match(
    css,
    /\.verdict-banner\.verdict-red\s+\.verdict-icon\s*\{\s*color:\s*var\(--hold-text\)/s,
    'HOLD icon must use --hold-text',
  )
  assert.match(
    css,
    /\.verdict-banner\.verdict-amber\s+\.verdict-icon\s*\{\s*color:\s*var\(--verify-text\)/s,
    'VERIFY icon must use --verify-text',
  )
  assert.match(
    css,
    /\.verdict-banner\.verdict-green\s+\.verdict-icon\s*\{\s*color:\s*var\(--ready-text\)/s,
    'READY icon must use --ready-text',
  )

  const cases = [
    { name: 'HOLD', token: holdText, stops: lightBannerStops.hold },
    { name: 'VERIFY', token: verifyText, stops: lightBannerStops.verify },
    { name: 'READY', token: readyText, stops: lightBannerStops.ready },
  ] as const

  for (const { name, token, stops } of cases) {
    assert.ok(
      contrastRatio(token, lightPageBg) >= 3,
      `${name} border ${token} vs page ${lightPageBg}`,
    )
    assert.ok(
      contrastRatio(token, lightIconChip) >= 3,
      `${name} icon ${token} vs chip ${lightIconChip}`,
    )
    for (const stop of stops) {
      assert.ok(
        contrastRatio(token, stop) >= 3,
        `${name} border ${token} vs fill stop ${stop}`,
      )
    }
  }
})
