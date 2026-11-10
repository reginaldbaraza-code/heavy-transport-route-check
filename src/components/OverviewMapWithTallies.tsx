import { CheckCircle2, AlertTriangle, CircleX } from 'lucide-react'

type RouteTally = {
  ready: number
  verify: number
  hold: number
}

type Props = {
  tally: RouteTally
  cities: Array<{ name: string; position: [number, number] }>
}

export function OverviewMapWithTallies({ tally, cities }: Props) {
  const total = tally.ready + tally.verify + tally.hold

  return (
    <div className="overview-map-tallies">
      <div className="overview-map-container">
        <div className="overview-map-germany">
          {/* Simplified Germany outline SVG */}
          <svg viewBox="0 0 200 280" className="germany-map-svg">
            <path
              d="M 50,10 L 80,5 L 110,15 L 140,20 L 160,35 L 170,60 L 165,90 L 155,120 L 160,150 L 150,180 L 140,210 L 130,240 L 110,260 L 90,270 L 70,265 L 50,250 L 35,230 L 25,200 L 20,170 L 25,140 L 30,110 L 35,80 L 40,50 L 45,30 Z"
              fill="var(--bg-grouped)"
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          </svg>
          {/* City markers */}
          {cities.map((city, i) => (
            <button
              key={i}
              className="city-marker"
              style={{
                left: `${city.position[0]}%`,
                top: `${city.position[1]}%`,
              }}
              aria-label={city.name}
              title={city.name}
            >
              <span className="city-dot" />
              <span className="city-label">{city.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="overview-tallies">
        <div className="overview-tally-header">
          <strong>{total} monitored route{total === 1 ? '' : 's'}</strong>
          <span>Live verdicts across Germany</span>
        </div>
        <div className="overview-tally-bars">
          <div className="tally-bar ready" style={{ '--tally-width': `${total ? (tally.ready / total) * 100 : 0}%` } as React.CSSProperties}>
            <CheckCircle2 size={16} />
            <span>Ready</span>
            <strong>{tally.ready}</strong>
          </div>
          <div className="tally-bar verify" style={{ '--tally-width': `${total ? (tally.verify / total) * 100 : 0}%` } as React.CSSProperties}>
            <AlertTriangle size={16} />
            <span>Verify</span>
            <strong>{tally.verify}</strong>
          </div>
          <div className="tally-bar hold" style={{ '--tally-width': `${total ? (tally.hold / total) * 100 : 0}%` } as React.CSSProperties}>
            <CircleX size={16} />
            <span>Hold</span>
            <strong>{tally.hold}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
