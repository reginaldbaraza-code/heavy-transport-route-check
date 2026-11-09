import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, ChevronDown, CircleX, Download,
  FileUp, Loader2, MapPin, ShieldCheck, Truck, Upload,
} from 'lucide-react'
import type { RouteMapHandle } from '../components/RouteMapGL'
import { Toast } from '../components/Feedback'
import { Button } from '../components/ui/button'
import {
  checkRoute,
  loadTestPermit,
  permitVehicleDims,
  readFileAsText,
  sampleTestPermits,
  scenarioTestPermits,
  testPermits,
  type RouteCheckResult,
  type TestPermit,
} from '../lib/routeCheck'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { useOrgSettings } from '../context/OrgSettingsContext'
import { formatBerlinDateTime } from '../lib/formatTime'
import type { RouteEvidence } from '../data/routeChecks'
import { confirmOnSiteTitles, downloadSnapshot, formatStartLabel, pdfBytesFromSnapshot, sanitizePdfText, snapshotFromResult } from '../lib/exportCheck'
import {
  DEFAULT_MONITOR_PREFS,
  MONITOR_INTERVAL_OPTIONS,
  defaultDepartureIso,
  defaultJobName,
  fromLocalInput,
  toLocalInput,
} from '../lib/jobs'
import {
  applySiteAcknowledgements,
  isAcknowledgeable,
  isHoldItem,
  isNearbyOffRoute,
  type SiteAcknowledgement,
} from '../lib/siteAcknowledgements'
import { displayEvidenceTitle, evidenceOriginalGerman, looksGerman, looksTechnical, splitConcatenatedPlaces } from '../lib/evidenceSummary'
import { GPX_FRIENDLY_TOO_LARGE, GpxParseError, parseGpxDocument, serializeGpxTrack, validateGpxFileSize } from '../lib/gpxParse'

