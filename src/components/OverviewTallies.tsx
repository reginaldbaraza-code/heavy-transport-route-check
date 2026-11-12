import { MapPin } from 'lucide-react'
import type { TestPermit } from '../lib/routeCheck'
import { overviewVerdictForPermit } from '../lib/overviewTracks'

interface OverviewTalliesProps {
  permits: TestPermit[]
}

export default function OverviewTallies({ permits }: OverviewTalliesProps) {
  // Compute verdicts from the same data source as the map
  const verdicts = permits.map(permit => overviewVerdictForPermit(permit))
  
  const tallies = {
    ready: verdicts.filter(v => v === 'READY').length,
    verify: verdicts.filter(v => v === 'VERIFY').length,
    hold: verdicts.filter(v => v === 'HOLD').length,
  }

  return (
    <div className="overview-tallies">
      <strong>{permits.length} monitored route{permits.length === 1 ? '' : 's'}</strong>
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
