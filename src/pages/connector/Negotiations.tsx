import ConnectorSidebar from '../../components/ConnectorSidebar'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Negotiations() {
  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Contract Negotiations</h1>
        </div>
        <div className="connector-workspace-body p-8">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {['Incoming Negotiations', 'Outgoing Negotiations'].map(t => (
              <div key={t} className="bg-white rounded-xl border border-[var(--border)] p-6">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">{t}</h2>
                <p className="text-sm text-[var(--muted-foreground)] mb-8">
                  {t === 'Incoming Negotiations' ? 'Consumers requesting access to your data' : 'Your ongoing access requests'}
                </p>
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <FileText size={32} className="text-[var(--border)]" />
                  <p className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">No active negotiations</p>
                  <Link
                    to={t === 'Incoming Negotiations' ? '/connector/approvals' : '/catalogue'}
                    className="mt-1 px-4 py-2 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)]"
                  >
                    {t === 'Incoming Negotiations' ? 'Review access requests' : 'Browse data catalogue'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 text-sm text-[var(--primary)]">
            Contract negotiations are initiated when a consumer submits an access request for one of your data offers. They appear here while the contract terms are being established.
          </div>
        </div>
      </div>
    </div>
  )
}
