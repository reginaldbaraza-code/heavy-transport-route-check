import { sampleTestPermits, type TestPermit } from './routeCheck'

export type OverviewVerdict = 'READY' | 'HOLD' | 'VERIFY'

export const VERDICT_TRACK_COLORS: Record<OverviewVerdict, string> = {
  READY: '#16A34A',
  VERIFY: '#F59E0B',
  HOLD: '#DC2626',
}

/** Permitted-route blue used by the Sample GPX legend. */
export const SAMPLE_ROUTE_COLOR = '#0b57d0'

export const OVERVIEW_FEATURED_PERMIT_ID = 'munchen-stuttgart'

export const OVERVIEW_FEATURED_COPY = {
  title: 'Hold departure – width restriction on A8',
  summary: 'Restbreite 3.00 m is below the approved 3.30 m vehicle width on the permitted A8 corridor.',
  impact: 'Selected vehicle: 3.30 m W × 4.30 m H × 30.0 m L · 65 t. Live width (not height) blocks the permitted route when present.',
}

/** Four geographically spread live sample permits for the overview hero map. */
export const OVERVIEW_MONITOR_ROUTES: Array<{ id: string; verdict: OverviewVerdict }> = [
  { id: 'hamburg-hannover', verdict: 'VERIFY' },
  { id: 'lubeck-rostock', verdict: 'VERIFY' },
  { id: 'leipzig-nurnberg', verdict: 'VERIFY' },
  { id: 'munchen-stuttgart', verdict: 'HOLD' },
]

export function overviewVerdictForPermit(permit: TestPermit): OverviewVerdict {
  if (permit.expectedVerdict) return permit.expectedVerdict
  const configured = OVERVIEW_MONITOR_ROUTES.find(route => route.id === permit.id)
  if (configured) return configured.verdict
  return 'VERIFY'
}

export function getOverviewMonitorPermits() {
  return OVERVIEW_MONITOR_ROUTES.map(route => {
    const permit = sampleTestPermits.find(item => item.id === route.id)
    if (!permit) throw new Error(`Missing overview sample permit ${route.id}`)
    return {
      permit,
      verdict: permit.expectedVerdict ?? route.verdict,
    }
  })
}

export function getOverviewFeatured() {
  const featured = getOverviewMonitorPermits().find(item => item.permit.id === OVERVIEW_FEATURED_PERMIT_ID)
  if (!featured) throw new Error(`Missing featured overview permit ${OVERVIEW_FEATURED_PERMIT_ID}`)
  return featured
}
