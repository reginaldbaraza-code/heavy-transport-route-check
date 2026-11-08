import ConnectorSidebar from '../../components/ConnectorSidebar'
import { CheckSquare, CheckCircle, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog, Toast } from '../../components/Feedback'

const mockApprovals = [
  { id: 'req-001', consumer: 'Fraunhofer IML', dataset: 'EV Charging REST API', purpose: 'Research', submitted: '2024-12-10', status: 'pending' },
  { id: 'req-002', consumer: 'Volkswagen AG', dataset: 'EV Charging REST API', purpose: 'Product development', submitted: '2024-12-12', status: 'pending' },
]

export default function Approvals() {
  const [reqs, setReqs] = useState(mockApprovals)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const act = (id: string, action: 'approve' | 'reject') => {
    setReqs(prev => prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r))
    setToast(action === 'approve' ? 'Access request approved.' : 'Access request rejected.')
  }

  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Manual Approvals</h1>
          <span className="bg-[var(--primary)] text-white text-sm font-bold px-2.5 py-1 rounded-full">
            {reqs.filter(r => r.status === 'pending').length} pending
          </span>
        </div>
        <div className="connector-workspace-body p-8">
          <p className="text-sm text-[var(--muted-foreground)] mb-5">
            Access requests that require your manual review before a contract can be established.
          </p>
          <div className="space-y-3">
            {reqs.map(req => (
              <div key={req.id} className={`bg-white rounded-xl border p-5 flex items-center gap-4 ${
                req.status === 'pending' ? 'border-[var(--border)]' :
                req.status === 'approved' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
              }`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[var(--foreground)]">{req.consumer}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">·</span>
                    <span className="text-sm text-[var(--muted-foreground)]">submitted {req.submitted}</span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Requests access to <strong className="text-[var(--foreground)]">{req.dataset}</strong> for: {req.purpose}
                  </p>
                </div>
                {req.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(req.id, 'approve')}
                      className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectId(req.id)}
                      className="flex items-center gap-1.5 border border-[var(--border)] text-sm font-semibold px-3 py-2 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      <X size={13} /> Reject
                    </button>
                  </div>
                ) : (
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {req.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                )}
              </div>
            ))}
          </div>
          {reqs.length === 0 && <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">No approval requests.</div>}
        </div>
      </div>
      {rejectId && (
        <ConfirmDialog
          title="Reject access request?"
          description="The requester will see that access was declined. This prototype keeps the result for the current session."
          confirmLabel="Reject request"
          destructive
          onCancel={() => setRejectId(null)}
          onConfirm={() => { act(rejectId, 'reject'); setRejectId(null) }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
