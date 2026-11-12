import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import {
  DRAWER_NAV_MAX_WIDTH_PX,
  collapseControlLabel,
  effectiveSidebarCollapsed,
  isClosedDrawerInert,
  isDrawerViewport,
  reduceNavChromeCollapseToggle,
  reduceNavChromeOpenMobile,
  reduceNavChromeViewportChange,
} from "./layoutNavChrome"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
const layoutSource = readFileSync(
  join(root, "src/components/Layout.tsx"),
  "utf8",
)
const css = readFileSync(join(root, "src/index.css"), "utf8")

test("drawer breakpoint matches CSS max-width 900px overlay rules", () => {
  assert.equal(DRAWER_NAV_MAX_WIDTH_PX, 900)
  assert.match(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.app-sidebar\s*\{[^}]*position:\s*fixed/,
  )
  assert.equal(isDrawerViewport(900), true)
  assert.equal(isDrawerViewport(901), false)
  assert.equal(isDrawerViewport(390), true)
  assert.equal(isDrawerViewport(320), true)
  assert.equal(isDrawerViewport(1440), false)
})

test("desktop collapse toggles the icon rail at 1440px", () => {
  const expanded = { collapsed: false, mobileOpen: false }
  const collapsed = reduceNavChromeCollapseToggle(expanded, 1440)
  assert.deepEqual(collapsed, { collapsed: true, mobileOpen: false })
  assert.equal(effectiveSidebarCollapsed(collapsed.collapsed, 1440), true)
  assert.equal(collapseControlLabel(collapsed, 1440), "Expand navigation")

  const reexpanded = reduceNavChromeCollapseToggle(collapsed, 1440)
  assert.deepEqual(reexpanded, { collapsed: false, mobileOpen: false })
  assert.equal(collapseControlLabel(reexpanded, 1440), "Collapse navigation")
})

test("mobile collapse closes the drawer and never keeps a collapsed rail", () => {
  for (const width of [320, 390, 400, 768, 900]) {
    const open = reduceNavChromeOpenMobile({
      collapsed: false,
      mobileOpen: false,
    })
    assert.deepEqual(open, { collapsed: false, mobileOpen: true })

    const afterCollapse = reduceNavChromeCollapseToggle(open, width)
    assert.deepEqual(
      afterCollapse,
      { collapsed: false, mobileOpen: false },
      `width ${width} should close drawer without collapsing`,
    )
    assert.equal(
      effectiveSidebarCollapsed(afterCollapse.collapsed, width),
      false,
    )
    assert.equal(collapseControlLabel(open, width), "Close navigation")
  }
})

test("drawer viewport clears a leftover desktop-collapsed rail", () => {
  const leftover = { collapsed: true, mobileOpen: false }
  assert.equal(effectiveSidebarCollapsed(true, 390), false)

  const cleared = reduceNavChromeViewportChange(leftover, 390)
  assert.deepEqual(cleared, { collapsed: false, mobileOpen: false })

  const leavingDrawer = reduceNavChromeViewportChange(
    { collapsed: false, mobileOpen: true },
    1440,
  )
  assert.deepEqual(leavingDrawer, { collapsed: false, mobileOpen: false })
})

test("closed drawer is inert at mobile widths; open drawer and desktop are not", () => {
  const closed = { collapsed: false, mobileOpen: false }
  const open = { collapsed: false, mobileOpen: true }

  for (const width of [320, 390, 768, 900]) {
    assert.equal(isClosedDrawerInert(closed, width), true, `closed @ ${width}`)
    assert.equal(isClosedDrawerInert(open, width), false, `open @ ${width}`)
  }

  assert.equal(isClosedDrawerInert(closed, 901), false)
  assert.equal(isClosedDrawerInert(closed, 1440), false)
  assert.equal(isClosedDrawerInert({ collapsed: true, mobileOpen: false }, 1440), false)
})

test("Layout wires collapse through layoutNavChrome helpers", () => {
  assert.match(layoutSource, /reduceNavChromeCollapseToggle/)
  assert.match(layoutSource, /effectiveSidebarCollapsed/)
  assert.match(layoutSource, /onCollapseControl/)
  assert.match(layoutSource, /isClosedDrawerInert/)
  assert.match(layoutSource, /\binert=\{drawerInert/)
  assert.match(layoutSource, /useLayoutEffect/)
  assert.doesNotMatch(
    layoutSource,
    /onClick=\{\(\) => setCollapsed\(!collapsed\)\}/,
    "raw collapsed toggle must not remain on the collapse control",
  )
})

test("collapsed rail allows tooltips to escape overflow clipping", () => {
  assert.match(layoutSource, /is-collapsed-rail/)
  assert.match(css, /\.app-sidebar\.is-collapsed-rail\s*\{[^}]*overflow:\s*visible/)
  assert.match(css, /\.app-sidebar\.is-collapsed-rail\s+\.sidebar-nav/)
  assert.match(
    css,
    /\.has-tooltip\[data-tooltip\]:hover::after[\s\S]*\.has-tooltip\[data-tooltip\]:focus-visible::after/,
  )
})
