import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, Sparkles, ThumbsDown } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, OfferCard } from '../components/MarketplaceUI'

const goals = ['Improve route planning', 'Optimize charging operations', 'Improve fleet utilization', 'Understand travel demand', 'Reduce delivery delays', 'Improve safety']

export default function Recommendations() {
  const { offers, needs, dismissedRecommendationIds, dismissRecommendation, preferences } = useMarketplace()
  const [goal, setGoal] = useState(preferences.goal)
  const visible = offers.filter(offer => offer.status === 'Published' && !dismissedRecommendationIds.includes(offer.id))
  const ranked = [...visible].sort((a, b) => score(b) - score(a))
  function score(offer: typeof offers[number]) {
    const needScore = needs.some(need => need.domain === offer.category) ? 4 : 0
    const goalScore = goal && offer.useCases.some(useCase => useCase.toLowerCase().includes(goal.toLowerCase().split(' ')[1] ?? '')) ? 5 : 0
    const regionScore = preferences.regions && offer.geography.some(place => preferences.regions.toLowerCase().includes(place.toLowerCase())) ? 3 : 0
    return needScore + goalScore + regionScore + offer.quality / 100 + offer.popularity / 200
  }
  return (
    <div className="market-page">
      <MarketplacePageHeader eyebrow="Explainable matching" title="Recommendations" description="Relevant data offers and providers based on your organization profile, active needs, saved offers, and selected business objective." actions={<Link to="/needs/new" className="market-button secondary"><Search size={15} /> Create data need</Link>} />
      <section className="recommendation-goal">
        <div><Sparkles size={18} /><div><h2>What are you trying to improve?</h2><p>Select a goal to refine recommendations. You can change it at any time.</p></div></div>
        <div>{goals.map(item => <button type="button" key={item} className={goal === item ? 'selected' : ''} onClick={() => setGoal(goal === item ? '' : item)}>{item}</button>)}</div>
      </section>
      <div className="recommendation-summary"><div><strong>{ranked.length}</strong><span>recommendations available</span></div><p>Recommendations are ranked using transparent marketplace criteria. They are not endorsements or automatic purchasing decisions.</p></div>
      <div className="recommendation-list">
        {ranked.map((offer, index) => (
          <div key={offer.id} className="recommendation-item">
            <div className="recommendation-rank">{String(index + 1).padStart(2, '0')}</div>
            <OfferCard offer={offer} recommendation={reason(offer, goal, needs)} />
            <button type="button" className="dismiss-recommendation" onClick={() => dismissRecommendation(offer.id)}><ThumbsDown size={13} /> Not relevant</button>
          </div>
        ))}
      </div>
      {!ranked.length && <div className="market-empty"><Sparkles size={28} /><h2>You have reviewed all current recommendations</h2><p>Create a new data need or revisit Discover Data to generate more relevant matches.</p><Link to="/discover" className="market-button primary">Discover data <ArrowRight size={14} /></Link></div>}
    </div>
  )
}
function reason(offer: { useCases: string[]; geography: string[]; category: string; updateFrequency: string }, goal: string, needs: Array<{ domain: string; geography: string }>) {
  if (goal && offer.useCases.some(useCase => useCase.toLowerCase().includes(goal.toLowerCase().split(' ')[1] ?? ''))) return `Recommended because it directly supports your selected goal: ${goal}.`
  const need = needs.find(item => item.domain === offer.category)
  if (need) return `Matches your ${need.domain.toLowerCase()} need and provides ${offer.updateFrequency.toLowerCase()} updates.`
  return `Relevant to your marketplace activity and available in ${offer.geography.slice(0, 2).join(', ')}.`
}