const RouteMapGL = lazy(() => import('../components/RouteMapGL'))

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
  const [errorTechnical, setErrorTechnical] = useState('')
  const [gpxSimplifyNote, setGpxSimplifyNote] = useState('')
  const [showTestPermits, setShowTestPermits] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const mapRef = useRef<RouteMapHandle>(null)
  const loadedPermit = useRef<string | null>(null)
  const [searchParams] = useSearchParams()
  const { recordCheck, patchHistory } = useRouteMonitoring()
  const { saveJob, getJob, updateJob, prefs, requestNotifications } = useJobs()
  const { savedProfile } = useOrgSettings()
  const [plannedDeparture, setPlannedDeparture] = useState(toLocalInput(defaultDepartureIso(8)))
  const [jobName, setJobName] = useState('')
  const [jobInterval, setJobInterval] = useState(prefs.intervalMinutes)
  const [showSaveJob, setShowSaveJob] = useState(false)
  const loadedJob = useRef<string | null>(null)
  const [activePermitId, setActivePermitId] = useState<string | null>(null)
  const [clearanceConfirmed, setClearanceConfirmed] = useState(false)
  const [clearanceBy, setClearanceBy] = useState('')
  const [confirmedAt, setConfirmedAt] = useState('')
  const [acknowledgements, setAcknowledgements] = useState<SiteAcknowledgement[]>([])
  const lastHistoryId = useRef<string | null>(null)
  const clearanceConfirmedRef = useRef(clearanceConfirmed)
  const clearanceByRef = useRef(clearanceBy)
  const confirmedAtRef = useRef(confirmedAt)
  clearanceConfirmedRef.current = clearanceConfirmed
  clearanceByRef.current = clearanceBy
  confirmedAtRef.current = confirmedAt

  const vehicle = {
    width: parseFloat(vehicleWidth) || 0,
    height: parseFloat(vehicleHeight) || 0,
    length: parseFloat(vehicleLength) || 0,
    grossWeight: parseFloat(vehicleWeight) || 0,
  }

  const vehicleValid = vehicle.width > 0 && vehicle.height > 0 && vehicle.length > 0 && vehicle.grossWeight > 0

  const applyPermitClearance = (permit?: TestPermit | null, metadata?: any) => {
    const confirmed = Boolean(permit?.bridgeClearanceConfirmed ?? metadata?.bridgeClearanceConfirmed)
    setClearanceConfirmed(confirmed)
    setClearanceBy(permit?.clearanceConfirmedBy || metadata?.clearanceConfirmedBy || savedProfile.dispatcherName || '')
    setConfirmedAt(permit?.confirmedAt || metadata?.confirmedAt || (confirmed ? new Date().toISOString() : ''))
  }

  const applyPermitVehicle = (permit?: TestPermit | null, metadata?: any) => {
    const dims = permitVehicleDims(permit, metadata)
    if (!dims) return
    setVehicleProfile('custom')
    setVehicleWidth(String(dims.width))
    setVehicleHeight(String(dims.height))
    setVehicleLength(String(dims.length))
    setVehicleWeight(String(dims.grossWeight))
  }

  const runCheck = async (
    content: string,
    metadata?: any,
    permitOverride?: TestPermit,
    acks: SiteAcknowledgement[] = acknowledgements,
  ) => {
    const activePermit = permitOverride || testPermits.find(item => item.id === activePermitId)
    const dims = permitVehicleDims(activePermit, metadata) || vehicle
    const permit = (activePermit?.kind === 'scenario' ? activePermit.permitNumber : null)
      || metadata?.permitNumber
      || permitNumber
    if (!(dims.width > 0 && dims.height > 0 && dims.length > 0 && dims.grossWeight > 0) || checking) return

    setChecking(true)
    setError('')
    setErrorTechnical('')
    
    try {
      if (metadata || activePermit) {
        setPermitNumber(activePermit?.kind === 'scenario' ? (activePermit.permitNumber || permit) : (metadata?.permitNumber || activePermit?.permitNumber || ''))
        applyPermitVehicle(activePermit, metadata)
      }

      const checkResult = await checkRoute(content, dims, {
        permitNumber: permit,
        corridor: metadata?.corridor || activePermit?.corridor,
        permittedRoads: (metadata?.corridor || activePermit?.corridor)
          ? [String(metadata?.corridor || activePermit?.corridor).replace(/\s+/g, '')]
          : undefined,
        validFrom: metadata?.validFrom || activePermit?.validFrom,
        validUntil: metadata?.validUntil || activePermit?.validUntil,
        bridgeClearanceConfirmed: permitOverride
          ? Boolean(metadata?.bridgeClearanceConfirmed ?? permitOverride.bridgeClearanceConfirmed)
          : Boolean(metadata?.bridgeClearanceConfirmed ?? clearanceConfirmed),
        clearanceConfirmedBy: permitOverride
          ? (metadata?.clearanceConfirmedBy || permitOverride.clearanceConfirmedBy)
          : (metadata?.clearanceConfirmedBy || clearanceBy || undefined),
        confirmedAt: permitOverride
          ? (metadata?.confirmedAt || permitOverride.confirmedAt)
          : (metadata?.confirmedAt || confirmedAt || undefined),
        scenario: activePermit?.scenario,
        acknowledgements: acks,
      })
      setResult(checkResult)
      setActiveLayer('roadworks')
      setStep('result')
      setToast(`Route checked: ${checkResult.verdict}`)
      const runAt = new Date().toISOString()
      const history = recordCheck({
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
        alertEligible: !activePermit,
        siteAcknowledgements: acks,
      })
      lastHistoryId.current = history.id
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
          siteAcknowledgements: acks,
        })
      }
      setJobName(defaultJobName(
        activePermit?.name.split('·')[0].trim() || routeFile,
        checkResult.route.origin,
        checkResult.route.destination,
        permit,
      ))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check route'
      setError(errorMsg)
      setErrorTechnical(err instanceof GpxParseError ? err.technical : '')
      setToast(errorMsg)
    } finally {
      setChecking(false)
    }
  }

  const handleTestPermitSelect = async (permitId: string) => {
    const permit = testPermits.find(p => p.id === permitId)
    if (!permit) return

    setActivePermitId(permit.id)
    setRouteFile(permit.name.split('·')[0].trim())
    setShowTestPermits(false)
    setError('')
    setErrorTechnical('')
    setStep('vehicle')
    applyPermitClearance(permit)
    applyPermitVehicle(permit)
    setPermitNumber(permit.permitNumber)
    setAcknowledgements([])

    try {
      const { gpxContent: content, metadata } = await loadTestPermit(permit)
      setGpxContent(content)
      applyPermitVehicle(permit, metadata)
      setPermitNumber(permit.kind === 'scenario' ? permit.permitNumber : (metadata?.permitNumber || permit.permitNumber))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample permit')
    }
  }

  const handleFileUpload = async (file: File) => {
    setError('')
    setErrorTechnical('')
    setActivePermitId(null)

    try {
      validateGpxFileSize(file.size)
    } catch (err) {
      setError(err instanceof GpxParseError ? err.message : GPX_FRIENDLY_TOO_LARGE)
      setErrorTechnical(err instanceof GpxParseError ? err.technical : '')
      setRouteFile('')
      return
    }

    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError("This file isn't a valid GPX route. Export the route from VEMAGS as GPX and try again.")
      setErrorTechnical(`Unexpected file name: ${file.name}`)
      setRouteFile('')
      return
    }

    try {
      const content = await readFileAsText(file)
      const parsed = parseGpxDocument(content)
      setRouteFile(file.name)
      if (parsed.downsampled || parsed.originalCount > parsed.points.length) {
        const note = `Simplified from ${parsed.originalCount} to ${parsed.points.length} points`
        setGpxContent(serializeGpxTrack(parsed.points, parsed.creator))
        setGpxSimplifyNote(note)
        setToast(parsed.vemags ? `VEMAGS route detected. ${note}` : note)
      } else {
        setGpxContent(content)
        setGpxSimplifyNote('')
        if (parsed.vemags) setToast('VEMAGS route detected.')
      }
      setStep('vehicle')
    } catch (err) {
      setError(err instanceof Error ? err.message : "This file isn't a valid GPX route. Export the route from VEMAGS as GPX and try again.")
      setErrorTechnical(err instanceof GpxParseError ? err.technical : '')
      setRouteFile('')
    }
  }

  const handleCheckRoute = () => {
    if (gpxContent && vehicleValid) {
      runCheck(gpxContent)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__HT_TEST__) return
    window.__HT_TEST__.pdfBytesFromSnapshot = pdfBytesFromSnapshot
    window.__HT_TEST__.sanitizePdfText = sanitizePdfText
  }, [])

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
      setActivePermitId(null)
      setClearanceConfirmed(Boolean(job.bridgeClearanceConfirmed))
      setClearanceBy(job.clearanceConfirmedBy || '')
      setConfirmedAt(job.confirmedAt || '')
      setAcknowledgements(job.siteAcknowledgements || [])
      if (searchParams.get('run') === '1') {
        void runCheck(job.gpxContent, {
          permitNumber: job.permitNumber,
          vehicle: job.vehicle,
          corridor: job.corridor,
          bridgeClearanceConfirmed: job.bridgeClearanceConfirmed,
          clearanceConfirmedBy: job.clearanceConfirmedBy,
          confirmedAt: job.confirmedAt,
        }, undefined, job.siteAcknowledgements || [])
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
        setPermitNumber(permit.kind === 'scenario' ? permit.permitNumber : (metadata?.permitNumber || permit.permitNumber))
        applyPermitVehicle(permit, metadata)
        setActivePermitId(permit.id)
        applyPermitClearance(permit, metadata)
        if (autoRun) {
          await runCheck(content, metadata, permit)
        } else {
          setStep('vehicle')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sample permit')
      }
    })()
  }, [getJob, prefs.intervalMinutes, searchParams])

  const resetFlow = () => {
    setStep('import')
    setResult(null)
    setRouteFile('')
    setGpxContent('')
    setError('')
    setErrorTechnical('')
    setGpxSimplifyNote('')
    setPermitNumber('')
    setShowSaveJob(false)
    loadedJob.current = null
    setActivePermitId(null)
    setClearanceConfirmed(false)
    setClearanceBy('')
    setConfirmedAt('')
    setAcknowledgements([])
    lastHistoryId.current = null
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
      lastVerdict: displayed?.verdict || result?.verdict,
      lastSummary: displayed?.summary || result?.summary,
      lastRetrievedAt: result?.retrievedAt,
      lastSource: result?.source,
      monitoringStoppedReason: null,
      bridgeClearanceConfirmed: clearanceConfirmed,
      clearanceConfirmedBy: clearanceBy,
      confirmedAt: confirmedAt || (clearanceConfirmed ? new Date().toISOString() : undefined),
      siteAcknowledgements: acknowledgements,
    }, loadedJob.current || undefined)
    loadedJob.current = saved.id
    setShowSaveJob(false)
    setToast('Job saved in this browser only.')
  }

  const displayed = result
    ? applySiteAcknowledgements(result, acknowledgements, clearanceConfirmed, {
      by: clearanceBy,
      at: confirmedAt,
    })
    : null

  const persistOverlay = (
    acks: typeof acknowledgements,
    nextClearance: boolean,
    by: string,
    at?: string,
  ) => {
    if (!result) return null
    const overlaid = applySiteAcknowledgements(result, acks, nextClearance, {
      by,
      at,
    })
    if (lastHistoryId.current) {
      patchHistory(lastHistoryId.current, {
        verdict: overlaid.verdict,
        title: overlaid.title,
        summary: overlaid.summary,
        impact: overlaid.impact,
        evidence: overlaid.evidence,
        siteAcknowledgements: acks,
      })
    }
    if (loadedJob.current) {
      updateJob(loadedJob.current, {
        siteAcknowledgements: acks,
        lastVerdict: overlaid.verdict,
        lastSummary: overlaid.summary,
        bridgeClearanceConfirmed: nextClearance,
        clearanceConfirmedBy: by,
        confirmedAt: at,
      })
    }
    return overlaid
  }

  const setResultClearance = (next: boolean) => {
    const by = clearanceByRef.current.trim() || clearanceBy.trim() || 'Dispatcher'
    const at = next ? (confirmedAtRef.current || confirmedAt || new Date().toISOString()) : (confirmedAtRef.current || confirmedAt)
    clearanceConfirmedRef.current = next
    if (next) {
      if (!clearanceByRef.current.trim()) {
        clearanceByRef.current = by
        setClearanceBy(by)
      }
      if (!confirmedAtRef.current) {
        confirmedAtRef.current = at
        setConfirmedAt(at)
      }
    }
    setClearanceConfirmed(next)
    persistOverlay(acknowledgements, next, by, at)
  }

  const confirmOnSite = (ids: string[]) => {
    if (!result) return
    const name = clearanceByRef.current.trim() || clearanceBy.trim() || 'Dispatcher'
    if (!clearanceByRef.current.trim()) {
      clearanceByRef.current = name
      setClearanceBy(name)
    }
    const at = new Date().toISOString()
    const next = [...acknowledgements]
    let skippedHold = 0
    let added = 0
    for (const id of ids) {
      const item = result.evidence.find(entry => entry.id === id)
      if (!item) continue
      if (isHoldItem(item)) {
        skippedHold += 1
        continue
      }
      if (!isAcknowledgeable(item) || next.some(ack => ack.evidenceId === id)) continue
      next.push({ evidenceId: id, acknowledgedBy: name, acknowledgedAt: at })
      added += 1
    }
    if (!added) {
      setToast(skippedHold ? 'HOLD items cannot be acknowledged away.' : 'No VERIFY items left to confirm.')
      return
    }
    setAcknowledgements(next)
    const clearance = clearanceConfirmedRef.current
    const confirmed = clearance
      ? (confirmedAtRef.current || new Date().toISOString())
      : confirmedAtRef.current
    const overlaid = persistOverlay(next, clearance, name, confirmed)
    setToast(overlaid?.verdict === 'READY' ? overlaid.title : `Confirmed ${added} item${added === 1 ? '' : 's'} on site`)
  }

  const exportCurrent = (format: 'pdf' | 'csv') => {
    if (!displayed) return
    downloadSnapshot(snapshotFromResult(displayed, {
      permitNumber,
      permitName: routeFile || permitNumber,
      vehicle,
    }), format)
  }

  const VerdictIcon = displayed?.verdict === 'READY' ? CheckCircle2 
    : displayed?.verdict === 'HOLD' ? CircleX 
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

  const currentVerdict = displayed ? verdictConfig[displayed.verdict] : null
  const primaryEvidence = displayed?.evidence.filter(item => !isNearbyOffRoute(item)) || []
  const nearbyOffRoute = displayed?.evidence.filter(isNearbyOffRoute) || []
  const pendingVerify = primaryEvidence.filter(item => isAcknowledgeable(item) && !item.acknowledgedAt)

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
                <p>Upload a GPX file with your exact approved route or select a sample permit</p>
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
              <div className="error-message" role="alert" data-testid="gpx-upload-error">
                <AlertTriangle size={20} />
                <div>
                  <strong>Could not use this file</strong>
                  <p>{error}</p>
                  {errorTechnical && (
                    <details className="error-technical">
                      <summary>Technical details</summary>
                      <pre>{errorTechnical}</pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            <div className="divider-text">
              <span>or select a sample permit</span>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowTestPermits(!showTestPermits)}
            >
              {showTestPermits ? 'Hide' : 'Show'} sample permits
              <ChevronDown size={16} style={{ transform: showTestPermits ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showTestPermits && (
              <div className="test-permit-groups">
                <div>
                  <h3 className="test-permit-group-title">Live samples</h3>
                  <p className="test-permit-group-note">Sample — expected outcome, live data may differ</p>
                  <div className="test-permits-grid">
                    {sampleTestPermits.map(permit => (
                      <PermitCard key={permit.id} permit={permit} onSelect={handleTestPermitSelect} />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="test-permit-group-title">Scenario mode</h3>
                  <p className="test-permit-group-note">Simulated — not live data. Skips live feeds so READY, VERIFY, and HOLD can all be demoed.</p>
                  <div className="test-permits-grid">
                    {scenarioTestPermits.map(permit => (
                      <PermitCard key={permit.id} permit={permit} onSelect={handleTestPermitSelect} />
                    ))}
                  </div>
                </div>
                <p className="test-permit-attribution">
                  Test routes were pre-snapped to OpenStreetMap roads with OSRM. © OpenStreetMap contributors, ODbL.
                </p>
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
                {gpxSimplifyNote && (
                  <div className="route-info-item">
                    <span>Track</span>
                    <strong>{gpxSimplifyNote}</strong>
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
                          step="any"
                          value={field.value}
                          onChange={e => field.setValue(e.target.value)}
                          aria-label={`${field.label} in ${field.unit}`}
                          data-testid={`vehicle-${field.label.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                        <span className="unit">{field.unit}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

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

            <label className="clearance-tick">
              <input
                type="checkbox"
                checked={clearanceConfirmed}
                onChange={event => {
                  const next = event.target.checked
                  setClearanceConfirmed(next)
                  if (next) {
                    if (!clearanceBy) setClearanceBy('Dispatcher')
                    setConfirmedAt(new Date().toISOString())
                  }
                }}
              />
              <span>
                <strong>Bridge and clearance confirmed</strong>
                READY is only possible after this dispatcher tick. Stored with the job.
              </span>
            </label>
            {clearanceConfirmed && (
              <div className="form-group">
                <label htmlFor="clearance-by">
                  <span>Confirmed by</span>
                  <input
                    id="clearance-by"
                    value={clearanceBy}
                    onChange={event => setClearanceBy(event.target.value)}
                    placeholder="Dispatcher name"
                  />
                </label>
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
        {displayed && !checking && currentVerdict && (
          <>
            {/* Verdict Banner */}
            <div className={`verdict-banner verdict-${currentVerdict.color}`}>
              <div className="verdict-icon">
                <VerdictIcon size={40} />
              </div>
              <div className="verdict-content">
                <div className="verdict-label">{currentVerdict.label}</div>
                <h2>{displayed.title}</h2>
                <p>{displayed.summary || currentVerdict.description}</p>
                {displayed.degraded && (
                  <div className="degraded-notice">
                    <AlertTriangle size={16} />
                    <span>Data source temporarily unavailable – verify manually</span>
                  </div>
                )}
                {displayed.mode === 'simulated' && (
                  <div className="scenario-banner">Simulated — not live data</div>
                )}
                {(() => {
                  const permit = testPermits.find(item => item.id === activePermitId)
                  if (!permit?.expectedVerdict) return null
                  const matched = displayed.verdict === permit.expectedVerdict
                  return (
                    <div className={`outcome-match ${matched ? 'matched' : 'differed'}`}>
                      Expected {permit.expectedVerdict} — actual {displayed.verdict}
                      {!matched && permit.liveMayDiffer ? ' (live data may differ)' : ''}
                    </div>
                  )
                })()}
              </div>
              <button type="button" className="btn-text" onClick={resetFlow}>
                Check another route
              </button>
            </div>

            <div className="result-actions">
              <Button type="button" onClick={() => setShowSaveJob(true)}>
                <Briefcase size={16} /> Save as job
              </Button>
              <Button type="button" variant="outline" onClick={() => exportCurrent('pdf')}>
                <Download size={16} /> Export PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => exportCurrent('csv')}>
                <Download size={16} /> Export CSV
              </Button>
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
                <div className="results-map-card">
                  <Suspense fallback={<div className="results-map-fallback">Loading map…</div>}>
                    <RouteMapGL
                      ref={mapRef}
                      coordinates={displayed.route.coordinates}
                      origin={displayed.route.origin}
                      destination={displayed.route.destination}
                      evidence={displayed.evidence}
                      verdict={displayed.verdict}
                      activeLayer={activeLayer}
                      layers={routeLayers}
                      onLayerChange={setActiveLayer}
                      className="results-map"
                    />
                  </Suspense>
                </div>
              </div>

              <div className="results-sidebar">
                <div className="results-summary">
                  <h3>Route details</h3>
                  <div className="summary-grid">
                    <div><span>Origin</span><strong>{displayed.route.origin}</strong></div>
                    <div><span>Destination</span><strong>{displayed.route.destination}</strong></div>
                    <div><span>Distance</span><strong>{displayed.route.distance} km</strong></div>
                    <div><span>Evidence found</span><strong>{displayed.evidence.length}</strong></div>
                    <div><span>Retrieved</span><strong data-testid="result-retrieved-at">{formatBerlinDateTime(displayed.retrievedAt) || 'Just now'}</strong></div>
                    <div><span>Source</span><strong>{displayed.source || 'Autobahn GmbH'}</strong></div>
                  </div>
                </div>

                <div className="evidence-section">
                  <h3>
                    Evidence ({displayed.evidence.length})
                  </h3>
                  <div className="confirm-on-site-bar">
                    {displayed.verdict === 'HOLD' && (
                      <div className="evidence-hold-lock" role="note">
                        <strong>Why HOLD items have no Confirm on site</strong>
                        <p>HOLD items cannot be acknowledged away. They are confirmed mainline blocks (closure, height, width, or weight). Change the permitted route or wait until the restriction ends. VERIFY items below can still be confirmed on site.</p>
                      </div>
                    )}
                    <label>
                      <span>Dispatcher name</span>
                        <input
                          value={clearanceBy}
                          onChange={event => {
                            clearanceByRef.current = event.target.value
                            setClearanceBy(event.target.value)
                          }}
                          placeholder="Name stored with each confirmation"
                        />
                    </label>
                    <label className="clearance-tick">
                      <input
                        type="checkbox"
                        checked={clearanceConfirmed}
                        onChange={event => setResultClearance(event.target.checked)}
                      />
                      <span>
                        <strong>Bridge and clearance confirmed</strong>
                        Tick here on the result — no need to re-run the check.
                      </span>
                    </label>
                    {pendingVerify.length > 0 && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => confirmOnSite(pendingVerify.map(item => item.id))}
                      >
                        Confirm remaining VERIFY on site ({pendingVerify.length})
                      </button>
                    )}
                  </div>
                  <div className="evidence-list">
                    {primaryEvidence.map(item => (
                      <EvidenceCard
                        key={item.id}
                        item={item}
                        retrievedAt={displayed.retrievedAt}
                        onFly={() => item.lat != null && item.lng != null && mapRef.current?.flyToEvidence(item)}
                        onConfirm={() => confirmOnSite([item.id])}
                      />
                    ))}
                  </div>
                  {nearbyOffRoute.length > 0 && (
                    <details className="nearby-off-route-group">
                      <summary>Nearby, not on route ({nearbyOffRoute.length})</summary>
                      <p className="nearby-off-route-note">Other Autobahn, off-corridor ramps/AS, or BW state roads more than 0.5 km from the GPX line. Informational only — they do not block READY.</p>
                      <div className="evidence-list">
                        {nearbyOffRoute.map(item => (
                          <EvidenceCard
                            key={item.id}
                            item={item}
                            retrievedAt={displayed.retrievedAt}
                            onFly={() => item.lat != null && item.lng != null && mapRef.current?.flyToEvidence(item)}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile sticky action bar */}
            <div className="mobile-route-actions">
              <button type="button" className="btn-secondary" onClick={resetFlow}>
                Re-check
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => pendingVerify.length
                  ? confirmOnSite(pendingVerify.map(item => item.id))
                  : setToast(displayed.verdict === 'HOLD' ? 'HOLD items cannot be acknowledged away.' : 'No VERIFY items left to confirm.')}
              >
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

function EvidenceCard({
  item,
  retrievedAt,
  onFly,
  onConfirm,
}: {
  item: RouteEvidence
  retrievedAt?: string
  onFly: () => void
  onConfirm?: () => void
}) {
  const canConfirm = onConfirm && isAcknowledgeable(item) && !item.acknowledgedAt
  const holdLocked = isHoldItem(item)
  const title = displayEvidenceTitle(item)
  const original = evidenceOriginalGerman(item)
  const blob = `${item.title} ${item.detail}`
  const summarized = title !== splitConcatenatedPlaces(item.title || '')
  const keepOriginalAside = Boolean(original)
    && original.replace(/\s+/g, ' ') !== title.replace(/\s+/g, ' ')
    && (summarized || looksGerman(blob) || /[a-zäöüß][A-ZÄÖÜ]/.test(blob) || looksTechnical(blob))
  return (
    <div
      className={`evidence-card evidence-${item.state}`}
      onClick={() => item.lat != null && item.lng != null && onFly()}
      style={{ cursor: item.lat != null && item.lng != null ? 'pointer' : 'default' }}
    >
      <div className="evidence-header">
        <strong data-testid="evidence-title">{title}</strong>
        <span className={`confidence-badge confidence-${String(item.confidence).toLowerCase()}`}>
          {String(item.confidence).toLowerCase() === 'high' ? 'High confidence' : 'Medium confidence'}
        </span>
      </div>
      {keepOriginalAside ? (
        <details className="evidence-original">
          <summary>Original text (German)</summary>
          <pre>{original}</pre>
        </details>
      ) : (
        <p>{splitConcatenatedPlaces(item.detail || '')}</p>
      )}
      {(item.reason || item.distanceKm != null) && (
        <p className="evidence-reason">
          {item.distanceKm != null && (
            <span className="evidence-distance">{item.distanceKm.toFixed(2)} km from route · </span>
          )}
          {item.reason}
        </p>
      )}
      <div className="evidence-meta">
        <span>{item.source}</span>
        <span>·</span>
        <span>{formatStartLabel(item.startTimestamp ? formatBerlinDateTime(item.startTimestamp) : '')}</span>
        {item.endTimestamp && (
          <>
            <span>·</span>
            <span>Until {formatBerlinDateTime(item.endTimestamp)}</span>
          </>
        )}
        <span>·</span>
        <span>Retrieved {formatBerlinDateTime(item.retrievedAt || retrievedAt) || 'just now'}</span>
        {item.longRunning && <span className="evidence-long-running">Long-running / verify on site</span>}
        {item.lat != null && item.lng != null && (
          <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.6 }}>📍 Click to view</span>
        )}
      </div>
      {item.acknowledgedBy && (
        <p className="evidence-ack">Confirmed on site by {item.acknowledgedBy} · {formatBerlinDateTime(item.acknowledgedAt)}</p>
      )}
      {canConfirm && (
        <button
          type="button"
          className="btn-secondary evidence-confirm-btn"
          onClick={event => {
            event.stopPropagation()
            onConfirm?.()
          }}
        >
          Confirm on site
        </button>
      )}
      {holdLocked && (
        <div className="evidence-hold-lock" role="note">
          <strong>Why this cannot be confirmed on site</strong>
          <p>HOLD items cannot be acknowledged away. This is a confirmed mainline block (closure, height, width, or weight). Change the permitted route or wait until the restriction ends.</p>
        </div>
      )}
    </div>
  )
}

function PermitCard({ permit, onSelect }: { permit: TestPermit; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      className={`test-permit-card kind-${permit.kind}`}
      onClick={() => onSelect(permit.id)}
    >
      <MapPin size={20} />
      <div>
        <strong>{permit.name.split('·')[0].trim()}</strong>
        <span>{permit.permitNumber || permit.liveLabel}</span>
        <span className="permit-card-label">{permit.liveLabel}</span>
      </div>
      {permit.expectedVerdict && (
        <b className={`expected-badge expected-${permit.expectedVerdict.toLowerCase()}`}>
          Expected {permit.expectedVerdict}
        </b>
      )}
    </button>
  )
}
