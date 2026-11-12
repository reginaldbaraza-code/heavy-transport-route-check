import { MapPin } from 'lucide-react'
import type { TestPermit } from '../lib/routeCheck'
import { overviewTallyCounts } from '../lib/overviewTracks'

interface OverviewTalliesProps {
  permits: TestPermit[]
}

export default function OverviewTallies({ permits }: OverviewTalliesProps) {
  const tallies = overviewTallyCounts(permits)

  return (
    <div className="overview-tallies">
      <strong>{tallies.total} monitored route{tallies.total === 1 ? '' : 's'}</strong>
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
  )
}
