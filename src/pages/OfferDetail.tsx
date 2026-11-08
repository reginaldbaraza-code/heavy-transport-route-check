import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Bookmark, Building2, CalendarRange, Check, CheckCircle2,
  Clock3, Code2, Download, FileJson, Globe2, LockKeyhole, MapPin, Radio,
  ShieldCheck, Sparkles, Table2,
} from 'lucide-react'
import { getProvider, useMarketplace } from '../context/MarketplaceContext'
import { MarketplaceStatus, OfferCard, QualityScore } from '../components/MarketplaceUI'
import MobilityHeatmap from '../components/MobilityHeatmap'

export default function OfferDetail() {
  const { offerId } = useParams()
  const navigate = useNavigate()
  const { offers, savedOfferIds, toggleSaved } = useMarketplace()
  const offer = offers.find(item => item.id === offerId)
  if (!offer) return <div className="market-page"><div className="market-empty"><h1>Offer not found</h1><p>This offer may have been removed or unpublished.</p><Link className="market-button primary" to="/discover">Return to Discover Data</Link></div></div>
  const provider = getProvider(offer.providerId)
  const saved = savedOfferIds.includes(offer.id)
  const similar = offers.filter(item => item.id !== offer.id && (item.category === offer.category || item.geography.some(place => offer.geography.includes(place)))).slice(0, 3)
  const primaryLabel = offer.commercialModel === 'Free access' ? 'Request access' : offer.commercialModel === 'Request a quote' ? 'Request a quote' : 'Start data request'
  const downloadSample = () => {
    const sample = JSON.stringify({ offer: offer.title, fields: offer.fields, format: offer.formats[0], note: 'Illustrative sample schema for prototype evaluation.' }, null, 2)
    const url = URL.createObjectURL(new Blob([sample], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${offer.id}-sample-schema.json`; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="offer-detail-page">
      <div className="offer-detail-breadcrumb">
        <button type="button" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Back</button><span>/</span><Link to="/discover">Discover Data</Link><span>/</span><b>{offer.category}</b>
      </div>
      <header className="offer-detail-hero">
        <div className="offer-detail-main">
          <div className="offer-detail-labels"><span>{offer.category}</span><MarketplaceStatus status={offer.status} />{offer.sampleAvailable && <span className="sample-label"><Check size={12} /> Sample available</span>}</div>
          <h1>{offer.title}</h1>
          <p>{offer.summary}</p>
          <Link to={`/providers/${provider?.id}`} className="offer-detail-provider">
            <div className="provider-mark">{provider?.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</div>
            <div><span>Provided by</span><strong>{provider?.name}</strong></div>
            {provider?.verified && <b><CheckCircle2 size={13} /> Verified organization</b>}
            <ArrowRight size={14} />
          </Link>
        </div>
        <aside className="offer-action-card">
          <span className="market-eyebrow">Commercial access</span>
          <h2>{offer.commercialModel}</h2>
          <p>{offer.price}</p>
          <Link to={`/requests/new?offer=${offer.id}`} className="market-button primary">{primaryLabel} <ArrowRight size={15} /></Link>
          <button type="button" className="market-button secondary" onClick={() => toggleSaved(offer.id)}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved to shortlist' : 'Save offer'}</button>
          <small>Submitting a request does not create a contract or charge your organization.</small>
        </aside>
      </header>

      <div className="offer-detail-layout">
        <main>
          <section className="detail-section">
            <span className="market-eyebrow">Business value</span><h2>What this data helps you achieve</h2>
            <p>{offer.description}</p>
            <div className="use-case-grid">{offer.useCases.map(useCase => <div key={useCase}><Sparkles size={16} /><strong>{useCase}</strong><span>Use this offer as an input to operational decisions and mobility products.</span></div>)}</div>
          </section>

          <section className="detail-section">
            <span className="market-eyebrow">Coverage and characteristics</span><h2>Data scope</h2>
            <div className="spec-grid">
              <Spec icon={MapPin} label="Geographic coverage" value={offer.geography.join(', ')} />
              <Spec icon={Radio} label="Update frequency" value={offer.updateFrequency} />
              <Spec icon={Clock3} label="Current freshness" value={offer.freshness} />
              <Spec icon={CalendarRange} label="Historical depth" value={offer.historicalDepth} />
              <Spec icon={FileJson} label="Formats" value={offer.formats.join(', ')} />
              <Spec icon={Code2} label="Delivery" value={offer.delivery.join(', ')} />
            </div>
          </section>

          <section className="detail-section">
            <span className="market-eyebrow">Trust and fitness</span><h2>Quality indicators</h2>
            <div className="quality-panel">
              <QualityScore value={offer.quality} label="Overall quality" /><QualityScore value={offer.completeness} label="Completeness" /><QualityScore value={offer.reliability} label="Reliability" />
            </div>
            <p className="detail-note"><ShieldCheck size={15} /> Scores are supplied by the provider and supported by marketplace validation checks. Review the sample before production use.</p>
          </section>

          <section className="detail-section">
            <span className="market-eyebrow">Geographic evidence · Prototype data</span><h2>Where this offer is useful</h2>
            <p>This coverage preview helps you evaluate geographic fit. It is illustrative prototype data and does not represent a live service.</p>
            <div className="offer-coverage-map"><div className="coverage-map-heading"><div><strong>{offer.geography.join(', ')}</strong><span>Coverage, relative activity, and known gaps</span></div><span>Updated {offer.lastUpdated}</span></div><MobilityHeatmap mode="quality" compact /></div>
            <p className="detail-note"><MapPin size={15} /> Use this view to decide whether coverage aligns with your operating area. Confirm exact boundaries with the provider before requesting production access.</p>
          </section>

          <section className="detail-section">
            <span className="market-eyebrow">Preview</span><h2>Included signals</h2>
            <div className="field-list">{offer.fields.map(field => <span key={field}><Table2 size={13} />{field}</span>)}</div>
            {offer.sampleAvailable ? <button type="button" className="market-button secondary" onClick={downloadSample}><Download size={14} /> Download sample schema</button> : <p className="detail-note"><LockKeyhole size={15} /> A sample can be discussed during the request process.</p>}
          </section>

          <section className="detail-section">
            <span className="market-eyebrow">Licensing and governance</span><h2>Conditions for responsible use</h2>
            <div className="governance-list">
              <div><Building2 size={16} /><span>Provenance and collection</span><strong>{offer.collectionMethod || 'Provider-created mobility data; collection details available on request.'}</strong></div>
              <div><ShieldCheck size={16} /><span>License</span><strong>{offer.license}</strong></div>
              <div><LockKeyhole size={16} /><span>Usage restrictions</span><strong>{offer.restrictions}</strong></div>
              <div><Clock3 size={16} /><span>Known limitations</span><strong>{offer.limitations || 'No additional limitations documented.'}</strong></div>
              <div><CheckCircle2 size={16} /><span>Access requirements</span><strong>{offer.accessRequirements || 'Verified organization and approved intended use.'}</strong></div>
              <div><Globe2 size={16} /><span>Privacy and governance</span><strong>{offer.privacy}</strong></div>
            </div>
            <div className="sovereignty-statement"><ShieldCheck size={17} /><div><strong>The provider retains ownership and control</strong><p>MDS supports discovery, conditions, and trusted exchange. Access does not transfer ownership of the underlying data asset.</p></div></div>
          </section>
        </main>

        <aside className="offer-facts-sidebar">
          <div><span>Last updated</span><strong>{offer.lastUpdated}</strong></div><div><span>Published</span><strong>{offer.publishedAt}</strong></div><div><span>Typical provider response</span><strong>{provider?.responseTime}</strong></div>
          <Link to={`/providers/${provider?.id}`}>View provider profile <ArrowRight size={13} /></Link>
        </aside>
      </div>

      {similar.length > 0 && <section className="market-section related-offers"><div className="market-section-header"><div><span className="market-eyebrow">Related marketplace data</span><h2>Similar offers worth evaluating</h2></div></div><div className="offer-grid">{similar.map(item => <OfferCard key={item.id} offer={item} compact />)}</div></section>}
    </div>
  )
}

function Spec({ icon: Icon, label, value }: { icon: React.FC<{ size?: number }>; label: string; value: string }) {
  return <div><Icon size={17} /><span>{label}</span><strong>{value}</strong></div>
}
