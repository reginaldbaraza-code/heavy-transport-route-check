#!/usr/bin/env node
/**
 * Stream Autobahn GmbH MIA DATEX II feeds republished by MobiData BW,
 * keep a compact JSON snapshot for route checks.
 *
 * Zero npm deps so GitHub Actions can run without pnpm install.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMiaSnapshot, snapshotContentUnchanged } from '../api/_lib/mia-datex.mjs'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/mia-roadworks.json')

async function main() {
  const snapshot = await buildMiaSnapshot()
  if (existsSync(OUT)) {
    try {
      const previous = JSON.parse(readFileSync(OUT, 'utf8'))
      if (snapshotContentUnchanged(previous, snapshot)) {
        console.log('Snapshot items unchanged; skipping write')
        return
      }
    } catch (error) {
      console.warn('Could not compare existing snapshot; rewriting', error)
    }
  }

  mkdirSync(dirname(OUT), { recursive: true })
  const json = JSON.stringify(snapshot)
  writeFileSync(OUT, json)
  console.log(`Wrote ${OUT}`)
  console.log(`items ${snapshot.items.length}  bytes ${json.length}  gzip-target ~${(json.length / 4 / 1_048_576).toFixed(2)} MB`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
