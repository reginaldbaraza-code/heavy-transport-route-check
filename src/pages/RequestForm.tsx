import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { getProvider, useMarketplace } from '../context/MarketplaceContext'

export default function RequestForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { offers, submitRequest } = useMarketplace()
  const initialOffer = offers.find(offer => offer.id === params.get('offer'))
  const initialProvider = getProvider(params.get('provider') ?? initialOffer?.providerId ?? '')
  const [offerId, setOfferId] = useState(initialOffer?.id ?? '')
  const [purpose, setPurpose] = useState('')
  const [coverage, setCoverage] = useState(initialOffer?.geography.join(', ') ?? '')
  const [duration, setDuration] = useState('12 months')
  const [message, setMessage] = useState('')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const selectedOffer = offers.find(offer => offer.id === offerId)
  const provider = getProvider(selectedOffer?.providerId ?? initialProvider?.id ?? '')

  const next = () => {
    if (step === 1 && !offerId && !provider) return setError('Select an offer or provider to contact.')
    if (step === 2 && (!purpose.trim() || purpose.trim().length < 20)) return setError('Describe the intended use in at least 20 characters.')
    if (step === 3 && (!coverage.trim() || !duration)) return setError('Add the required coverage and duration.')
    setError('')
    setStep(current => Math.min(4, current + 1))
  }
  const submit = () => {
    const id = submitRequest({ offerId, direction: 'buying', counterpart: provider?.name ?? 'Selected provider', purpose, coverage, duration, message, status: 'Submitted' })
    navigate(`/requests?submitted=${id}`)
  }

  return (
    <div className="request-market-page">
      <Link to={selectedOffer ? `/discover/${selectedOffer.id}` : '/discover'} className="market-back"><ArrowLeft size={14} /> Back</Link>
      <header><span className="market-eyebrow">Commercial engagement</span><h1>{selectedOffer?.commercialModel === 'Request a quote' ? 'Request a commercial proposal' : 'Request data access'}</h1><p>Share enough context for the provider to evaluate fit and propose the right coverage, delivery, and commercial terms.</p></header>
      <div className="request-stepper">{['Data and provider', 'Intended use', 'Coverage and term', 'Review'].map((label, index) => <div key={label} className={step >= index + 1 ? 'active' : ''}><span>{step > index + 1 ? <CheckCircle2 size={13} /> : index + 1}</span><b>{label}</b></div>)}</div>
      <main className="request-form-card">
        {step === 1 && <section><h2>What data are you interested in?</h2><p>Select a specific offer. You can also start a broader provider conversation.</p><label className="market-field"><span>Data offer<b>Required</b></span><select value={offerId} onChange={event => setOfferId(event.target.value)}><option value="">Select data offer</option>{offers.filter(offer => !initialProvider || offer.providerId === initialProvider.id).map(offer => <option key={offer.id} value={offer.id}>{offer.title}</option>)}</select></label>{provider && <div className="selected-provider"><Building2 size={17} /><div><span>Provider</span><strong>{provider.name}</strong></div><b><CheckCircle2 size={13} /> Verified</b></div>}</section>}
        {step === 2 && <section><h2>How will your organization use the data?</h2><p>Providers use this information to assess licensing, privacy, and commercial fit.</p><label className="market-field"><span>Intended use<b>Required</b></span><textarea rows={6} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="Describe the business objective, product or operation, expected users, and outcome…" /><small>{purpose.length} characters · minimum 20</small></label><label className="market-field"><span>Additional context</span><textarea rows={3} value={message} onChange={event => setMessage(event.target.value)} placeholder="Optional technical, procurement, or timing context" /></label></section>}
        {step === 3 && <section><h2>What coverage and term do you need?</h2><p>The provider may propose alternatives during review.</p><div className="market-form-grid"><label className="market-field"><span>Required geography<b>Required</b></span><input value={coverage} onChange={event => setCoverage(event.target.value)} /></label><label className="market-field"><span>Expected duration<b>Required</b></span><select value={duration} onChange={event => setDuration(event.target.value)}><option>30-day evaluation</option><option>6 months</option><option>12 months</option><option>24 months</option><option>Ongoing</option></select></label></div><div className="request-guidance"><ShieldCheck size={16} /><p><strong>No commitment yet</strong><span>The provider can accept, ask for more information, reject, or propose different terms.</span></p></div></section>}
        {step === 4 && <section><h2>Review your request</h2><p>Confirm the context before sending it to the provider.</p><div className="request-review"><div><span>Offer</span><strong>{selectedOffer?.title}</strong></div><div><span>Provider</span><strong>{provider?.name}</strong></div><div><span>Intended use</span><strong>{purpose}</strong></div><div><span>Coverage</span><strong>{coverage}</strong></div><div><span>Duration</span><strong>{duration}</strong></div></div></section>}
        {error && <p role="alert" className="market-form-error">{error}</p>}
        <footer><button type="button" className="market-button secondary" onClick={() => step === 1 ? navigate(-1) : setStep(current => current - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button type="button" className="market-button primary" onClick={step === 4 ? submit : next}>{step === 4 ? 'Submit request' : 'Continue'} <ArrowRight size={14} /></button></footer>
      </main>
    </div>
  )
}
