import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Save } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import type { CommercialModel, DataOffer, OfferStatus } from '../data/marketplace'
import { ConfirmDialog } from '../components/Feedback'

const steps = ['Basic information', 'Business value', 'Coverage', 'Quality', 'Delivery', 'Commercial terms', 'Governance', 'Review']

const blank: Omit<DataOffer, 'id' | 'publishedAt' | 'lastUpdated' | 'popularity'> = {
  title: '', providerId: 'custom-org', summary: '', description: '', category: '', useCases: [], geography: [],
  updateFrequency: '', freshness: '', quality: 85, completeness: 85, reliability: 90, historicalDepth: '',
  formats: [], delivery: [], license: '', commercialModel: 'Request a quote', price: '', sampleAvailable: false,
  privacy: '', restrictions: '', fields: [], status: 'Draft',
  collectionMethod: '', limitations: '', accessRequirements: '',
}

export default function PublishOffer() {
  const { offerId } = useParams()
  const navigate = useNavigate()
  const { offers, addOffer, updateOffer } = useMarketplace()
  const existing = offers.find(offer => offer.id === offerId)
  const [data, setData] = useState<typeof blank>(existing ? strip(existing) : blank)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const set = <K extends keyof typeof data>(key: K, value: typeof data[K]) => setData(current => ({ ...current, [key]: value }))
  const list = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
  const validate = () => {
    if (step === 0 && (!data.title.trim() || !data.summary.trim() || !data.category)) return 'Add a title, short summary, and mobility category.'
    if (step === 1 && (!data.description.trim() || data.useCases.length === 0)) return 'Describe the data’s business value and add at least one use case.'
    if (step === 2 && (data.geography.length === 0 || !data.updateFrequency || !data.historicalDepth)) return 'Add geographic coverage, update frequency, and historical depth.'
    if (step === 4 && (data.formats.length === 0 || data.delivery.length === 0)) return 'Add at least one format and delivery method.'
    if (step === 5 && (!data.commercialModel || !data.price.trim())) return 'Describe the pricing or quote expectation.'
    if (step === 6 && (!data.license.trim() || !data.privacy.trim())) return 'Add licensing and privacy information.'
    return ''
  }
  const next = () => { const issue = validate(); if (issue) return setError(issue); setError(''); setStep(current => Math.min(7, current + 1)) }
  const save = (status: OfferStatus) => {
    const payload = { ...data, status }
    if (existing) updateOffer(existing.id, payload)
    else addOffer(payload)
    setSaving(true)
    window.setTimeout(() => navigate('/offers'), 650)
  }
  return (
    <div className="publish-page">
      <button type="button" onClick={() => setConfirmExit(true)} className="market-back"><ArrowLeft size={14} /> My offers</button>
      <header><div><span className="market-eyebrow">Provider workspace</span><h1>{existing ? 'Edit data offer' : 'Publish a data offer'}</h1><p>Present the business value first. Technical delivery details come later in the workflow.</p></div><button className="market-button secondary" onClick={() => save('Draft')}><Save size={14} /> Save draft</button></header>
      <div className="publish-layout">
        <nav className="publish-steps" aria-label="Offer publishing progress">{steps.map((label, index) => <button type="button" key={label} className={step === index ? 'active' : step > index ? 'complete' : ''} onClick={() => index < step && setStep(index)}><span>{step > index ? <Check size={13} /> : index + 1}</span><div><b>{label}</b><small>{index === 0 ? 'What buyers will see' : index === 7 ? 'Confirm and publish' : 'Offer details'}</small></div></button>)}</nav>
        <main className="publish-form">
          {step === 0 && <Step title="Basic information" description="Make it immediately clear what the data contains."><Field label="Offer title" required><input value={data.title} onChange={event => set('title', event.target.value)} placeholder="e.g. Real-time traffic flow — Munich" /></Field><Field label="Short summary" required help={`${data.summary.length}/220 characters`}><textarea maxLength={220} rows={3} value={data.summary} onChange={event => set('summary', event.target.value)} placeholder="Explain the data and its value in one concise paragraph." /></Field><Field label="Mobility category" required><select value={data.category} onChange={event => set('category', event.target.value)}><option value="">Select category</option>{['Traffic and road conditions', 'Public transport', 'Vehicle movement', 'Fleet operations', 'EV charging', 'Parking', 'Weather and environment', 'Road infrastructure', 'Mobility demand', 'Logistics and freight', 'Safety and incidents', 'Geospatial data'].map(item => <option key={item}>{item}</option>)}</select></Field></Step>}
          {step === 1 && <Step title="Business value and use cases" description="Help buyers understand the problems this data can solve."><Field label="Detailed description" required><textarea rows={6} value={data.description} onChange={event => set('description', event.target.value)} placeholder="Describe where the data comes from, what it represents, and how organizations can use it." /></Field><Field label="Use cases" required help="Separate multiple use cases with commas."><input value={data.useCases.join(', ')} onChange={event => set('useCases', list(event.target.value))} placeholder="Improve route planning, Reduce congestion" /></Field><Field label="Included signals or fields" help="Separate field names with commas."><input value={data.fields.join(', ')} onChange={event => set('fields', list(event.target.value))} placeholder="Road segment, Average speed, Timestamp" /></Field></Step>}
          {step === 2 && <Step title="Coverage and data characteristics" description="Define where and when the data is useful."><Field label="Geographic coverage" required help="Separate regions with commas."><input value={data.geography.join(', ')} onChange={event => set('geography', list(event.target.value))} placeholder="Munich, Bavaria" /></Field><div className="market-form-grid"><Field label="Update frequency" required><select value={data.updateFrequency} onChange={event => set('updateFrequency', event.target.value)}><option value="">Select frequency</option><option>Every 30 seconds</option><option>Every 2 minutes</option><option>Every 5 minutes</option><option>Every 15 minutes</option><option>Hourly</option><option>Daily</option></select></Field><Field label="Expected freshness"><input value={data.freshness} onChange={event => set('freshness', event.target.value)} placeholder="< 5 minutes" /></Field><Field label="Historical depth" required><input value={data.historicalDepth} onChange={event => set('historicalDepth', event.target.value)} placeholder="24 months" /></Field></div></Step>}
          {step === 3 && <Step title="Quality and freshness" description="Use realistic, supportable indicators rather than marketing claims."><Slider label="Overall quality" value={data.quality} onChange={value => set('quality', value)} /><Slider label="Completeness" value={data.completeness} onChange={value => set('completeness', value)} /><Slider label="Reliability" value={data.reliability} onChange={value => set('reliability', value)} /></Step>}
          {step === 4 && <Step title="Delivery and technical access" description="Buyers see this after understanding the business value."><Field label="Data formats" required help="Separate formats with commas."><input value={data.formats.join(', ')} onChange={event => set('formats', list(event.target.value))} placeholder="JSON, DATEX II" /></Field><Field label="Delivery methods" required help="Separate methods with commas."><input value={data.delivery.join(', ')} onChange={event => set('delivery', list(event.target.value))} placeholder="REST API, Streaming" /></Field><label className="market-checkbox"><input type="checkbox" checked={data.sampleAvailable} onChange={event => set('sampleAvailable', event.target.checked)} /><span><strong>Sample or preview is available</strong><small>Buyers can evaluate structure and fitness before requesting production access.</small></span></label></Step>}
          {step === 5 && <Step title="Commercial terms" description="Be transparent about how buyers should engage."><Field label="Commercial model" required><select value={data.commercialModel} onChange={event => set('commercialModel', event.target.value as CommercialModel)}><option>Free access</option><option>Subscription</option><option>Usage-based</option><option>Request a quote</option></select></Field><Field label="Indicative pricing or quote guidance" required><input value={data.price} onChange={event => set('price', event.target.value)} placeholder="From €1,200 / month or Pricing based on coverage" /></Field></Step>}
          {step === 6 && <Step title="Licensing, provenance, and governance" description="Set clear expectations for trust, limitations, and responsible use."><Field label="How the data was created or collected"><textarea rows={3} value={data.collectionMethod} onChange={event => set('collectionMethod', event.target.value)} placeholder="Explain sensors, contributing systems, aggregation, or modeling." /></Field><Field label="Known limitations"><textarea rows={3} value={data.limitations} onChange={event => set('limitations', event.target.value)} placeholder="Explain coverage gaps, uncertainty, exclusions, or known delay." /></Field><Field label="License type" required><input value={data.license} onChange={event => set('license', event.target.value)} placeholder="Commercial mobility data license" /></Field><Field label="Usage restrictions"><textarea rows={3} value={data.restrictions} onChange={event => set('restrictions', event.target.value)} placeholder="Explain redistribution, derivative-use, or purpose restrictions." /></Field><Field label="Access requirements"><textarea rows={2} value={data.accessRequirements} onChange={event => set('accessRequirements', event.target.value)} placeholder="Verification, intended-use review, or agreement requirements." /></Field><Field label="Privacy and governance" required><textarea rows={3} value={data.privacy} onChange={event => set('privacy', event.target.value)} placeholder="Explain anonymization, aggregation, GDPR, and governance controls." /></Field></Step>}
          {step === 7 && <Step title="Review and publish" description="Confirm how buyers will evaluate this offer."><div className="publish-review"><div><span>Title</span><strong>{data.title || 'Not provided'}</strong></div><div><span>Category</span><strong>{data.category || 'Not provided'}</strong></div><div><span>Use cases</span><strong>{data.useCases.join(', ') || 'Not provided'}</strong></div><div><span>Coverage</span><strong>{data.geography.join(', ') || 'Not provided'}</strong></div><div><span>Quality</span><strong>{data.quality}/100</strong></div><div><span>Delivery</span><strong>{data.delivery.join(', ') || 'Not provided'}</strong></div><div><span>Commercial model</span><strong>{data.commercialModel} · {data.price || 'Not provided'}</strong></div><div><span>Governance</span><strong>{data.privacy || 'Not provided'}</strong></div></div><div className="publish-confirmation"><CheckCircle2 size={17} /><p><strong>Ready for marketplace review</strong><span>You can pause or edit the offer at any time from My Offers.</span></p></div></Step>}
          {error && <p role="alert" className="market-form-error">{error}</p>}
          <footer><button type="button" className="market-button secondary" disabled={step === 0} onClick={() => setStep(current => current - 1)}>Back</button>{step < 7 ? <button type="button" className="market-button primary" onClick={next}>Continue <ArrowRight size={14} /></button> : <button type="button" className="market-button primary" onClick={() => save('Published')}><CheckCircle2 size={14} /> Publish offer</button>}</footer>
        </main>
      </div>
      {saving && <div className="form-saving"><CheckCircle2 size={16} /> Saving offer…</div>}
      {confirmExit && <ConfirmDialog title="Discard unsaved offer changes?" description="Changes made since the last save will be lost." confirmLabel="Discard changes" destructive onCancel={() => setConfirmExit(false)} onConfirm={() => navigate('/offers')} />}
    </div>
  )
}

function strip(offer: DataOffer): typeof blank { const { id, publishedAt, lastUpdated, popularity, ...rest } = offer; return rest }
function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="publish-step"><header><span className="market-eyebrow">Step details</span><h2>{title}</h2><p>{description}</p></header><div>{children}</div></section> }
function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) { return <label className="market-field"><span>{label}{required && <b>Required</b>}</span>{children}{help && <small>{help}</small>}</label> }
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="quality-slider"><div><span>{label}</span><strong>{value}/100</strong></div><input type="range" min="50" max="100" value={value} onChange={event => onChange(Number(event.target.value))} /><small>Only publish scores your organization can support with evidence.</small></label> }
