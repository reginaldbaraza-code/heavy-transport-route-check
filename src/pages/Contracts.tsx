import { useState } from 'react'
import { Search, X, ArrowRight, FileText, Calendar, Users } from 'lucide-react'

const contracts = [
  { id: 'CTR-2024-001', dataset: 'BMW Slippery Road', provider: 'BMW AG', consumer: 'RheinLift Logistics', status: 'active', startDate: '2024-01-15', endDate: '2026-12-31', lastActivity: '2 hours ago', purpose: 'Research', permissions: ['Read', 'Analyze'], license: 'Custom MDS License' },
  { id: 'CTR-2024-002', dataset: 'Real-Time Traffic Flow — Munich', provider: 'City of Munich', consumer: 'RheinLift Logistics', status: 'pending', startDate: '2024-03-01', endDate: '2025-03-01', lastActivity: '1 day ago', purpose: 'Product development', permissions: ['Read'], license: 'Public Open Data License' },
  { id: 'CTR-2024-003', dataset: 'Public Transport Disruptions NRW', provider: 'VRR GmbH', consumer: 'RheinLift Logistics', status: 'action-required', startDate: '2024-02-10', endDate: '2025-02-10', lastActivity: '3 days ago', purpose: 'Research', permissions: ['Read', 'Redistribute'], license: 'Creative Commons 4.0' },
  { id: 'CTR-2023-011', dataset: 'BMW Heavy Rain', provider: 'BMW AG', consumer: 'RheinLift Logistics', status: 'expired', startDate: '2023-01-01', endDate: '2024-01-01', lastActivity: '1 year ago', purpose: 'Internal analysis', permissions: ['Read'], license: 'Custom MDS License' },
  { id: 'CTR-2024-004', dataset: 'EV Charging Points Germany', provider: 'Bundesnetzagentur', consumer: 'RheinLift Logistics', status: 'active', startDate: '2024-04-01', endDate: '2027-04-01', lastActivity: '5 hours ago', purpose: 'Urban planning', permissions: ['Read', 'Analyze', 'Aggregate'], license: 'GovData Open License' },
]

type Contract = typeof contracts[number]

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  pending: { label: 'Pending approval', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  'action-required': { label: 'Action required', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}

export default function Contracts() {
  const [activeTab, setActiveTab] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)

  const filtered = contracts.filter(c => {
    const matchTab =
      activeTab === 'all' ||
      (activeTab === 'active' && c.status === 'active') ||
      (activeTab === 'pending' && (c.status === 'pending' || c.status === 'action-required')) ||
      (activeTab === 'expired' && c.status === 'expired')
    const matchSearch = !searchQuery ||
      c.dataset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchTab && matchSearch
  })

  return (
    <div className="flex h-full">
      <div className="app-page contracts-page flex-1 flex flex-col p-6 max-w-[1400px] mx-auto w-full overflow-y-auto">
        <div className="page-heading flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Contracts</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Manage your data access agreements</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-5 border-b border-[var(--border)] mb-4">
          {[
            { key: 'active', label: 'Active', count: contracts.filter(c => c.status === 'active').length },
            { key: 'pending', label: 'Pending', count: contracts.filter(c => c.status === 'pending' || c.status === 'action-required').length },
            { key: 'expired', label: 'Expired', count: contracts.filter(c => c.status === 'expired').length },
            { key: 'all', label: 'All', count: contracts.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === key ? 'border-[var(--foreground)] text-[var(--foreground)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {label}
              <span className={`text-sm px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === key ? 'bg-[var(--foreground)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 gap-2 mb-4 max-w-sm focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <Search size={15} className="text-[var(--muted-foreground)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="flex-1 text-sm outline-none bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={13} /></button>}
        </div>

        {/* Table */}
        <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                {['Dataset', 'Provider', 'Status', 'Start date', 'End date', 'Last activity', ''].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                    <div className="flex items-center gap-1">
                      {col}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((c) => {
                const sc = statusConfig[c.status]
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-[var(--muted)] transition-colors cursor-pointer ${selectedContract?.id === c.id ? 'bg-blue-50/30' : ''}`}
                    onClick={() => setSelectedContract(selectedContract?.id === c.id ? null : c)}
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedContract(selectedContract?.id === c.id ? null : c)
                      }
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[var(--foreground)]">{c.dataset}</div>
                      <div className="mono text-sm text-[var(--muted-foreground)] mt-0.5">{c.id}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--foreground)]">{c.provider}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted-foreground)] text-sm mono">{c.startDate}</td>
                    <td className="px-4 py-3.5 text-[var(--muted-foreground)] text-sm mono">{c.endDate}</td>
                    <td className="px-4 py-3.5 text-[var(--muted-foreground)] text-sm">{c.lastActivity}</td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-sm text-[var(--accent)] font-semibold">
                        View <ArrowRight size={12} />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-14">
              <FileText size={32} className="text-[var(--border)] mx-auto mb-3" />
              <div className="font-semibold text-[var(--foreground)]">No contracts found</div>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {searchQuery ? 'Try a different search term.' : "You don't have any contracts in this category."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Contract detail drawer */}
      {selectedContract && (
        <ContractDetailDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} />
      )}
    </div>
  )
}

