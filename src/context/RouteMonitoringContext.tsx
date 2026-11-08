import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RouteEvidence, RouteVerdict } from '../data/routeChecks'

export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved'

export type MonitoringAlert = {
  id: string
  time: string
  routeId: string
  change: string
  detail: string
  severity: RouteVerdict
  status: AlertStatus
}

export type OnSiteOutcome = 'Open' | 'Closed' | 'Partly'

const initialAlerts: MonitoringAlert[] = [
  { id: 'alert-a7-closure', time: '2 min ago', routeId: 'bremen-hannover', change: 'New closure on A7 22:00–05:00', detail: 'Verdict changed VERIFY → HOLD', severity: 'HOLD', status: 'New' },
  { id: 'alert-width-hold', time: '18 min ago', routeId: 'duisburg-munich', change: 'Verdict changed READY → HOLD', detail: 'Selected vehicle exceeds the A3 lane-width restriction.', severity: 'HOLD', status: 'New' },
  { id: 'alert-a9-conflict', time: '40 min ago', routeId: 'leipzig-nuremberg', change: 'Conflicting report on A9', detail: 'Official feed reports closed; on-site driver reports open.', severity: 'VERIFY', status: 'New' },
  { id: 'alert-source-outage', time: '1 h ago', routeId: 'duisburg-munich', change: 'Source unavailable', detail: 'Roadworks feed did not respond during a scheduled refresh.', severity: 'VERIFY', status: 'Acknowledged' },
  { id: 'alert-onsite-confirmed', time: 'Yesterday', routeId: 'hamburg-kassel', change: 'Verification confirmed by on-site driver', detail: 'A7 corridor reported open and passable.', severity: 'READY', status: 'Resolved' },
]

type RouteMonitoringValue = {
  alerts: MonitoringAlert[]
  unreadCount: number
  disruptions: Record<string, boolean>
  onSiteReports: Record<string, RouteEvidence[]>
  onSiteOutcomes: Record<string, OnSiteOutcome | undefined>
  addAlert: (alert: Omit<MonitoringAlert, 'id' | 'time'>) => void
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  simulateNewDisruption: (routeId: string) => void
  clearDisruption: (routeId: string) => void
  addOnSiteReport: (routeId: string, outcome: OnSiteOutcome, note: string, photoName?: string) => void
}

const RouteMonitoringContext = createContext<RouteMonitoringValue | null>(null)

export function RouteMonitoringProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState(initialAlerts)
  const [disruptions, setDisruptions] = useState<Record<string, boolean>>({})
  const [onSiteReports, setOnSiteReports] = useState<Record<string, RouteEvidence[]>>({})
  const [onSiteOutcomes, setOnSiteOutcomes] = useState<Record<string, OnSiteOutcome | undefined>>({})

  const addAlert: RouteMonitoringValue['addAlert'] = alert => {
    setAlerts(current => [{
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: 'Just now',
    }, ...current])
  }

  const acknowledgeAlert = (id: string) => {
    setAlerts(current => current.map(alert => alert.id === id && alert.status === 'New' ? { ...alert, status: 'Acknowledged' } : alert))
  }

  const resolveAlert = (id: string) => {
    setAlerts(current => current.map(alert => alert.id === id ? { ...alert, status: 'Resolved' } : alert))
  }

  const simulateNewDisruption = (routeId: string) => {
    if (disruptions[routeId]) return
    setDisruptions(current => ({ ...current, [routeId]: true }))
    addAlert({
      routeId,
      change: 'Verdict changed READY → HOLD',
      detail: 'New closure on A7 22:00–05:00',
      severity: 'HOLD',
      status: 'New',
    })
  }

  const clearDisruption = (routeId: string) => {
    setDisruptions(current => ({ ...current, [routeId]: false }))
  }

  const addOnSiteReport = (routeId: string, outcome: OnSiteOutcome, note: string, photoName?: string) => {
    const state = outcome === 'Open' ? 'clear' : outcome === 'Closed' ? 'danger' : 'warning'
    const report: RouteEvidence = {
      id: `onsite-${Date.now()}`,
      title: `On-site confirmation: ${outcome}`,
      detail: [note || `Driver or escort reported the lane/road as ${outcome.toLowerCase()}.`, photoName ? `Photo: ${photoName}` : ''].filter(Boolean).join(' '),
      source: 'On-site driver or escort',
      age: 'Just now',
      confidence: 'High',
      state,
      category: 'observations',
    }
    setOnSiteReports(current => ({ ...current, [routeId]: [report, ...(current[routeId] ?? [])] }))
    setOnSiteOutcomes(current => ({ ...current, [routeId]: outcome }))
    addAlert({
      routeId,
      change: 'Verification confirmed by on-site driver',
      detail: `Lane/road reported ${outcome.toLowerCase()}${note ? ` · ${note}` : ''}`,
      severity: outcome === 'Open' ? 'READY' : outcome === 'Closed' ? 'HOLD' : 'VERIFY',
      status: 'New',
    })
  }

  const value = useMemo<RouteMonitoringValue>(() => ({
    alerts,
    unreadCount: alerts.filter(alert => alert.status === 'New').length,
    disruptions,
    onSiteReports,
    onSiteOutcomes,
    addAlert,
    acknowledgeAlert,
    resolveAlert,
    simulateNewDisruption,
    clearDisruption,
    addOnSiteReport,
  }), [alerts, disruptions, onSiteOutcomes, onSiteReports])

  return <RouteMonitoringContext.Provider value={value}>{children}</RouteMonitoringContext.Provider>
}

export function useRouteMonitoring() {
  const context = useContext(RouteMonitoringContext)
  if (!context) throw new Error('useRouteMonitoring must be used inside RouteMonitoringProvider')
  return context
}
