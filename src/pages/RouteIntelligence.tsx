import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ChevronUp,
  CircleX, Download, FileJson, FlaskConical, MapPin, RefreshCw, Route, ShieldCheck, Upload, X,
} from 'lucide-react'
import RouteMapGL from '../components/RouteMapGL'
import { Toast } from '../components/Feedback'
import { checkRoute, loadTestPermit, readFileAsText, testPermits, type RouteCheckResult } from '../lib/routeCheck'
import type { RouteEvidence } from '../data/routeChecks'

const routeLayers = [
  { id: 'roadworks', label: 'Roadworks' },
  { id: 'closures', label: 'Closures' },
  { id: 'observations', label: 'Observations' },
]

const verdictLabels = {
  READY: 'Ready',
  HOLD: 'Hold departure',
  VERIFY: 'Verify evidence',
}

export default function RouteIntelligenceNew() {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<RouteCheckResult | null>(null)
  const [activeLayer, setActiveLayer] = useState('roadworks')
  const [vehicleWidth, setVehicleWidth] = useState('3.2')
  const [vehicleHeight, setVehicleHeight] = useState('4.5')
  const [vehicleLength, setVehicleLength] = useState('28.5')
  const [vehicleWeight, setVehicleWeight] = useState('60')
  const [departure, setDeparture] = useState('10.11.2026, 22:00')
  const [permitNumber, setPermitNumber] = useState('')
  const [routeFile, setRouteFile] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [selectedTestPermit, setSelectedTestPermit] = useState('')
  const [testPermitOpen, setTestPermitOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const vehicle = {
    width: parseFloat(vehicleWidth) || 0,
    height: parseFloat(vehicleHeight) || 0,
    length: parseFloat(vehicleLength) || 0,
    grossWeight: parseFloat(vehicleWeight) || 0,
  }

  const vehicleValid = vehicle.width > 0 && vehicle.height > 0 && vehicle.length > 0 && vehicle.grossWeight > 0

  const runCheck = async (gpxContent: string, metadata?: any) => {
    if (!vehicleValid || checking) return

    setChecking(true)
    setError('')
    
    try {
      if (metadata) {
        setPermitNumber(metadata.permitNumber || '')
        setDeparture(new Date(metadata.validFrom).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }))
        setVehicleWidth(metadata.vehicle.width.toString())
        setVehicleHeight(metadata.vehicle.height.toString())
        setVehicleLength(metadata.vehicle.length.toString())
        setVehicleWeight(metadata.vehicle.grossWeight.toString())
      }

      const checkResult = await checkRoute(gpxContent, vehicle, permitNumber)
      setResult(checkResult)
      setActiveLayer('roadworks')
      setToast(`Route check complete: ${verdictLabels[checkResult.verdict]}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check route'
      setError(errorMsg)
      setToast('Route check failed')
      console.error('Route check error:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleTestPermitSelect = async (permitId: string) => {
    const permit = testPermits.find(p => p.id === permitId)
    if (!permit) return

    setSelectedTestPermit(permitId)
    setRouteFile(permit.name.split('·')[0].trim())
    setTestPermitOpen(false)
    setError('')

    try {
      const { gpxContent, metadata } = await loadTestPermit(permit)
      await runCheck(gpxContent, metadata)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load test permit'
      setError(errorMsg)
      setToast('Failed to load test permit')
    }
  }

  const handleFileUpload = async (file: File) => {
    setRouteFile(file.name)
    setSelectedTestPermit('')
    setError('')

    try {
      const gpxContent = await readFileAsText(file)
      await runCheck(gpxContent)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to read uploaded file'
      setError(errorMsg)
      setToast('Failed to read file')
    }
  }

  const VerdictIcon = result?.verdict === 'READY' ? CheckCircle2 
    : result?.verdict === 'HOLD' ? CircleX 
    : AlertTriangle

  const visibleEvidence = result?.evidence.filter(e => e.category === activeLayer) || []

  return (
    <div className="route-page">
      <div className="route-header">
        <div>
          <Link to="/" className="route-back"><ArrowLeft size={16} /> Operations overview</Link>
          <h1>Check a permitted route</h1>
          <p>Check the exact approved route before departure and monitor it for short-notice changes.</p>
        </div>
      </div>

      <div className="permit-scope-note">
        <ShieldCheck size={20} />
        <div>
          <strong>This tool does not calculate a new route.</strong>
          <span>Heavy transports may only use the route approved in their permit. We check and monitor that exact route.</span>
        </div>
      </div>

      {checking && (
        <section className="dispatcher-verdict-banner checking" aria-live="polite">
          <span className="dispatcher-verdict-icon"><RefreshCw size={28} className="spin" /></span>
          <div>
            <span>Route check in progress</span>
            <h2>Checking live Autobahn data…</h2>
            <p>Comparing the approved route, departure time, and vehicle measurements against live roadworks and closures.</p>
          </div>
        </section>
      )}

      {result && !checking && (
        <section className={`dispatcher-verdict-banner ${result.verdict.toLowerCase()}`} aria-live="polite">
          <span className="dispatcher-verdict-icon"><VerdictIcon size={30} /></span>
          <div>
            <span>{verdictLabels[result.verdict]}</span>
            <h2>{result.title}</h2>
            <p>{result.summary}</p>
            {result.degraded && <small className="stale-verdict-note">Data source unavailable</small>}
          </div>
        </section>
      )}

      <div className="route-workspace">
        <aside className="route-planner">
          <div className="route-panel-heading">
            <span className="eyebrow">Permit route</span>
            <h2>Import route</h2>
          </div>

          <input
            ref={fileInput}
            className="permit-file-input"
            type="file"
            accept=".gpx,application/gpx+xml,text/xml"
            onChange={event => {
              const file = event.target.files?.[0]
              if (file) {
                handleFileUpload(file)
                event.target.value = ''
              }
            }}
          />

          <button
            type="button"
            className={`permit-upload ${error ? 'invalid' : ''}`}
            onClick={() => fileInput.current?.click()}
          >
            {routeFile ? <FileJson size={20} /> : <Upload size={20} />}
            <span>
              <strong>{routeFile || 'Select route file'}</strong>
              <small>{error || 'GPX file · exact approved route'}</small>
            </span>
            <b>{routeFile ? 'Replace' : 'Browse'}</b>
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setTestPermitOpen(true)}
            style={{ marginTop: '8px' }}
          >
            <FlaskConical size={16} />
            Select test permit
          </button>

          {result && (
            <div className="permit-route-summary">
              <div><MapPin size={16} /><span>Origin</span><strong>{result.route.origin}</strong></div>
              <ArrowRight size={16} />
              <div><MapPin size={16} /><span>Destination</span><strong>{result.route.destination}</strong></div>
            </div>
          )}

          <label>
            <span>Planned departure</span>
            <div><CalendarClock size={16} /><input value={departure} onChange={e => setDeparture(e.target.value)} /></div>
            <small className="field-helper">Use DD.MM.YYYY and 24-hour time (Europe/Berlin).</small>
          </label>

          {permitNumber && (
            <label>
              <span>Permit number</span>
              <input value={permitNumber} onChange={e => setPermitNumber(e.target.value)} />
            </label>
          )}

          <div className="route-panel-heading" style={{ marginTop: '20px' }}>
            <span className="eyebrow">Vehicle profile</span>
            <h2>Approved dimensions</h2>
          </div>

          <div className="custom-vehicle-fields">
            {[
              ['width', 'Width', 'm', vehicleWidth, setVehicleWidth],
              ['height', 'Height', 'm', vehicleHeight, setVehicleHeight],
              ['length', 'Length', 'm', vehicleLength, setVehicleLength],
              ['grossWeight', 'Gross weight', 't', vehicleWeight, setVehicleWeight],
            ].map(([field, label, unit, value, setValue]) => {
              const invalid = parseFloat(value as string) <= 0
              return (
                <label key={field as string}>
                  <span>{label}</span>
                  <div className={invalid ? 'invalid' : ''}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={value as string}
                      onChange={e => (setValue as (v: string) => void)(e.target.value)}
                    />
                    <b>{unit}</b>
                  </div>
                  {invalid && <small>Enter a value greater than 0 {unit}.</small>}
                </label>
              )
            })}
          </div>

          <div className="route-source-note">
            <ShieldCheck size={16} />
            <p><strong>Permit remains authoritative</strong><span>The check supports dispatch decisions. It does not replace VEMAGS or authority approval.</span></p>
          </div>
        </aside>

        <main className="route-map-panel">
          {result ? (
            <RouteMapGL
              coordinates={result.route.coordinates}
              origin={result.route.origin}
              destination={result.route.destination}
              evidence={result.evidence}
              verdict={result.verdict}
              activeLayer={activeLayer}
              layers={routeLayers}
              onLayerChange={setActiveLayer}
            />
          ) : (
            <div className="route-map-placeholder">
              <Route size={48} />
              <h3>No route loaded</h3>
              <p>Upload a GPX file or select a test permit to begin the route check.</p>
            </div>
          )}

          {result && !checking && (
            <div className="route-result" id="route-check-details" style={{ marginTop: '20px' }}>
              <div className="route-result-top">
                <div>
                  <span className="eyebrow">Route check details</span>
                  <h2>{result.route.origin} <ArrowRight size={18} /> {result.route.destination}</h2>
                </div>
              </div>
              <div className="route-stat-grid">
                <div><span>Permitted distance</span><strong>{result.route.distance} km</strong></div>
                <div><span>Route corridor</span><strong>{result.route.corridor}</strong></div>
                <div><span>Issues detected</span><strong>{result.issueCount}</strong></div>
              </div>

              <div className="route-detail-summary">
                <div>
                  <strong>Why this result?</strong>
                  <span>{result.impact}</span>
                </div>
              </div>

              <div className="route-alert-detail">
                <div className="verification-heading">
                  <div><strong>Evidence checked</strong><span>Live data from Autobahn GmbH checked against vehicle dimensions and route corridor.</span></div>
                  <span className={`verification-confidence ${result.confidence}`}>
                    {result.confidence === 'high' ? 'High confidence' : 'Medium confidence'}
                  </span>
                </div>
                <div className="verification-evidence">
                  {visibleEvidence.map(item => (
                    <div className={`evidence-${item.state}`} key={item.id}>
                      <span>{item.source}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>{item.age} · {item.confidence === 'high' ? 'Confirmed source' : 'Unconfirmed report'}</small>
                    </div>
                  ))}
                  {!visibleEvidence.length && (
                    <div className="layer-evidence-empty">
                      <span>No items in this layer</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {testPermitOpen && (
        <div className="route-sheet-backdrop" onMouseDown={e => e.target === e.currentTarget && setTestPermitOpen(false)}>
          <section className="route-sheet" role="dialog" aria-modal="true">
            <header>
              <div><span><FlaskConical size={19} /></span><div><h2>Select test permit</h2><p>Choose a test route to check against live Autobahn data.</p></div></div>
              <button type="button" onClick={() => setTestPermitOpen(false)}><X size={18} /></button>
            </header>
            <div className="route-sheet-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {testPermits.map(permit => (
                  <button
                    key={permit.id}
                    type="button"
                    className={`test-permit-option ${selectedTestPermit === permit.id ? 'selected' : ''}`}
                    onClick={() => handleTestPermitSelect(permit.id)}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: selectedTestPermit === permit.id ? 'var(--accent-light)' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {permit.name}
                  </button>
                ))}
              </div>
            </div>
            <footer>
              <button type="button" className="secondary-button" onClick={() => setTestPermitOpen(false)}>Cancel</button>
            </footer>
          </section>
        </div>
      )}

      <aside className={`demo-controls ${demoOpen ? 'open' : ''}`}>
        <button type="button" className="demo-controls-trigger" onClick={() => setDemoOpen(current => !current)}>
          <FlaskConical size={18} />
          <span><strong>Test scenarios</strong><small>Demo controls (kept from prototype)</small></span>
          <ChevronUp size={17} />
        </button>
        {demoOpen && (
          <div className="demo-controls-body">
            <p>The test scenarios from the prototype are preserved for testing workflows. Use test permits above for live data checks.</p>
          </div>
        )}
      </aside>

      {toast && <Toast message={toast} tone="info" onClose={() => setToast('')} />}
    </div>
  )
}
