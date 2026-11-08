import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Edit3, MapPin, Radio, Sparkles } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplaceStatus, OfferCard } from '../components/MarketplaceUI'

export default function DataNeedDetail() {
  const { needId } = useParams()
  const { needs, offers } = useMarketplace()
  const need = needs.find(item => item.id === needId)
  if (!need) return <div className="market-page"><div className="market-empty"><h1>Data need not found</h1><Link to="/needs" className="market-button primary">View data needs</Link></div></div>
  const matches = offers.filter(offer => offer.status === 'Published').sort((a, b) => {
    const aScore = Number(a.category === need.domain) * 3 + Number(offerGeo(a, need.geography)) * 2 + a.quality / 100
    const bScore = Number(b.category === need.domain) * 3 + Number(offerGeo(b, need.geography)) * 2 + b.quality / 100
    return bScore - aScore
  }).slice(0, Math.max(3, need.matches))
  return (
    <div className="market-page">
      <Link to="/needs" className="market-back"><ArrowLeft size={14} /> Data needs</Link>
      <header className="need-detail-hero">
        <div><div><MarketplaceStatus status={need.status} /><span>Created {need.createdAt}</span></div><h1>{need.title}</h1><p>{need.objective}</p><div className="data-need-facts"><span><MapPin size={13} />{need.geography}</span><span><Radio size={13} />{need.frequency}</span></div></div>
        <Link to={`/needs/${need.id}/edit`} className="market-button secondary"><Edit3 size={14} /> Edit need</Link>
      </header>
      <div className="need-requirements"><div><span>Domain</span><strong>{need.domain}</strong></div><div><span>Quality</span><strong>{need.quality || 'Open to guidance'}</strong></div><div><span>Delivery</span><strong>{need.format || 'Flexible'}</strong></div><div><span>Budget</span><strong>{need.budget || 'To discuss'}</strong></div><div><span>Timeframe</span><strong>{need.timeframe || 'Not specified'}</strong></div></div>
      <section className="market-section">
        <div className="market-section-header"><div><span className="market-eyebrow">Explainable matching</span><h2>{matches.length} offers to evaluate</h2><p>Ranked using the requirements in this data need. Review each offer before contacting a provider.</p></div></div>
        <div className="offer-grid">{matches.map((offer, index) => <OfferCard key={offer.id} offer={offer} recommendation={index === 0 ? 'Best match for your mobility domain, freshness, and quality requirements.' : offerGeo(offer, need.geography) ? `Covers geography related to ${need.geography}.` : 'Supports a closely related business objective.'} />)}</div>
      </section>
    </div>
  )
}
function offerGeo(offer: { geography: string[] }, geography: string) { return offer.geography.some(place => geography.toLowerCase().includes(place.toLowerCase()) || place.toLowerCase().includes(geography.toLowerCase())) }
