import { useState } from 'react'
import { CalendarRange, FileCheck2, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, MarketplaceStatus } from '../components/MarketplaceUI'
import { Toast } from '../components/Feedback'

export default function Deals() {
  const { requests, offers, updateRequestStatus } = useMarketplace()
  const [tab, setTab] = useState('active')
  const [toast, setToast] = useState('')
  const deals = requests.filter(request => ['Approved', 'Agreement pending', 'Active', 'Paused', 'Expired'].includes(request.status))
  const shown = deals.filter(deal => tab === 'all' || (tab === 'active' ? ['Approved', 'Agreement pending', 'Active', 'Paused'].includes(deal.status) : deal.status === 'Expired'))
  return (
    <div className="market-page">
      <MarketplacePageHeader eyebrow="Commercial relationships" title="Deals and agreements" description="Manage agreed data usage, delivery readiness, term, permissions, and relationship status." />
      <div className="agreement-metrics"><div><FileCheck2 size={17} /><span>Active relationships</span><strong>{deals.filter(item => item.status === 'Active').length}</strong></div><div><ShieldCheck size={17} /><span>Pending agreement</span><strong>{deals.filter(item => ['Approved', 'Agreement pending'].includes(item.status)).length}</strong></div><div><CalendarRange size={17} /><span>Renewals in 90 days</span><strong>1</strong></div></div>
      <div className="market-tabs"><button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active and pending</button><button className={tab === 'expired' ? 'active' : ''} onClick={() => setTab('expired')}>Expired</button><button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All agreements</button></div>
      <div className="agreement-list">
        {shown.map(deal => {
          const offer = offers.find(item => item.id === deal.offerId)
          return <article key={deal.id}><div className="agreement-icon"><FileCheck2 size={18} /></div><div className="agreement-main"><div><span>{deal.id.replace('REQ', 'AGR')}</span><MarketplaceStatus status={deal.status} /></div><h2>{offer?.title ?? 'Data agreement'}</h2><p>{deal.counterpart} · {deal.coverage} · {deal.duration}</p><div><span>Permitted use</span><strong>{deal.purpose}</strong></div></div><aside><span>Delivery</span><strong>{offer?.delivery.join(', ') || 'To be configured'}</strong><span>Commercial model</span><strong>{offer?.commercialModel}</strong>{deal.status === 'Active' ? <button className="market-button secondary" onClick={() => { updateRequestStatus(deal.id, 'Paused'); setToast('Agreement paused for this session.') }}><PauseCircle size={14} /> Pause</button> : ['Paused', 'Approved', 'Agreement pending'].includes(deal.status) ? <button className="market-button primary" onClick={() => { updateRequestStatus(deal.id, 'Active'); setToast('Agreement activated. Delivery can now be configured.') }}><PlayCircle size={14} /> {deal.status === 'Paused' ? 'Resume' : 'Activate'}</button> : null}</aside></article>
        })}
        {!shown.length && <div className="market-empty"><FileCheck2 size={28} /><h2>No agreements in this view</h2><p>Approved requests appear here when commercial terms are ready.</p></div>}
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
