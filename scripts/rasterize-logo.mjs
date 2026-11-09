import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { chromium } from "playwright"

// Render at 2× then downscale with lanczos so edges stay crisp.
// PNGs written here must stay regular git blobs (see public/*.png in .gitattributes).

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const svg = readFileSync(join(root, "public/favicon.svg"), "utf8")

const targets = [
  { file: "public/favicon-32.png", size: 32 },
  { file: "public/apple-touch-icon.png", size: 180 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
]

const browser = await chromium.launch()
const page = await browser.newPage()

for (const { file, size } of targets) {
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
