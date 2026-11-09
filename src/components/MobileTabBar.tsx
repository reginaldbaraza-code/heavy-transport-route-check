import { NavLink } from 'react-router-dom'
import { Home, Route, Map, ShieldAlert, Settings } from 'lucide-react'

const tabs = [
  { path: '/', label: 'Home', icon: Home, exact: true },
  { path: '/route-checks', label: 'Checks', icon: Route },
  { path: '/map-explorer', label: 'Corridor', icon: Map },
  { path: '/activity', label: 'Alerts', icon: ShieldAlert },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileTabBar() {
  return (
    <nav className="mobile-tab-bar" aria-label="Primary">
      <div className="mobile-tab-bar-inner">
        {tabs.map(({ path, label, icon: Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className="mobile-tab-link"
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.75} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
