import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(join(root, 'src/index.css'), 'utf8')
const settingsSource = readFileSync(join(root, 'src/pages/Settings.tsx'), 'utf8')

function mediaBlock(cssText: string, query: string): string {
  const start = cssText.indexOf(`@media (${query})`)
  assert.ok(start >= 0, `missing @media (${query})`)
  const brace = cssText.indexOf('{', start)
  let depth = 0
  for (let i = brace; i < cssText.length; i++) {
    if (cssText[i] === '{') depth++
    else if (cssText[i] === '}') {
      depth--
      if (depth === 0) return cssText.slice(brace + 1, i)
    }
  }
  assert.fail(`unclosed @media (${query})`)
}

test('settings mobile tab nav is width-constrained so overflow-x can scroll', () => {
  const block = mediaBlock(css, 'max-width: 820px')
  assert.match(block, /\.settings-sidebar nav\s*\{[^}]*min-width:\s*0/)
  assert.match(block, /\.settings-sidebar nav\s*\{[^}]*overflow-x:\s*auto/)
  assert.match(block, /\.settings-sidebar nav\s*\{[^}]*display:\s*flex/)
  assert.match(block, /\.settings-sidebar nav button\s*\{[^}]*flex:\s*0 0 auto/)
})

test('settings page must not force nav min-width:max-content on small screens', () => {
  // This rule made the tab strip grow to content width; the aside then clipped
  // Monitoring / Data sources with no way to scroll them into view.
  assert.equal(
    /\.settings-page nav\s*\{[^}]*min-width:\s*max-content/.test(css),
    false,
    '.settings-page nav must not use min-width: max-content',
  )
})

test('settings keeps the active tab scrolled into view', () => {
  assert.match(settingsSource, /scrollIntoView/)
  assert.match(settingsSource, /button\.active/)
})
