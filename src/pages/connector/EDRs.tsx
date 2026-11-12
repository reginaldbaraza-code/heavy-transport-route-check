import ConnectorSidebar from '../../components/ConnectorSidebar'
import { TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function EDRs() {
  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">EDRs</h1>
          <p className="text-sm text-[var(--foreground)]/70 mt-0.5">Endpoint Data References</p>
        </div>
        <div className="connector-workspace-body p-8">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 mb-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              EDRs (Endpoint Data References) are tokens that grant temporary access to a data endpoint after a transfer process has been successfully initiated.
            </p>
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <TrendingUp size={36} className="text-[var(--border)]" />
              <p className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">No active EDRs</p>
              <p className="text-sm text-[var(--muted-foreground)]">Start a transfer process to generate EDRs</p>
              <Link to="/connector/transfers" className="mt-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg">View transfer processes</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
