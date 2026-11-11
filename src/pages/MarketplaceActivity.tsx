import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BellRing, CheckCircle2, ChevronRight, CircleX, Download, History, Route, Plus,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { formatBerlinDateTime } from '../lib/formatTime'
import { downloadSnapshot, snapshotFromHistory } from '../lib/exportCheck'

const filters = ['All', 'Hold', 'Verify', 'Resolved'] as const

export default function MarketplaceActivity() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [routeFilter, setRouteFilter] = useState('all')
  const { alerts, history, acknowledgeAlert, resolveAlert, recordCheck, addAlert } = useRouteMonitoring()
  const navigate = useNavigate()
  const routeOptions = Array.from(new Set(history.map(record => record.permitName).filter(Boolean)))
  const shown = alerts.filter(alert => {
    const matchesRoute = routeFilter === 'all' || alert.routeLabel === routeFilter || history.find(record => record.id === alert.id)?.permitName === routeFilter
    const matchesFilter = filter === 'All'
      || filter === 'Hold' && alert.severity === 'HOLD'
      || filter === 'Verify' && alert.severity === 'VERIFY'
      || filter === 'Resolved' && alert.status === 'Resolved'
    return matchesRoute && matchesFilter
  })

  return (
    <div className="market-page route-alert-page">
      <PageHeader
        eyebrow="Live route monitoring"
        title="Alerts & history"
        description="Alerts and history come only from route checks you actually ran in this browser, plus their Autobahn GmbH results."
      />
      <p className="storage-note activity-storage-note">History is stored only in this browser. It is not synced to a server.</p>

      <div className="route-alert-filters">
        <div className="activity-filters" role="group" aria-label="Alert severity">
          {filters.map(item => (
            <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="route-alert-filter-row">
          <label>
            <span>Route</span>
            <select value={routeFilter} onChange={event => setRouteFilter(event.target.value)}>
              <option value="all">All permitted routes</option>
              {routeOptions.map(name => (
                <option value={name} key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-text load-demo-btn"
            onClick={() => {
              const now = new Date()
              const hour = 3600000
              
              // Sample 1: HOLD alert from 2 hours ago
              const holdCheck = recordCheck({
                permitName: 'Mannheim to Freiburg',
                routeLabel: 'A5 Karlsruhe → Basel',
                runAt: new Date(now.getTime() - 2 * hour).toISOString(),
                verdict: 'HOLD',
                evidenceCount: 3,
                retrievedAt: new Date(now.getTime() - 2 * hour).toISOString(),
                source: 'Autobahn GmbH MIA, Open Roadworks',
                summary: 'Full closure detected on mainline',
                alertEligible: true,
              })
              
              addAlert({
                runAt: holdCheck.runAt,
                routeId: holdCheck.id,
                routeLabel: holdCheck.routeLabel,
                change: 'READY → HOLD',
                detail: 'Full carriageway closure detected near AS Baden-Baden',
                severity: 'HOLD',
                status: 'New',
                source: holdCheck.source,
                previousVerdict: 'READY',
                nextVerdict: 'HOLD',
              })
              
              // Sample 2: VERIFY alert from 45 minutes ago
              const verifyCheck = recordCheck({
                permitName: 'Stuttgart to Karlsruhe',
                routeLabel: 'A8 Stuttgart → Karlsruhe',
                runAt: new Date(now.getTime() - 45 * 60000).toISOString(),
                verdict: 'VERIFY',
                evidenceCount: 2,
                retrievedAt: new Date(now.getTime() - 45 * 60000).toISOString(),
                source: 'Autobahn GmbH MIA',
                summary: 'Width restriction requires verification',
                alertEligible: true,
              })
              
              addAlert({
                runAt: verifyCheck.runAt,
                routeId: verifyCheck.id,
                routeLabel: verifyCheck.routeLabel,
                change: 'READY → VERIFY',
                detail: 'Roadworks with 3.2m width limit detected',
                severity: 'VERIFY',
                status: 'New',
                source: verifyCheck.source,
                previousVerdict: 'READY',
                nextVerdict: 'VERIFY',
              })
              
              // Sample 3: Resolved VERIFY from yesterday
              const oldCheck = recordCheck({
                permitName: 'Frankfurt to Mannheim',
                routeLabel: 'A67 Darmstadt → Mannheim',
                runAt: new Date(now.getTime() - 24 * hour).toISOString(),
                verdict: 'READY',
                evidenceCount: 0,
                retrievedAt: new Date(now.getTime() - 24 * hour).toISOString(),
                source: 'Autobahn GmbH MIA',
                summary: 'Route clear',
                alertEligible: false,
              })
            }}
          >
            <Plus size={16} />
            Load demo history
          </button>
        </div>
      </div>

      <section className="route-alert-log">
        <header>
          <div><BellRing size={20} /><h2>Alerts from your checks</h2></div>
          <span>{shown.length} alerts</span>
        </header>
        {shown.map(alert => {
          const Icon = alert.severity === 'HOLD' ? CircleX : alert.severity === 'VERIFY' ? AlertTriangle : CheckCircle2
          return (
            <article className={`route-alert-item severity-${alert.severity.toLowerCase()}`} key={alert.id}>
              <button type="button" className="route-alert-main" onClick={() => {
                acknowledgeAlert(alert.id)
                navigate('/route-checks')
              }}>
                <span className="route-alert-icon"><Icon size={19} /></span>
                <div>
                  <span className="route-alert-meta">
                    <b>{alert.routeLabel}</b>
                    <small>{alert.source} · {formatBerlinDateTime(alert.runAt)}</small>
                  </span>
                  <strong>{alert.change}</strong>
                  <p>{alert.detail}</p>
                </div>
                <span className="route-alert-badges">
                  <span className={`alert-status ${alert.status.toLowerCase()}`}>{alert.status}</span>
                  {alert.escalated && (
                    <span className="alert-status escalated" title="Escalated" aria-label="Escalated">Escalated</span>
                  )}
                </span>
                <ChevronRight size={18} className="route-alert-chevron" aria-hidden="true" />
              </button>
              {alert.status !== 'Resolved' && (
                <button type="button" className="resolve-alert" onClick={() => resolveAlert(alert.id)}>Mark resolved</button>
              )}
            </article>
          )
        })}
        {!shown.length && (
          <div className="market-empty">
            <Route size={30} />
            <h2>{history.length ? 'Nothing in this view' : 'No alerts yet'}</h2>
            <p>{history.length ? 'No saved-check alerts match the selected filters.' : 'Run a route check to create an alert. Example Overview data does not appear here.'}</p>
          </div>
        )}
      </section>

      <section className="route-alert-log check-history-log">
        <header>
          <div><History size={20} /><h2>Check history</h2></div>
          <span>{history.length} checks</span>
        </header>
        {history.map(record => {
          const Icon = record.verdict === 'HOLD' ? CircleX : record.verdict === 'VERIFY' ? AlertTriangle : CheckCircle2
          return (
            <article className={`route-alert-item severity-${record.verdict.toLowerCase()}`} key={record.id}>
              <button type="button" className="route-alert-main" onClick={() => navigate('/route-checks')}>
                <span className="route-alert-icon"><Icon size={19} /></span>
                <div>
                  <span className="route-alert-meta">
                    <b>{record.permitName}</b>
                    <small>{record.source} · {formatBerlinDateTime(record.runAt)}</small>
                  </span>
                  <strong>{record.verdict} · {record.routeLabel}</strong>
                  <p>{record.summary} · {record.evidenceCount} evidence · retrieved {formatBerlinDateTime(record.retrievedAt)}</p>
                </div>
                <span className="route-alert-badges">
                  <span className={`alert-status ${record.verdict.toLowerCase()}`}>{record.verdict}</span>
                </span>
                <ChevronRight size={18} className="route-alert-chevron" aria-hidden="true" />
              </button>
              <div className="history-export-actions">
                <button type="button" className="resolve-alert" onClick={() => downloadSnapshot(snapshotFromHistory(record), 'pdf')}>
                  <Download size={14} /> PDF
                </button>
                <button type="button" className="resolve-alert" onClick={() => downloadSnapshot(snapshotFromHistory(record), 'csv')}>
                  <Download size={14} /> CSV
                </button>
              </div>
            </article>
          )
        })}
        {!history.length && (
          <div className="market-empty">
            <History size={30} />
            <h2>No checks in this browser</h2>
            <p>When a route check finishes, a record is saved here with the permit name, time, verdict, evidence count, and data retrieved-at.</p>
          </div>
        )}
      </section>
    </div>
  )
}
