import type { RouteEvidence } from '../data/routeChecks'

export function isConfirmOnSite(item: Pick<RouteEvidence, 'id' | 'title' | 'detail' | 'longRunning' | 'category' | 'state'>) {
  if (item.id === 'bridge-clearance-confirmed' || item.state === 'clear') return false
  const text = `${item.title} ${item.detail}`
  return Boolean(item.longRunning)
    || item.id === 'bridge-clearance-unknown'
    || /verify on site|confirm on site|bridge and clearance data not available/i.test(text)
}

export function confirmOnSiteTitles(evidence: RouteEvidence[]) {
  return evidence.filter(item => isConfirmOnSite(item)).map(item => item.title)
}
