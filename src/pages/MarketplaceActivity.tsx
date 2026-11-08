import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BellRing, CheckCircle2, ChevronRight, CircleX, Route,
} from 'lucide-react'
import { MarketplacePageHeader } from '../components/MarketplaceUI'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { getPermittedRoute, permittedRoutes } from '../data/routeChecks'

const filters = ['All', 'Hold', 'Verify', 'Resolved'] as const

export default function MarketplaceActivity() {
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [routeFilter, setRouteFilter] = useState('all')
  const { alerts, acknowledgeAlert, resolveAlert } = useRouteMonitoring()
  const navigate = useNavigate()
  const shown = alerts.filter(alert => {
    const matchesRoute = routeFilter === 'all' || alert.routeId === routeFilter
    const matchesFilter = filter === 'All'
      || filter === 'Hold' && alert.severity === 'HOLD'
      || filter === 'Verify' && alert.severity === 'VERIFY'
      || filter === 'Resolved' && alert.status === 'Resolved'
    return matchesRoute && matchesFilter
  })

  return (
    <div className="market-page route-alert-page">
      <MarketplacePageHeader
        eyebrow="Live route monitoring"
        title="Alerts & history"
        description="A route-by-route log of verdict changes, disruptions, source failures, and on-site confirmations."
      />

      <div className="route-alert-filters">
        <div className="activity-filters" role="group" aria-label="Alert severity">
          {filters.map(item => (
            <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
              {item}
            </button>
          ))}
        </div>
        <label>
          <span>Route</span>
          <select value={routeFilter} onChange={event => setRouteFilter(event.target.value)}>
            <option value="all">All permitted routes</option>
            {permittedRoutes.map(route => (
              <option value={route.id} key={route.id}>{route.originShort} → {route.destinationShort}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="route-alert-log">
        <header>
          <div><BellRing size={20} /><h2>Monitoring events</h2></div>
          <span>{shown.length} alerts</span>
        </header>
        {shown.map(alert => {
          const route = getPermittedRoute(alert.routeId)
          const Icon = alert.severity === 'HOLD' ? CircleX : alert.severity === 'VERIFY' ? AlertTriangle : CheckCircle2
          return (
            <article className={`route-alert-item severity-${alert.severity.toLowerCase()}`} key={alert.id}>
              <button type="button" className="route-alert-main" onClick={() => {
                acknowledgeAlert(alert.id)
                navigate(`/route-checks?route=${alert.routeId}`)
              }}>
                <span className="route-alert-icon"><Icon size={19} /></span>
                <div>
                  <span className="route-alert-meta"><b>{route.originShort} → {route.destinationShort}</b><small>{route.corridor} · {alert.time}</small></span>
                  <strong>{alert.change}</strong>
                  <p>{alert.detail}</p>
                </div>
                <span className={`alert-status ${alert.status.toLowerCase()}`}>{alert.status}</span>
                <ChevronRight size={18} />
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
            <h2>Nothing in this view</h2>
            <p>No route-monitoring alerts match the selected filters.</p>
          </div>
        )}
      </section>
    </div>
  )
}
