import { useState } from 'react'
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
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { formatBerlinDateTime } from '../lib/formatTime'
import { sampleTestPermits } from '../lib/routeCheck'
import { readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'
import { formatVehicleDims, shouldMonitorJob } from '../lib/jobs'

const verdictMeta = {
  READY: { label: 'Ready', icon: CheckCircle2, iconClass: 'green', badgeClass: 'ready' },
  HOLD: { label: 'Hold departure', icon: CircleX, iconClass: 'red', badgeClass: 'hold' },
  VERIFY: { label: 'Verify evidence', icon: AlertTriangle, iconClass: 'amber', badgeClass: 'verify' },
}

type SampleMode = 'example' | 'permits'

export default function MarketplaceOverview() {
  const { history } = useRouteMonitoring()
  const { jobs } = useJobs()
  const [sampleMode, setSampleMode] = useState<SampleMode>(() => {
    const stored = typeof window === 'undefined' ? 'example' : readJson<SampleMode>(STORAGE_KEYS.overviewSampleMode, 'example')
    return stored === 'permits' ? 'permits' : 'example'
  })

  const setMode = (mode: SampleMode) => {
    setSampleMode(mode)
    writeJson(STORAGE_KEYS.overviewSampleMode, mode)
  }

  const heroRoute = getPermittedRoute('duisburg-munich')
  const heroResult = getRouteCheckResult(heroRoute, defaultVehicleProfile)
  const HeroVerdictIcon = verdictMeta[heroResult.verdict].icon
  const monitoredRoutes = permittedRoutes.map(route => ({
    id: route.id,
    coordinates: route.coordinates,
    verdict: getRouteCheckResult(route, defaultVehicleProfile).verdict,
  }))
  const heroPermit = sampleTestPermits[0]

  return (
    <div className="market-page transport-overview">
      <MarketplacePageHeader
        eyebrow="Heavy transport operations"
        title="Know whether the permitted route is usable"
        description="Check the exact approved route against current roadworks, closures, and trusted on-site reports before the transport departs."
        actions={
          <>
            <Link to="/map-explorer" className="market-button secondary"><Map size={16} /> Open route monitor</Link>
            <Link to="/route-checks" className="market-button primary"><Upload size={16} /> Import permitted route</Link>
          </>
        }
      />

      {jobs.length > 0 && (
        <section className="saved-checks-section" aria-label="Saved jobs">
          <div className="market-section-header compact">
            <div>
              <span className="market-eyebrow">This browser</span>
              <h2>Saved jobs</h2>
            </div>
            <Link to="/jobs">Open jobs <ArrowRight size={16} /></Link>
          </div>
          <div className="transport-route-list saved-checks-list">
            {jobs.slice(0, 4).map(job => (
              <Link to={`/route-checks?job=${job.id}&run=1`} key={job.id}>
                <span className={`transport-list-icon ${job.lastVerdict === 'HOLD' ? 'red' : job.lastVerdict === 'READY' ? 'green' : 'amber'}`}><Route size={16} /></span>
                <div>
                  <strong>{job.name}</strong>
                  <span>{job.permitNumber || job.routeFileName} · {formatVehicleDims(job.vehicle)} · {formatBerlinDateTime(job.plannedDeparture) || 'no departure'}</span>
                </div>
                <b className={shouldMonitorJob(job) ? 'verify' : job.lastVerdict === 'HOLD' ? 'hold' : job.lastVerdict === 'READY' ? 'ready' : 'verify'}>
                  {shouldMonitorJob(job) ? 'Monitoring' : job.lastVerdict || 'Saved'}
                </b>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          <p className="storage-note">Jobs are stored in this browser only. Monitoring runs only while the tab is open.</p>
        </section>
      )}

      {history.length > 0 ? (
        <section className="saved-checks-section" aria-label="Saved route checks">
          <div className="market-section-header compact">
            <div>
              <span className="market-eyebrow">This browser</span>
              <h2>Your saved route checks</h2>
            </div>
            <Link to="/activity">Alerts & history <ArrowRight size={16} /></Link>
          </div>
          <div className="transport-route-list saved-checks-list">
            {history.slice(0, 6).map(record => {
              const meta = verdictMeta[record.verdict]
              const VerdictIcon = meta.icon
              return (
                <Link to="/activity" key={record.id}>
                  <span className={`transport-list-icon ${meta.iconClass}`}><Route size={16} /></span>
                  <div>
                    <strong>{record.permitName}</strong>
                    <span>{record.routeLabel} · {formatBerlinDateTime(record.runAt)}</span>
                  </div>
                  <b className={meta.badgeClass}><VerdictIcon size={14} /> {meta.label}</b>
                  <ArrowRight size={16} />
                </Link>
              )
            })}
          </div>
          <p className="storage-note">History is stored only in this browser.</p>
        </section>
      ) : (
        <section className="transport-empty-state saved-checks-empty">
          <div className="empty-state-card">
            <Upload size={48} />
            <h2>No saved routes yet</h2>
            <p>Import a permitted route to check live Autobahn conditions. Completed checks are stored only in this browser.</p>
            <Link to="/route-checks" className="market-button primary">
              <Upload size={16} /> Check your first route
            </Link>
          </div>
        </section>
      )}

      <div className="example-data-panel">
        <div className="example-data-banner" role="note">
          <div className="example-data-banner-copy">
            <span className="example-data-badge">{sampleMode === 'permits' ? 'Test / sample data' : 'Example data'}</span>
            <p>
              {sampleMode === 'permits'
                ? 'These are the labelled sample permits from Route Checks. Opening one loads it for a live Autobahn check. Nothing is saved to alerts or history until you actually run a check.'
                : 'These routes and sources are illustrative, not live. They do not affect alerts, history, or the notification badge.'}
            </p>
          </div>
          <div className="sample-mode-toggle" role="group" aria-label="Overview sample data mode">
            <button type="button" className={sampleMode === 'example' ? 'active' : ''} onClick={() => setMode('example')} aria-pressed={sampleMode === 'example'}>
              Example data
            </button>
            <button type="button" className={sampleMode === 'permits' ? 'active' : ''} onClick={() => setMode('permits')} aria-pressed={sampleMode === 'permits'}>
              Test permits
            </button>
          </div>
        </div>

        {sampleMode === 'example' ? (
          <>
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
                <Link to="/route-checks" className="transport-review-link">Review approved route <ArrowRight size={16} /></Link>
              </div>
              <div className="transport-readiness-map">
                <MobilityHeatmap
                  mode="transport"
                  compact
                  showRoute
                  routePermitId="4 monitored routes"
                  routeCorridor="Example verdicts across Germany"
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
                  <Link to="/route-checks">New route check <ArrowRight size={16} /></Link>
                </div>
                <div className="transport-route-list">
                  {permittedRoutes.map(route => {
                    const result = getRouteCheckResult(route, defaultVehicleProfile)
                    const meta = verdictMeta[result.verdict]
                    const VerdictIcon = meta.icon
                    return (
                      <Link to="/route-checks" key={route.id}>
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
                      <div><strong>{item.source}</strong><small>{item.title} · Example</small></div>
                      <b>Example</b>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <>
            <section className="transport-readiness">
              <div className="transport-readiness-copy">
                <div className="transport-route-heading">
                  <span className="transport-icon"><Truck size={20} /></span>
                  <div>
                    <span className="market-eyebrow">Sample permit · {heroPermit.permitNumber}</span>
                    <h2>{heroPermit.origin} <ArrowRight size={18} /> {heroPermit.destination}</h2>
                  </div>
                </div>
                <div className="transport-status verify">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Sample permit – not yet checked</strong>
                    <span>Open this labelled sample to run a live Autobahn GmbH route check. History is only written after you run the check.</span>
                  </div>
                </div>
                <div className="transport-facts">
                  <div><span>Valid</span><strong>{formatBerlinDateTime(heroPermit.validFrom)} – {formatBerlinDateTime(heroPermit.validUntil)}</strong></div>
                  <div><span>Load</span><strong>{heroPermit.vehicle.grossWeight} t · {heroPermit.vehicle.width.toFixed(2)} m wide</strong></div>
                  <div><span>Route area</span><strong>{heroPermit.corridor} · {heroPermit.distance}</strong></div>
                </div>
                <div className="transport-warning verdict-verify">
                  <AlertTriangle size={16} />
                  <div><strong>{heroPermit.routeDescription}</strong><span>Uses the same sample file as Route Checks.</span></div>
                </div>
                <Link to={`/route-checks?permit=${heroPermit.id}`} className="transport-review-link">Check this sample permit <ArrowRight size={16} /></Link>
              </div>
              <div className="transport-readiness-map">
                <MobilityHeatmap
                  mode="transport"
                  compact
                  showRoute
                  routePermitId="Sample test permits"
                  routeCorridor="Hamburg, Bremen, Leipzig, Duisburg, München"
                  routeMarkers={[]}
                  routeOverlays={[]}
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
                  <div><span className="market-eyebrow">Sample permits</span><h2>Test permits from Route Checks</h2></div>
                  <Link to="/route-checks">Open Route Checks <ArrowRight size={16} /></Link>
                </div>
                <div className="transport-route-list">
                  {sampleTestPermits.map(permit => (
                    <Link to={`/route-checks?permit=${permit.id}`} key={permit.id}>
                      <span className="transport-list-icon amber"><Route size={16} /></span>
                      <div>
                        <strong>{permit.originShort} → {permit.destinationShort}</strong>
                        <span>{permit.permitNumber} · {permit.corridor} · {permit.distance}</span>
                      </div>
                      <b className="verify">Sample</b>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              </section>

              <section className="market-section">
                <div className="market-section-header compact">
                  <div><span className="market-eyebrow">Source status</span><h2>What a live check will use</h2></div>
                  <Link to="/map-explorer">Corridor monitor <ArrowRight size={16} /></Link>
                </div>
                <div className="transport-source-list">
                  <div>
                    <span>AG</span>
                    <div><strong>Autobahn GmbH</strong><small>Live roadworks, closures, warnings, and lorry parking · Sample until you run a check</small></div>
                    <b>Sample</b>
                  </div>
                  <div>
                    <span>SP</span>
                    <div><strong>{heroPermit.permitNumber}</strong><small>Sample GPX and vehicle dimensions from /test-permits</small></div>
                    <b>Sample</b>
                  </div>
                  <div>
                    <span>BC</span>
                    <div><strong>Bridge, clearance, Mobilithek</strong><small>Bridge/clearance stays manual. Mobilithek roadworks need registration, so they are not integrated.</small></div>
                    <b>Sample</b>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
