import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { chromium } from "playwright"

// Render at 2× then downscale with lanczos so edges stay crisp.
// PNGs written here must stay regular git blobs (see public/*.png in .gitattributes).
// 32px uses the simplified bold mark; 180/192/512 use the full mark (gradient + dashed lane).

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const fullSvg = readFileSync(join(root, "public/favicon.svg"), "utf8")
const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="rc-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#13294B"/>
      <stop offset="1" stop-color="#0A1A33"/>
    </linearGradient>
    <linearGradient id="rc-route" x1="14" y1="46" x2="52" y2="14" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F5C518"/>
      <stop offset="1" stop-color="#F0A500"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#rc-tile)"/>
  <path d="M14 46 C24 46 30 42 34 36 C38 30 40 24 36 20 L42 26 L52 14" stroke="url(#rc-route)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const targets = [
  { file: "public/favicon-32.png", size: 32, svg: smallSvg },
  { file: "public/apple-touch-icon.png", size: 180, svg: fullSvg },
  { file: "public/icon-192.png", size: 192, svg: fullSvg },
  { file: "public/icon-512.png", size: 512, svg: fullSvg },
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const { file, size, svg } of targets) {
  const render = size * 2
  await page.setViewportSize({ width: render, height: render })
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;width:${render}px;height:${render}px;overflow:hidden}
      svg{display:block;width:${render}px;height:${render}px}
    </style></head><body>${svg}</body></html>`,
    { waitUntil: "load" },
  )
  const hiRes = join(root, `${file}.2x.tmp.png`)
  const buf = await page.screenshot({ type: "png", omitBackground: true })
  writeFileSync(hiRes, buf)
  const out = join(root, file)
  const scaled = spawnSync(
    "ffmpeg",
    ["-y", "-i", hiRes, "-vf", `scale=${size}:${size}:flags=lanczos+accurate_rnd+full_chroma_int`, out],
    { encoding: "utf8" },
  )
  unlinkSync(hiRes)
  if (scaled.status !== 0) {
    console.error(scaled.stderr)
    throw new Error(`ffmpeg failed for ${file}`)
  }
  const written = readFileSync(out)
  if (written.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${file} is not a PNG blob`)
  }
  console.log(`wrote ${file} (${written.length} bytes) from ${render}px`)
}

await browser.close()
