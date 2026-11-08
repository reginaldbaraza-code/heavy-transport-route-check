import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bookmark, ChevronDown, GitCompareArrows, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { MarketplacePageHeader, OfferCard } from '../components/MarketplaceUI'

const categories = ['All domains', 'Traffic and road conditions', 'Public transport', 'EV charging', 'Parking', 'Safety and incidents', 'Logistics and freight']
const geographies = ['All geographies', 'Germany', 'Munich', 'Bavaria', 'European Union', 'DACH']

export default function DiscoverData() {
  const { offers, compareOfferIds, toggleCompare } = useMarketplace()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [category, setCategory] = useState('All domains')
  const [geography, setGeography] = useState('All geographies')
  const [quality, setQuality] = useState('Any quality')
  const [delivery, setDelivery] = useState('Any delivery')
  const [freshness, setFreshness] = useState('Any freshness')
  const [commercial, setCommercial] = useState('Any commercial model')
  const [sort, setSort] = useState('Relevance')
  const [moreFilters, setMoreFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedSearches, setSavedSearches] = useState<string[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    setQuery(params.get('q') ?? '')
  }, [params])

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = offers.filter(offer => {
      const providerText = offer.providerId.replaceAll('-', ' ')
      const matchesQuery = !normalized || [offer.title, offer.summary, offer.category, providerText, ...offer.useCases, ...offer.geography].join(' ').toLowerCase().includes(normalized)
      const matchesCategory = category === 'All domains' || offer.category === category
      const matchesGeography = geography === 'All geographies' || offer.geography.some(item => item.includes(geography))
      const matchesQuality = quality === 'Any quality' || offer.quality >= Number(quality)
      const matchesDelivery = delivery === 'Any delivery' || offer.delivery.includes(delivery)
      const matchesCommercial = commercial === 'Any commercial model' || offer.commercialModel === commercial
      const matchesFreshness = freshness === 'Any freshness' ||
        (freshness === 'Near real-time' && (offer.freshness.includes('seconds') || offer.freshness.includes('minute'))) ||
        (freshness === 'Hourly or better' && !offer.freshness.includes('day'))
      return offer.status === 'Published' && matchesQuery && matchesCategory && matchesGeography && matchesQuality && matchesDelivery && matchesCommercial && matchesFreshness
    })
    return [...filtered].sort((a, b) => {
      if (sort === 'Quality') return b.quality - a.quality
      if (sort === 'Popularity') return b.popularity - a.popularity
      if (sort === 'Newest') return b.publishedAt.localeCompare(a.publishedAt)
      if (sort === 'Freshness') return a.freshness.localeCompare(b.freshness)
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.popularity - a.popularity
    })
  }, [offers, query, category, geography, quality, delivery, commercial, freshness, sort])

  const clearFilters = () => {
    setQuery(''); setCategory('All domains'); setGeography('All geographies'); setQuality('Any quality'); setDelivery('Any delivery'); setCommercial('Any commercial model'); setFreshness('Any freshness')
  }

  return (
    <div className="market-page">
      <MarketplacePageHeader
        eyebrow="Mobility data marketplace"
        title="Discover data"
        description="Find trusted mobility data by business objective, coverage, quality, delivery method, and commercial model."
      />

      <section className="discover-search-panel">
        <div className="discover-search">
          <Search size={19} />
          <input aria-label="Search data offers" list="market-search-suggestions" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search data, providers, cities, or business goals…" />
          <datalist id="market-search-suggestions"><option value="Improve route planning in Munich" /><option value="Real-time EV charging availability" /><option value="Cycling infrastructure and travel demand" /><option value="Freight corridor delays" /></datalist>
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
        </div>
        <div className="discovery-suggestions">
          <span>{query ? 'Related searches' : 'Popular mobility challenges'}</span>
          {(query ? ['Wider geographic coverage', 'Alternative providers', 'Historical data for this topic'] : ['Improve route planning', 'Optimize charging operations', 'Understand travel demand', 'Improve road safety']).map(item => <button type="button" key={item} onClick={() => setQuery(item)}>{item}</button>)}
          {query && <button type="button" className={savedSearches.includes(query) ? 'saved' : ''} onClick={() => setSavedSearches(current => current.includes(query) ? current.filter(item => item !== query) : [...current, query])}><Bookmark size={12} fill={savedSearches.includes(query) ? 'currentColor' : 'none'} />{savedSearches.includes(query) ? 'Search saved' : 'Save search'}</button>}
        </div>
        <div className="primary-filters">
          <FilterSelect label="Mobility domain" value={category} options={categories} onChange={setCategory} />
          <FilterSelect label="Geography" value={geography} options={geographies} onChange={setGeography} />
          <FilterSelect label="Quality" value={quality} options={['Any quality', '80', '90', '95']} optionLabel={option => option === 'Any quality' ? option : `${option}+ score`} onChange={setQuality} />
          <button type="button" className={moreFilters ? 'active' : ''} onClick={() => setMoreFilters(current => !current)}><SlidersHorizontal size={14} /> More filters</button>
        </div>
        {moreFilters && (
          <div className="advanced-filters">
            <FilterSelect label="Delivery" value={delivery} options={['Any delivery', 'REST API', 'Streaming', 'SFTP', 'Cloud bucket', 'Daily file']} onChange={setDelivery} />
            <FilterSelect label="Commercial model" value={commercial} options={['Any commercial model', 'Free access', 'Subscription', 'Usage-based', 'Request a quote']} onChange={setCommercial} />
            <FilterSelect label="Freshness" value={freshness} options={['Any freshness', 'Near real-time', 'Hourly or better']} onChange={setFreshness} />
            <button type="button" className="clear-filters" onClick={clearFilters}>Clear all filters</button>
          </div>
        )}
      </section>

      <div className="discover-results-bar">
        <div><strong>{results.length} data offers</strong><span>Verified marketplace providers</span></div>
        <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option>Relevance</option><option>Quality</option><option>Freshness</option><option>Popularity</option><option>Newest</option></select></label>
      </div>

      {loading ? (
        <div className="offer-grid discover-grid" aria-label="Loading data offers">{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="offer-card-skeleton"><i /><b /><span /><span /><em /></div>)}</div>
      ) : results.length ? (
        <div className="offer-grid discover-grid">{results.map(offer => <OfferCard key={offer.id} offer={offer} />)}</div>
      ) : (
        <div className="market-empty">
          <Search size={28} /><h2>No matching data offers</h2><p>Try a broader geography or remove one of the quality and delivery requirements.</p><button type="button" className="market-button primary" onClick={clearFilters}>Clear filters</button>
        </div>
      )}

      {compareOfferIds.length > 0 && (
        <div className="compare-tray" role="status">
          <GitCompareArrows size={17} /><div><strong>{compareOfferIds.length} offer{compareOfferIds.length > 1 ? 's' : ''} selected</strong><span>Select up to 3 offers to compare.</span></div>
          <div className="compare-chips">{compareOfferIds.map(id => <button key={id} onClick={() => toggleCompare(id)}>{offers.find(offer => offer.id === id)?.title.slice(0, 28)} <X size={12} /></button>)}</div>
          {compareOfferIds.length >= 2 ? <Link to="/compare" className="market-button primary">Compare offers</Link> : <button type="button" className="market-button primary" disabled>Compare offers</button>}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange, optionLabel = option => option }: { label: string; value: string; options: string[]; onChange: (value: string) => void; optionLabel?: (value: string) => string }) {
  return (
    <label className="filter-select"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{optionLabel(option)}</option>)}</select><ChevronDown size={13} /></label>
  )
}
