import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleX, FileJson, Map,
  Route, ShieldCheck, Truck, Upload,
} from 'lucide-react'
import MobilityHeatmap from '../components/MobilityHeatmap'
import { MarketplacePageHeader } from '../components/MarketplaceUI'
import {
  defaultVehicleProfile, getPermittedRoute, getRouteCheckResult, permittedRoutes,
} from '../data/routeChecks'

const verdictMeta = {
  READY: { label: 'Ready', icon: CheckCircle2, iconClass: 'green', badgeClass: 'ready' },
  HOLD: { label: 'Hold departure', icon: CircleX, iconClass: 'red', badgeClass: 'hold' },
  VERIFY: { label: 'Verify evidence', icon: AlertTriangle, iconClass: 'amber', badgeClass: 'verify' },
}

export default function MarketplaceOverview() {
  const heroRoute = getPermittedRoute('duisburg-munich')
  const heroResult = getRouteCheckResult(heroRoute, defaultVehicleProfile)
  const HeroVerdictIcon = verdictMeta[heroResult.verdict].icon
  const monitoredRoutes = permittedRoutes.map(route => ({
    id: route.id,
    coordinates: route.coordinates,
    verdict: getRouteCheckResult(route, defaultVehicleProfile).verdict,
  }))

  return (
    <div className="market-page transport-overview">
      <MarketplacePageHeader
        eyebrow="Heavy transport operations"
        title="Know whether the permitted route is usable"
        description="Check the exact approved route against current roadworks, closures, and trusted on-site reports before the transport departs."
        actions={
          <>
            <Link to="/map-explorer" className="market-button secondary"><Map size={16} /> Open route monitor</Link>
            <Link to={`/route-checks?route=${heroRoute.id}`} className="market-button primary"><Upload size={16} /> Import permitted route</Link>
          </>
        }
      />

      <section className="transport-readiness">
        <div className="transport-readiness-copy">
          <div className="transport-route-heading">
            <span className="transport-icon"><Truck size={20} /></span>
            <div>
              <span className="market-eyebrow">Next transport · Permit {heroRoute.permitId}</span>
              <h2>{heroRoute.origin} <ArrowRight size={18} /> {heroRoute.destination}</h2>
            </div>
          </div>
          <div className={`transport-status ${heroResult.verdict.toLowerCase()}`}><HeroVerdictIcon size={18} /><div><strong>{heroResult.title}</strong><span>{heroResult.summary}</span></div></div>
          <div className="transport-facts">
            <div><span>Departure</span><strong>{heroRoute.departure}</strong></div>
            <div><span>Load</span><strong>{defaultVehicleProfile.grossWeight} t · {defaultVehicleProfile.width.toFixed(2)} m wide</strong></div>
            <div><span>Route area</span><strong>{heroRoute.corridor} · {heroRoute.distance}</strong></div>
          </div>
          <div className={`transport-warning verdict-${heroResult.verdict.toLowerCase()}`}>
            <HeroVerdictIcon size={16} />
            <div><strong>{heroResult.title}</strong><span>{heroResult.impact}</span></div>
          </div>
          <Link to={`/route-checks?route=${heroRoute.id}`} className="transport-review-link">Review approved route <ArrowRight size={16} /></Link>
        </div>
        <div className="transport-readiness-map">
          <MobilityHeatmap
            mode="transport"
            compact
            showRoute
            routePermitId="4 monitored routes"
            routeCorridor="Live verdicts across Germany"
            routeMarkers={[]}
            routeOverlays={monitoredRoutes}
          />
        </div>
      </section>

      <section className="transport-workflow" aria-label="Heavy transport route monitoring workflow">
        <div><span>1</span><FileJson size={18} /><strong>Import the permit</strong><p>Upload the exact VEMAGS route and approved transport dimensions.</p></div>
        <ArrowRight size={18} />
        <div><span>2</span><Route size={18} /><strong>Check the route</strong><p>Compare only the approved route with current restrictions and roadworks.</p></div>
        <ArrowRight size={18} />
        <div><span>3</span><ShieldCheck size={18} /><strong>Monitor until departure</strong><p>Receive early warnings when conditions change or evidence is uncertain.</p></div>
      </section>

      <div className="market-two-column">
        <section className="market-section">
          <div className="market-section-header compact">
            <div><span className="market-eyebrow">Dispatch queue</span><h2>Upcoming permitted routes</h2></div>
            <Link to={`/route-checks?route=${heroRoute.id}`}>New route check <ArrowRight size={16} /></Link>
          </div>
          <div className="transport-route-list">
            {permittedRoutes.map(route => {
              const result = getRouteCheckResult(route, defaultVehicleProfile)
              const meta = verdictMeta[result.verdict]
              const VerdictIcon = meta.icon
              return (
                <Link to={`/route-checks?route=${route.id}`} key={route.id}>
                  <span className={`transport-list-icon ${meta.iconClass}`}><Route size={16} /></span>
                  <div><strong>{route.originShort} → {route.destinationShort}</strong><span>{route.permitId} · {route.queueDeparture}</span></div>
                  <b className={meta.badgeClass}><VerdictIcon size={14} /> {meta.label}</b>
                  <ArrowRight size={16} />
                </Link>
              )
            })}
          </div>
        </section>

        <section className="market-section">
          <div className="market-section-header compact">
            <div><span className="market-eyebrow">Source status</span><h2>Information covering your next route</h2></div>
            <Link to="/discover">Manage data <ArrowRight size={16} /></Link>
          </div>
          <div className="transport-source-list">
            {heroRoute.evidence.map((item, index) => (
              <div key={item.id}>
                <span>{['AG', 'RO', 'VB'][index]}</span>
                <div><strong>{item.source}</strong><small>{item.title} · {item.age}</small></div>
                <b>{item.confidence === 'High' ? 'Confirmed' : 'Unconfirmed'}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
