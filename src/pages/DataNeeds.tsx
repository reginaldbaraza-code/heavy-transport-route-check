import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Edit3, FilePlus2, MapPin, Radio, Search, Sparkles } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, MarketplaceStatus } from '../components/MarketplaceUI'

export default function DataNeeds() {
  const { needs } = useMarketplace()
  return (
    <div className="market-page">
      <MarketplacePageHeader
        eyebrow="Buyer workspace"
        title="Data needs"
        description="Describe the business outcome and data requirements you are looking for. Structured needs improve matching and help providers respond effectively."
        actions={<Link to="/needs/new" className="market-button primary"><FilePlus2 size={15} /> Create data need</Link>}
      />
      <div className="need-overview">
        <div><Search size={18} /><span>Active needs</span><strong>{needs.filter(need => need.status !== 'Closed').length}</strong></div>
        <div><Sparkles size={18} /><span>Matching offers</span><strong>{needs.reduce((sum, need) => sum + need.matches, 0)}</strong></div>
        <div><CalendarClock size={18} /><span>Needs requiring detail</span><strong>{needs.filter(need => need.status === 'Draft').length}</strong></div>
      </div>
      <section className="market-section">
        <div className="market-section-header compact"><div><h2>Your organization’s demand signals</h2><p>Only providers you engage with can see the full commercial context.</p></div></div>
        <div className="data-needs-grid">
          {needs.map(need => (
            <article key={need.id} className="data-need-card">
              <div className="data-need-top"><MarketplaceStatus status={need.status} /><Link to={`/needs/${need.id}/edit`} aria-label={`Edit ${need.title}`}><Edit3 size={15} /></Link></div>
              <h2>{need.title}</h2><p>{need.objective}</p>
              <div className="data-need-facts"><span><MapPin size={13} />{need.geography}</span><span><Radio size={13} />{need.frequency}</span></div>
              <div className="data-need-match"><Sparkles size={15} /><div><strong>{need.matches} potential matches</strong><span>{need.status === 'Draft' ? 'Complete this need to improve matching.' : 'Ranked by coverage, freshness, and use case.'}</span></div></div>
              <footer><span>Created {need.createdAt}</span><Link to={`/needs/${need.id}`}>View matches <ArrowRight size={13} /></Link></footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
