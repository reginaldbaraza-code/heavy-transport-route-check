import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, Clock3, Globe2, MapPin, ShieldCheck } from 'lucide-react'
import { getProvider, useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, OfferCard } from '../components/MarketplaceUI'

export default function ProviderProfile() {
  const { providerId } = useParams()
  const { offers } = useMarketplace()
  const provider = getProvider(providerId ?? '')
  if (!provider) return <div className="market-page"><div className="market-empty"><h1>Provider not found</h1><Link to="/discover" className="market-button primary">Browse providers and data</Link></div></div>
  const providerOffers = offers.filter(offer => offer.providerId === provider.id && offer.status === 'Published')
  return (
    <div className="market-page">
      <div className="provider-profile-hero">
        <div className="provider-profile-mark">{provider.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</div>
        <div><span className="market-eyebrow">{provider.type}</span><h1>{provider.name}</h1><p>{provider.description}</p><div className="provider-signals"><span><CheckCircle2 size={14} /> Verified organization</span><span><Clock3 size={14} /> Active since {provider.activeSince}</span><span><MapPin size={14} /> {provider.regions.join(', ')}</span></div></div>
        <Link to={`/requests/new?provider=${provider.id}`} className="market-button primary">Start a conversation <ArrowRight size={14} /></Link>
      </div>
      <div className="provider-profile-facts">
        <div><Building2 size={17} /><span>Organization type</span><strong>{provider.type}</strong></div>
        <div><Globe2 size={17} /><span>Mobility domains</span><strong>{provider.domains.join(', ')}</strong></div>
        <div><ShieldCheck size={17} /><span>Marketplace trust</span><strong>Identity and organization verified</strong></div>
      </div>
      <section className="market-section">
        <div className="market-section-header"><div><span className="market-eyebrow">Available data</span><h2>{providerOffers.length} published offer{providerOffers.length !== 1 ? 's' : ''}</h2><p>Evaluate the provider’s coverage, quality, delivery options, and commercial terms.</p></div></div>
        <div className="offer-grid">{providerOffers.map(offer => <OfferCard key={offer.id} offer={offer} />)}</div>
      </section>
    </div>
  )
}
