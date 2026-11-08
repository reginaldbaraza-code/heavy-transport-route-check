import { Link } from 'react-router-dom'
import ConnectorSidebar from '../../components/ConnectorSidebar'
import { Plus, Activity, ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog, Toast } from '../../components/Feedback'

export const initialOffers = [
  { id: 'offer-001', name: 'EV Charging REST API', asset: 'asset-001', policy: 'Unrestricted Access', status: 'published', subscriptions: 3 },
  { id: 'offer-002', name: 'Parking Sensor Stream', asset: 'asset-002', policy: 'Unrestricted Access', status: 'published', subscriptions: 1 },
  { id: 'offer-003', name: 'Campus Traffic Dataset', asset: 'asset-003', policy: 'Unrestricted Access', status: 'draft', subscriptions: 0 },
  { id: 'offer-004', name: 'Bike Forecast API', asset: 'asset-003', policy: 'Unrestricted Access', status: 'published', subscriptions: 8 },
]

export default function DataOffers() {
  const [offers, setOffers] = useState(() => {
    try {
      const saved = sessionStorage.getItem('mds-data-offers')
      return saved ? JSON.parse(saved) as typeof initialOffers : initialOffers
    } catch {
      return initialOffers
    }
  })
  const [selectedOffer, setSelectedOffer] = useState<typeof initialOffers[number] | null>(null)
  const [deleteOffer, setDeleteOffer] = useState<typeof initialOffers[number] | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    sessionStorage.setItem('mds-data-offers', JSON.stringify(offers))
  }, [offers])

  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header px-8 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Data Offers</h1>
          <Link
            to="/connector/create-offer"
            className="flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[var(--navy-900)] transition-colors"
          >
            <Plus size={15} /> Create Data Offer
          </Link>
        </div>
        <div className="connector-workspace-body p-8">
          <div className="metric-grid grid grid-cols-3 gap-4 mb-6">
            <div className="metric-card bg-white rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-4xl font-bold text-[var(--foreground)]">{offers.filter(o => o.status === 'published').length}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Published</div>
            </div>
            <div className="metric-card bg-white rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-4xl font-bold text-[var(--foreground)]">{offers.filter(o => o.status === 'draft').length}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Drafts</div>
            </div>
            <div className="metric-card bg-white rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-4xl font-bold text-[var(--foreground)]">{offers.reduce((s, o) => s + o.subscriptions, 0)}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Total subscriptions</div>
            </div>
          </div>
          {selectedOffer && (
            <div className="bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 mb-4 flex items-start justify-between gap-4">
              <div><div className="text-sm font-bold text-[var(--primary)] uppercase tracking-wide">Offer details</div><div className="font-semibold mt-1">{selectedOffer.name}</div><div className="text-sm text-[var(--muted-foreground)] mt-1">Asset {selectedOffer.asset} · {selectedOffer.policy} · {selectedOffer.subscriptions} subscriptions</div></div>
              <button type="button" onClick={() => setSelectedOffer(null)} className="text-sm font-semibold text-[var(--accent)]">Close</button>
            </div>
          )}

          <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  {['Offer ID', 'Name', 'Asset', 'Policy', 'Status', 'Subscriptions', 'Actions'].map(col => (
                    <th key={col} className="px-5 py-3 text-left text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {offers.map(o => (
                  <tr key={o.id} className="hover:bg-[var(--muted)] transition-colors">
                    <td className="px-5 py-3.5 mono text-sm text-[var(--muted-foreground)]">{o.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--foreground)]">
                      <div className="flex items-center gap-2"><Activity size={14} className="text-[var(--primary)]" />{o.name}</div>
                    </td>
                    <td className="px-5 py-3.5 mono text-sm text-[var(--muted-foreground)]">{o.asset}</td>
                    <td className="px-5 py-3.5 text-[var(--foreground)]">{o.policy}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full ${
                        o.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${o.status === 'published' ? 'bg-green-500' : 'bg-slate-400'}`} />
                        {o.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--foreground)]">{o.subscriptions}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedOffer(o)} aria-label={`View ${o.name}`} className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"><ExternalLink size={14} /></button>
                        <button type="button" onClick={() => setDeleteOffer(o)} aria-label={`Delete ${o.name}`}
                          className="p-1.5 rounded hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {offers.length === 0 && <div className="text-center py-10 text-sm text-[var(--muted-foreground)]">No data offers yet. Create an offer to make an asset discoverable.</div>}
        </div>
      </div>
      {deleteOffer && (
        <ConfirmDialog
          title="Delete data offer?"
          description={`“${deleteOffer.name}” will be removed from this session. Existing subscriptions are shown for context and will not contact external systems.`}
          confirmLabel="Delete offer"
          destructive
          onCancel={() => setDeleteOffer(null)}
          onConfirm={() => {
            setOffers(prev => prev.filter(offer => offer.id !== deleteOffer.id))
            setSelectedOffer(current => current?.id === deleteOffer.id ? null : current)
            setToast('Data offer deleted.')
            setDeleteOffer(null)
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
