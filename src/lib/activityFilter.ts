/** Shared matching helpers for Alerts & history route filters. */

export type AlertRouteRef = {
  routeId: string
  routeLabel: string
}

export type HistoryRouteRef = {
  id: string
  jobId?: string
  permitName: string
}

/** True when an alert belongs to the selected permit/route filter. */
export function alertMatchesRouteFilter(
  alert: AlertRouteRef,
  routeFilter: string,
  history: HistoryRouteRef[],
): boolean {
  if (routeFilter === 'all') return true
  if (alert.routeLabel === routeFilter) return true
  const linked = history.find(
    record => record.id === alert.routeId || record.jobId === alert.routeId,
  )
  return linked?.permitName === routeFilter
}

/** True when a history record belongs to the selected permit/route filter. */
export function historyMatchesRouteFilter(
  record: HistoryRouteRef,
  routeFilter: string,
): boolean {
  return routeFilter === 'all' || record.permitName === routeFilter
}
