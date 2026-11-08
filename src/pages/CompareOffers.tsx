import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, GitCompareArrows, X } from 'lucide-react'
import { getProvider, useMarketplace } from '../context/MarketplaceContext'
import { QualityScore } from '../components/MarketplaceUI'

export default function CompareOffers() {
  const { offers, compareOfferIds, toggleCompare } = useMarketplace()
  const compared = compareOfferIds.map(id => offers.find(offer => offer.id === id)).filter(Boolean) as typeof offers
  if (compared.length < 2) return <div className="market-page"><div className="market-empty"><GitCompareArrows size={28} /><h1>Select at least two offers</h1><p>Add offers to comparison from Discover Data.</p><Link to="/discover" className="market-button primary">Browse data offers</Link></div></div>
  const rows = [
    ['Provider', (offer: typeof compared[number]) => getProvider(offer.providerId)?.name ?? '—'],
    ['Geographic coverage', (offer: typeof compared[number]) => offer.geography.join(', ')],
    ['Update frequency', (offer: typeof compared[number]) => offer.updateFrequency],
    ['Freshness', (offer: typeof compared[number]) => offer.freshness],
    ['Historical depth', (offer: typeof compared[number]) => offer.historicalDepth],
    ['Delivery', (offer: typeof compared[number]) => offer.delivery.join(', ')],
    ['Formats', (offer: typeof compared[number]) => offer.formats.join(', ')],
    ['License', (offer: typeof compared[number]) => offer.license],
    ['Commercial model', (offer: typeof compared[number]) => `${offer.commercialModel} · ${offer.price}`],
  ] as const
  return (
    <div className="market-page">
      <Link to="/discover" className="market-back"><ArrowLeft size={14} /> Discover Data</Link>
      <header className="compare-header"><div><span className="market-eyebrow">Decision support</span><h1>Compare data offers</h1><p>Review fitness, quality, delivery, and commercial terms side by side.</p></div></header>
      <div className="comparison-table" style={{ '--compare-count': compared.length } as React.CSSProperties}>
        <div className="comparison-label-cell">Offer</div>
        {compared.map(offer => <div key={offer.id} className="comparison-offer-head"><button onClick={() => toggleCompare(offer.id)} aria-label={`Remove ${offer.title}`}><X size={14} /></button><span>{offer.category}</span><Link to={`/discover/${offer.id}`}>{offer.title}</Link><small>{getProvider(offer.providerId)?.name}</small></div>)}
        <div className="comparison-label-cell">Quality</div>
        {compared.map(offer => <div key={offer.id} className="comparison-value"><QualityScore value={offer.quality} label="Overall" /><QualityScore value={offer.completeness} label="Completeness" /><QualityScore value={offer.reliability} label="Reliability" /></div>)}
        {rows.flatMap(([label, value]) => [<div key={`${label}-label`} className="comparison-label-cell">{label}</div>, ...compared.map(offer => <div key={`${label}-${offer.id}`} className="comparison-value">{value(offer)}</div>)])}
        <div className="comparison-label-cell">Next step</div>
        {compared.map(offer => <div key={offer.id} className="comparison-value"><Link to={`/requests/new?offer=${offer.id}`} className="market-button primary">{offer.commercialModel === 'Request a quote' ? 'Request quote' : 'Request access'}</Link></div>)}
      </div>
      <p className="comparison-note"><CheckCircle2 size={14} />Quality indicators are provider-supplied and should be validated against a sample and your specific intended use.</p>
    </div>
  )
}