function ContractDetailDrawer({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const sc = statusConfig[contract.status]
  const [reviewing, setReviewing] = useState(false)
  const auditLog = [
    { action: 'Contract activated', actor: 'MDS Platform', time: contract.startDate },
    { action: 'Access granted', actor: contract.consumer, time: contract.startDate },
    { action: 'Last data sync', actor: 'System', time: contract.lastActivity },
  ]

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-[var(--border)] bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--muted)]">
        <h3 className="font-bold text-sm text-[var(--foreground)]">Contract details</h3>
        <button onClick={onClose} aria-label="Close contract details" className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${sc.cls}`}>
            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />{sc.label}
          </span>
          <span className="mono text-sm text-[var(--muted-foreground)]">{contract.id}</span>
        </div>

        {/* Dataset */}
        <div className="bg-[var(--muted)] rounded-xl p-4">
          <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-3">Dataset</p>
          <p className="font-bold text-[var(--foreground)] mb-1">{contract.dataset}</p>
          <p className="text-sm text-[var(--muted-foreground)]">Provider: {contract.provider}</p>
        </div>

        {/* Contract parties */}
        <div>
          <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">Contract Parties</p>
          <div className="space-y-2">
            {[
              { role: 'Provider', name: contract.provider, icon: Users },
              { role: 'Consumer', name: contract.consumer, icon: Users },
            ].map(({ role, name, icon: Icon }) => (
              <div key={role} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-sm text-[var(--muted-foreground)]">{role}</div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">Duration</p>
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-[var(--muted-foreground)]" />
            <span className="mono text-sm">{contract.startDate}</span>
            <span className="text-[var(--muted-foreground)]">→</span>
            <span className="mono text-sm">{contract.endDate}</span>
          </div>
        </div>

        {/* Usage conditions */}
        <div>
          <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">Data Usage Conditions</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Purpose</span>
              <span className="font-medium text-[var(--foreground)]">{contract.purpose}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">License</span>
              <span className="font-medium text-[var(--foreground)]">{contract.license}</span>
            </div>
            <div className="flex items-start justify-between text-sm gap-2">
              <span className="text-[var(--muted-foreground)]">Permissions</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {contract.permissions.map(p => (
                  <span key={p} className="text-sm bg-[var(--navy-50)] text-[var(--primary)] px-2 py-0.5 rounded font-medium">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit history */}
        <div>
          <p className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">Audit History</p>
          <div className="space-y-2">
            {auditLog.map((entry, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium text-[var(--foreground)]">{entry.action}</span>
                  <span className="text-[var(--muted-foreground)]"> · {entry.actor}</span>
                </div>
                <span className="text-[var(--muted-foreground)] flex-shrink-0 mono">{entry.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action required banner */}
        {contract.status === 'action-required' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-orange-800 mb-1">Action required</p>
            <p className="text-sm text-orange-700">This contract requires your review before it can proceed. Please check the terms and respond.</p>
            <button type="button" onClick={() => setReviewing(current => !current)} className="mt-2 text-sm font-bold text-orange-700 underline">
              {reviewing ? 'Hide terms' : 'Review contract terms'}
            </button>
            {reviewing && (
              <div className="mt-3 pt-3 border-t border-orange-200 space-y-2">
                <p className="text-sm"><strong>Requested change:</strong> Confirm that derived analytics will not expose individual vehicle records.</p>
                <p className="text-sm"><strong>Next step:</strong> Contact the provider through the established contract channel after reviewing the condition.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
