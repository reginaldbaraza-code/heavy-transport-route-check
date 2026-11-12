/**
 * Sidebar / drawer chrome for the app shell.
 *
 * CSS turns `.app-sidebar` into an off-canvas drawer at max-width 900px
 * (see `src/index.css`). Desktop-only "collapsed icon rail" state must never
 * win inside that drawer breakpoint — otherwise the rail stays in the layout,
 * clips main content, and hides the mobile bottom tab bar.
 */

/** Matches `@media (max-width: 900px)` drawer rules in `src/index.css`. */
export const DRAWER_NAV_MAX_WIDTH_PX = 900

export type NavChromeState = {
  collapsed: boolean
  mobileOpen: boolean
}

export function isDrawerViewport(widthPx: number): boolean {
  return widthPx <= DRAWER_NAV_MAX_WIDTH_PX
}

/** Desktop collapsed rail only; always expanded chrome in drawer mode. */
export function effectiveSidebarCollapsed(
  collapsed: boolean,
  viewportWidthPx: number,
): boolean {
  if (isDrawerViewport(viewportWidthPx)) return false
  return collapsed
}

/**
 * Collapse control on desktop toggles the icon rail.
 * In drawer mode (or while the mobile drawer is open) it only closes the drawer.
 */
export function reduceNavChromeCollapseToggle(
  state: NavChromeState,
  viewportWidthPx: number,
): NavChromeState {
  if (isDrawerViewport(viewportWidthPx) || state.mobileOpen) {
    return { collapsed: false, mobileOpen: false }
  }
  return { collapsed: !state.collapsed, mobileOpen: false }
}

export function reduceNavChromeOpenMobile(
  state: NavChromeState,
): NavChromeState {
  return { collapsed: false, mobileOpen: true }
}

/** Drop desktop-collapsed state when crossing into the drawer breakpoint. */
export function reduceNavChromeViewportChange(
  state: NavChromeState,
  viewportWidthPx: number,
): NavChromeState {
  if (isDrawerViewport(viewportWidthPx)) {
    return { collapsed: false, mobileOpen: state.mobileOpen }
  }
  return { collapsed: state.collapsed, mobileOpen: false }
}

export function collapseControlLabel(
  state: NavChromeState,
  viewportWidthPx: number,
): "Close navigation" | "Expand navigation" | "Collapse navigation" {
  if (isDrawerViewport(viewportWidthPx) || state.mobileOpen) {
    return "Close navigation"
  }
  return state.collapsed ? "Expand navigation" : "Collapse navigation"
}

/**
 * Off-canvas drawer content must leave the tab order and a11y tree while closed.
 * Desktop sidebar / collapsed icon rail stay interactive (never inert).
 */
export function isClosedDrawerInert(
  state: NavChromeState,
  viewportWidthPx: number,
): boolean {
  return isDrawerViewport(viewportWidthPx) && !state.mobileOpen
}
