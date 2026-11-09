import { useState } from 'react'
import { ArrowRight, Building2, Check, Database, MapPin, SlidersHorizontal, X } from 'lucide-react'
import { useMarketplace } from '../context/MarketplaceContext'
import RouteCheckLogo from './RouteCheckLogo'

const organizationTypes = ['Municipality or authority', 'Fleet or logistics operator', 'Public transport operator', 'Mobility service provider', 'Infrastructure operator', 'Data or analytics company']
const goals = ['Improve route planning', 'Optimize charging operations', 'Understand travel demand', 'Improve cycling infrastructure', 'Reduce congestion', 'Improve safety']
const topics = ['Traffic and roads', 'Public transport', 'EV charging', 'Cycling', 'Parking', 'Logistics and freight', 'Safety and incidents', 'Mobility demand']

export default function OnboardingDialog() {
  const { onboardingComplete, completeOnboarding } = useMarketplace()
  const [step, setStep] = useState(0)
  const [organizationType, setOrganizationType] = useState('')
  const [goal, setGoal] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [regions, setRegions] = useState('')
  const [role, setRole] = useState('Both finding and offering data')
  const [detailLevel, setDetailLevel] = useState('Business overview first')
  if (onboardingComplete) return null
  const finish = () => completeOnboarding({ organizationType, goal, topics: selectedTopics, regions, role, detailLevel })
  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header>
          <div className="onboarding-brand"><RouteCheckLogo size={24} tone="dark" decorative /></div>
          <div><span>Personalize HTR</span><strong>{step + 1} of 3</strong></div>
          <button type="button" onClick={() => completeOnboarding()} aria-label="Skip onboarding"><X size={17} /></button>
        </header>
        <div className="onboarding-progress"><i style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
        <main>
          {step === 0 && <><span className="market-eyebrow">Your context</span><h1 id="onboarding-title">What kind of mobility organization are you?</h1><p>This helps us explain data in language and use cases relevant to your work.</p><div className="onboarding-options">{organizationTypes.map(item => <button type="button" key={item} className={organizationType === item ? 'selected' : ''} onClick={() => setOrganizationType(item)}><Building2 size={15} /><span>{item}</span>{organizationType === item && <Check size={14} />}</button>)}</div></>}
          {step === 1 && <><span className="market-eyebrow">Mobility challenge</span><h1>What are you trying to improve?</h1><p>Choose one primary outcome and any mobility topics that matter to you.</p><div className="onboarding-goals">{goals.map(item => <button type="button" key={item} className={goal === item ? 'selected' : ''} onClick={() => setGoal(item)}>{item}</button>)}</div><div className="onboarding-topic-label">Relevant topics</div><div className="onboarding-chips">{topics.map(item => <button type="button" key={item} className={selectedTopics.includes(item) ? 'selected' : ''} onClick={() => setSelectedTopics(current => current.includes(item) ? current.filter(topic => topic !== item) : [...current, item])}>{selectedTopics.includes(item) && <Check size={12} />}{item}</button>)}</div></>}
          {step === 2 && <><span className="market-eyebrow">Working preferences</span><h1>Where and how will you use HTR?</h1><p>You can update these preferences later from your organization profile.</p><label className="onboarding-field"><span><MapPin size={14} /> Regions or cities</span><input value={regions} onChange={event => setRegions(event.target.value)} placeholder="e.g. Munich, Bavaria, DACH" /></label><label className="onboarding-field"><span><Database size={14} /> Primary role</span><select value={role} onChange={event => setRole(event.target.value)}><option>Mainly finding data</option><option>Mainly offering data</option><option>Both finding and offering data</option></select></label><label className="onboarding-field"><span><SlidersHorizontal size={14} /> Preferred level of detail</span><select value={detailLevel} onChange={event => setDetailLevel(event.target.value)}><option>Business overview first</option><option>Balanced business and technical detail</option><option>Show technical detail early</option></select></label></>}
        </main>
        <footer>
          <button type="button" className="market-button ghost" onClick={() => completeOnboarding()}>Skip for now</button>
          <div>{step > 0 && <button type="button" className="market-button secondary" onClick={() => setStep(current => current - 1)}>Back</button>}<button type="button" className="market-button primary" disabled={step === 0 && !organizationType || step === 1 && !goal} onClick={step === 2 ? finish : () => setStep(current => current + 1)}>{step === 2 ? 'Show my HTR workspace' : 'Continue'} <ArrowRight size={14} /></button></div>
        </footer>
      </section>
    </div>
  )
}
