import { useState } from 'react'
import { Link } from 'react-router-dom'
import ConnectorSidebar from '../../components/ConnectorSidebar'
import { Plus, FileText, Trash2, ExternalLink } from 'lucide-react'
import { ConfirmDialog, Toast } from '../../components/Feedback'

const mockAssets = [
  { id: 'asset-001', name: 'EV Charging REST API', type: 'REST-API Endpoint', contentType: 'application/json', created: '2024-01-15' },
  { id: 'asset-002', name: 'Parking Sensor Stream', type: 'REST-API Endpoint', contentType: 'application/json', created: '2024-02-20' },
  { id: 'asset-003', name: 'Campus Traffic Dataset', type: 'S3 Bucket', contentType: 'text/csv', created: '2024-03-01' },
]

export default function Assets() {
  const [assets, setAssets] = useState(mockAssets)
  const [selectedAsset, setSelectedAsset] = useState<typeof mockAssets[number] | null>(null)
  const [deleteAsset, setDeleteAsset] = useState<typeof mockAssets[number] | null>(null)
  const [toast, setToast] = useState('')

  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Assets</h1>
          <Link
            to="/connector/create-offer"
            className="flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[var(--navy-900)] transition-colors"
          >
            <Plus size={15} /> Create Asset
          </Link>
        </div>
        <div className="connector-workspace-body p-8">
          <p className="text-sm text-[var(--muted-foreground)] mb-5">
            Assets represent the data sources your connector can provide. Each asset defines how data is accessed.
          </p>
          {selectedAsset && (
            <div className="bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-[var(--primary)] uppercase tracking-wide">Asset details</div>
                <div className="font-semibold text-[var(--foreground)] mt-1">{selectedAsset.name}</div>
                <div className="text-sm text-[var(--muted-foreground)] mt-1">{selectedAsset.id} · {selectedAsset.type} · {selectedAsset.contentType}</div>
              </div>
              <button type="button" onClick={() => setSelectedAsset(null)} className="text-sm font-semibold text-[var(--accent)]">Close</button>
            </div>
          )}
          <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  {['Asset ID', 'Name', 'Type', 'Content Type', 'Created', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-left text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {assets.map(a => (
                  <tr key={a.id} className="hover:bg-[var(--muted)] transition-colors">
                    <td className="px-5 py-3.5 mono text-sm text-[var(--muted-foreground)]">{a.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--foreground)]">{a.name}</td>
                    <td className="px-5 py-3.5 text-[var(--foreground)]">{a.type}</td>
                    <td className="px-5 py-3.5 mono text-sm text-[var(--foreground)]">{a.contentType}</td>
                    <td className="px-5 py-3.5 text-sm text-[var(--muted-foreground)] mono">{a.created}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedAsset(a)} aria-label={`View ${a.name}`} className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteAsset(a)}
                          aria-label={`Delete ${a.name}`}
                          className="p-1.5 rounded hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assets.length === 0 && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No assets yet. Create your first asset to publish data.</div>}
        </div>
      </div>
      {deleteAsset && (
        <ConfirmDialog
          title="Delete asset?"
          description={`“${deleteAsset.name}” will be removed from this session. This cannot be undone.`}
          confirmLabel="Delete asset"
          destructive
          onCancel={() => setDeleteAsset(null)}
          onConfirm={() => {
            setAssets(prev => prev.filter(asset => asset.id !== deleteAsset.id))
            setSelectedAsset(current => current?.id === deleteAsset.id ? null : current)
            setToast('Asset deleted.')
            setDeleteAsset(null)
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
