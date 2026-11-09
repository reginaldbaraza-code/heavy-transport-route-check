import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RouteEvidence, RouteVerdict } from '../data/routeChecks'
import { readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'
import type { VehicleDims } from '../lib/jobs'

export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved'

export type CheckHistoryRecord = {
  id: string
  permitName: string
  routeLabel: string
  runAt: string
  verdict: RouteVerdict
  evidenceCount: number
  retrievedAt: string
  source: string
  summary: string
  degraded?: boolean
  permitNumber?: string
  vehicle?: VehicleDims | null
  title?: string
  impact?: string
  confidence?: string
  evidence?: RouteEvidence[]
  confirmOnSite?: string[]
  jobId?: string
  alertEligible?: boolean
  siteAcknowledgements?: Array<{
    evidenceId: string
    acknowledgedBy: string
    acknowledgedAt: string
  }>
}

export type MonitoringAlert = {
  id: string
  time: string
  runAt: string
  routeId: string
  routeLabel: string
  change: string
  detail: string
  severity: RouteVerdict
  status: AlertStatus
  source: string
  jobId?: string
  previousVerdict?: RouteVerdict
  nextVerdict?: RouteVerdict
  escalated?: boolean
  escalatedAt?: string
  kind?: 'check' | 'verdict-change'
}

export type OnSiteOutcome = 'Open' | 'Closed' | 'Partly'

type AlertState = {
  readIds: string[]
  resolvedIds: string[]
}

const emptyAlertState: AlertState = { readIds: [], resolvedIds: [] }

function alertsFromHistory(history: CheckHistoryRecord[], alertState: AlertState): MonitoringAlert[] {
  return history
    .filter(record => record.alertEligible !== false && (record.verdict === 'HOLD' || record.verdict === 'VERIFY') && Boolean(record.jobId))
    .map(record => {
      const resolved = alertState.resolvedIds.includes(record.id)
      const read = resolved || alertState.readIds.includes(record.id)
      return {
        id: record.id,
        time: record.runAt,
        runAt: record.runAt,
        routeId: record.jobId || record.id,
        routeLabel: record.routeLabel || record.permitName,
        change: `Route check: ${record.verdict}`,
        detail: `${record.summary} · ${record.evidenceCount} evidence item${record.evidenceCount === 1 ? '' : 's'}.`,
        severity: record.verdict,
        status: (resolved ? 'Resolved' : read ? 'Acknowledged' : 'New') as AlertStatus,
        source: record.source || 'Autobahn GmbH',
        jobId: record.jobId,
        kind: 'check' as const,
      }
    })
}

function mergeAlerts(historyAlerts: MonitoringAlert[], extra: MonitoringAlert[], alertState: AlertState): MonitoringAlert[] {
  const applied = extra.map(alert => {
    const resolved = alertState.resolvedIds.includes(alert.id) || alert.status === 'Resolved'
    const read = resolved || alertState.readIds.includes(alert.id) || alert.status === 'Acknowledged'
    return {
      ...alert,
      status: (resolved ? 'Resolved' : read ? 'Acknowledged' : 'New') as AlertStatus,
    }
  })
  const extraIds = new Set(applied.map(alert => alert.id))
  return [...applied, ...historyAlerts.filter(alert => !extraIds.has(alert.id))]
}

export type NewAlertInput = Omit<MonitoringAlert, 'id' | 'time'> & { id?: string }

type RouteMonitoringValue = {
  history: CheckHistoryRecord[]
  alerts: MonitoringAlert[]
  unreadCount: number
  disruptions: Record<string, boolean>
  onSiteReports: Record<string, RouteEvidence[]>
  onSiteOutcomes: Record<string, OnSiteOutcome | undefined>
  recordCheck: (record: Omit<CheckHistoryRecord, 'id'> & { id?: string }) => CheckHistoryRecord
  patchHistory: (id: string, patch: Partial<CheckHistoryRecord>) => void
  addAlert: (alert: NewAlertInput) => MonitoringAlert
  markAlertEscalated: (id: string) => void
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  simulateNewDisruption: (routeId: string) => void
  clearDisruption: (routeId: string) => void
  addOnSiteReport: (routeId: string, outcome: OnSiteOutcome, note: string, photoName?: string) => void
}

const RouteMonitoringContext = createContext<RouteMonitoringValue | null>(null)

export function RouteMonitoringProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<CheckHistoryRecord[]>(() => (
    typeof window === 'undefined' ? [] : readJson<CheckHistoryRecord[]>(STORAGE_KEYS.checkHistory, [])
  ))
  const [alertState, setAlertState] = useState<AlertState>(() => (
    typeof window === 'undefined' ? emptyAlertState : readJson<AlertState>(STORAGE_KEYS.alertState, emptyAlertState)
  ))
  const [extraAlerts, setExtraAlerts] = useState<MonitoringAlert[]>(() => (
    typeof window === 'undefined' ? [] : readJson<MonitoringAlert[]>(STORAGE_KEYS.extraAlerts, [])
  ))
  const [disruptions, setDisruptions] = useState<Record<string, boolean>>({})
  const [onSiteReports, setOnSiteReports] = useState<Record<string, RouteEvidence[]>>({})
  const [onSiteOutcomes, setOnSiteOutcomes] = useState<Record<string, OnSiteOutcome | undefined>>({})

  const recordCheck = useCallback<RouteMonitoringValue['recordCheck']>(record => {
    const saved: CheckHistoryRecord = {
      ...record,
      id: record.id || `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    setHistory(current => {
      const next = [saved, ...current.filter(item => item.id !== saved.id)].slice(0, 100)
      writeJson(STORAGE_KEYS.checkHistory, next)
      return next
    })
    return saved
  }, [])

  const patchHistory = useCallback<RouteMonitoringValue['patchHistory']>((id, patch) => {
    setHistory(current => {
      const next = current.map(item => item.id === id ? { ...item, ...patch } : item)
      writeJson(STORAGE_KEYS.checkHistory, next)
      return next
    })
  }, [])

  const addAlert = useCallback<RouteMonitoringValue['addAlert']>(alert => {
    const saved: MonitoringAlert = {
      ...alert,
      id: alert.id || `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: alert.runAt,
    }
    setExtraAlerts(current => {
      const next = [saved, ...current.filter(item => item.id !== saved.id)].slice(0, 100)
      writeJson(STORAGE_KEYS.extraAlerts, next)
      return next
    })
    return saved
  }, [])

  const markAlertEscalated = useCallback((id: string) => {
    const at = new Date().toISOString()
    setExtraAlerts(current => {
      const next = current.map(alert => alert.id === id ? { ...alert, escalated: true, escalatedAt: alert.escalatedAt || at } : alert)
      writeJson(STORAGE_KEYS.extraAlerts, next)
      return next
    })
  }, [])

  const acknowledgeAlert = useCallback((id: string) => {
    setAlertState(current => {
      if (current.readIds.includes(id) || current.resolvedIds.includes(id)) return current
      const next = { ...current, readIds: [...current.readIds, id] }
      writeJson(STORAGE_KEYS.alertState, next)
      return next
    })
    setExtraAlerts(current => {
      const next = current.map(alert => alert.id === id && alert.status === 'New' ? { ...alert, status: 'Acknowledged' as const } : alert)
      writeJson(STORAGE_KEYS.extraAlerts, next)
      return next
    })
  }, [])

  const resolveAlert = useCallback((id: string) => {
    setAlertState(current => {
      const next = {
        readIds: current.readIds.includes(id) ? current.readIds : [...current.readIds, id],
        resolvedIds: current.resolvedIds.includes(id) ? current.resolvedIds : [...current.resolvedIds, id],
      }
      writeJson(STORAGE_KEYS.alertState, next)
      return next
    })
    setExtraAlerts(current => {
      const next = current.map(alert => alert.id === id ? { ...alert, status: 'Resolved' as const } : alert)
      writeJson(STORAGE_KEYS.extraAlerts, next)
      return next
    })
  }, [])

  const simulateNewDisruption = (routeId: string) => {
    if (disruptions[routeId]) return
    setDisruptions(current => ({ ...current, [routeId]: true }))
  }

  const clearDisruption = (routeId: string) => {
    setDisruptions(current => ({ ...current, [routeId]: false }))
  }

  const addOnSiteReport = (routeId: string, outcome: OnSiteOutcome, note: string, photoName?: string) => {
    const now = new Date().toISOString()
    const state = outcome === 'Open' ? 'clear' : outcome === 'Closed' ? 'danger' : 'warning'
    const report: RouteEvidence = {
      id: `onsite-${Date.now()}`,
      title: `On-site confirmation: ${outcome}`,
      detail: [note || `Driver or escort reported the lane/road as ${outcome.toLowerCase()}.`, photoName ? `Photo: ${photoName}` : ''].filter(Boolean).join(' '),
      source: 'On-site driver or escort',
      age: 'Just now',
      confidence: 'high',
      state,
      category: 'observations',
      retrievedAt: now,
    }
    setOnSiteReports(current => ({ ...current, [routeId]: [report, ...(current[routeId] ?? [])] }))
    setOnSiteOutcomes(current => ({ ...current, [routeId]: outcome }))
  }

  const alerts = useMemo(
    () => mergeAlerts(alertsFromHistory(history, alertState), extraAlerts, alertState),
    [alertState, extraAlerts, history],
  )

  const value = useMemo<RouteMonitoringValue>(() => ({
    history,
    alerts,
    unreadCount: alerts.filter(alert => alert.status === 'New').length,
    disruptions,
    onSiteReports,
    onSiteOutcomes,
    recordCheck,
    patchHistory,
    addAlert,
    markAlertEscalated,
    acknowledgeAlert,
    resolveAlert,
    simulateNewDisruption,
    clearDisruption,
    addOnSiteReport,
  }), [acknowledgeAlert, addAlert, alerts, disruptions, history, markAlertEscalated, onSiteOutcomes, onSiteReports, patchHistory, recordCheck, resolveAlert])

  return <RouteMonitoringContext.Provider value={value}>{children}</RouteMonitoringContext.Provider>
}

export function useRouteMonitoring() {
  const context = useContext(RouteMonitoringContext)
  if (!context) throw new Error('useRouteMonitoring must be used inside RouteMonitoringProvider')
  return context
}
