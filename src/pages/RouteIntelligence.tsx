import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, CircleX, 
  FileUp, Loader2, MapPin, ShieldCheck, Truck, Upload,
} from 'lucide-react'
import RouteMapGL, { type RouteMapHandle } from '../components/RouteMapGL'
import { Toast } from '../components/Feedback'
import { checkRoute, loadTestPermit, readFileAsText, testPermits, type RouteCheckResult } from '../lib/routeCheck'
import type { RouteEvidence } from '../data/routeChecks'

const routeLayers = [
  { id: 'roadworks', label: 'Roadworks' },
  { id: 'closures', label: 'Closures' },
  { id: 'observations', label: 'On-site reports' },
]

export default function RouteIntelligencePolished() {
  // State
  const [step, setStep] = useState<'import' | 'vehicle' | 'result'>('import')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<RouteCheckResult | null>(null)
  const [activeLayer, setActiveLayer] = useState('roadworks')
  const [vehicleProfile, setVehicleProfile] = useState('standard')
  const [vehicleWidth, setVehicleWidth] = useState('3.0')
  const [vehicleHeight, setVehicleHeight] = useState('4.0')
  const [vehicleLength, setVehicleLength] = useState('25.0')
  const [vehicleWeight, setVehicleWeight] = useState('52')
  const [permitNumber, setPermitNumber] = useState('')
  const [routeFile, setRouteFile] = useState('')
  const [gpxContent, setGpxContent] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [showTestPermits, setShowTestPermits] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const mapRef = useRef<RouteMapHandle>(null)

  const vehicle = {
    width: parseFloat(vehicleWidth) || 0,
    height: parseFloat(vehicleHeight) || 0,
    length: parseFloat(vehicleLength) || 0,
    grossWeight: parseFloat(vehicleWeight) || 0,
  }

  const vehicleValid = vehicle.width > 0 && vehicle.height > 0 && vehicle.length > 0 && vehicle.grossWeight > 0

  const runCheck = async (content: string, metadata?: any) => {
    if (!vehicleValid || checking) return

    setChecking(true)
    setError('')
    
    try {
      if (metadata) {
        setPermitNumber(metadata.permitNumber || '')
        setVehicleProfile('custom')
        setVehicleWidth(metadata.vehicle.width.toString())
        setVehicleHeight(metadata.vehicle.height.toString())
        setVehicleLength(metadata.vehicle.length.toString())
        setVehicleWeight(metadata.vehicle.grossWeight.toString())
      }

      const checkResult = await checkRoute(content, vehicle, permitNumber)
      setResult(checkResult)
      setActiveLayer('roadworks')
      setStep('result')
      setToast(`Route checked: ${checkResult.verdict}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check route'
      setError(errorMsg)
      setToast(errorMsg)
    } finally {
      setChecking(false)
    }
  }

  const handleTestPermitSelect = async (permitId: string) => {
    const permit = testPermits.find(p => p.id === permitId)
    if (!permit) return

    setRouteFile(permit.name.split('·')[0].trim())
    setShowTestPermits(false)
    setError('')
    setStep('vehicle')

    try {
      const { gpxContent: content, metadata } = await loadTestPermit(permit)
      setGpxContent(content)
      if (metadata) {
        setPermitNumber(metadata.permitNumber || '')
        setVehicleProfile('custom')
        setVehicleWidth(metadata.vehicle.width.toString())
        setVehicleHeight(metadata.vehicle.height.toString())
        setVehicleLength(metadata.vehicle.length.toString())
        setVehicleWeight(metadata.vehicle.grossWeight.toString())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test permit')
    }
  }

  const handleFileUpload = async (file: File) => {
    setError('')
    
    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError('Invalid file format. Please upload a .gpx file.')
      setRouteFile('')
      return
    }
    
    try {
      const content = await readFileAsText(file)
      
      // Validate GPX structure
      if (!content.includes('<gpx') || !content.includes('</gpx>')) {
        setError('Invalid GPX file. The file does not contain valid GPX data.')
        setRouteFile('')
        return
      }
      
      // Check for track points
      if (!content.includes('<trkpt')) {
        setError('Invalid GPX file. No route track points found.')
        setRouteFile('')
        return
      }
      
      setRouteFile(file.name)
      setGpxContent(content)
      setStep('vehicle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setRouteFile('')
    }
  }

  const handleCheckRoute = () => {
    if (gpxContent && vehicleValid) {
      runCheck(gpxContent)
    }
  }

  const resetFlow = () => {
    setStep('import')
    setResult(null)
    setRouteFile('')
    setGpxContent('')
    setError('')
    setPermitNumber('')
  }

  const VerdictIcon = result?.verdict === 'READY' ? CheckCircle2 
    : result?.verdict === 'HOLD' ? CircleX 
    : AlertTriangle

  const verdictConfig = {
    READY: {
      label: 'Ready to depart',
      color: 'green',
      description: 'No blocking issues on your permitted route',
    },
    HOLD: {
      label: 'Hold departure',
      color: 'red',
      description: 'Blocking issue detected – do not depart',
    },
    VERIFY: {
      label: 'Verify before departure',
      color: 'amber',
      description: 'Verification required before making dispatch decision',
    },
  }

  const currentVerdict = result ? verdictConfig[result.verdict] : null

  return (
    <div className="route-page-polished">
      {/* Header */}
      <div className="route-polished-header">
        <Link to="/" className="route-polished-back">
          <ArrowLeft size={20} />
          <span>Back to overview</span>
        </Link>
        <div className="route-polished-header-content">
          <h1>Route Check</h1>
          <p>Check your permitted route against live Autobahn conditions</p>
        </div>
      </div>

      {/* Progress Steps */}
      {!result && (
        <div className="route-polished-steps">
          <div className={`route-polished-step ${step === 'import' ? 'active' : routeFile ? 'completed' : ''}`}>
            <div className="step-number">{routeFile ? '✓' : '1'}</div>
            <div className="step-label">Import route</div>
          </div>
          <div className="route-polished-step-connector" />
          <div className={`route-polished-step ${step === 'vehicle' ? 'active' : result ? 'completed' : ''}`}>
            <div className="step-number">{result ? '✓' : '2'}</div>
            <div className="step-label">Vehicle dimensions</div>
          </div>
          <div className="route-polished-step-connector" />
          <div className={`route-polished-step ${step === 'result' ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Check result</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="route-polished-content">
        {/* Step 1: Import Route */}
        {step === 'import' && (
          <div className="route-polished-card">
            <div className="card-header">
              <FileUp size={24} />
              <div>
                <h2>Import your permitted route</h2>
                <p>Upload a GPX file with your exact approved route or select a test permit</p>
              </div>
            </div>

            <div className="route-polished-upload-area">
              <input
                ref={fileInput}
                type="file"
                accept=".gpx,application/gpx+xml,text/xml"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileUpload(file)
                    e.target.value = ''
                  }
                }}
                className="file-input-hidden"
                aria-label="Upload GPX file"
              />
              
              {!routeFile ? (
                <button 
                  type="button"
                  className="upload-dropzone"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={32} />
                  <strong>Choose GPX file</strong>
                  <span>Or drag and drop your permit route file here</span>
                </button>
              ) : (
                <div className="upload-success">
                  <CheckCircle2 size={24} />
                  <div>
                    <strong>{routeFile}</strong>
                    <span>Route file loaded</span>
                  </div>
                  <button type="button" onClick={() => fileInput.current?.click()} className="btn-text">
                    Replace file
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="error-message" role="alert">
                <AlertTriangle size={20} />
                <div>
                  <strong>Could not read file</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <div className="divider-text">
              <span>or select a test permit</span>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowTestPermits(!showTestPermits)}
            >
              {showTestPermits ? 'Hide' : 'Show'} test permits
              <ChevronDown size={16} style={{ transform: showTestPermits ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showTestPermits && (
              <div className="test-permits-grid">
                {testPermits.filter(p => p.id !== 'invalid').map(permit => (
                  <button
                    key={permit.id}
                    type="button"
                    className="test-permit-card"
                    onClick={() => handleTestPermitSelect(permit.id)}
                  >
                    <MapPin size={20} />
                    <div>
                      <strong>{permit.name.split('·')[0].trim()}</strong>
                      <span>{permit.name.split('·')[1]?.trim()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="info-note">
              <ShieldCheck size={20} />
              <p>
                <strong>Your permit remains authoritative.</strong>
                This check supports dispatch decisions but does not replace VEMAGS or authority approval.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Vehicle Dimensions */}
        {step === 'vehicle' && !checking && !result && (
          <div className="route-polished-card">
            <div className="card-header">
              <Truck size={24} />
              <div>
                <h2>Vehicle dimensions</h2>
                <p>Enter the exact measurements approved in your transport permit</p>
              </div>
            </div>

            {routeFile && (
              <div className="route-info-summary">
                <div className="route-info-item">
                  <span>Route file</span>
                  <strong>{routeFile}</strong>
                </div>
                {permitNumber && (
                  <div className="route-info-item">
                    <span>Permit number</span>
                    <strong>{permitNumber}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="vehicle-profile">
                <span>Transport profile</span>
                <select 
                  id="vehicle-profile"
                  value={vehicleProfile} 
                  onChange={e => {
                    setVehicleProfile(e.target.value)
                    if (e.target.value === 'standard') {
                      setVehicleWidth('3.0')
                      setVehicleHeight('4.0')
                      setVehicleLength('25.0')
                      setVehicleWeight('52')
                    } else if (e.target.value === 'wide') {
                      setVehicleWidth('3.8')
                      setVehicleHeight('4.2')
                      setVehicleLength('32.0')
                      setVehicleWeight('68')
                    }
                  }}
                >
                  <option value="standard">Standard heavy haulage · 3.0m × 4.0m × 25.0m · 52t</option>
                  <option value="wide">Wide heavy haulage · 3.8m × 4.2m × 32.0m · 68t</option>
                  <option value="custom">Custom dimensions</option>
                </select>
              </label>
            </div>

            {vehicleProfile === 'custom' ? (
              <div className="dimensions-grid">
                {[
                  ['Width', 'm', vehicleWidth, setVehicleWidth],
                  ['Height', 'm', vehicleHeight, setVehicleHeight],
                  ['Length', 'm', vehicleLength, setVehicleLength],
                  ['Gross weight', 't', vehicleWeight, setVehicleWeight],
                ].map(([label, unit, value, setValue], idx) => (
                  <div className="form-group" key={idx}>
                    <label>
                      <span>{label}</span>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={value as string}
                          onChange={e => (setValue as (v: string) => void)(e.target.value)}
                          aria-label={`${label} in ${unit}`}
                        />
                        <span className="unit">{unit}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dimensions-summary">
                <div><span>Width</span><strong>{vehicleWidth} m</strong></div>
                <div><span>Height</span><strong>{vehicleHeight} m</strong></div>
                <div><span>Length</span><strong>{vehicleLength} m</strong></div>
                <div><span>Gross weight</span><strong>{vehicleWeight} t</strong></div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={resetFlow}>
                Back
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleCheckRoute}
                disabled={!vehicleValid}
              >
                Check route
              </button>
            </div>
          </div>
        )}

        {/* Checking State */}
        {checking && (
          <div className="route-polished-card checking-state">
            <Loader2 size={48} className="spinner" />
            <h2>Checking your route...</h2>
            <p>Comparing your approved route and vehicle dimensions against live Autobahn conditions</p>
          </div>
        )}

        {/* Step 3: Results */}
        {result && !checking && currentVerdict && (
          <>
            {/* Verdict Banner */}
            <div className={`verdict-banner verdict-${currentVerdict.color}`}>
              <div className="verdict-icon">
                <VerdictIcon size={40} />
              </div>
              <div className="verdict-content">
                <div className="verdict-label">{currentVerdict.label}</div>
                <h2>{result.title}</h2>
                <p>{currentVerdict.description}</p>
                {result.degraded && (
                  <div className="degraded-notice">
                    <AlertTriangle size={16} />
                    <span>Data source temporarily unavailable – verify manually</span>
                  </div>
                )}
              </div>
              <button type="button" className="btn-text" onClick={resetFlow}>
                Check another route
              </button>
            </div>

            {/* Map and Evidence */}
            <div className="results-layout">
              <div className="results-main">
                <RouteMapGL
                  ref={mapRef}
                  coordinates={result.route.coordinates}
                  origin={result.route.origin}
                  destination={result.route.destination}
                  evidence={result.evidence}
                  verdict={result.verdict}
                  activeLayer={activeLayer}
                  layers={routeLayers}
                  onLayerChange={setActiveLayer}
                  className="results-map"
                />
              </div>

              <div className="results-sidebar">
                <div className="results-summary">
                  <h3>Route details</h3>
                  <div className="summary-grid">
                    <div><span>Origin</span><strong>{result.route.origin}</strong></div>
                    <div><span>Destination</span><strong>{result.route.destination}</strong></div>
                    <div><span>Distance</span><strong>{result.route.distance} km</strong></div>
                    <div><span>Issues found</span><strong>{result.issueCount}</strong></div>
                  </div>
                </div>

                <div className="evidence-section">
                  <h3>
                    Evidence ({result.evidence.filter(e => e.category === activeLayer).length})
                    {result.evidence.filter(e => e.category === activeLayer).length !== result.evidence.length && (
                      <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '14px' }}>
                        {' '}· {result.evidence.length} total
                      </span>
                    )}
                  </h3>
                  <div className="evidence-list">
                    {result.evidence.filter(e => e.category === activeLayer).map(item => (
                      <div 
                        key={item.id} 
                        className={`evidence-card evidence-${item.state}`}
                        onClick={() => item.lat != null && item.lng != null && mapRef.current?.flyToEvidence(item)}
                        style={{ cursor: item.lat != null && item.lng != null ? 'pointer' : 'default' }}
                      >
                        <div className="evidence-header">
                          <strong>{item.title}</strong>
                          <span className={`confidence-badge confidence-${item.confidence}`}>
                            {item.confidence === 'high' ? 'High confidence' : 'Medium confidence'}
                          </span>
                        </div>
                        <p>{item.detail}</p>
                        <div className="evidence-meta">
                          <span>{item.source}</span>
                          <span>·</span>
                          <span>{item.age}</span>
                          {item.lat != null && item.lng != null && (
                            <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.6 }}>📍 Click to view</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast} tone="info" onClose={() => setToast('')} />}
    </div>
  )
}
