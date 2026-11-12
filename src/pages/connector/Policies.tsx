import { useState } from 'react'
import ConnectorSidebar from '../../components/ConnectorSidebar'
import { Plus, Shield, Trash2 } from 'lucide-react'
import { ConfirmDialog, Toast } from '../../components/Feedback'

const mockPolicies = [
  { id: 'pol-001', name: 'Unrestricted Access', type: 'USE_UNRESTRICTED', datasets: 3, created: '2024-01-15' },
]

export default function Policies() {
  const [policies, setPolicies] = useState(mockPolicies)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [deletePolicy, setDeletePolicy] = useState<typeof mockPolicies[number] | null>(null)
  const [toast, setToast] = useState('')

  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Policies</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[var(--navy-900)] transition-colors"
          >
            <Plus size={15} /> Create Policy
          </button>
        </div>
        <div className="connector-workspace-body p-8">
          <p className="text-sm text-[var(--muted-foreground)] mb-5">
            Policies define the terms and conditions under which your data assets can be accessed.
          </p>

          {showCreate && (
            <div className="bg-[var(--bg-card)] border border-[var(--accent)] rounded-xl p-5 mb-5">
              <h3 className="font-bold text-[var(--foreground)] mb-3">New Policy</h3>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Policy name"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (newName.trim()) {
                      setPolicies(prev => [...prev, {
                        id: `pol-00${prev.length + 1}`,
                        name: newName.trim(),
                        type: 'USE_UNRESTRICTED',
                        datasets: 0,
                        created: new Date().toISOString().slice(0, 10),
                      }])
                      setNewName('')
                      setShowCreate(false)
                      setToast('Policy created.')
                    }
                  }}
                  className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--navy-900)] transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="data-table-shell bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  {['Policy ID', 'Name', 'Type', 'Used by', 'Created', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-left text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {policies.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--muted)] transition-colors">
                    <td className="px-5 py-3.5 mono text-sm text-[var(--muted-foreground)]">{p.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--foreground)]">
                      <div className="flex items-center gap-2"><Shield size={14} className="text-[var(--primary)]" />{p.name}</div>
                    </td>
                    <td className="px-5 py-3.5"><span className="text-sm bg-[var(--navy-50)] text-[var(--primary)] font-mono px-2 py-0.5 rounded">{p.type}</span></td>
                    <td className="px-5 py-3.5 text-[var(--muted-foreground)]">{p.datasets} dataset{p.datasets !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-3.5 mono text-sm text-[var(--muted-foreground)]">{p.created}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setDeletePolicy(p)}
                        disabled={p.datasets > 0}
                        className="p-1.5 rounded hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={p.datasets > 0 ? 'Cannot delete a policy in use' : 'Delete policy'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {policies.length === 0 && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No policies yet. Create one before publishing a restricted data offer.</div>}
        </div>
      </div>
      {deletePolicy && (
        <ConfirmDialog
          title="Delete policy?"
          description={`“${deletePolicy.name}” will be permanently removed from this session.`}
          confirmLabel="Delete policy"
          destructive
          onCancel={() => setDeletePolicy(null)}
          onConfirm={() => {
            setPolicies(prev => prev.filter(policy => policy.id !== deletePolicy.id))
            setToast('Policy deleted.')
            setDeletePolicy(null)
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
