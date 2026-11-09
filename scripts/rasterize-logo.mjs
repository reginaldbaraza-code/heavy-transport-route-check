import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

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

await page.setViewportSize({ width: 64, height: 64 })
await page.setContent(
  `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;width:64px;height:64px;overflow:hidden}
    svg{display:block;width:64px;height:64px}
  </style></head><body>${svg}</body></html>`,
  { waitUntil: "load" },
)
const logo64 = await page.screenshot({ type: "png", omitBackground: true })
const b64 = logo64.toString("base64")
writeFileSync(
  join(root, "src/lib/routeCheckLogoPng.ts"),
  `/** 64×64 PNG of the route-check mark, for PDF header embedding. */\n` +
    `export const ROUTE_CHECK_LOGO_PNG =\n` +
    `  'data:image/png;base64,${b64}'\n`,
)
console.log(`wrote src/lib/routeCheckLogoPng.ts (${b64.length} chars)`)

await browser.close()
