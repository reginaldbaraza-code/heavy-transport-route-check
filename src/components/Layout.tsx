import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  Home, Settings, Map, DatabaseZap, Route, ShieldAlert,
  Bell, Search, ChevronDown, X, Menu, HelpCircle, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import RouteCheckLogo from './RouteCheckLogo'
import MobileTabBar from './MobileTabBar'
import { useRouteMonitoring } from '../context/RouteMonitoringContext'
import { useJobs } from '../context/JobsContext'
import { useOrgSettings } from '../context/OrgSettingsContext'
import type { SearchHit } from '../lib/appSearch'
import { SEARCH_EMPTY_HELP } from '../lib/searchCopy'
import { formatBerlinDateTime, orgInitials } from '../lib/formatTime'
import { applyBootLcp } from '../lib/lcpHeading'

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

function NavItem({
  path,
  label,
  icon: Icon,
  exact,
  collapsed,
  onClick,
}: {
  path: string
  label: string
  icon: typeof Home
  exact?: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <NavLink
      to={path}
      end={exact}
      title={collapsed ? label : undefined}
      className="block"
      onClick={onClick}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors',
            collapsed ? 'justify-center' : 'justify-start',
            isActive
              ? 'bg-white/12 text-white'
              : 'text-white/70 hover:bg-white/8 hover:text-white',
          )}
        >
          {isActive && (
            <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />
          )}
          <Icon size={18} strokeWidth={1.75} className="shrink-0" />
          {!collapsed && (
            <span className={cn('truncate tracking-tight', isActive ? 'font-semibold' : 'font-medium')}>
              {label}
            </span>
          )}
        </div>
      )}
    </NavLink>
  )
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
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      setSearchHits([])
      return
    }
    let cancelled = false
    void import('../lib/appSearch').then(({ searchAppData }) => {
      if (cancelled) return
      setSearchHits(searchAppData({ query, jobs, history, alerts }))
    })
    return () => {
      cancelled = true
    }
  }, [alerts, history, jobs, searchQuery])
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
    applyBootLcp(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    const host = document.querySelector('.app-page-host')
    const boot = document.getElementById('boot-lcp')
    if (!host || !boot) return
    const onScroll = () => {
      document.documentElement.classList.toggle('lcp-scrolled', host.scrollTop > 12)
    }
    host.addEventListener('scroll', onScroll, { passive: true })
    return () => host.removeEventListener('scroll', onScroll)
  }, [])

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

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="app-frame flex h-screen overflow-hidden bg-background">
      <aside
        className={cn('app-sidebar flex shrink-0 flex-col overflow-hidden text-sidebar-foreground', mobileOpen && 'mobile-open')}
        style={{ width: collapsed ? 64 : 220, background: 'var(--navy)' }}
      >
        <div className={cn('sidebar-brand', collapsed && 'is-collapsed')}>
          {collapsed ? (
            <button type="button" className="sidebar-htr" onClick={() => navigate('/')} aria-label="Heavy transport route check">
              HTR
            </button>
          ) : (
            <div className="sidebar-lockup">
              <button type="button" className="sidebar-logo" onClick={() => navigate('/')} aria-label="Go to home">
                <RouteCheckLogo size={32} tone="dark" decorative />
              </button>
              <button type="button" className="sidebar-wordmark" onClick={() => navigate('/')} aria-label="Heavy transport route check">
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

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/55 uppercase">
                Heavy transport
              </div>
            )}
            {navItems.map(item => (
              <NavItem key={item.path} {...item} collapsed={collapsed} onClick={closeMobile} />
            ))}
            <div className="my-3 h-px bg-white/10" role="separator" />
            {!collapsed && (
              <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/55 uppercase">
                Coming later
              </div>
            )}
            {connectorItems.map(item => (
              <NavItem key={item.path} {...item} collapsed={collapsed} onClick={closeMobile} />
            ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <NavItem path="/settings" label="Settings" icon={Settings} collapsed={collapsed} onClick={closeMobile} />
        </div>
      </aside>
      {mobileOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={closeMobile} />}

      <div className="app-main flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-topbar flex h-14 shrink-0 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur-xl">
          <button
            type="button"
            className="mobile-nav-trigger inline-flex size-7 items-center justify-center rounded-lg"
            aria-label="Open navigation"
            onClick={() => { setCollapsed(false); setMobileOpen(true) }}
          >
            <Menu size={17} />
          </button>

          <div className="topbar-search relative flex h-9 max-w-md min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/70 px-3" ref={searchRef}>
            <Search size={15} className="shrink-0 text-muted-foreground" />
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
              placeholder="Search"
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="text-muted-foreground">
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

          <div className="ml-auto flex items-center gap-1">
            <div className="topbar-notifications relative">
              <button
                type="button"
                className="relative inline-flex size-7 items-center justify-center rounded-lg"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notification-popover">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button type="button" onClick={() => setNotifOpen(false)} aria-label="Close notifications" className="text-muted-foreground">
                      <X size={15} />
                    </button>
                  </div>
                  {notifications.length === 0 && (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      No alerts yet. Alerts appear after you run a route check in this browser.
                    </div>
                  )}
                  {notifications.map((n, i) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => { acknowledgeAlert(n.id); navigate(n.link); setNotifOpen(false) }}
                      className={cn('flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-muted', i < notifications.length - 1 && 'border-b border-border')}
                    >
                      <div className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', n.color)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="mt-0.5 truncate text-sm text-muted-foreground">{n.desc}</div>
                      </div>
                      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">{n.time}</span>
                    </button>
                  ))}
                  <div className="border-t border-border px-4 py-2.5">
                    <button type="button" className="text-sm font-medium text-[var(--accent)]" onClick={() => { navigate('/activity'); setNotifOpen(false) }}>
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="topbar-help inline-flex size-7 items-center justify-center rounded-lg"
              onClick={() => navigate('/settings')}
              aria-label="Help and settings"
            >
              <HelpCircle size={17} />
            </button>

            <span className="topbar-divider mx-1.5 h-5 w-px bg-border" aria-hidden="true" />

            <button
              type="button"
              className="topbar-org-button flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-muted"
              onClick={() => navigate('/settings')}
            >
              <span className="sr-only">{displayName} · {orgTypeLabel}</span>
              <div
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--navy-mid)] text-[11px] font-bold tracking-tight text-white"
              >
                {orgInitials(complete ? displayName : 'Dispatcher')}
              </div>
              <div aria-hidden="true" className="hidden text-left sm:block">
                <div className="text-sm leading-tight font-semibold">{displayName}</div>
                <div className="text-xs leading-tight text-muted-foreground">{orgTypeLabel}</div>
              </div>
              <ChevronDown size={12} aria-hidden="true" className="text-muted-foreground" />
            </button>
          </div>
        </header>

        <main className="app-page-host min-h-0 flex-1 overflow-y-auto" onClick={() => notifOpen && setNotifOpen(false)}>
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
