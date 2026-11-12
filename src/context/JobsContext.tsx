import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RouteVerdict } from '../data/routeChecks'
import { flushPendingSaves, getCachedRaw, readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'
import {
  applyCheckToJob,
  DEFAULT_MONITOR_PREFS,
  isFutureDeparture,
  jobCheckOptions,
  jobDueForCheck,
  newJobId,
  normalizeSavedJob,
  sanitizeCorridor,
  shouldMonitorJob,
  type MonitorPrefs,
  type SavedJob,
} from '../lib/jobs'
import { notificationBody, shouldEscalateAlert, verdictChangeCopy } from '../lib/monitoring'
import { checkRoute, type RouteCheckResult } from '../lib/routeCheck'
import { confirmOnSiteTitles } from '../lib/siteAcknowledgements'
import { useRouteMonitoring } from './RouteMonitoringContext'

export type JobDraft = Omit<SavedJob, 'id' | 'createdAt' | 'updatedAt'>

type JobsValue = {
  jobs: SavedJob[]
  prefs: MonitorPrefs
  notificationPermission: NotificationPermission | 'unsupported'
  monitoringActive: boolean
  monitoredCount: number
  checkingJobId: string | null
  lastTickAt: string | null
  saveJob: (draft: JobDraft, id?: string) => SavedJob
  updateJob: (id: string, patch: Partial<SavedJob>) => SavedJob | null
  deleteJob: (id: string) => void
  getJob: (id: string) => SavedJob | undefined
  runJobCheck: (id: string) => Promise<RouteCheckResult | null>
  setPrefs: (patch: Partial<MonitorPrefs>) => void
  requestNotifications: () => Promise<NotificationPermission | 'unsupported'>
}

const JobsContext = createContext<JobsValue | null>(null)

function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body })
  } catch {
    // Safari private mode and some embedded browsers throw.
  }
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const { recordCheck, addAlert, alerts, markAlertEscalated } = useRouteMonitoring()
  const [jobs, setJobs] = useState<SavedJob[]>(() => (
    typeof window === 'undefined'
      ? []
      : readJson<SavedJob[]>(STORAGE_KEYS.savedJobs, []).map(normalizeSavedJob)
  ))
  const [prefs, setPrefsState] = useState<MonitorPrefs>(() => (
    typeof window === 'undefined' ? DEFAULT_MONITOR_PREFS : { ...DEFAULT_MONITOR_PREFS, ...readJson<Partial<MonitorPrefs>>(STORAGE_KEYS.monitorPrefs, {}) }
  ))
  const [checkingJobId, setCheckingJobId] = useState<string | null>(null)
  const [lastTickAt, setLastTickAt] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })
  const jobsRef = useRef(jobs)
  const prefsRef = useRef(prefs)
  const alertsRef = useRef(alerts)
  const checkingRef = useRef<Set<string>>(new Set())
  jobsRef.current = jobs
  prefsRef.current = prefs
  alertsRef.current = alerts

  const persistJobs = (next: SavedJob[]) => {
    const normalized = next.map(normalizeSavedJob)
    writeJson(STORAGE_KEYS.savedJobs, normalized)
    setJobs(normalized)
  }

  const saveJob = useCallback<JobsValue['saveJob']>((draft, id) => {
    const now = new Date().toISOString()
    const existing = id ? jobsRef.current.find(job => job.id === id) : undefined
    const corridor = sanitizeCorridor(draft.corridor, draft.permittedRoads, existing?.corridor, existing?.permittedRoads)
    const saved: SavedJob = normalizeSavedJob({
      ...existing,
      ...draft,
      corridor: corridor || draft.corridor || existing?.corridor || '',
      permittedRoads: draft.permittedRoads || existing?.permittedRoads,
      id: existing?.id || id || newJobId(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      monitoringStoppedReason: draft.monitoringStoppedReason !== undefined 
        ? draft.monitoringStoppedReason 
        : (isFutureDeparture(draft) ? null : 'departed'),
    })
    persistJobs([saved, ...jobsRef.current.filter(job => job.id !== saved.id)])
    return saved
  }, [])

  const updateJob = useCallback<JobsValue['updateJob']>((id, patch) => {
    const current = jobsRef.current.find(job => job.id === id)
    if (!current) return null
    const next = normalizeSavedJob({ ...current, ...patch, id, updatedAt: new Date().toISOString() })
    persistJobs(jobsRef.current.map(job => job.id === id ? next : job))
    return next
  }, [])

  const deleteJob = useCallback<JobsValue['deleteJob']>(id => {
    persistJobs(jobsRef.current.filter(job => job.id !== id))
  }, [])

  const getJob = useCallback((id: string) => {
    const job = jobsRef.current.find(job => job.id === id)
    return job ? normalizeSavedJob(job) : undefined
  }, [])

  const setPrefs = useCallback<JobsValue['setPrefs']>(patch => {
    setPrefsState(current => {
      const next = { ...current, ...patch }
      writeJson(STORAGE_KEYS.monitorPrefs, next)
      return next
    })
  }, [])

  const requestNotifications = useCallback<JobsValue['requestNotifications']>(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return 'unsupported'
    }
    const result = await Notification.requestPermission()
    setNotificationPermission(result)
    return result
  }, [])

  const applyResult = useCallback((job: SavedJob, result: RouteCheckResult, kind: 'check' | 'verdict-change') => {
    const nowIso = new Date().toISOString()
    const previous = job.lastVerdict
    const nextJob = applyCheckToJob(job, result, nowIso)
    persistJobs(jobsRef.current.map(item => item.id === job.id ? nextJob : item))
    const history = recordCheck({
      permitName: job.permitNumber || job.name || job.routeFileName,
      routeLabel: `${nextJob.origin} → ${nextJob.destination}`,
      runAt: nowIso,
      verdict: result.verdict,
      evidenceCount: result.evidence.length,
      retrievedAt: result.retrievedAt || nowIso,
      source: result.source || 'Autobahn GmbH',
      summary: result.summary,
      degraded: result.degraded,
      permitNumber: job.permitNumber,
      vehicle: job.vehicle,
      title: result.title,
      impact: result.impact,
      confidence: result.confidence,
      evidence: result.evidence,
      confirmOnSite: confirmOnSiteTitles(result.evidence),
      jobId: job.id,
      alertEligible: true,
    })
    const verdictChanged = Boolean(previous && previous !== result.verdict)
    if (kind === 'verdict-change' || verdictChanged) {
      const change = verdictChanged
        ? verdictChangeCopy(previous, result.verdict)
        : `Route check: ${result.verdict}`
      addAlert({
        id: history.id,
        runAt: nowIso,
        routeId: job.id,
        routeLabel: `${nextJob.origin} → ${nextJob.destination}`,
        change,
        detail: result.summary,
        severity: result.verdict,
        status: 'New',
        source: result.source || 'Autobahn GmbH',
        jobId: job.id,
        previousVerdict: previous,
        nextVerdict: result.verdict,
        kind: 'verdict-change',
      })
      if (verdictChanged) {
        showBrowserNotification(change, notificationBody(`${nextJob.origin} → ${nextJob.destination}`, change, result.summary))
      }
    }
    return result
  }, [addAlert, recordCheck])

  const runJobCheck = useCallback<JobsValue['runJobCheck']>(async id => {
    const job = jobsRef.current.find(item => item.id === id)
    if (!job || checkingRef.current.has(id)) return null
    checkingRef.current.add(id)
    setCheckingJobId(id)
    try {
      const result = await checkRoute(job.gpxContent, job.vehicle, {
        ...jobCheckOptions(job),
        departureStart: job.plannedDeparture,
        acknowledgements: job.siteAcknowledgements,
      })
      applyResult(job, result, job.lastVerdict && job.lastVerdict !== result.verdict ? 'verdict-change' : 'check')
      return result
    } catch (error) {
      const nowIso = new Date().toISOString()
      updateJob(id, { lastCheckedAt: nowIso, lastSummary: error instanceof Error ? error.message : 'Check failed' })
      return null
    } finally {
      checkingRef.current.delete(id)
      setCheckingJobId(current => current === id ? null : current)
    }
  }, [applyResult, updateJob])

  const simulateVerdictChange = useCallback((jobId: string, nextVerdict: RouteVerdict) => {
    const job = jobsRef.current.find(item => item.id === jobId)
    if (!job) return null
    const previous = job.lastVerdict && job.lastVerdict !== nextVerdict
      ? job.lastVerdict
      : nextVerdict === 'HOLD' ? 'READY' : 'HOLD'
    const jobWithPrevious = { ...job, lastVerdict: previous as RouteVerdict }
    const nowIso = new Date().toISOString()
    const result: RouteCheckResult = {
      verdict: nextVerdict,
      title: nextVerdict === 'HOLD' ? 'Hold departure – simulated monitoring change' : nextVerdict === 'READY' ? 'Route clear – simulated monitoring change' : 'Verification required – simulated monitoring change',
      summary: `Test hook changed the stored verdict to ${nextVerdict}.`,
      impact: `Selected vehicle: ${job.vehicle.width}m × ${job.vehicle.height}m × ${job.vehicle.length}m · ${job.vehicle.grossWeight}t`,
      confidence: nextVerdict === 'HOLD' ? 'high' : 'medium',
      issueCount: nextVerdict === 'READY' ? 0 : 1,
      evidence: [{
        id: 'bridge-clearance-unknown',
        title: 'Bridge and clearance data not available',
        detail: 'Unknown clearance cannot yield READY — confirm on site before departure.',
        source: 'Route check system',
        age: 'Just now',
        confidence: 'medium',
        state: 'warning',
        category: 'observations',
        retrievedAt: nowIso,
      }],
      route: {
        coordinates: [],
        origin: job.origin || 'Origin',
        destination: job.destination || 'Destination',
        distance: 0,
        corridor: job.corridor || 'Saved job',
      },
      degraded: false,
      retrievedAt: nowIso,
      source: 'Test hook',
    }
    return applyResult(jobWithPrevious, result, 'verdict-change')
  }, [applyResult])

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (document.visibilityState !== 'visible' || !hiddenAt) return
      const hiddenFor = Date.now() - hiddenAt
      hiddenAt = 0
      for (const job of jobsRef.current) {
        const intervalMs = Math.max(1, job.monitorIntervalMinutes || DEFAULT_MONITOR_PREFS.intervalMinutes) * 60 * 1000
        if (shouldMonitorJob(job) && hiddenFor >= intervalMs) void runJobCheck(job.id)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [runJobCheck])

  useEffect(() => {
    const tickMs = typeof window !== 'undefined' && window.__HT_TEST__?.tickMs ? window.__HT_TEST__.tickMs : 15000
    const tick = () => {
      const now = Date.now()
      setLastTickAt(new Date(now).toISOString())
      for (const job of jobsRef.current) {
        if (!isFutureDeparture(job, now) && job.monitoringStoppedReason !== 'departed') {
          persistJobs(jobsRef.current.map(item => item.id === job.id ? { ...item, monitoringStoppedReason: 'departed', updatedAt: new Date(now).toISOString() } : item))
        }
      }
      for (const alert of alertsRef.current) {
        const job = jobsRef.current.find(item => item.id === alert.jobId || item.id === alert.routeId)
        if (!alert.escalated && shouldEscalateAlert(alert, job, prefsRef.current, now)) {
          markAlertEscalated(alert.id)
        }
      }
      for (const job of jobsRef.current) {
        if (jobDueForCheck(job, now)) void runJobCheck(job.id)
      }
    }
    const id = window.setInterval(tick, tickMs)
    tick()
    return () => window.clearInterval(id)
  }, [markAlertEscalated, runJobCheck])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__HT_TEST__ = {
      getJobs: () => jobsRef.current,
      getAlerts: () => alertsRef.current,
      getHistory: () => {
        try {
          return JSON.parse(getCachedRaw(STORAGE_KEYS.checkHistory) || '[]')
        } catch {
          return []
        }
      },
      getStore: (key: string) => {
        const raw = getCachedRaw(key)
        if (raw == null) return null
        try {
          return JSON.parse(raw)
        } catch {
          return null
        }
      },
      setStore: (key: string, value: unknown) => {
        writeJson(key, value)
      },
      flushStore: () => flushPendingSaves(),
      simulateVerdictChange: (jobId, verdict) => simulateVerdictChange(jobId, verdict),
      tickMs: window.__HT_TEST__?.tickMs,
      pdfBytesFromSnapshot: window.__HT_TEST__?.pdfBytesFromSnapshot ?? (() => {
        throw new Error('PDF helper is only available on the route check screen')
      }),
      sanitizePdfText: window.__HT_TEST__?.sanitizePdfText ?? (value => String(value ?? '')),
    }
    return () => {
      delete window.__HT_TEST__
    }
  }, [simulateVerdictChange])

  const monitoredCount = jobs.filter(job => shouldMonitorJob(job)).length
  const value = useMemo<JobsValue>(() => ({
    jobs,
    prefs,
    notificationPermission,
    monitoringActive: monitoredCount > 0,
    monitoredCount,
    checkingJobId,
    lastTickAt,
    saveJob,
    updateJob,
    deleteJob,
    getJob,
    runJobCheck,
    setPrefs,
    requestNotifications,
  }), [checkingJobId, deleteJob, getJob, jobs, lastTickAt, monitoredCount, notificationPermission, prefs, requestNotifications, runJobCheck, saveJob, setPrefs, updateJob])

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}

export function useJobs() {
  const context = useContext(JobsContext)
  if (!context) throw new Error('useJobs must be used inside JobsProvider')
  return context
}
