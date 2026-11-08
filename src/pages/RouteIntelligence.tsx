import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Camera, CheckCircle2,
  ChevronUp, CircleX, Download, FileJson, FlaskConical, Info, MapPin, Navigation,
  Radio, RefreshCw, Route, Send, ShieldCheck, Square, Upload, X,
} from 'lucide-react'
import MobilityHeatmap, { type HeatmapLayer } from '../components/MobilityHeatmap'
import { ConfirmDialog, Toast } from '../components/Feedback'
import {
  defaultVehicleProfile, formatVehicleDimensions, getPermittedRoute, getRouteCheckResult,
  getRouteEvidence, permittedRoutes, vehicleProfiles, type RouteCheckResult,
  type RouteEvidence, type VehicleProfile,
} from '../data/routeChecks'
import { useRouteMonitoring, type OnSiteOutcome } from '../context/RouteMonitoringContext'

const routeLayers = [
  { id: 'roadworks', label: 'Roadworks', unit: 'Route impact' },
  { id: 'closures', label: 'Closures', unit: 'Current status' },
  { id: 'observations', label: 'On-site observations', unit: 'Report status' },
] as HeatmapLayer[]

const verdictLabels = {
  READY: 'Ready',
  HOLD: 'Hold departure',
  VERIFY: 'Verify evidence',
}

