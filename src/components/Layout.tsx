import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Home, Settings, Map, DatabaseZap, Route, ShieldAlert,
  Bell, Search, ChevronDown, Activity, X, Menu,
  HelpCircle, Briefcase
} from 'lucide-react'
import RouteCheckLogo from './RouteCheckLogo'
import MobileTabBar from './MobileTabBar'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { useOrgSettings } from '../context/OrgSettingsContext'
import { SEARCH_EMPTY_HELP, searchAppData } from '../lib/appSearch'
import { formatBerlinDateTime, orgInitials } from '../lib/formatTime'

const navItems = [
  { path: '/', label: 'Overview', icon: Home, exact: true },
  { path: '/route-checks', label: 'Route checks', icon: Route },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/map-explorer', label: 'Corridor monitor', icon: Map },
  { path: '/activity', label: 'Alerts & history', icon: ShieldAlert },
]

const connectorItems = [
  { path: '/data-partners', label: 'Data partners', icon: DatabaseZap },
]

const APP_DOCUMENT_TITLE = 'HTR · Heavy transport route check'

const extraTitleRoutes = [
  { path: '/settings', label: 'Settings' },
  { path: '/search', label: 'Search' },
  { path: '/data-partners', label: 'Data partners' },
]

function documentTitleFor(pathname: string) {
  const routes = [...navItems, ...connectorItems, ...extraTitleRoutes]
  const match = routes.find(item =>
    ('exact' in item && item.exact) || item.path === '/'
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(`${item.path}/`),
  )
  if (!match) return `Not found · ${APP_DOCUMENT_TITLE}`
  if (match.path === '/') return APP_DOCUMENT_TITLE
  return `${match.label} · ${APP_DOCUMENT_TITLE}`
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { alerts, history, unreadCount, acknowledgeAlert } = useRouteMonitoring()
  const { jobs } = useJobs()
  const { displayName, orgTypeLabel, complete } = useOrgSettings()
  const searchHits = useMemo(
    () => searchAppData({ query: searchQuery, jobs, history, alerts }),
    [alerts, history, jobs, searchQuery],
  )
  const notifications = alerts.slice(0, 4).map(alert => ({
    id: alert.id,
    title: alert.escalated ? `Escalated · ${alert.change}` : alert.change,
    desc: `${alert.routeLabel} · ${alert.source} · ${alert.detail}`,
    time: formatBerlinDateTime(alert.runAt) || alert.time,
    color: alert.escalated || alert.severity === 'HOLD' ? 'bg-red-500' : alert.severity === 'VERIFY' ? 'bg-amber-500' : 'bg-green-500',
    link: alert.jobId ? `/jobs` : '/activity',
  }))

  useEffect(() => {
    document.title = documentTitleFor(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotifOpen(false)
        setMobileOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', closeMenus)
    return () => document.removeEventListener('keydown', closeMenus)
  }, [])

  const goSearch = (href?: string) => {
    const q = searchQuery.trim()
    if (href) navigate(href)
    else if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      goSearch(searchHits[0]?.href)
    }
  }

  return (
    <div className="app-frame flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: collapsed ? 64 : 220,
          background: 'var(--navy)',
          transition: 'width 250ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Logo row */}
        <div className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
          {collapsed ? (
            <button
              type="button"
              className="sidebar-htr"
              onClick={() => navigate('/')}
              aria-label="Heavy transport route check"
            >
              HTR
            </button>
          ) : (
            <div className="sidebar-lockup">
              <button
                type="button"
                className="sidebar-logo"
                onClick={() => navigate('/')}
                aria-label="Go to home"
              >
                <RouteCheckLogo size={32} tone="dark" decorative />
              </button>
              <button
                type="button"
                className="sidebar-wordmark"
                onClick={() => navigate('/')}
                aria-label="Heavy transport route check"
              >
                <span>Heavy transport</span>
                <span>route check</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="sidebar-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <Menu size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {!collapsed && (
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.72)', padding: '4px 8px 6px', textTransform: 'uppercase' }}>
              Heavy transport
            </div>
          )}
          {collapsed && <div style={{ height: 8 }} />}

          {navItems.map(({ path, label, icon: Icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              title={collapsed ? label : undefined}
              style={{ display: 'block', marginBottom: 2 }}
              className="group"
              onClick={() => setMobileOpen(false)}
            >
              {({ isActive }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '9px 10px' : '8px 10px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
                  cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'all 120ms',
                  position: 'relative',
                }}>
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 18, background: '#f5c518', borderRadius: '0 3px 3px 0',
                    }} />
                  )}
                  <Icon size={18} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}

          <div style={{ height: 16 }} />
          {!collapsed && (
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.72)', padding: '4px 8px 6px', textTransform: 'uppercase' }}>
              Coming later
            </div>
          )}
          {collapsed && <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', margin: '0 4px 8px' }} />}

          {connectorItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              style={{ display: 'block', marginBottom: 2 }}
              onClick={() => setMobileOpen(false)}
            >
              {({ isActive }) => (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '9px 10px' : '8px 10px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
                  cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'all 120ms',
                  position: 'relative',
                }}>
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 18, background: '#f5c518', borderRadius: '0 3px 3px 0',
                    }} />
                  )}
                  <Icon size={18} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px' }}>
          <NavLink to="/settings" title={collapsed ? 'Settings' : undefined} onClick={() => setMobileOpen(false)}>
            {({ isActive }) => (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}>
                <Settings size={18} strokeWidth={1.75} />
                {!collapsed && <span style={{ fontSize: 14, fontWeight: 400, letterSpacing: '-0.01em' }}>Settings</span>}
              </div>
            )}
          </NavLink>
        </div>
      </aside>
      {mobileOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header className="app-topbar" style={{
          height: 56,
          background: 'rgba(242,242,247,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 20px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 20,
        }}>
          <button type="button" className="mobile-nav-trigger" aria-label="Open navigation" onClick={() => { setCollapsed(false); setMobileOpen(true) }}>
            <Menu size={17} />
          </button>
          {/* Search */}
          <div className="topbar-search" ref={searchRef} style={{
            flex: 1,
            maxWidth: 360,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.06)',
            borderRadius: 10,
            padding: '0 12px',
            height: 34,
            position: 'relative',
          }}>
            <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="search"
              aria-label="Search permits, routes, roads, and alerts"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearch}
              placeholder="Search jobs, permits, A9…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Clear search" style={{ color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}>
                <X size={12} />
              </button>
            )}
            {searchOpen && searchQuery.trim() && (
              <div id="app-search-results" className="app-search-dropdown" role="listbox">
                {searchHits.length === 0 && (
                  <p className="app-search-empty">{SEARCH_EMPTY_HELP}</p>
                )}
                {searchHits.slice(0, 8).map(hit => (
                  <button
                    type="button"
                    key={hit.id}
                    className="app-search-hit"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => goSearch(hit.href)}
                  >
                    <small>{hit.kind}</small>
                    <strong>{hit.title}</strong>
                    <span>{hit.detail}</span>
                  </button>
                ))}
                <button type="button" className="app-search-all" onMouseDown={event => event.preventDefault()} onClick={() => goSearch()}>
                  View all results
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="topbar-notifications" style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                style={{
                  width: 34, height: 34,
                  borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  position: 'relative',
                }}
                className="hover:!bg-black/[0.06] hover:!text-[var(--text-primary)]"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notification-popover" style={{
                  position: 'absolute',
                  top: 42, right: 0,
                  width: 400,
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow-xl)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  zIndex: 100,
                }}>
                  <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--divider)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Notifications</span>
                    <button onClick={() => setNotifOpen(false)} aria-label="Close notifications" style={{ color: 'var(--text-tertiary)', display: 'flex' }}>
                      <X size={15} />
                    </button>
                  </div>
                  {notifications.length === 0 && (
                    <div style={{ padding: '16px', fontSize: 14, color: 'var(--text-secondary)' }}>
                      No alerts yet. Alerts appear after you run a route check in this browser.
                    </div>
                  )}
                  {notifications.map((n, i) => (
                    <button
                      key={n.id}
                      onClick={() => { acknowledgeAlert(n.id); navigate(n.link); setNotifOpen(false) }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '12px 16px',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        borderBottom: i < notifications.length - 1 ? '1px solid var(--divider)' : 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      className="hover:!bg-[var(--muted)]"
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0 }} className={n.color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.title}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.desc}</div>
                      </div>
                      <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}>{n.time}</span>
                    </button>
                  ))}
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--divider)' }}>
                    <button onClick={() => { navigate('/activity'); setNotifOpen(false) }}
                      style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent)', background: 'none', cursor: 'pointer' }}>
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              className="topbar-help hover:!bg-black/[0.06] hover:!text-[var(--text-primary)]"
              onClick={() => navigate('/settings')}
              aria-label="Help and settings"
              style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              <HelpCircle size={17} />
            </button>

            <div className="topbar-divider" style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)', margin: '0 6px' }} />

            <button
              type="button"
              className="topbar-org-button hover:!bg-black/[0.06]"
              onClick={() => navigate('/settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px 4px 4px',
                borderRadius: 10,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <span className="sr-only">{displayName} · {orgTypeLabel}</span>
              <div
                aria-hidden="true"
                style={{
                width: 28, height: 28, borderRadius: 9,
                background: 'var(--navy-mid)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: 'white',
                letterSpacing: '-0.01em',
                flexShrink: 0,
              }}>
                {orgInitials(complete ? displayName : 'Dispatcher')}
              </div>
              <div aria-hidden="true">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{orgTypeLabel}</div>
              </div>
              <ChevronDown size={12} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="app-page-host"
          style={{ flex: 1, overflowY: 'auto' }}
          onClick={() => notifOpen && setNotifOpen(false)}
        >
          <Outlet />
        </main>
      </div>
      
      {/* Mobile bottom tab bar */}
      <MobileTabBar />
    </div>
  )
}
