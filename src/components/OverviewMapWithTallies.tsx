import { MapPin } from 'lucide-react'

interface OverviewMapWithTalliesProps {
  routes: Array<{
    id: string
    origin: string
    destination: string
    verdict: 'READY' | 'VERIFY' | 'HOLD'
  }>
}

export default function OverviewMapWithTallies({ routes }: OverviewMapWithTalliesProps) {
  const tallies = {
    ready: routes.filter(r => r.verdict === 'READY').length,
    verify: routes.filter(r => r.verdict === 'VERIFY').length,
    hold: routes.filter(r => r.verdict === 'HOLD').length,
  }

  return (
    <div className="overview-map-tallies">
      <div className="overview-map-placeholder">
        <div className="map-svg-container">
          {/* Simple Germany outline placeholder */}
          <svg viewBox="0 0 400 500" className="germany-map-svg">
            <path
              d="M 200 50 L 280 120 L 320 200 L 300 300 L 280 400 L 200 450 L 120 400 L 100 300 L 120 200 L 160 120 Z"
              fill="var(--bg-grouped)"
              stroke="var(--border-strong)"
              strokeWidth="2"
            />
            {/* Route markers */}
            {routes.slice(0, 4).map((route, index) => {
              const positions = [
                { x: 180, y: 120 }, // Hamburg
                { x: 250, y: 200 }, // Leipzig
                { x: 220, y: 320 }, // Nuremberg
                { x: 240, y: 400 }, // Munich
              ]
              const pos = positions[index] || { x: 200, y: 250 }
              const color =
                route.verdict === 'READY'
                  ? 'var(--green-text)'
                  : route.verdict === 'HOLD'
                    ? 'var(--red-text)'
                    : 'var(--amber-text)'
              return (
                <circle key={route.id} cx={pos.x} cy={pos.y} r="6" fill={color} opacity="0.9" />
              )
            })}
          </svg>
        </div>
        <p className="map-coming-soon">
          Germany coverage map coming soon
        </p>
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
