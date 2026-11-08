import { Link } from 'react-router-dom'
import { BarChart3, Eye, FilePlus2, PauseCircle, PlayCircle, Users } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, MarketplaceStatus, QualityScore } from '../components/MarketplaceUI'
import { Toast } from '../components/Feedback'
import { useState } from 'react'

export default function MyOffers() {
  const { offers, requests, updateOffer } = useMarketplace()
  const [toast, setToast] = useState('')
  const ownOffers = offers.filter(offer => offer.providerId === 'city-munich' || offer.providerId === 'custom-org')
  return (
    <div className="market-page">
      <MarketplacePageHeader eyebrow="Provider workspace" title="My offers" description="Present the commercial value of your data, manage publication status, and monitor buyer interest." actions={<Link to="/offers/new" className="market-button primary"><FilePlus2 size={15} /> Publish data offer</Link>} />
      <div className="offer-management-metrics"><div><Eye size={17} /><span>Published offers</span><strong>{ownOffers.filter(item => item.status === 'Published').length}</strong></div><div><Users size={17} /><span>Open buyer requests</span><strong>{requests.filter(item => item.direction === 'selling' && !['Rejected', 'Active'].includes(item.status)).length}</strong></div><div><BarChart3 size={17} /><span>Average quality score</span><strong>{Math.round(ownOffers.reduce((sum, item) => sum + item.quality, 0) / Math.max(1, ownOffers.length))}</strong></div></div>
      <section className="market-section">
        <div className="market-section-header compact"><div><h2>Offer portfolio</h2><p>Business presentation appears before technical access details in the marketplace.</p></div></div>
        <div className="managed-offer-list">
          {ownOffers.map(offer => {
            const interest = requests.filter(request => request.offerId === offer.id && request.direction === 'selling').length
            return <article key={offer.id}><div className="managed-offer-icon">{offer.category.split(' ').slice(0, 2).map(word => word[0]).join('')}</div><div className="managed-offer-main"><div><MarketplaceStatus status={offer.status} /><span>Updated {offer.lastUpdated}</span></div><Link to={`/discover/${offer.id}`}>{offer.title}</Link><p>{offer.summary}</p><div><QualityScore value={offer.quality} /><span><Users size={13} /> {interest} interested compan{interest === 1 ? 'y' : 'ies'}</span><span>{offer.commercialModel}</span></div></div><div className="managed-offer-actions"><Link to={`/offers/${offer.id}/edit`} className="market-button secondary">Edit</Link><button type="button" className="market-button ghost" onClick={() => { const status = offer.status === 'Published' ? 'Paused' : 'Published'; updateOffer(offer.id, { status }); setToast(`${offer.title} is now ${status.toLowerCase()}.`) }}>{offer.status === 'Published' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}{offer.status === 'Published' ? 'Pause' : 'Publish'}</button></div></article>
          })}
          {!ownOffers.length && <div className="market-empty"><FilePlus2 size={28} /><h2>Publish your first data offer</h2><p>Describe the business value and let relevant mobility companies discover it.</p><Link to="/offers/new" className="market-button primary">Create offer</Link></div>}
        </div>
      </section>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
