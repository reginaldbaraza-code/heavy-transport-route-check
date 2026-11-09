import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { chromium } from "playwright"

// Render at 2× then downscale with lanczos so edges stay crisp.
// PNGs written here must stay regular git blobs (see public/*.png in .gitattributes).
// 32px uses the small mark; 180/192/512 use the full mark (gradient + both dashed lanes).

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#13294B"/>
      <stop offset="1" stop-color="#0A1A33"/>
    </linearGradient>
    <linearGradient id="road" x1="6" y1="52" x2="56" y2="11" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F0A500"/>
      <stop offset="1" stop-color="#F5C518"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14.5" fill="url(#bg)"/>
  <rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <path d="M7 52 C22 52 36.5 48 36.5 39.5 C36.5 33.5 28.2 30.5 28.2 24.5 C28.2 19.6 34 15.6 39.6 11.8 L47.6 20 L56.6 11" stroke="url(#road)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18.5 46.4 C24.6 44.6 29.4 40.6 30 35.6 C30.2 33.8 29.6 32.4 28.8 31.2" stroke="#fff" stroke-opacity=".9" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="2.2 2.4" stroke-dashoffset="4.1"/>
  <path d="M38.6 31.6 C42.4 35 43.6 40 41.8 44.4 C40.8 47 38.8 49.4 36.2 51.4" stroke="#fff" stroke-opacity=".9" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="2.2 2.4" stroke-dashoffset="2.35"/>
</svg>`

const smallSvg = readFileSync(join(root, "public/favicon.svg"), "utf8")

const targets = [
  { file: "public/favicon-32.png", size: 32, svg: smallSvg },
  { file: "public/apple-touch-icon.png", size: 180, svg: fullSvg },
  { file: "public/icon-192.png", size: 192, svg: fullSvg },
  { file: "public/icon-512.png", size: 512, svg: fullSvg },
]

const browser = await chromium.launch()
const page = await browser.newPage()

await page.setContent(
  `<!doctype html><html><body>${fullSvg}</body></html>`,
  { waitUntil: "load" },
)
const lengths = await page.evaluate(() => {
  const paths = [...document.querySelectorAll("path")]
  return paths.map(p => ({ d: p.getAttribute("d"), len: p.getTotalLength() }))
})
console.log("path lengths", JSON.stringify(lengths, null, 2))

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
