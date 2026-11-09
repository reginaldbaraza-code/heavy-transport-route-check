import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

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
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden}
      svg{display:block;width:${size}px;height:${size}px}
    </style></head><body>${svg}</body></html>`,
    { waitUntil: "load" },
  )
  const buf = await page.screenshot({ type: "png", omitBackground: true })
  writeFileSync(join(root, file), buf)
  console.log(`wrote ${file} (${buf.length} bytes)`)
}

await browser.close()
