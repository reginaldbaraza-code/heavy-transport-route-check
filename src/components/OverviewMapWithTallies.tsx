import { MapPin } from 'lucide-react'
import LazyPermitMap from './LazyPermitMap'
import type { TestPermit } from '../lib/routeCheck'

interface OverviewMapWithTalliesProps {
  permits: TestPermit[]
  routes: Array<{
    id: string
    origin: string
    destination: string
    verdict: 'READY' | 'VERIFY' | 'HOLD'
  }>
}

export default function OverviewMapWithTallies({ permits, routes }: OverviewMapWithTalliesProps) {
  const tallies = {
    ready: routes.filter(r => r.verdict === 'READY').length,
    verify: routes.filter(r => r.verdict === 'VERIFY').length,
    hold: routes.filter(r => r.verdict === 'HOLD').length,
  }

  return (
    <div className="overview-map-tallies">
      <div className="overview-map-real">
        <LazyPermitMap
          permits={permits}
          badgeTitle="Demo: 4 monitored routes"
          badgeSubtitle="Example verdicts across Germany"
          endpointMode="cities"
          showLegend
        />
      </div>
      <div className="overview-tallies">
        <strong>{routes.length} monitored route{routes.length === 1 ? '' : 's'}</strong>
        <div className="overview-tallies-grid">
          <div className="tally-item tally-ready">
            <MapPin size={16} />
            <span className="tally-label">Ready</span>
            <strong>{tallies.ready}</strong>
          </div>
          <div className="tally-item tally-verify">
            <MapPin size={16} />
            <span className="tally-label">Verify</span>
            <strong>{tallies.verify}</strong>
          </div>
          <div className="tally-item tally-hold">
            <MapPin size={16} />
            <span className="tally-label">Hold</span>
            <strong>{tallies.hold}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
