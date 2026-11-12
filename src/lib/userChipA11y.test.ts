import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const chipSource = readFileSync(new URL('../components/UserChip.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

test('compact UserChip is a labeled switch-user button (not a dead avatar span)', () => {
  assert.match(chipSource, /if \(compact\) \{/)
  assert.match(
    chipSource,
    /className="user-chip is-compact"[\s\S]*aria-label=\{switchLabel\}[\s\S]*onClick=\{onSwitch\}/,
  )
  assert.match(chipSource, /const switchLabel = `Switch user \(\$\{user\.name\}\)`/)
  // Avatar stays presentational inside the compact button.
  assert.match(chipSource, /className="user-chip-avatar"[\s\S]*aria-hidden="true"/)
})

test('≤420px mobile header keeps a ≥36px avatar-only switch control', () => {
  assert.match(
    css,
    /@media \(max-width:\s*420px\)[\s\S]*?\.mobile-user-chip \.user-chip-meta\s*\{[^}]*display:\s*none/,
  )
  assert.match(
    css,
    /@media \(max-width:\s*420px\)[\s\S]*?\.mobile-user-chip \.user-chip\s*\{[^}]*(?:min-width:\s*40px|width:\s*40px|min-height:\s*40px|height:\s*40px)/,
  )
})
