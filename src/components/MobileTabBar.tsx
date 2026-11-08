import { NavLink } from 'react-router-dom'
import { Home, Route, Map, ShieldAlert, Settings } from 'lucide-react'

const tabs = [
  { path: '/', label: 'Home', icon: Home, exact: true },
  { path: '/route-checks', label: 'Route checks', icon: Route },
  { path: '/map-explorer', label: 'Corridor', icon: Map },
  { path: '/activity', label: 'Alerts', icon: ShieldAlert },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileTabBar() {
  return (
    <nav
      className="mobile-tab-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'none', // Hidden on desktop, shown via media query
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'var(--safe-area-inset-bottom)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-around',
          height: 56,
        }}
      >
        {tabs.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              textDecoration: 'none',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={20}
                  style={{
                    color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
