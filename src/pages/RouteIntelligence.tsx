import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, ChevronDown, CircleX, Download,
  FileUp, Loader2, MapPin, ShieldCheck, Truck, Upload,
} from 'lucide-react'
import RouteMapGL, { type RouteMapHandle } from '../components/RouteMapGL'
import { Toast } from '../components/Feedback'
import { checkRoute, loadTestPermit, readFileAsText, testPermits, type RouteCheckResult } from '../lib/routeCheck'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { formatBerlinDateTime } from '../lib/formatTime'
import { confirmOnSiteTitles, downloadSnapshot, snapshotFromResult } from '../lib/exportCheck'
import {
  DEFAULT_MONITOR_PREFS,
  MONITOR_INTERVAL_OPTIONS,
  defaultDepartureIso,
  defaultJobName,
  fromLocalInput,
  toLocalInput,
} from '../lib/jobs'

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
  const loadedPermit = useRef<string | null>(null)
  const [searchParams] = useSearchParams()
  const { recordCheck } = useRouteMonitoring()
  const { saveJob, getJob, updateJob, prefs, requestNotifications } = useJobs()
  const [plannedDeparture, setPlannedDeparture] = useState(toLocalInput(defaultDepartureIso(8)))
  const [jobName, setJobName] = useState('')
  const [jobInterval, setJobInterval] = useState(prefs.intervalMinutes)
  const [showSaveJob, setShowSaveJob] = useState(false)
  const loadedJob = useRef<string | null>(null)

  const vehicle = {
    width: parseFloat(vehicleWidth) || 0,
    height: parseFloat(vehicleHeight) || 0,
    length: parseFloat(vehicleLength) || 0,
    grossWeight: parseFloat(vehicleWeight) || 0,
  }

  const vehicleValid = vehicle.width > 0 && vehicle.height > 0 && vehicle.length > 0 && vehicle.grossWeight > 0

  const runCheck = async (content: string, metadata?: any) => {
    const dims = metadata?.vehicle ? {
      width: Number(metadata.vehicle.width),
      height: Number(metadata.vehicle.height),
      length: Number(metadata.vehicle.length),
      grossWeight: Number(metadata.vehicle.grossWeight),
    } : vehicle
    const permit = metadata?.permitNumber || permitNumber
    if (!(dims.width > 0 && dims.height > 0 && dims.length > 0 && dims.grossWeight > 0) || checking) return

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

      const checkResult = await checkRoute(content, dims, permit)
      setResult(checkResult)
      setActiveLayer('roadworks')
      setStep('result')
      setToast(`Route checked: ${checkResult.verdict}`)
      const runAt = new Date().toISOString()
      recordCheck({
        permitName: permit || routeFile || `${checkResult.route.origin} → ${checkResult.route.destination}`,
        routeLabel: `${checkResult.route.origin} → ${checkResult.route.destination}`,
        runAt,
        verdict: checkResult.verdict,
        evidenceCount: checkResult.evidence.length,
        retrievedAt: checkResult.retrievedAt || runAt,
        source: checkResult.source || 'Autobahn GmbH',
        summary: checkResult.summary,
        degraded: checkResult.degraded,
        permitNumber: permit,
        vehicle: dims,
        title: checkResult.title,
        impact: checkResult.impact,
        confidence: checkResult.confidence,
        evidence: checkResult.evidence,
        confirmOnSite: confirmOnSiteTitles(checkResult.evidence),
        jobId: loadedJob.current || undefined,
      })
      if (loadedJob.current) {
        updateJob(loadedJob.current, {
          lastCheckedAt: runAt,
          lastVerdict: checkResult.verdict,
          lastSummary: checkResult.summary,
          lastRetrievedAt: checkResult.retrievedAt || runAt,
          lastSource: checkResult.source,
          origin: checkResult.route.origin,
          destination: checkResult.route.destination,
          corridor: checkResult.route.corridor,
        })
      }
      setJobName(defaultJobName(routeFile, checkResult.route.origin, checkResult.route.destination, permit))
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

  useEffect(() => {
    const jobId = searchParams.get('job')
    if (jobId) {
      if (loadedJob.current === jobId) return
      const job = getJob(jobId)
      if (!job) {
        setError('That saved job was not found in this browser.')
        return
      }
      loadedJob.current = jobId
      loadedPermit.current = jobId
      setRouteFile(job.routeFileName)
      setGpxContent(job.gpxContent)
      setPermitNumber(job.permitNumber)
      setVehicleProfile('custom')
      setVehicleWidth(String(job.vehicle.width))
      setVehicleHeight(String(job.vehicle.height))
      setVehicleLength(String(job.vehicle.length))
      setVehicleWeight(String(job.vehicle.grossWeight))
      setPlannedDeparture(toLocalInput(job.plannedDeparture || defaultDepartureIso(8)))
      setJobName(job.name)
      setJobInterval(job.monitorIntervalMinutes || prefs.intervalMinutes)
      setShowTestPermits(false)
      setError('')
      if (searchParams.get('run') === '1') {
        void runCheck(job.gpxContent, { permitNumber: job.permitNumber, vehicle: job.vehicle })
      } else {
        setStep('vehicle')
      }
      return
    }

    const permitId = searchParams.get('permit')
    if (!permitId || loadedPermit.current === permitId) return
    loadedPermit.current = permitId
    const autoRun = searchParams.get('run') === '1'
    const permit = testPermits.find(item => item.id === permitId)
    if (!permit) return
    void (async () => {
      try {
        const { gpxContent: content, metadata } = await loadTestPermit(permit)
        setRouteFile(permit.name.split('·')[0].trim())
        setGpxContent(content)
        setShowTestPermits(false)
        setError('')
        if (metadata) {
          setPermitNumber(metadata.permitNumber || '')
          setVehicleProfile('custom')
          setVehicleWidth(metadata.vehicle.width.toString())
          setVehicleHeight(metadata.vehicle.height.toString())
          setVehicleLength(metadata.vehicle.length.toString())
          setVehicleWeight(metadata.vehicle.grossWeight.toString())
        }
        if (autoRun) {
          await runCheck(content, metadata)
        } else {
          setStep('vehicle')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test permit')
      }
    })()
  }, [getJob, prefs.intervalMinutes, searchParams])

  const resetFlow = () => {
    setStep('import')
    setResult(null)
    setRouteFile('')
    setGpxContent('')
    setError('')
    setPermitNumber('')
    setShowSaveJob(false)
    loadedJob.current = null
  }

  const handleSaveJob = () => {
    if (!gpxContent) return
    const name = jobName.trim() || defaultJobName(routeFile, result?.route.origin, result?.route.destination, permitNumber)
    const saved = saveJob({
      name,
      permitNumber,
      routeFileName: routeFile || name,
      gpxContent,
      origin: result?.route.origin || '',
      destination: result?.route.destination || '',
      corridor: result?.route.corridor || '',
      vehicle,
      plannedDeparture: fromLocalInput(plannedDeparture),
      monitorIntervalMinutes: jobInterval || prefs.intervalMinutes,
      lastCheckedAt: new Date().toISOString(),
      lastVerdict: result?.verdict,
      lastSummary: result?.summary,
      lastRetrievedAt: result?.retrievedAt,
      lastSource: result?.source,
      monitoringStoppedReason: null,
    }, loadedJob.current || undefined)
    loadedJob.current = saved.id
    setShowSaveJob(false)
    setToast('Job saved in this browser only.')
  }

  const exportCurrent = (format: 'pdf' | 'csv') => {
    if (!result) return
    downloadSnapshot(snapshotFromResult(result, {
      permitNumber,
      permitName: routeFile || permitNumber,
      vehicle,
      runAt: result.retrievedAt,
    }), format)
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
                {([
                  { label: 'Width', unit: 'm', value: vehicleWidth, setValue: setVehicleWidth },
                  { label: 'Height', unit: 'm', value: vehicleHeight, setValue: setVehicleHeight },
                  { label: 'Length', unit: 'm', value: vehicleLength, setValue: setVehicleLength },
                  { label: 'Gross weight', unit: 't', value: vehicleWeight, setValue: setVehicleWeight },
                ]).map(field => (
                  <div className="form-group" key={field.label}>
                    <label>
                      <span>{field.label}</span>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*[.,]?[0-9]*"
                          min="0"
                          step="0.1"
                          value={field.value}
                          onChange={e => field.setValue(e.target.value)}
                          aria-label={`${field.label} in ${field.unit}`}
                        />
                        <span className="unit">{field.unit}</span>
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

            <div className="form-group">
              <label htmlFor="planned-departure">
                <span>Planned departure</span>
                <input
                  id="planned-departure"
                  type="datetime-local"
                  value={plannedDeparture}
                  onChange={event => setPlannedDeparture(event.target.value)}
                />
              </label>
              <p className="storage-note">Used if you save this as a job. Monitoring only runs while the tab is open and stops after this time.</p>
            </div>

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

            <div className="result-actions">
              <button type="button" className="btn-primary" onClick={() => setShowSaveJob(true)}>
                <Briefcase size={16} /> Save as job
              </button>
              <button type="button" className="btn-secondary" onClick={() => exportCurrent('pdf')}>
                <Download size={16} /> Export PDF
              </button>
              <button type="button" className="btn-secondary" onClick={() => exportCurrent('csv')}>
                <Download size={16} /> Export CSV
              </button>
            </div>

            {showSaveJob && (
              <div className="job-save-card" data-testid="save-job-form">
                <h3>Save as job</h3>
                <p>Stores the route file, permit number, vehicle dimensions, and planned departure in this browser only.</p>
                <label>
                  <span>Job name</span>
                  <input value={jobName} onChange={event => setJobName(event.target.value)} />
                </label>
                <label>
                  <span>Permit number</span>
                  <input value={permitNumber} onChange={event => setPermitNumber(event.target.value)} />
                </label>
                <label>
                  <span>Planned departure</span>
                  <input type="datetime-local" value={plannedDeparture} onChange={event => setPlannedDeparture(event.target.value)} />
                </label>
                <label>
                  <span>Re-check every</span>
                  <select value={jobInterval} onChange={event => setJobInterval(Number(event.target.value))}>
                    {MONITOR_INTERVAL_OPTIONS.map(minutes => (
                      <option key={minutes} value={minutes}>{minutes} minutes</option>
                    ))}
                  </select>
                </label>
                <p className="storage-note">Monitoring runs only while this tab is open. It stops after departure. Browser notifications need an explicit Allow click.</p>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowSaveJob(false)}>Cancel</button>
                  <button type="button" className="btn-secondary" onClick={() => void requestNotifications()}>Allow notifications</button>
                  <button type="button" className="btn-primary" onClick={handleSaveJob}>Save job</button>
                </div>
              </div>
            )}

            {/* Critical Disclaimer */}
            <div className="verdict-disclaimer">
              <strong>⚠️ Important:</strong> This route check is an informational snapshot only. It does not grant permission to depart or replace official permit validity. Bridge clearances and local road conditions may require manual verification. Always confirm with authorities before departure.
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
                    <div><span>Evidence found</span><strong>{result.evidence.length}</strong></div>
                    <div><span>Retrieved</span><strong>{formatBerlinDateTime(result.retrievedAt) || 'Just now'}</strong></div>
                    <div><span>Source</span><strong>{result.source || 'Autobahn GmbH'}</strong></div>
                  </div>
                </div>

                <div className="evidence-section">
                  <h3>
                    Evidence ({result.evidence.length})
                  </h3>
                  <div className="evidence-list">
                    {result.evidence.map(item => (
                      <div 
                        key={item.id} 
                        className={`evidence-card evidence-${item.state}`}
                        onClick={() => item.lat != null && item.lng != null && mapRef.current?.flyToEvidence(item)}
                        style={{ cursor: item.lat != null && item.lng != null ? 'pointer' : 'default' }}
                      >
                        <div className="evidence-header">
                          <strong>{item.title}</strong>
                          <span className={`confidence-badge confidence-${String(item.confidence).toLowerCase()}`}>
                            {String(item.confidence).toLowerCase() === 'high' ? 'High confidence' : 'Medium confidence'}
                          </span>
                        </div>
                        <p>{item.detail}</p>
                        <div className="evidence-meta">
                          <span>{item.source}</span>
                          <span>·</span>
                          <span>{item.startTimestamp ? `Started ${formatBerlinDateTime(item.startTimestamp)}` : 'Start not published'}</span>
                          {item.endTimestamp && (
                            <>
                              <span>·</span>
                              <span>Until {formatBerlinDateTime(item.endTimestamp)}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>Retrieved {formatBerlinDateTime(item.retrievedAt || result.retrievedAt) || 'just now'}</span>
                          {item.longRunning && <span className="evidence-long-running">Long-running / verify on site</span>}
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
            
            {/* Mobile sticky action bar */}
            <div className="mobile-route-actions" style={{ display: 'none' }}>
              <button type="button" className="btn-secondary" onClick={resetFlow}>
                Re-check
              </button>
              <button type="button" className="btn-primary" onClick={() => setToast('Site confirmation feature coming soon')}>
                Confirm on site
              </button>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast} tone="info" onClose={() => setToast('')} />}
    </div>
  )
}