export default function RouteIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRoute = getPermittedRoute(searchParams.get('route'))
  const [departure, setDeparture] = useState(selectedRoute.departure)
  const [activeLayer, setActiveLayer] = useState('roadworks')
  const [routeFile, setRouteFile] = useState(selectedRoute.fileName)
  const [fileValid, setFileValid] = useState(true)
  const [fileError, setFileError] = useState('')
  const [attemptedFile, setAttemptedFile] = useState('')
  const [vehicleProfileId, setVehicleProfileId] = useState(defaultVehicleProfile.id)
  const [customVehicle, setCustomVehicle] = useState({
    width: '',
    height: '',
    length: '',
    grossWeight: '',
  })
  const [checked, setChecked] = useState(true)
  const [checking, setChecking] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [simulateStale, setSimulateStale] = useState(false)
  const [simulateOutage, setSimulateOutage] = useState(false)
  const [simulateNoResponse, setSimulateNoResponse] = useState(false)
  const [manualHold, setManualHold] = useState(false)
  const [bridgeCheckedAt, setBridgeCheckedAt] = useState('')
  const [toast, setToast] = useState('')
  const [monitoring, setMonitoring] = useState(true)
  const [refreshCountdown, setRefreshCountdown] = useState(15 * 60)
  const [onSiteOpen, setOnSiteOpen] = useState(false)
  const [onSiteStatus, setOnSiteStatus] = useState<OnSiteOutcome>('Open')
  const [onSiteNote, setOnSiteNote] = useState('')
  const [onSitePhoto, setOnSitePhoto] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<'hold' | 'escalate' | null>(null)
  const [holdActionsOpen, setHoldActionsOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const checkTimer = useRef<number | null>(null)
  const {
    disruptions, onSiteReports, onSiteOutcomes, simulateNewDisruption, clearDisruption,
    addOnSiteReport,
  } = useRouteMonitoring()
  const customVehicleValid = Object.values(customVehicle).every(value => Number(value) > 0)
  const customProfile: VehicleProfile = {
    id: 'custom',
    label: 'Custom vehicle',
    width: Number(customVehicle.width) || 0,
    height: Number(customVehicle.height) || 0,
    length: Number(customVehicle.length) || 0,
    grossWeight: Number(customVehicle.grossWeight) || 0,
  }
  const vehicleProfile = vehicleProfileId === 'custom'
    ? customProfile
    : vehicleProfiles.find(profile => profile.id === vehicleProfileId) ?? defaultVehicleProfile
  const vehicleValid = vehicleProfileId !== 'custom' || customVehicleValid
  const baseResult = getRouteCheckResult(selectedRoute, vehicleProfile)
  const baseEvidence = [
    ...getRouteEvidence(selectedRoute, vehicleProfile),
    ...(onSiteReports[selectedRoute.id] ?? []),
  ]
  const newDisruption = Boolean(disruptions[selectedRoute.id])
  const onSiteOutcome = onSiteOutcomes[selectedRoute.id]
  const result: RouteCheckResult = manualHold
    ? {
        verdict: 'HOLD',
        title: 'Hold departure – unverified evidence',
        summary: 'Unverified evidence before departure.',
        impact: `No confirmation was received before the decision deadline. Selected vehicle: ${formatVehicleDimensions(vehicleProfile)}.`,
        confidence: 'Medium',
        issueCount: 1,
      }
    : newDisruption
      ? {
          verdict: 'HOLD',
          title: 'Hold departure – new closure on permitted route',
          summary: 'A new closure on the A7 overlaps the monitored departure window from 22:00 to 05:00.',
          impact: `The status changed after monitoring began. Selected vehicle: ${formatVehicleDimensions(vehicleProfile)}.`,
          confidence: 'High',
          issueCount: 1,
        }
    : simulateOutage
      ? {
          verdict: 'VERIFY',
          title: `Can't confirm route – a data source is unavailable`,
          summary: 'The roadworks source is unavailable, so the approved route cannot be fully checked.',
          impact: `Available sources were checked for ${formatVehicleDimensions(vehicleProfile)}. Retry the failed source before dispatch.`,
          confidence: 'Medium',
          issueCount: 1,
        }
      : simulateStale
        ? {
            verdict: 'VERIFY',
            title: 'Verification required – data is out of date',
            summary: 'The main roadworks source was last updated 26 h ago.',
            impact: `The selected vehicle (${formatVehicleDimensions(vehicleProfile)}) cannot be cleared using out-of-date route information.`,
            confidence: 'Medium',
            issueCount: 1,
          }
        : selectedRoute.id === 'leipzig-nuremberg' && onSiteOutcome
          ? {
              verdict: onSiteOutcome === 'Open' ? 'READY' : onSiteOutcome === 'Closed' ? 'HOLD' : 'VERIFY',
              title: onSiteOutcome === 'Open'
                ? 'Route clear – on-site confirmation received'
                : onSiteOutcome === 'Closed'
                  ? 'Hold departure – on-site closure confirmed'
                  : 'Verification required – lane partly open',
              summary: `A driver or escort confirmed the lane/road is ${onSiteOutcome.toLowerCase()}.`,
              impact: `A confirmed on-site report was added just now for ${formatVehicleDimensions(vehicleProfile)}.`,
              confidence: 'High',
              issueCount: onSiteOutcome === 'Open' ? 0 : 1,
            }
          : baseResult
  const [lastValidResult, setLastValidResult] = useState<RouteCheckResult>(baseResult)
  const displayedResult = checked ? result : lastValidResult
  const disruptionEvidence: RouteEvidence[] = newDisruption ? [{
    id: 'simulated-new-closure',
    title: 'New closure on A7 22:00–05:00',
    detail: 'A newly reported full closure blocks the monitored Hamburg–Kassel approved route.',
    source: 'National traffic management feed',
    age: 'Just now',
    confidence: 'High',
    state: 'danger',
    category: 'closures',
  }] : []
  const evidence: RouteEvidence[] = [...disruptionEvidence, ...baseEvidence].map((item, index) => {
    if (index !== 0) return item
    if (simulateOutage) {
      return {
        ...item,
        title: 'Roadworks feed unavailable',
        detail: 'This source did not respond. Other connected sources were checked successfully.',
        age: 'Unavailable',
        confidence: 'Medium',
        state: 'danger',
      }
    }
    if (simulateStale) {
      return {
        ...item,
        detail: `${item.detail} This record may no longer reflect current route conditions.`,
        age: 'Last updated 26 h ago',
        confidence: 'Medium',
        state: 'warning',
      }
    }
    return item
  })
  const sources = Array.from(new Set(evidence.map(item => item.source)))
  const layerCounts = {
    roadworks: evidence.filter(item => item.category === 'roadworks').length,
    closures: evidence.filter(item => item.category === 'closures').length,
    observations: evidence.filter(item => item.category === 'observations').length,
  }
  const layersWithCounts = routeLayers.map(layer => ({
    ...layer,
    label: `${layer.label} (${layerCounts[layer.id as keyof typeof layerCounts]})`,
  }))
  const visibleEvidence = evidence.filter(item => item.category === activeLayer)
  const mapMarkers = useMemo(() => visibleEvidence.map((item, index) => {
    const fallbackIndex = Math.min(selectedRoute.coordinates.length - 2, Math.max(1, index + 1))
    const point = selectedRoute.alert?.category === item.category && index === 0
      ? [selectedRoute.alert.lat, selectedRoute.alert.lng] as [number, number]
      : selectedRoute.coordinates[fallbackIndex]
    return {
      lat: point[0],
      lng: point[1],
      title: item.title,
      detail: `${item.source} · ${item.age}`,
      severity: displayedResult.verdict,
      category: item.category,
    }
  }), [displayedResult.verdict, selectedRoute, visibleEvidence])

  useEffect(() => () => {
    if (checkTimer.current) window.clearTimeout(checkTimer.current)
  }, [])

  useEffect(() => {
    if (!monitoring || !checked || checking) return
    const timer = window.setInterval(() => {
      setRefreshCountdown(current => current > 0 ? current - 1 : 15 * 60)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [checked, checking, monitoring])

  useEffect(() => {
    setDeparture(selectedRoute.departure)
    setActiveLayer('roadworks')
    setRouteFile(selectedRoute.fileName)
    setFileValid(true)
    setFileError('')
    setAttemptedFile('')
    setChecked(true)
    setChecking(false)
    setReviewOpen(false)
    setVerificationRequested(false)
    setManualHold(false)
    setBridgeCheckedAt('')
    setMonitoring(true)
    setRefreshCountdown(15 * 60)
    setOnSiteOpen(false)
    setPendingDecision(null)
    setHoldActionsOpen(false)
    if (checkTimer.current) window.clearTimeout(checkTimer.current)
  }, [selectedRoute])

  useEffect(() => {
    if (checked && !checking) setLastValidResult(result)
  }, [checked, checking, result.confidence, result.impact, result.issueCount, result.summary, result.title, result.verdict])

  const runCheck = () => {
    if (!routeFile || !fileValid || !vehicleValid || checking) return
    if (checkTimer.current) window.clearTimeout(checkTimer.current)
    setChecking(true)
    setChecked(false)
    checkTimer.current = window.setTimeout(() => {
      setChecking(false)
      setChecked(true)
      setMonitoring(true)
      setRefreshCountdown(15 * 60)
      checkTimer.current = null
    }, 1500)
  }

  const selectRoute = (routeId: string) => {
    setSearchParams({ route: routeId })
  }

  const useSamplePermit = () => {
    setRouteFile(selectedRoute.fileName)
    setFileValid(true)
    setFileError('')
    setAttemptedFile('')
    setChecked(false)
  }

  const updateCustomVehicle = (field: keyof typeof customVehicle, value: string) => {
    setCustomVehicle(current => ({ ...current, [field]: value }))
    setChecked(false)
    setManualHold(false)
  }

  const submitOnSiteReport = () => {
    addOnSiteReport(selectedRoute.id, onSiteStatus, onSiteNote, onSitePhoto || undefined)
    setOnSiteOpen(false)
    setOnSiteNote('')
    setOnSitePhoto('')
    setVerificationRequested(false)
    setToast(`On-site report saved. The lane or road is ${onSiteStatus.toLowerCase()}.`)
  }

  const countdownLabel = `${Math.floor(refreshCountdown / 60).toString().padStart(2, '0')}:${(refreshCountdown % 60).toString().padStart(2, '0')}`
  const VerdictIcon = result.verdict === 'READY' ? CheckCircle2 : result.verdict === 'HOLD' ? CircleX : AlertTriangle
  const BannerVerdictIcon = displayedResult.verdict === 'READY' ? CheckCircle2 : displayedResult.verdict === 'HOLD' ? CircleX : AlertTriangle
  const verdictSentence = displayedResult.verdict === 'READY'
    ? 'Safe to depart'
    : displayedResult.verdict === 'HOLD'
      ? selectedRoute.id === 'duisburg-munich' && !newDisruption && !manualHold
        ? 'Do not depart – vehicle is too wide'
        : manualHold
          ? 'Do not depart – confirmation is missing'
          : 'Do not depart – closure on route'
      : `Check ${displayedResult.issueCount || 1} item before departure`
  const verdictActionLabel = displayedResult.verdict === 'READY'
    ? 'View route details'
    : displayedResult.verdict === 'HOLD'
      ? 'Take action'
      : simulateOutage
        ? 'Try source again'
        : simulateStale
          ? 'Request fresh data'
          : 'Confirm on site'

  const showRouteDetails = () => {
    setReviewOpen(true)
    window.requestAnimationFrame(() => document.getElementById('route-check-details')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }))
  }

  const handleVerdictAction = () => {
    if (displayedResult.verdict === 'HOLD') {
      setHoldActionsOpen(true)
      return
    }
    if (displayedResult.verdict !== 'VERIFY') {
      showRouteDetails()
      return
    }
    if (simulateOutage) {
      setToast('Trying the roadworks source again.')
      runCheck()
      return
    }
    if (simulateStale) {
      setVerificationRequested(true)
      setToast('Fresh route information requested.')
      return
    }
    setOnSiteOpen(true)
  }
  const routeLegendLabel = selectedRoute.id === 'duisburg-munich' && displayedResult.verdict === 'READY'
    ? 'Fits – no action needed'
    : displayedResult.verdict === 'HOLD'
      ? newDisruption ? 'New closure – do not depart' : 'Blocking issue'
      : displayedResult.verdict === 'VERIFY'
        ? 'Verification required'
        : 'Checked – no action needed'

  const evidenceNextStep = (item: RouteEvidence) => {
    if (item.state === 'clear') return 'Next: No action needed.'
    if (item.title.toLowerCase().includes('unavailable')) return 'Next: Try this source again before departure.'
    if (item.state === 'conflict') return 'Next: Confirm the lane status on site.'
    if (item.category === 'closures') return 'Next: Keep the transport on hold and call the permit office.'
    return 'Next: Confirm vehicle clearance before departure.'
  }

  return (
    <div className="route-page">
      <div className="route-header">
        <div>
          <Link to="/" className="route-back"><ArrowLeft size={16} /> Operations overview</Link>
          <h1>Check a permitted route</h1>
          <p>Check the exact approved route before departure and monitor it for short-notice changes.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setExportOpen(true)}>
          <Download size={16} /> Export check
        </button>
      </div>

      <div className="permit-scope-note">
        <ShieldCheck size={20} />
        <div>
          <strong>This tool does not calculate a new route.</strong>
          <span>Heavy transports may only use the route approved in their permit. We check and monitor that exact route.</span>
        </div>
      </div>

      {checking ? (
        <section className="dispatcher-verdict-banner checking" aria-live="polite">
          <span className="dispatcher-verdict-icon"><RefreshCw size={28} className="spin" /></span>
          <div>
            <span>Route check in progress</span>
            <h2>Checking {sources.length} sources…</h2>
            <p>Comparing the approved route, departure time, and vehicle measurements.</p>
          </div>
        </section>
      ) : (
        <section className={`dispatcher-verdict-banner ${displayedResult.verdict.toLowerCase()}`} aria-live="polite">
          <span className="dispatcher-verdict-icon"><BannerVerdictIcon size={30} /></span>
          <div>
            <span>{verdictLabels[displayedResult.verdict]}</span>
            <h2>{verdictSentence}</h2>
            <p>{displayedResult.summary}</p>
            {!checked && <small className="stale-verdict-note">Re-check to update</small>}
          </div>
          <button type="button" onClick={handleVerdictAction}>
            {displayedResult.verdict === 'VERIFY' ? <MapPin size={18} /> : <ArrowRight size={18} />}
            {verdictActionLabel}
          </button>
        </section>
      )}

      <div className="route-workspace">
        <aside className="route-planner">
          <div className="route-panel-heading">
            <span className="eyebrow">Permit route</span>
            <h2>Select permitted route</h2>
          </div>
          <label>
            <span>Route and permit</span>
            <select
              value={selectedRoute.id}
              title={`${selectedRoute.origin} to ${selectedRoute.destination} · ${selectedRoute.permitId}`}
              onChange={event => selectRoute(event.target.value)}
            >
              {permittedRoutes.map(route => (
                <option
                  value={route.id}
                  key={route.id}
                  title={`${route.origin} to ${route.destination} · ${route.permitId}`}
                >
                  {route.originShort} → {route.destinationShort} · {route.permitId}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInput}
            className="permit-file-input"
            type="file"
            accept=".pdf,.xml,.gpx,application/pdf,application/xml,text/xml,application/gpx+xml"
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) {
                const name = file.name.toLowerCase()
                const valid = name.includes('permit') || name.endsWith('.gpx') || name.endsWith('.xml')
                setAttemptedFile(file.name)
                if (valid) {
                  setRouteFile(file.name)
                  setFileValid(true)
                  setFileError('')
                  setChecked(false)
                } else {
                  setFileValid(false)
                  setFileError(`We couldn't read this permit file. Upload a VEMAGS permit export (PDF/XML) or a GPX route.`)
                  setChecked(false)
                }
                event.target.value = ''
              }
            }}
          />
          <button type="button" className={`permit-upload ${fileError ? 'invalid' : ''}`} onClick={() => fileInput.current?.click()}>
            {routeFile ? <FileJson size={20} /> : <Upload size={20} />}
            <span>
              <strong>{fileError ? attemptedFile : routeFile || 'Select route file'}</strong>
              <small>{fileError ? 'File could not be read' : 'PDF, XML, or GPX · exact approved route'}</small>
            </span>
            <b>{routeFile ? 'Replace' : 'Browse'}</b>
          </button>
          {fileError && (
            <div className="permit-upload-error" role="alert">
              <AlertTriangle size={18} />
              <p><strong>{fileError}</strong><span>The previously selected route has not been changed.</span></p>
              <div>
                <button type="button" onClick={() => fileInput.current?.click()}>Try again</button>
                <button type="button" onClick={useSamplePermit}>Use sample permit</button>
              </div>
            </div>
          )}
          <div className="permit-route-summary">
            <div><MapPin size={16} /><span>Origin</span><strong>{selectedRoute.origin}</strong></div>
            <ArrowRight size={16} />
            <div><Navigation size={16} /><span>Destination</span><strong>{selectedRoute.destination}</strong></div>
          </div>
          <label>
            <span>Planned departure</span>
            <div><CalendarClock size={16} /><input value={departure} onChange={event => setDeparture(event.target.value)} /></div>
            <small className="field-helper">Use DD.MM.YYYY and 24-hour time (Europe/Berlin).</small>
          </label>
          <label>
            <span>Approved transport profile</span>
            <select value={vehicleProfileId} onChange={event => {
              setVehicleProfileId(event.target.value)
              setChecked(event.target.value !== 'custom')
              setManualHold(false)
            }}>
              {vehicleProfiles.map(profile => (
                <option value={profile.id} key={profile.id}>
                  {profile.label} · {formatVehicleDimensions(profile)}
                </option>
              ))}
              <option value="custom">Custom vehicle</option>
            </select>
            <small className="field-helper">Use the measurements approved in the transport permit.</small>
          </label>
          {vehicleProfileId === 'custom' ? (
            <div className="custom-vehicle-fields">
              {([
                ['width', 'Width', 'm'],
                ['height', 'Height', 'm'],
                ['length', 'Length', 'm'],
                ['grossWeight', 'Gross weight', 't'],
              ] as const).map(([field, label, unit]) => {
                const invalid = Number(customVehicle[field]) <= 0
                return (
                  <label key={field}>
                    <span>{label}</span>
                    <div className={invalid ? 'invalid' : ''}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customVehicle[field]}
                        onChange={event => updateCustomVehicle(field, event.target.value)}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `${field}-error` : undefined}
                      />
                      <b>{unit}</b>
                    </div>
                    {invalid
                      ? <small id={`${field}-error`}>Enter a value greater than 0 {unit}.</small>
                      : <small className="field-helper">Approved permit value in {unit}.</small>}
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="vehicle-profile-facts">
              <div><span>Width</span><strong>{vehicleProfile.width.toFixed(2)} m</strong></div>
              <div><span>Height</span><strong>{vehicleProfile.height.toFixed(2)} m</strong></div>
              <div><span>Length</span><strong>{vehicleProfile.length.toFixed(1)} m</strong></div>
              <div><span>Gross weight</span><strong>{vehicleProfile.grossWeight} t</strong></div>
            </div>
          )}
          <button type="button" className="primary-button route-plan-button" onClick={runCheck} disabled={!routeFile || !fileValid || !vehicleValid || checking}>
            {checking ? <RefreshCw size={16} className="spin" /> : <Route size={16} />}
            {checking ? `Checking ${sources.length} sources…` : 'Check route'}
          </button>
          {!vehicleValid && <p className="route-check-hint">Enter all vehicle dimensions to run the check</p>}

          <div className="route-source-note">
            <ShieldCheck size={16} />
            <p><strong>Permit remains authoritative</strong><span>The check supports dispatch decisions. It does not replace VEMAGS or authority approval.</span></p>
          </div>
        </aside>

        <main className="route-map-panel">
          <MobilityHeatmap
            mode="transport"
            layers={layersWithCounts}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showRoute={Boolean(routeFile)}
            routeCoordinates={selectedRoute.coordinates}
            routeOrigin={selectedRoute.originShort}
            routeDestination={selectedRoute.destinationShort}
            routePermitId={selectedRoute.permitId}
            routeCorridor={selectedRoute.corridor}
            routeMarkers={mapMarkers}
            routeLegendLabel={routeLegendLabel}
            emptyLayerMessage={visibleEvidence.length ? undefined : 'Nothing on this layer for this route'}
          />
          {checking && (
            <div className="route-checking-state" role="status" aria-live="polite">
              <RefreshCw size={22} className="spin" />
              <div><strong>Checking {sources.length} sources…</strong><span>Comparing the approved route, departure time, and selected vehicle measurements.</span></div>
            </div>
          )}
          {checked && !checking && (
            <div className="route-result" id="route-check-details">
              <div className="route-result-top">
                <div>
                  <span className="eyebrow">Route check details</span>
                  <h2>{selectedRoute.origin} <ArrowRight size={18} /> {selectedRoute.destination}</h2>
                </div>
              </div>
              <div className="route-stat-grid">
                <div><span>Permitted distance</span><strong>{selectedRoute.distance}</strong></div>
                <div><span>Route area</span><strong>{selectedRoute.corridor}</strong></div>
                <div><span>Data checked</span><strong>Updated {selectedRoute.lastUpdated.replace(' ago', ' ago').replace('Updated ', '')}</strong></div>
              </div>
              <div className="route-detail-summary">
                <div>
                  <strong>Why this result?</strong>
                  <span>{result.impact}</span>
                </div>
                <button type="button" onClick={() => setReviewOpen(current => !current)} aria-expanded={reviewOpen}>
                  {reviewOpen ? 'Hide details' : 'Show details'}
                </button>
              </div>
              {reviewOpen && (
                <div className="route-alert-detail">
                  <div className="verification-heading">
                    <div><strong>Information checked</strong><span>We checked how recent each report is and whether it affects this vehicle.</span></div>
                    <span className={`verification-confidence ${result.confidence.toLowerCase()}`}>
                      {result.confidence === 'High' ? 'Confirmed sources' : 'Unconfirmed report'}
                    </span>
                  </div>
                  <div className="verification-evidence">
                    {visibleEvidence.map(item => (
                      <div className={`evidence-${item.state}`} key={item.id}>
                        <span>{item.source}</span>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        <small>{item.age} · {item.confidence === 'High' ? 'Confirmed source' : 'Unconfirmed report'}</small>
                        <b className="evidence-next-step">{evidenceNextStep(item)}</b>
                      </div>
                    ))}
                    {!visibleEvidence.length && (
                      <div className="layer-evidence-empty">
                        <Info size={18} />
                        <strong>No reports in this view</strong>
                        <span>The route is still being monitored. Check roadworks for the latest route information.</span>
                        <button type="button" onClick={() => setActiveLayer('roadworks')}>Show roadworks</button>
                      </div>
                    )}
                    <div className={`bridge-evidence-row ${bridgeCheckedAt ? 'checked' : ''}`}>
                      <Info size={18} />
                      <p>
                        <strong>Bridge and clearance limits</strong>
                        <span>Live data does not cover these limits. Compare them with the permit before departure.</span>
                      </p>
                      {bridgeCheckedAt
                        ? <span><CheckCircle2 size={16} /> Checked at {bridgeCheckedAt}</span>
                        : <button type="button" onClick={() => setBridgeCheckedAt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()))}>Mark as checked</button>}
                    </div>
                  </div>
                  {result.verdict === 'VERIFY' && (
                    <div className="verification-action">
                      {simulateOutage ? (
                        <>
                          <p><strong>The roadworks source did not respond.</strong><span>The other sources were checked. Try this source again before departure.</span></p>
                          <button type="button" onClick={() => {
                            setToast('Trying the roadworks source again.')
                            runCheck()
                          }}><RefreshCw size={16} /> Try again</button>
                        </>
                      ) : (
                        <>
                          <p>
                            <strong>{simulateStale ? 'Request current route information.' : 'Check the lane before departure.'}</strong>
                            <span>{simulateStale ? 'The main source is too old to support a safe departure decision.' : 'Ask a trusted driver or escort near the affected area to confirm the current status.'}</span>
                          </p>
                          <div className="verification-action-buttons">
                            <button
                              type="button"
                              className={verificationRequested ? 'requested' : ''}
                              onClick={() => {
                                setVerificationRequested(true)
                                if (simulateStale) setToast('Fresh route information requested.')
                              }}
                              disabled={verificationRequested}
                            >
                              {verificationRequested ? <Radio size={16} /> : <Send size={16} />}
                              {verificationRequested ? 'Request sent' : simulateStale ? 'Request fresh data' : 'Request on-site check'}
                            </button>
                            <button type="button" className="secondary" onClick={() => setOnSiteOpen(true)}>
                              <MapPin size={16} /> Confirm on site
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {verificationRequested && (
                    <div className="verification-confirmation" role="status">
                      <ShieldCheck size={16} />
                      <span><strong>Request sent to 8 nearby participants.</strong> You will be notified when a trusted observation is submitted.</span>
                    </div>
                  )}
                </div>
              )}
              {result.verdict === 'VERIFY' && verificationRequested && simulateNoResponse && (
                <div className="no-response-banner" role="alert">
                  <AlertTriangle size={20} />
                  <div><strong>No confirmation received – departure in 45 min.</strong><span>Escalate to transport manager?</span></div>
                  <button type="button" onClick={() => setPendingDecision('escalate')}>Escalate</button>
                  <button type="button" className="danger" onClick={() => setPendingDecision('hold')}>Hold departure</button>
                </div>
              )}
              <div className={`route-monitoring-bar ${monitoring ? 'active' : 'stopped'}`}>
                <Radio size={18} />
                <div>
                  <strong>{monitoring ? 'Monitoring until departure' : 'Monitoring stopped'}</strong>
                  <span>{monitoring ? `Next refresh in ${countdownLabel} · departure ${departure}` : 'No automatic route refreshes are running.'}</span>
                </div>
                {monitoring
                  ? <button type="button" onClick={() => { setMonitoring(false); setToast('Monitoring stopped. Select Resume monitoring to undo.') }}><Square size={15} /> Stop monitoring</button>
                  : <button type="button" onClick={() => { setMonitoring(true); setRefreshCountdown(15 * 60); setToast('Monitoring resumed.') }}><Radio size={15} /> Resume monitoring</button>}
              </div>
              <div className="route-provenance">
                <span>Sources</span>
                {sources.map(source => <b key={source}>{source}</b>)}
                <small>{monitoring ? `Continuous monitoring active until ${departure}` : 'Monitoring stopped'}</small>
              </div>
              <div className="monitoring-timeline" aria-label="Route monitoring progress">
                <div className="complete"><span><FileJson size={16} /></span><p><strong>Route imported</strong><small>{selectedRoute.permitId}</small></p></div>
                <i />
                <div className="complete"><span><Route size={16} /></span><p><strong>Route checked</strong><small>{result.issueCount ? `${result.issueCount} issue detected` : 'No blocking issues'}</small></p></div>
                <i />
                <div className={monitoring ? 'active' : ''}><span><Radio size={16} /></span><p><strong>{monitoring ? 'Monitoring live' : 'Monitoring stopped'}</strong><small>{monitoring ? `${evidence.length} sources connected` : 'Automatic refresh disabled'}</small></p></div>
                <i />
                <div className={result.verdict === 'READY' ? 'complete' : ''}><span><ShieldCheck size={16} /></span><p><strong>Dispatch decision</strong><small>{result.title}</small></p></div>
              </div>
            </div>
          )}
        </main>
      </div>
      <aside className={`demo-controls ${demoOpen ? 'open' : ''}`} aria-label="Test scenarios">
        <button type="button" className="demo-controls-trigger" onClick={() => setDemoOpen(current => !current)} aria-expanded={demoOpen}>
          <FlaskConical size={18} />
          <span><strong>Test scenarios</strong><small>Demo controls</small></span>
          <ChevronUp size={17} />
        </button>
        {demoOpen && (
          <div className="demo-controls-body">
            <p>Moderated-test controls</p>
            <label>
              <span><strong>Simulate stale data</strong><small>Main source is 26 h old</small></span>
              <input type="checkbox" checked={simulateStale} onChange={event => {
                setSimulateStale(event.target.checked)
                if (event.target.checked) setSimulateOutage(false)
                setManualHold(false)
                setVerificationRequested(false)
              }} />
            </label>
            <label>
              <span><strong>Simulate source outage</strong><small>Roadworks feed unavailable</small></span>
              <input type="checkbox" checked={simulateOutage} onChange={event => {
                setSimulateOutage(event.target.checked)
                if (event.target.checked) setSimulateStale(false)
                setManualHold(false)
                setVerificationRequested(false)
              }} />
            </label>
            <label>
              <span><strong>Simulate no response</strong><small>After a verification request</small></span>
              <input type="checkbox" checked={simulateNoResponse} onChange={event => {
                setSimulateNoResponse(event.target.checked)
                setManualHold(false)
              }} />
            </label>
            <label className={selectedRoute.id !== 'hamburg-kassel' ? 'disabled' : ''}>
              <span><strong>Simulate new disruption</strong><small>{selectedRoute.id === 'hamburg-kassel' ? 'New A7 closure during monitoring' : 'Available for Hamburg → Kassel'}</small></span>
              <input
                type="checkbox"
                disabled={selectedRoute.id !== 'hamburg-kassel'}
                checked={newDisruption}
                onChange={event => {
                  if (event.target.checked) {
                    simulateNewDisruption(selectedRoute.id)
                    setActiveLayer('closures')
                    setToast('Route changed to Hold. Do not depart.')
                  } else {
                    clearDisruption(selectedRoute.id)
                  }
                }}
              />
            </label>
            {(simulateStale || simulateOutage || simulateNoResponse || manualHold || newDisruption) && (
              <button type="button" className="demo-reset" onClick={() => {
                setSimulateStale(false)
                setSimulateOutage(false)
                setSimulateNoResponse(false)
                setManualHold(false)
                setVerificationRequested(false)
                clearDisruption(selectedRoute.id)
              }}>Reset scenarios</button>
            )}
          </div>
        )}
      </aside>
      {onSiteOpen && (
        <div className="route-sheet-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setOnSiteOpen(false)}>
          <section className="route-sheet" role="dialog" aria-modal="true" aria-labelledby="onsite-title">
            <header>
              <div><span><MapPin size={19} /></span><div><h2 id="onsite-title">Confirm on site</h2><p>Add a current report from the driver or escort at the affected location.</p></div></div>
              <button type="button" onClick={() => setOnSiteOpen(false)} aria-label="Close on-site confirmation"><X size={18} /></button>
            </header>
            <div className="route-sheet-body">
              <fieldset>
                <legend>Is the lane/road open?</legend>
                <div className="onsite-status-options">
                  {(['Open', 'Closed', 'Partly'] as OnSiteOutcome[]).map(status => (
                    <button type="button" key={status} className={onSiteStatus === status ? 'selected' : ''} onClick={() => setOnSiteStatus(status)}>
                      {status}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="onsite-photo">
                <span>Photo <small>Optional</small></span>
                <div><Camera size={18} /><strong>{onSitePhoto || 'Add a photo from the location'}</strong><input type="file" accept="image/*" onChange={event => setOnSitePhoto(event.target.files?.[0]?.name ?? '')} /></div>
              </label>
              <label className="onsite-note">
                <span>Note <small>Optional</small></span>
                <textarea rows={3} value={onSiteNote} onChange={event => setOnSiteNote(event.target.value)} placeholder="Add lane position, barrier status, or other useful context…" />
              </label>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setOnSiteOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={submitOnSiteReport}>Submit confirmation</button>
            </footer>
          </section>
        </div>
      )}
      {exportOpen && (
        <div className="route-sheet-backdrop export-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setExportOpen(false)}>
          <section className="route-export" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <header>
              <div><span className="eyebrow">RheinLift Logistics · Route-check summary</span><h2 id="export-title">{selectedRoute.originShort} → {selectedRoute.destinationShort}</h2><p>{selectedRoute.permitId} · {selectedRoute.corridor} · {departure}</p></div>
              <span className={`route-verdict ${result.verdict.toLowerCase()}`}><VerdictIcon size={16} /> {verdictLabels[result.verdict]}</span>
            </header>
            <div className="route-export-body">
              <section>
                <h3>{result.title}</h3>
                <p>{result.summary}</p>
                <small>{result.impact}</small>
              </section>
              <div className="route-export-facts">
                <div><span>Vehicle</span><strong>{formatVehicleDimensions(vehicleProfile)}</strong></div>
                <div><span>Approved route</span><strong>{selectedRoute.distance} · {selectedRoute.corridor}</strong></div>
                <div><span>Generated</span><strong>{new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}</strong></div>
              </div>
              <section>
                <h3>Evidence reviewed</h3>
                <div className="route-export-evidence">
                  {evidence.map(item => <div key={item.id}><strong>{item.title}</strong><span>{item.source} · {item.age} · {item.confidence === 'High' ? 'Confirmed source' : 'Unconfirmed report'}</span></div>)}
                </div>
              </section>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setExportOpen(false)}>Close</button>
              <button type="button" className="primary-button" onClick={() => window.print()}><Download size={16} /> Download PDF</button>
            </footer>
          </section>
        </div>
      )}
      {holdActionsOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setHoldActionsOpen(false)}>
          <section className="hold-action-dialog" role="dialog" aria-modal="true" aria-labelledby="hold-actions-title">
            <div>
              <span><CircleX size={20} /></span>
              <div>
                <h2 id="hold-actions-title">Take action on this Hold verdict</h2>
                <p>Review the issue, notify the transport manager, or place the departure on hold.</p>
              </div>
            </div>
            <div className="hold-action-dialog-buttons">
              <button type="button" onClick={() => { setHoldActionsOpen(false); showRouteDetails() }}>Review issue</button>
              <button type="button" onClick={() => { setHoldActionsOpen(false); setPendingDecision('escalate') }}>Escalate</button>
              <button type="button" className="danger" onClick={() => { setHoldActionsOpen(false); setPendingDecision('hold') }}>Hold departure</button>
            </div>
            <button type="button" className="hold-action-cancel" onClick={() => setHoldActionsOpen(false)}>Cancel</button>
          </section>
        </div>
      )}
      {pendingDecision === 'escalate' && (
        <ConfirmDialog
          title="Escalate to the transport manager?"
          description="The manager will be told that the route is still unconfirmed and needs a departure decision."
          confirmLabel="Confirm escalation"
          onCancel={() => setPendingDecision(null)}
          onConfirm={() => {
            setPendingDecision(null)
            setToast('Transport manager notified.')
          }}
        />
      )}
      {pendingDecision === 'hold' && (
        <ConfirmDialog
          title="Place this departure on hold?"
          description="Dispatch will show Do not depart until the route is checked again or new information is received."
          confirmLabel="Confirm hold"
          destructive
          onCancel={() => setPendingDecision(null)}
          onConfirm={() => {
            setPendingDecision(null)
            setManualHold(true)
            setToast('Departure is on hold. Do not depart.')
          }}
        />
      )}
      {toast && <Toast message={toast} tone="info" onClose={() => setToast('')} />}
    </div>
  )
}
