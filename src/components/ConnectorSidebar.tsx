import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileCheck, ArrowLeftRight,
  TrendingUp, Shield, Database, FileText, CheckSquare, Activity
} from 'lucide-react'
import RouteCheckLogo from './RouteCheckLogo'

const mainNav = [
  { label: 'Delivery Dashboard', icon: LayoutDashboard, path: '/connector/dashboard' },
  { label: 'Discover Data', icon: BookOpen, path: '/discover' },
  { label: 'Deals & Agreements', icon: FileCheck, path: '/deals' },
  { label: 'Transfer Processes', icon: ArrowLeftRight, path: '/connector/transfers' },
  { label: 'EDRs', icon: TrendingUp, path: '/connector/edrs' },
]

const provideNav = [
  { label: 'Publish Marketplace Offer', icon: Database, path: '/offers/new' },
  { label: 'Assets', icon: FileText, path: '/connector/assets' },
  { label: 'Policies', icon: Shield, path: '/connector/policies' },
  { label: 'Delivery Configurations', icon: Activity, path: '/connector/data-offers' },
  { label: 'Contract negotiations', icon: FileText, path: '/connector/negotiations' },
  { label: 'Access Approvals', icon: CheckSquare, path: '/connector/approvals' },
]

export default function ConnectorSidebar() {
  return (
    <aside className="connector-sidebar w-64 flex-shrink-0 bg-white border-r border-[var(--border)] flex flex-col overflow-y-auto">
      <div className="connector-sidebar-brand flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
        <div className="w-10 h-10 flex-shrink-0">
          <RouteCheckLogo size={40} tone="light" decorative className="w-full h-full" />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight text-[var(--foreground)]">Heavy transport</div>
          <div className="font-bold text-sm leading-tight text-[var(--foreground)]">route check</div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {mainNav.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/connector/dashboard'}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`
            }
          >
            <Icon size={17} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="connector-sidebar-section px-5 mt-5 mb-2 text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
          Provide
        </div>

        {provideNav.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`
            }
          >
            <Icon size={17} className="flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
