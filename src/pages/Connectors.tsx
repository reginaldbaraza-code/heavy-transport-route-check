import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Info, X, ExternalLink } from 'lucide-react'
import { Toast } from '../components/Feedback'

const connectors = [
  { id: 'MDSLCN3QM1.C557VGC', name: 'Code Team 3.2', host: 'RheinLift Logistics', type: 'OWN', online: false, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.C6444W1', name: 'Code team', host: 'RheinLift Logistics', type: 'OWN', online: false, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CCC7JBY', name: 'm-10_group-6', host: 'RheinLift Logistics', type: 'OWN', online: true, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CDK69LF', name: 'Code team on-prem', host: 'RheinLift Logistics', type: 'OWN', online: true, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CFD4PQB', name: 'CODE Team 5', host: 'Think-iT GmbH', type: 'CAAS', online: true, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CQEFJU5', name: 'CODE Team 2 — MDS On-Prem Test', host: 'RheinLift Logistics', type: 'OWN', online: false, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CRJBHJX', name: 'CODE Team 2 — MDS CaaS', host: 'Think-iT GmbH', type: 'CAAS', online: true, frontendUrl: '/connector/dashboard' },
  { id: 'MDSLCN3QM1.CY11MGY', name: 'CODE Team 3 — MDS Connector', host: 'RheinLift Logistics', type: 'OWN', online: false, frontendUrl: '/connector/dashboard' },
]

type AddMode = 'caas' | 'onprem' | null

export default function Connectors() {
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [items, setItems] = useState(connectors)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [newName, setNewName] = useState('')
  const [addSuccess, setAddSuccess] = useState<string | null>(null)
  const [addError, setAddError] = useState('')
  const navigate = useNavigate()

  const filtered = typeFilter ? items.filter(c => c.type === typeFilter) : items

  const handleAdd = () => {
    if (!newName.trim()) {
      setAddError('Enter a connector name.')
      return
    }
    if (items.some(item => item.name.toLowerCase() === newName.trim().toLowerCase())) {
      setAddError('A connector with this name already exists.')
      return
    }
    const mode = addMode
    setItems(current => [...current, {
      id: `MDSLCN3QM1.C${String(current.length + 1).padStart(6, '0')}`,
      name: newName.trim(),
      host: mode === 'caas' ? 'Think-iT GmbH' : 'RheinLift Logistics',
      type: mode === 'caas' ? 'CAAS' : 'OWN',
      online: false,
      frontendUrl: '/connector/dashboard',
    }])
    setAddSuccess(`Connector “${newName.trim()}” registered for this session. It is shown as offline until opened.`)
    setAddError('')
    setNewName('')
    setAddMode(null)
  }

  return (
    <div className="app-page connectors-page p-6 max-w-[1400px] mx-auto">
      <div className="page-heading flex items-start justify-between gap-6 mb-7">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Data delivery operations</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Configure technical delivery endpoints after a marketplace request has progressed to an approved agreement.
          </p>
        </div>
        <div className="connector-page-actions flex gap-2 flex-shrink-0">
          <button onClick={() => setAddMode('caas')} className="flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
            <Plus size={15} /> Add managed
          </button>
          <button onClick={() => setAddMode('onprem')} className="flex items-center gap-2 border border-[var(--border-strong)] bg-white text-[var(--foreground)] text-sm font-semibold px-4 py-2.5 rounded-lg">
            <Plus size={15} /> Add on-premises
          </button>
        </div>
      </div>

      {addSuccess && <Toast message={addSuccess} onClose={() => setAddSuccess(null)} />}

      {/* Add connector modal */}
      {addMode && (
        <div className="connector-add-panel mb-5 bg-white border border-[var(--accent)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--foreground)]">
              {addMode === 'caas' ? 'Add CaaS Connector' : 'Add On-Premises Connector'}
            </h3>
            <button onClick={() => setAddMode(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            {addMode === 'caas'
              ? 'A CaaS (Connector as a Service) is managed by Think-iT GmbH on your behalf.'
              : 'Register your own self-hosted connector. You will need to configure the connector URL after registration.'}
          </p>
          <div className="connector-add-form flex gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="Connector name *"
              className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all"
            />
            {addError && <span role="alert" className="self-center text-sm text-red-700">{addError}</span>}
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--navy-900)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Register
            </button>
            <button onClick={() => setAddMode(null)}
              className="px-4 py-2.5 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <select
            value={typeFilter ?? ''}
            onChange={e => setTypeFilter(e.target.value || null)}
            className="appearance-none bg-white border border-[var(--border)] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none cursor-pointer focus:border-[var(--accent)] transition-all"
          >
            <option value="">All types</option>
            <option value="OWN">OWN</option>
            <option value="CAAS">CAAS</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">
          Showing {filtered.length} of {items.length} connectors
        </span>
      </div>

      {/* Table */}
      <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--primary)] text-white text-left">
              {['Connector ID', 'Connector Name', 'Host', 'Type', 'Frontend'].map(col => (
                <th key={col} className="px-5 py-3.5 font-semibold text-sm uppercase tracking-wide">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--muted)] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.online ? 'bg-green-500' : 'bg-slate-400'}`} />
                    <span className={`text-sm font-medium ${c.online ? 'text-green-700' : 'text-slate-500'}`}>
                      {c.online ? 'Online' : 'Offline'}
                    </span>
                    <span className="mono text-sm text-[var(--foreground)]">{c.id}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-medium text-[var(--foreground)]">{c.name}</td>
                <td className="px-5 py-3.5 text-[var(--muted-foreground)] text-sm">{c.host}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                    c.type === 'CAAS' ? 'bg-[var(--navy-50)] text-[var(--primary)]' : 'bg-slate-100 text-slate-600'
                  }`}>{c.type}</span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => navigate(c.frontendUrl)}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-[var(--accent-soft)] border border-[var(--border-strong)] text-[var(--accent)] text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={12} /> Frontend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">No connectors match this filter.</div>}
      </div>

      <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)] mb-5">
        <Info size={13} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
        <span>To ensure efficient use of resources, we reserve the right to delete inactive CaaS instances after 90 days.</span>
      </div>

    </div>
  )
}
