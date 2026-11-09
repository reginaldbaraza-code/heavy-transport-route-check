import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RouteEvidence, RouteVerdict } from '../data/routeChecks'
import { readJson, STORAGE_KEYS, writeJson } from '../lib/browserStore'

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
}

export type OnSiteOutcome = 'Open' | 'Closed' | 'Partly'

type AlertState = {
  readIds: string[]
  resolvedIds: string[]
}

const emptyAlertState: AlertState = { readIds: [], resolvedIds: [] }

function alertsFromHistory(history: CheckHistoryRecord[], alertState: AlertState): MonitoringAlert[] {
  return history
    .filter(record => record.verdict === 'HOLD' || record.verdict === 'VERIFY')
    .map(record => {
      const resolved = alertState.resolvedIds.includes(record.id)
      const read = resolved || alertState.readIds.includes(record.id)
      return {
        id: record.id,
        time: record.runAt,
        runAt: record.runAt,
        routeId: record.id,
        routeLabel: record.routeLabel || record.permitName,
        change: `Route check: ${record.verdict}`,
        detail: `${record.summary} · ${record.evidenceCount} evidence item${record.evidenceCount === 1 ? '' : 's'}.`,
        severity: record.verdict,
        status: resolved ? 'Resolved' : read ? 'Acknowledged' : 'New',
        source: record.source || 'Autobahn GmbH',
      }
    })
}

type RouteMonitoringValue = {
  history: CheckHistoryRecord[]
  alerts: MonitoringAlert[]
  unreadCount: number
  disruptions: Record<string, boolean>
  onSiteReports: Record<string, RouteEvidence[]>
  onSiteOutcomes: Record<string, OnSiteOutcome | undefined>
  recordCheck: (record: Omit<CheckHistoryRecord, 'id'>) => CheckHistoryRecord
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
  const [disruptions, setDisruptions] = useState<Record<string, boolean>>({})
  const [onSiteReports, setOnSiteReports] = useState<Record<string, RouteEvidence[]>>({})
  const [onSiteOutcomes, setOnSiteOutcomes] = useState<Record<string, OnSiteOutcome | undefined>>({})

  const recordCheck = useCallback<RouteMonitoringValue['recordCheck']>(record => {
    const saved: CheckHistoryRecord = {
      ...record,
      id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    setHistory(current => {
      const next = [saved, ...current].slice(0, 100)
      writeJson(STORAGE_KEYS.checkHistory, next)
      return next
    })
    return saved
  }, [])

  const acknowledgeAlert = useCallback((id: string) => {
    setAlertState(current => {
      if (current.readIds.includes(id) || current.resolvedIds.includes(id)) return current
      const next = { ...current, readIds: [...current.readIds, id] }
      writeJson(STORAGE_KEYS.alertState, next)
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

  const alerts = useMemo(() => alertsFromHistory(history, alertState), [alertState, history])

  const value = useMemo<RouteMonitoringValue>(() => ({
    history,
    alerts,
    unreadCount: alerts.filter(alert => alert.status === 'New').length,
    disruptions,
    onSiteReports,
    onSiteOutcomes,
    recordCheck,
    acknowledgeAlert,
    resolveAlert,
    simulateNewDisruption,
    clearDisruption,
    addOnSiteReport,
  }), [acknowledgeAlert, alerts, disruptions, history, onSiteOutcomes, onSiteReports, recordCheck, resolveAlert])

  return <RouteMonitoringContext.Provider value={value}>{children}</RouteMonitoringContext.Provider>
}

export function useRouteMonitoring() {
  const context = useContext(RouteMonitoringContext)
  if (!context) throw new Error('useRouteMonitoring must be used inside RouteMonitoringProvider')
  return context
}
