import { Link } from 'react-router-dom'
import {
  ArrowRight, Bookmark, Building2, Check, CheckCircle2, GitCompareArrows,
  MapPin, Radio, ShieldCheck, Sparkles,
} from 'lucide-react'
import { getProvider, useMarketplace } from '../context/MarketplaceContext'
import type { DataOffer, RequestStatus } from '../data/marketplace'

export function MarketplacePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <header className="market-page-header">
      <div>
        {eyebrow && <span className="market-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="market-page-actions">{actions}</div>}
    </header>
  )
}

export function QualityScore({ value, label = 'Quality' }: { value: number; label?: string }) {
  return (
    <div className="quality-score" aria-label={`${label}: ${value} out of 100`}>
      <span>{label}</span>
      <div><i style={{ width: `${value}%` }} /></div>
      <strong>{value}</strong>
    </div>
  )
}

export function OfferCard({
  offer,
  recommendation,
  compact = false,
}: {
  offer: DataOffer
  recommendation?: string
  compact?: boolean
}) {
  const provider = getProvider(offer.providerId)
  const { savedOfferIds, compareOfferIds, toggleSaved, toggleCompare } = useMarketplace()
  const saved = savedOfferIds.includes(offer.id)
  const compared = compareOfferIds.includes(offer.id)
  return (
    <article className={`offer-card ${compact ? 'compact' : ''}`}>
      {recommendation && (
        <div className="recommendation-reason"><Sparkles size={13} /><span>{recommendation}</span></div>
      )}
      <div className="offer-card-topline">
        <span className="domain-badge">{offer.category}</span>
        <div className="offer-card-actions">
          <button type="button" disabled={!compared && compareOfferIds.length >= 3} className={compared ? 'selected' : ''} onClick={() => toggleCompare(offer.id)} aria-label={compared ? 'Remove from comparison' : compareOfferIds.length >= 3 ? 'Comparison limit reached' : 'Add to comparison'} title={compareOfferIds.length >= 3 && !compared ? 'You can compare up to 3 offers' : 'Compare'}>
            {compared ? <Check size={15} /> : <GitCompareArrows size={15} />}
          </button>
          <button type="button" className={saved ? 'selected' : ''} onClick={() => toggleSaved(offer.id)} aria-label={saved ? 'Remove saved offer' : 'Save offer'} title="Save">
            <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <Link to={`/discover/${offer.id}`} className="offer-card-title">{offer.title}</Link>
      <p className="offer-card-summary">{offer.summary}</p>
      <Link to={`/providers/${offer.providerId}`} className="offer-provider">
        <Building2 size={13} />
        <span>{provider?.name}</span>
        {provider?.verified && <CheckCircle2 size={13} aria-label="Verified provider" />}
      </Link>
      <div className="offer-facts">
        <span><MapPin size={12} />{offer.geography.slice(0, 2).join(', ')}</span>
        <span><Radio size={12} />{offer.updateFrequency}</span>
        <span><ShieldCheck size={12} />{offer.license}</span>
      </div>
      <QualityScore value={offer.quality} />
      <footer>
        <div><span>{offer.commercialModel}</span><strong>{offer.price}</strong></div>
        <Link to={`/discover/${offer.id}`}>View offer <ArrowRight size={13} /></Link>
      </footer>
    </article>
  )
}

const statusTone: Record<RequestStatus | string, string> = {
  Draft: 'neutral',
  Submitted: 'blue',
  'Under review': 'amber',
  'More information required': 'red',
  'Quote received': 'purple',
  Negotiation: 'purple',
  Approved: 'green',
  Rejected: 'red',
  'Agreement pending': 'amber',
  Active: 'green',
  Paused: 'neutral',
  Expired: 'neutral',
  Cancelled: 'neutral',
  Matching: 'blue',
  Closed: 'neutral',
  Published: 'green',
}

export function MarketplaceStatus({ status }: { status: string }) {
  return <span className={`market-status ${statusTone[status] ?? 'neutral'}`}><i />{status}</span>
}
