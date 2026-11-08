import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Save, Sparkles } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import { ConfirmDialog } from '../components/Feedback'

export default function DataNeedForm() {
  const { needId } = useParams()
  const navigate = useNavigate()
  const { needs, addNeed, updateNeed } = useMarketplace()
  const existing = needs.find(need => need.id === needId)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [objective, setObjective] = useState(existing?.objective ?? '')
  const [domain, setDomain] = useState(existing?.domain ?? '')
  const [geography, setGeography] = useState(existing?.geography ?? '')
  const [frequency, setFrequency] = useState(existing?.frequency ?? '')
  const [quality, setQuality] = useState(existing?.quality ?? '')
  const [format, setFormat] = useState(existing?.format ?? '')
  const [budget, setBudget] = useState(existing?.budget ?? '')
  const [timeframe, setTimeframe] = useState(existing?.timeframe ?? '')
  const [intendedUse, setIntendedUse] = useState(existing?.intendedUse ?? '')
  const [alternatives, setAlternatives] = useState(existing?.alternatives ?? true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)

  const save = (status: 'Draft' | 'Matching') => {
    if (status === 'Matching' && (!title.trim() || !objective.trim() || !domain || !geography.trim() || !frequency)) {
      setError('Add a title, business objective, mobility domain, geography, and update frequency before starting matching.')
      return
    }
    const data = { title: title.trim() || 'Untitled data need', objective, domain, geography, frequency, quality, format, budget, timeframe, intendedUse, alternatives, status }
    if (existing) updateNeed(existing.id, data)
    else addNeed(data)
    setSaved(true)
    window.setTimeout(() => navigate('/needs'), 650)
  }

  return (
    <div className="market-form-page">
      <button type="button" onClick={() => setConfirmExit(true)} className="market-back"><ArrowLeft size={14} /> Data needs</button>
      <header><span className="market-eyebrow">Buyer workspace</span><h1>{existing ? 'Edit data need' : 'Create a data need'}</h1><p>Describe the business problem first. Providers can respond more effectively when requirements are specific but not unnecessarily technical.</p></header>
      <div className="need-form-layout">
        <form onSubmit={event => { event.preventDefault(); save('Matching') }}>
          <FormSection number="1" title="Business objective" description="What are you trying to improve or decide?">
            <Field label="Need title" required><input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Reduce failed charging stops for our fleet" /></Field>
            <Field label="Problem and desired outcome" required help="Explain the operational problem, who it affects, and what success looks like."><textarea rows={5} value={objective} onChange={event => setObjective(event.target.value)} placeholder="We operate a mixed commercial fleet and need…" /></Field>
            <Field label="Intended use"><textarea rows={3} value={intendedUse} onChange={event => setIntendedUse(event.target.value)} placeholder="How will your organization use the data?" /></Field>
          </FormSection>
          <FormSection number="2" title="Data requirements" description="Define the minimum characteristics required for a useful match.">
            <div className="market-form-grid">
              <Field label="Mobility domain" required><select value={domain} onChange={event => setDomain(event.target.value)}><option value="">Select domain</option><option>Traffic and road conditions</option><option>Public transport</option><option>EV charging</option><option>Parking</option><option>Logistics and freight</option><option>Safety and incidents</option><option>Mobility demand</option></select></Field>
              <Field label="Required geography" required><input value={geography} onChange={event => setGeography(event.target.value)} placeholder="Cities, regions, or countries" /></Field>
              <Field label="Required update frequency" required><select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="">Select frequency</option><option>Real-time or under 1 minute</option><option>Every 5 minutes</option><option>Every 15 minutes</option><option>Hourly</option><option>Daily</option><option>Historical only</option></select></Field>
              <Field label="Minimum quality"><select value={quality} onChange={event => setQuality(event.target.value)}><option value="">No fixed minimum</option><option>At least 80% completeness</option><option>At least 90% completeness</option><option>At least 95% reliability</option></select></Field>
              <Field label="Preferred format or delivery"><select value={format} onChange={event => setFormat(event.target.value)}><option value="">Open to recommendations</option><option>REST API</option><option>Streaming</option><option>CSV or file delivery</option><option>Cloud bucket</option></select></Field>
              <Field label="Required timeframe"><input value={timeframe} onChange={event => setTimeframe(event.target.value)} placeholder="e.g. Within 6 weeks" /></Field>
            </div>
          </FormSection>
          <FormSection number="3" title="Commercial preference" description="A range helps providers propose realistic terms.">
            <Field label="Budget or pricing preference"><select value={budget} onChange={event => setBudget(event.target.value)}><option value="">Prefer to discuss</option><option>Free or open data only</option><option>Under €1,000 per month</option><option>€1,000–€3,000 per month</option><option>€3,000–€10,000 per month</option><option>Open to usage-based pricing</option></select></Field>
            <label className="market-checkbox"><input type="checkbox" checked={alternatives} onChange={event => setAlternatives(event.target.checked)} /><span><strong>Open to alternative approaches</strong><small>Allow providers to suggest a different geography, frequency, delivery method, or combination of datasets.</small></span></label>
          </FormSection>
          {error && <p className="market-form-error" role="alert">{error}</p>}
          <div className="market-form-actions">
            <button type="button" className="market-button secondary" onClick={() => save('Draft')}><Save size={14} /> Save draft</button>
            <button type="submit" className="market-button primary"><Sparkles size={14} /> Save and find matches</button>
          </div>
        </form>
        <aside className="matching-guidance"><Sparkles size={19} /><h2>How matching works</h2><p>We compare your need with published offers using geography, mobility domain, freshness, quality, delivery, and intended use.</p><ul><li><CheckCircle2 size={13} />You stay in control of who you contact.</li><li><CheckCircle2 size={13} />Recommendations explain why they match.</li><li><CheckCircle2 size={13} />No agreement is created automatically.</li></ul></aside>
      </div>
      {saved && <div className="form-saving"><CheckCircle2 size={16} /> Saving data need…</div>}
      {confirmExit && <ConfirmDialog title="Discard unsaved data need?" description="Your current business objective and requirement changes will be lost." confirmLabel="Discard changes" destructive onCancel={() => setConfirmExit(false)} onConfirm={() => navigate('/needs')} />}
    </div>
  )
}

function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="market-form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header><div className="market-form-fields">{children}</div></section>
}
function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return <label className="market-field"><span>{label}{required && <b>Required</b>}</span>{children}{help && <small>{help}</small>}</label>
}
