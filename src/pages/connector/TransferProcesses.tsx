import ConnectorSidebar from '../../components/ConnectorSidebar'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function TransferProcesses() {
  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Transfer Processes</h1>
        </div>
        <div className="connector-workspace-body p-8">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {['Consuming', 'Providing'].map(dir => (
              <div key={dir} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">{dir} Transfers</h2>
                <p className="text-sm text-[var(--muted-foreground)] mb-8">Active {dir.toLowerCase()} transfer processes</p>
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <RefreshCw size={32} className="text-[var(--border)]" />
                  <p className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    No {dir.toLowerCase()} transfer processes
                  </p>
                  <Link
                    to={dir === 'Consuming' ? '/catalogue' : '/connector/data-offers'}
                    className="mt-1 px-4 py-2 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)]"
                  >
                    {dir === 'Consuming' ? 'Find a dataset' : 'Manage data offers'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 text-sm text-[var(--primary)]">
            <strong>How transfers work:</strong> Once a contract agreement is active, you can initiate a transfer process to start receiving or providing data. Transfer processes track the state of data exchanges between connectors.
          </div>
        </div>
      </div>
    </div>
  )
}
