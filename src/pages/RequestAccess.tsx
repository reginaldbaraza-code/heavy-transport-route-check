import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, ArrowLeft, ChevronRight, Info } from 'lucide-react'
import { ConfirmDialog } from '../components/Feedback'

const steps = ['Dataset', 'Intended use', 'Organization', 'Review', 'Submit']

const usePurposes = [
  { id: 'research', label: 'Research', desc: 'Academic or scientific research purposes' },
  { id: 'product', label: 'Product development', desc: 'Building or improving a commercial product' },
  { id: 'urban', label: 'Urban planning', desc: 'City or regional planning activities' },
  { id: 'commercial', label: 'Commercial application', desc: 'Commercial deployment or service' },
  { id: 'public', label: 'Public service', desc: 'Government or public-sector service delivery' },
  { id: 'internal', label: 'Internal analysis', desc: 'Internal business intelligence or analytics' },
  { id: 'other', label: 'Other', desc: 'Other intended use' },
]

const durations = ['30 days', '6 months', '1 year', 'Ongoing']

export default function RequestAccess() {
  const [step, setStep] = useState(0)
  const [purpose, setPurpose] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const datasetName = params.get('dataset') ?? 'Real-Time Traffic Flow — Munich'
  const providerName = params.get('provider') ?? 'City of Munich'

  const canProceed = [
    true,
    purpose !== '' && description.length > 10,
    true,
    duration !== '',
    true,
  ]

  const continueFlow = () => {
    if (!canProceed[step]) {
      setError(step === 1
        ? 'Choose an intended-use category and provide at least 10 characters of context.'
        : 'Choose how long you need access.')
      return
    }
    setError('')
    if (step === steps.length - 1) {
      setSubmitting(true)
      window.setTimeout(() => { setSubmitting(false); setSubmitted(true) }, 700)
    } else {
      setStep(current => current + 1)
    }
  }

  if (submitted) {
    return (
      <div className="app-page max-w-xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-[var(--success)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">Request submitted!</h1>
        <p className="text-[var(--muted-foreground)] mb-2">
          Your access request for <strong>{datasetName}</strong> has been sent to {providerName}.
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">
          You'll receive a notification when the provider reviews your request. Average response time is 2–3 business days.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/catalogue" className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--navy-900)] transition-colors">
            Back to catalogue
          </Link>
          <Link to="/contracts" className="px-5 py-2.5 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)] transition-colors">
            View my contracts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page request-page max-w-2xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] mb-6">
        <Link to="/catalogue" className="hover:text-[var(--accent)] transition-colors">Data Catalogue</Link>
        <ChevronRight size={12} />
        <span className="text-[var(--foreground)] font-medium">Request access</span>
      </nav>

      <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">Request access to {datasetName}</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-7">Provider: <strong>{providerName}</strong></p>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i < step && setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex items-center gap-2 group ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step ? 'bg-[var(--success)] text-white' :
                i === step ? 'bg-[var(--primary)] text-white' :
                'bg-[var(--muted)] text-[var(--muted-foreground)]'
              }`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${
                i === step ? 'text-[var(--foreground)]' : i < step ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'
              }`}>{s}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-5">
        {step === 0 && (
          <div>
            <h2 className="font-bold text-lg text-[var(--foreground)] mb-1">Dataset</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Confirm the dataset you want to request access to.</p>
            <div className="bg-[var(--muted)] rounded-xl p-4 space-y-3">
              <Row label="Dataset" value={datasetName} />
              <Row label="Provider" value={providerName} />
              <Row label="Category" value="Traffic Information" />
              <Row label="Format" value="JSON / REST API" />
              <Row label="Access model" value="Contract required" />
              <Row label="Update frequency" value="Every 30 seconds" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-bold text-lg text-[var(--foreground)] mb-1">Intended use</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Tell the provider how you plan to use this dataset.</p>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {usePurposes.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPurpose(p.id)}
                  aria-pressed={purpose === p.id}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    purpose === p.id
                      ? 'border-[var(--accent)] bg-blue-50'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  <div className="font-semibold text-sm text-[var(--foreground)]">{p.label}</div>
                  <div className="text-sm text-[var(--muted-foreground)] mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Describe your intended use</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Please describe in detail how you plan to use this dataset, what systems it will feed, and the expected outcomes..."
                rows={4}
                className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
              />
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{description.length} / 500 characters · minimum 10</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-bold text-lg text-[var(--foreground)] mb-1">Organization</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Confirm your organization details that will appear in the contract.</p>
            <div className="bg-[var(--muted)] rounded-xl p-4 space-y-3 mb-4">
              <Row label="Organization" value="RheinLift Logistics" />
              <Row label="Role" value="Consumer" />
              <Row label="Contact person" value="Your account" />
              <Row label="MDS ID" value="MDSLCN3QM1" />
              <Row label="Jurisdiction" value="Germany" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)] flex items-start gap-1.5">
              <Info size={13} className="text-[var(--accent)] mt-0.5 flex-shrink-0" />
              To update your organization details, visit your organization profile in <Link to="/settings" className="text-[var(--accent)] font-semibold">Settings</Link>.
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-bold text-lg text-[var(--foreground)] mb-1">Access duration</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">How long do you need access to this dataset?</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {durations.map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  aria-pressed={duration === d}
                  className={`p-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                    duration === d
                      ? 'border-[var(--accent)] bg-blue-50 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <strong>Note:</strong> Access duration is subject to the provider's terms. The provider may grant a shorter period than requested.
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-bold text-lg text-[var(--foreground)] mb-1">Review & submit</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Review your request before submitting.</p>
            <div className="space-y-4">
              <Section title="Dataset">
                <Row label="Dataset" value={datasetName} />
                <Row label="Provider" value={providerName} />
              </Section>
              <Section title="Intended use">
                <Row label="Purpose" value={usePurposes.find(p => p.id === purpose)?.label ?? '—'} />
                <Row label="Duration" value={duration || '—'} />
                <div className="flex gap-4 py-2 border-b border-[var(--border)] last:border-0">
                  <span className="text-sm text-[var(--muted-foreground)] w-36 flex-shrink-0">Description</span>
                  <span className="text-sm text-[var(--foreground)] flex-1">{description || '—'}</span>
                </div>
              </Section>
              <Section title="Access conditions">
                <Row label="License" value="Unrestricted (subject to contract)" />
                <Row label="Data retention" value="Per provider's data processing policy" />
                <Row label="Expected cost" value="No charge (public dataset)" />
              </Section>
            </div>
            <div className="mt-5 p-3 bg-[var(--navy-50)] border border-blue-200 rounded-xl text-sm text-[var(--primary)]">
              By submitting this request you confirm that your use of the dataset will comply with the stated purpose and MDS platform terms.
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step === 0 ? setShowCancelConfirm(true) : setStep(s => s - 1)}
          className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={15} />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          disabled={submitting}
          onClick={continueFlow}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--navy-900)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting…' : step === steps.length - 1 ? 'Submit access request' : 'Continue'}
          <ArrowRight size={15} />
        </button>
      </div>
      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel this access request?"
          description="The information entered in this request will be discarded."
          confirmLabel="Discard request"
          destructive
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={() => navigate('/catalogue')}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-[var(--border)] last:border-0">
      <span className="text-sm text-[var(--muted-foreground)] w-36 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)]">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--muted)] rounded-xl p-4">
      <div className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  )
}
