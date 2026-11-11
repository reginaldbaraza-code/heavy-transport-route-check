import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleX, FileJson, FileText, Map,
  Play, Route, ShieldCheck, Truck, Upload,
} from 'lucide-react'
import LazyPermitMap from '../components/LazyPermitMap'
import PageHeader from '../components/PageHeader'
import OverviewMapWithTallies from '../components/OverviewMapWithTallies'
import SourceStatusPanel from '../components/SourceStatusPanel'
import {
  defaultVehicleProfile, getRouteCheckResult, permittedRoutes,
} from '../data/routeChecks'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { formatBerlinDateTime } from '../lib/formatTime'
import { sampleTestPermits } from '../lib/routeCheck'
import {
  OVERVIEW_FEATURED_COPY,
  OVERVIEW_FEATURED_PERMIT_ID,
  getOverviewFeatured,
  getOverviewMonitorPermits,
} from '../lib/overviewTracks'
import { readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'
import { formatVehicleDims, shouldMonitorJob } from '../lib/jobs'

const DISPATCH_EXAMPLES: Array<{ routeId: string; permitId: string; daysAhead: number; hour: number }> = [
  { routeId: 'hamburg-kassel', permitId: 'hamburg-hannover', daysAhead: 1, hour: 22 },
  { routeId: 'duisburg-munich', permitId: 'munchen-stuttgart', daysAhead: 2, hour: 23 },
  { routeId: 'bremen-hannover', permitId: 'bremen-dortmund', daysAhead: 3, hour: 1 },
  { routeId: 'leipzig-nuremberg', permitId: 'leipzig-nurnberg', daysAhead: 4, hour: 0 },
]

function exampleDeparture(daysAhead: number, hour: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  date.setHours(hour, hour === 0 ? 30 : 0, 0, 0)
  return formatBerlinDateTime(date.toISOString())
}

const verdictMeta = {
  READY: { label: 'Ready', icon: CheckCircle2, iconClass: 'green', badgeClass: 'ready' },
  HOLD: { label: 'Hold departure', icon: CircleX, iconClass: 'red', badgeClass: 'hold' },
  VERIFY: { label: 'Verify evidence', icon: AlertTriangle, iconClass: 'amber', badgeClass: 'verify' },
}

type SampleMode = 'example' | 'permits'

function OverviewModeSwitch({
  mode,
  onChange,
}: {
  mode: SampleMode
  onChange: (mode: SampleMode) => void
}) {
  const demoRef = useRef<HTMLButtonElement>(null)
  const sampleRef = useRef<HTMLButtonElement>(null)

  const select = (next: SampleMode, moveFocus = false) => {
    onChange(next)
    if (moveFocus) {
      queueMicrotask(() => (next === 'example' ? demoRef : sampleRef).current?.focus())
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') select('example', true)
    else if (event.key === 'End') select('permits', true)
    else select(mode === 'example' ? 'permits' : 'example', true)
  }

  return (
    <div className="overview-mode-switch">
      <div
        className="overview-mode-toggle"
        role="tablist"
        aria-label="Overview content mode"
        aria-describedby="overview-mode-hint"
        onKeyDown={onKeyDown}
      >
        <button
          ref={demoRef}
          type="button"
          role="tab"
          id="overview-tab-demo"
          aria-selected={mode === 'example'}
          aria-controls="overview-panel-demo"
          tabIndex={mode === 'example' ? 0 : -1}
          className={mode === 'example' ? 'active' : ''}
          onClick={() => onChange('example')}
        >
          Demo dashboard
        </button>
        <button
          ref={sampleRef}
          type="button"
          role="tab"
          id="overview-tab-sample"
          aria-selected={mode === 'permits'}
          aria-controls="overview-panel-sample"
          tabIndex={mode === 'permits' ? 0 : -1}
          className={mode === 'permits' ? 'active' : ''}
          onClick={() => onChange('permits')}
        >
          Try a sample permit
        </button>
      </div>
      <p id="overview-mode-hint" className="overview-mode-hint">
        {mode === 'permits'
          ? 'Live Autobahn check — saved to your history.'
          : 'Preview only — never live, never saved.'}
      </p>
    </div>
  )
}

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

  const [selectedPermitId, setSelectedPermitId] = useState(sampleTestPermits[0].id)
  const featured = getOverviewFeatured()
  const featuredPermit = featured.permit
  const featuredVerdict = featured.verdict
  const FeaturedVerdictIcon = verdictMeta[featuredVerdict].icon
  const overviewPermits = useMemo(() => getOverviewMonitorPermits().map(item => item.permit), [])
  const heroPermit = sampleTestPermits.find(permit => permit.id === selectedPermitId) ?? sampleTestPermits[0]
  const selectedPermits = useMemo(() => [heroPermit], [heroPermit])

  return (
    <div className="market-page transport-overview">
      <PageHeader
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

      <div
        className={`overview-mode-panel ${sampleMode === 'permits' ? 'is-sample' : 'is-demo'}`}
        data-overview-mode={sampleMode === 'permits' ? 'sample' : 'demo'}
      >
        <div className="overview-mode-banner">
          <div className="overview-mode-banner-copy" role="status">
            <span className="overview-mode-badge">
              {sampleMode === 'permits' ? <FileText size={13} aria-hidden /> : <Play size={13} aria-hidden />}
              {sampleMode === 'permits' ? 'SAMPLE PERMIT' : 'DEMO'}
            </span>
            <p>
              {sampleMode === 'permits'
                ? 'Real sample permit files. Open one to run a live Autobahn check on its route; that check is saved to your history.'
                : 'A fixed preview of what monitoring looks like. Made-up routes and verdicts, never live, never saved.'}
            </p>
          </div>
          <OverviewModeSwitch mode={sampleMode} onChange={setMode} />
        </div>

        {sampleMode === 'example' ? (
          <div role="tabpanel" id="overview-panel-demo" aria-labelledby="overview-tab-demo">
            <section className="transport-readiness">
              <div className="transport-readiness-copy">
                <div className="transport-route-heading">
                  <span className="transport-icon"><Truck size={20} /></span>
                  <div>
                    <span className="market-eyebrow">Next transport · Permit {featuredPermit.permitNumber}</span>
                    <h2>{featuredPermit.origin} <ArrowRight size={18} /> {featuredPermit.destination}</h2>
                  </div>
                </div>
                <div className={`transport-status ${featuredVerdict.toLowerCase()}`}><FeaturedVerdictIcon size={18} /><div><strong>{OVERVIEW_FEATURED_COPY.title}</strong><span>{OVERVIEW_FEATURED_COPY.summary}</span></div></div>
                <div className="transport-facts">
                  <div><span>Valid</span><strong>{formatBerlinDateTime(featuredPermit.validFrom)} – {formatBerlinDateTime(featuredPermit.validUntil)}</strong></div>
                  <div><span>Load</span><strong>{featuredPermit.vehicle.grossWeight} t · {featuredPermit.vehicle.width.toFixed(2)} m wide</strong></div>
                  <div><span>Route area</span><strong>{featuredPermit.corridor} · {featuredPermit.distance}</strong></div>
                </div>
                <div className={`transport-warning verdict-${featuredVerdict.toLowerCase()}`}>
                  <FeaturedVerdictIcon size={16} />
                  <div><strong>{OVERVIEW_FEATURED_COPY.title}</strong><span>{OVERVIEW_FEATURED_COPY.impact}</span></div>
                </div>
                <Link to={`/route-checks?permit=${featuredPermit.id}`} className="transport-review-link">Review approved route <ArrowRight size={16} /></Link>
              </div>
              <div className="transport-readiness-map">
                <LazyPermitMap
                  permits={overviewPermits}
                  highlightPermitId={OVERVIEW_FEATURED_PERMIT_ID}
                  badgeTitle="Demo: 4 monitored routes"
                  badgeSubtitle="Example verdicts across Germany"
                  endpointMode="cities"
                  showLegend
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

            <OverviewMapWithTallies
              permits={overviewPermits}
              routes={permittedRoutes.map(route => {
                const result = getRouteCheckResult(route, defaultVehicleProfile)
                return {
                  id: route.id,
                  origin: route.originShort,
                  destination: route.destinationShort,
                  verdict: result.verdict,
                }
              })}
            />

            <div className="market-two-column">
              <section className="market-section">
                <div className="market-section-header compact">
                  <div><span className="market-eyebrow">Dispatch queue</span><h2>Upcoming permitted routes</h2></div>
                  <Link to="/route-checks">New route check <ArrowRight size={16} /></Link>
                </div>
                <div className="transport-route-list">
                  {permittedRoutes.map(route => {
                    const example = DISPATCH_EXAMPLES.find(item => item.routeId === route.id)
                    const permit = sampleTestPermits.find(item => item.id === example?.permitId)
                    const result = getRouteCheckResult(route, defaultVehicleProfile)
                    const meta = verdictMeta[result.verdict]
                    const VerdictIcon = meta.icon
                    const href = permit ? `/route-checks?permit=${permit.id}&run=1` : '/route-checks'
                    const when = example ? exampleDeparture(example.daysAhead, example.hour) : route.queueDeparture
                    return (
                      <Link to={href} key={route.id}>
                        <span className={`transport-list-icon ${meta.iconClass}`}><Route size={16} /></span>
                        <div>
                          <strong>{permit ? `${permit.originShort} → ${permit.destinationShort}` : `${route.originShort} → ${route.destinationShort}`}</strong>
                          <span>Example · {permit?.permitNumber || route.permitId} · Departs {when}</span>
                        </div>
                        <b className={meta.badgeClass}><VerdictIcon size={14} /> {meta.label}</b>
                        <ArrowRight size={16} />
                      </Link>
                    )
                  })}
                </div>
              </section>

              <section>
                <SourceStatusPanel
                  sources={[
                    {
                      id: 'ag',
                      name: 'Autobahn GmbH roadworks feed',
                      status: 'active',
                      lastUpdate: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                      detail: 'Lane-width restriction 3.50 m',
                    },
                    {
                      id: 'ro',
                      name: 'Road operator status feed',
                      status: 'active',
                      lastUpdate: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
                      detail: 'Work zone confirmed active',
                    },
                    {
                      id: 'vb',
                      name: 'VEMAGS profile + route check',
                      status: 'active',
                      lastUpdate: new Date().toISOString(),
                      detail: 'Vehicle clearance check · Calculated now',
                    },
                  ]}
                />
              </section>
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="overview-panel-sample" aria-labelledby="overview-tab-sample">
            <section className="transport-readiness">
              <div className="transport-readiness-copy">
                <div className="transport-route-heading">
                  <span className="transport-icon"><Truck size={20} /></span>
                  <div>
                    <span className="market-eyebrow">Sample permit · {heroPermit.permitNumber}</span>
                    <h2>{heroPermit.origin} <ArrowRight size={18} /> {heroPermit.destination}</h2>
                  </div>
                </div>
                <div className="transport-status sample">
                  <FileText size={18} />
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
                <div className="transport-warning sample">
                  <FileText size={16} />
                  <div><strong>{heroPermit.routeDescription}</strong><span>Uses the same sample file as Route Checks.</span></div>
                </div>
                <Link to={`/route-checks?permit=${heroPermit.id}`} className="transport-review-link">Run live check on this sample <ArrowRight size={16} /></Link>
              </div>
              <div className="transport-readiness-map">
                <LazyPermitMap
                  permits={selectedPermits}
                  selectedPermitId={heroPermit.id}
                  badgeTitle={heroPermit.permitNumber}
                  badgeSubtitle={`${heroPermit.originShort} → ${heroPermit.destinationShort} · ${heroPermit.corridor}`}
                  endpointMode="start-dest"
                  showLegend={false}
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
                  <div><span className="market-eyebrow">Sample permits</span><h2>Sample permits from Route Checks</h2></div>
                  <Link to="/route-checks">Open Route Checks <ArrowRight size={16} /></Link>
                </div>
                <div className="transport-route-list">
                  {sampleTestPermits.map(permit => (
                    <button
                      type="button"
                      key={permit.id}
                      className={permit.id === heroPermit.id ? 'is-selected' : ''}
                      aria-pressed={permit.id === heroPermit.id}
                      onClick={() => setSelectedPermitId(permit.id)}
                    >
                      <span className="transport-list-icon blue"><FileText size={16} /></span>
                      <div>
                        <strong>{permit.originShort} → {permit.destinationShort}</strong>
                        <span>{permit.permitNumber} · {permit.corridor} · {permit.distance}</span>
                      </div>
                      <b className="sample">Sample</b>
                      <ArrowRight size={16} />
                    </button>
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
          </div>
        )}
      </div>
    </div>
  )
}
