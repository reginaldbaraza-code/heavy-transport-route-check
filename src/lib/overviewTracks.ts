import { sampleTestPermits, type TestPermit } from './routeCheck'

export type OverviewVerdict = 'READY' | 'HOLD' | 'VERIFY'

export const VERDICT_TRACK_COLORS: Record<OverviewVerdict, string> = {
  READY: '#067647',
  VERIFY: '#93370d',
  HOLD: '#b42318',
}

/** Four geographically spread live sample permits for the overview hero map. */
export const OVERVIEW_MONITOR_ROUTES: Array<{ id: string; verdict: OverviewVerdict }> = [
  { id: 'hamburg-hannover', verdict: 'VERIFY' },
  { id: 'lubeck-rostock', verdict: 'READY' },
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
