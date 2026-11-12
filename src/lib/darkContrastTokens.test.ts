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

  assert.ok(contrastRatio(textPrimary, holdBg) >= 4.5, `HOLD banner title ${textPrimary} on ${holdBg}`)
  assert.ok(contrastRatio(textPrimary, readyBg) >= 4.5, `READY banner title on ${readyBg}`)
  assert.ok(contrastRatio(textPrimary, verifyBg) >= 4.5, `VERIFY banner title on ${verifyBg}`)
  assert.ok(contrastRatio(holdText, holdBg) >= 4.5, `HOLD tint text ${holdText} on ${holdBg}`)
  assert.ok(contrastRatio(readyText, readyBg) >= 4.5, `READY tint text on ${readyBg}`)
  assert.ok(contrastRatio(verifyText, verifyBg) >= 4.5, `VERIFY tint text on ${verifyBg}`)
  assert.ok(contrastRatio(textOnAccent, accentButton) >= 4.5, `primary button ${textOnAccent} on ${accentButton}`)
  // Verdict pills use dark ink on the bright semantic fill in dark mode
  assert.ok(contrastRatio('#1c1c1e', hold) >= 4.5, `Hold departure pill on ${hold}`)
  assert.ok(contrastRatio('#1c1c1e', ready) >= 4.5, `Ready pill on ${ready}`)
})
