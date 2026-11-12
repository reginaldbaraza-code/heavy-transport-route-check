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
        background: 'var(--bg-glass-strong)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderTop: 'var(--hairline)',
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
              gap: 2,
              textDecoration: 'none',
              minWidth: 44,
              minHeight: 44,
              padding: '4px 2px',
            }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{
                    color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '-0.01em',
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
