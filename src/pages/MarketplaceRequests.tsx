import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Clock3, MessageSquareMore, Send, XCircle } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, MarketplaceStatus } from '../components/MarketplaceUI'
import { ConfirmDialog, Toast } from '../components/Feedback'
import type { DataRequest, RequestStatus } from '../data/marketplace'

export default function MarketplaceRequests() {
  const [params] = useSearchParams()
  const { requests, offers, updateRequestStatus } = useMarketplace()
  const [tab, setTab] = useState(params.get('tab') === 'incoming' ? 'incoming' : 'outgoing')
  const [selected, setSelected] = useState<DataRequest | null>(null)
  const [confirm, setConfirm] = useState<{ request: DataRequest; status: RequestStatus } | null>(null)
  const [toast, setToast] = useState(params.get('submitted') ? 'Request submitted. The provider can now review your context.' : '')
  const shown = requests.filter(request => tab === 'incoming' ? request.direction === 'selling' : request.direction === 'buying')
  const act = (request: DataRequest, status: RequestStatus) => {
    if (status === 'Rejected') return setConfirm({ request, status })
    updateRequestStatus(request.id, status); setSelected(current => current?.id === request.id ? { ...current, status } : current); setToast(`Request moved to “${status}”.`)
  }
  return (
    <div className="market-page">
      <MarketplacePageHeader eyebrow="Buyer and provider workspace" title="Requests" description="Track commercial interest, respond to counterparties, and move suitable requests toward an agreement." />
      <div className="market-tabs"><button className={tab === 'outgoing' ? 'active' : ''} onClick={() => { setTab('outgoing'); setSelected(null) }}>Sent by us <span>{requests.filter(item => item.direction === 'buying').length}</span></button><button className={tab === 'incoming' ? 'active' : ''} onClick={() => { setTab('incoming'); setSelected(null) }}>Received from buyers <span>{requests.filter(item => item.direction === 'selling').length}</span></button></div>
      <div className="requests-layout">
        <div className="request-list">
          {shown.map(request => <button type="button" key={request.id} className={selected?.id === request.id ? 'selected' : ''} onClick={() => setSelected(request)}><div className="request-avatar">{request.counterpart.slice(0, 2).toUpperCase()}</div><div><span>{request.id} · {request.updatedAt}</span><strong>{request.counterpart}</strong><p>{offers.find(offer => offer.id === request.offerId)?.title ?? 'Provider conversation'}</p></div><MarketplaceStatus status={request.status} /><ChevronRight size={15} /></button>)}
          {!shown.length && <div className="market-empty"><Send size={26} /><h2>No {tab} requests</h2><p>{tab === 'incoming' ? 'New buyer interest will appear here.' : 'Start from a data offer to contact a provider.'}</p></div>}
        </div>
        <aside className="request-detail">
          {selected ? <><header><div><span>{selected.id}</span><h2>{selected.counterpart}</h2></div><MarketplaceStatus status={selected.status} /></header><div className="request-detail-offer"><span>Data offer</span><strong>{offers.find(offer => offer.id === selected.offerId)?.title ?? 'Provider conversation'}</strong></div><dl><div><dt>Intended use</dt><dd>{selected.purpose}</dd></div><div><dt>Coverage</dt><dd>{selected.coverage}</dd></div><div><dt>Duration</dt><dd>{selected.duration}</dd></div><div><dt>Message</dt><dd>{selected.message || 'No additional message.'}</dd></div></dl><div className="request-timeline"><span className="done"><CheckCircle2 size={13} /> Submitted</span><i /><span className={selected.status !== 'Submitted' ? 'done' : ''}><Clock3 size={13} /> Provider review</span><i /><span className={['Approved', 'Agreement pending', 'Active'].includes(selected.status) ? 'done' : ''}><CheckCircle2 size={13} /> Agreement</span></div>{selected.direction === 'selling' && !['Rejected', 'Active'].includes(selected.status) && <div className="request-detail-actions"><button onClick={() => act(selected, 'More information required')} className="market-button secondary"><MessageSquareMore size={14} /> Ask for information</button><button onClick={() => act(selected, 'Rejected')} className="market-button danger"><XCircle size={14} /> Reject</button><button onClick={() => act(selected, selected.status === 'Quote received' ? 'Agreement pending' : 'Approved')} className="market-button primary"><CheckCircle2 size={14} />{selected.status === 'Quote received' ? 'Create agreement' : 'Approve'}</button></div>}{selected.direction === 'buying' && selected.status === 'Approved' && <button onClick={() => act(selected, 'Agreement pending')} className="market-button primary">Review proposed agreement</button>}</> : <div className="request-detail-empty"><MessageSquareMore size={28} /><h2>Select a request</h2><p>Review business context, status, and available next actions.</p></div>}
        </aside>
      </div>
      {confirm && <ConfirmDialog title="Reject this request?" description={`This will tell ${confirm.request.counterpart} that you cannot proceed with the current request.`} confirmLabel="Reject request" destructive onCancel={() => setConfirm(null)} onConfirm={() => { updateRequestStatus(confirm.request.id, 'Rejected'); setSelected({ ...confirm.request, status: 'Rejected' }); setConfirm(null); setToast('Request rejected.') }} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
