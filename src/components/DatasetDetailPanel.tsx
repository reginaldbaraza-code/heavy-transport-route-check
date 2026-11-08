import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, Share2, Copy, CheckCircle, ArrowRight, Check, Maximize2 } from 'lucide-react'
import MobilityHeatmap from './MobilityHeatmap'

export type Dataset = {
  id: number
  org: string
  status: string
  title: string
  category: string
  verified?: boolean
  icon?: React.FC<any>
}

interface Props {
  dataset: Dataset
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

const tabs = ['Overview', 'Technical Information', 'Provider and Conditions', 'Data Offers']

export default function DatasetDetailPanel({ dataset, onClose, onPrev, onNext, hasPrev, hasNext }: Props) {
  const [activeTab, setActiveTab] = useState('Overview')
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href + `?selected=${dataset.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="dataset-detail-panel" style={{ width: 520, flexShrink: 0, borderLeft: '1px solid var(--divider)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '10px 16px', borderBottom: '1px solid var(--divider)', background: 'var(--bg-base)' }}>
        <button onClick={onPrev} disabled={!hasPrev} title="Previous" style={{ padding: 6, borderRadius: 7, background: 'none', cursor: hasPrev ? 'pointer' : 'default', color: 'var(--text-tertiary)', opacity: hasPrev ? 1 : 0.3 }}>
          <ChevronUp size={14} />
        </button>
        <button onClick={onNext} disabled={!hasNext} title="Next" style={{ padding: 6, borderRadius: 7, background: 'none', cursor: hasNext ? 'pointer' : 'default', color: 'var(--text-tertiary)', opacity: hasNext ? 1 : 0.3 }}>
          <ChevronDown size={14} />
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleShare} title="Copy link" style={{ padding: 6, borderRadius: 7, background: 'none', cursor: 'pointer', color: copied ? 'var(--green-text)' : 'var(--text-tertiary)' }}>
          {copied ? <Check size={14} /> : <Share2 size={14} />}
        </button>
        <button onClick={onClose} title="Close" style={{ padding: 6, borderRadius: 7, background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={14} />
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{dataset.org}</span>
          {dataset.verified && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, background: 'var(--green-bg)', color: 'var(--green-text)', padding: '2px 7px', borderRadius: 99 }}>
              <CheckCircle size={9} /> Verified
            </span>
          )}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-primary)', lineHeight: 1.25 }}>{dataset.title}</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 16px', background: 'var(--bg-card)', overflowX: 'auto', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '12px 8px', marginRight: 10,
            fontSize: 14, fontWeight: 500,
            color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderBottom: activeTab === tab ? '2px solid var(--text-primary)' : '2px solid transparent',
            background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'color 100ms',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'Overview' && <OverviewTab dataset={dataset} />}
        {activeTab === 'Technical Information' && <TechnicalTab dataset={dataset} />}
        {activeTab === 'Provider and Conditions' && <ProviderTab dataset={dataset} />}
        {activeTab === 'Data Offers' && <DataOffersTab dataset={dataset} />}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-sm text-[var(--muted-foreground)] w-40 flex-shrink-0">{label}:</span>
      <span className={`text-sm flex-1 ${mono ? 'font-mono text-sm text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function OverviewTab({ dataset }: { dataset: Dataset }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="p-6">
      <div className="divide-y divide-[var(--border)] mb-6">
        <Row label="Data Category" value={dataset.category} />
        <div className="py-3 border-b border-[var(--border)]">
          <div className="flex gap-4">
            <span className="text-sm text-[var(--muted-foreground)] w-40 flex-shrink-0">Description:</span>
            <div className="text-sm text-[var(--foreground)] flex-1">
              <p>
                Dataset <strong>{dataset.title}</strong> provided by <strong>{dataset.org}</strong>.
                Contains anonymized event data generated from vehicle signals.
              </p>
              {expanded && (
                <>
                  <p className="mt-3">
                    Each event is generated from vehicle signals (e.g., dynamic stabilization control) in a completely anonymized way. Position information consists of up to three consecutive points sorted by time, with timestamps rounded to 5 minutes.
                  </p>
                  <p className="mt-3">
                    Events are provided for the geographic rectangle: <strong>northLatitude</strong> = 71.5, <strong>southLatitude</strong> = 34.5, <strong>eastLongitude</strong> = 65.0, <strong>westLongitude</strong> = −11.0.
                  </p>
                  <p className="mt-3">
                    The dataset contains events from the last 30 minutes and updates every 5 minutes. Note: deactivated between 7 pm–6 am CEST and during weekends.
                  </p>
                </>
              )}
              <button onClick={() => setExpanded(!expanded)}
                className="mt-2 text-sm text-[var(--accent)] font-medium hover:underline">
                {expanded ? '↑ Show less' : '↓ Show more'}
              </button>
            </div>
          </div>
        </div>
        <Row label="Data Offer Type" value={dataset.status} />
        <Row label="Transport Mode" value="Road" />
        <Row label="Update frequency" value="Every 5 minutes" />
        <Row label="Geographic coverage" value="Europe (NUTS Level 0)" />
      </div>

      <div className="coverage-preview">
        <div className="coverage-preview-header">
          <div><span>Geographic coverage</span><strong>Germany · NUTS Level 0</strong></div>
          <span className="coverage-fresh">Updated 2 min ago</span>
        </div>
        <MobilityHeatmap mode={dataset.category.includes('Traffic') ? 'transport' : 'weather'} compact />
        <div className="coverage-preview-footer">
          <span>Resolution 5 km · Forecast 6 h</span>
          <button type="button" onClick={() => navigate('/my-data/route-intelligence')}>
            <Maximize2 size={12} /> Open in Route Intelligence
          </button>
        </div>
      </div>

      {/* Access CTA */}
      <div className="p-4 bg-[var(--navy-50)] rounded-xl border border-blue-200">
        <h3 className="font-bold text-sm text-[var(--primary)] mb-3">Access this dataset</h3>
        <ol className="space-y-1.5 mb-4">
          {['Review access conditions', 'Submit request', 'Provider reviews request', 'Contract is established', 'Data access becomes available'].map((step, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
              <span className="w-5 h-5 rounded-full bg-[var(--primary)] text-white text-sm flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <button
          onClick={() => navigate(`/catalogue/request?dataset=${encodeURIComponent(dataset.title)}&provider=${encodeURIComponent(dataset.org)}`)}
          className="w-full bg-[var(--primary)] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[var(--navy-900)] transition-colors flex items-center justify-center gap-2"
        >
          Request access <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function TechnicalTab({ dataset }: { dataset: Dataset }) {
  const assetId = `data.mds.${dataset.category.replace(/\s+/g, '').toLowerCase()}.${dataset.title.replace(/\s+/g, '_').toLowerCase().slice(0, 20)}`
  return (
    <div className="p-6">
      <div className="divide-y divide-[var(--border)]">
        <Row label="Version" value="1.0" />
        <Row label="Asset ID" value={assetId} mono />
        <Row label="Language" value="HTTPS://W3ID.ORG/IDSA/CODE/EN" mono />
        <Row label="NUTS Location" value="" />
        <Row label="Content Type" value="application/json" mono />
        <Row label="Data Model" value="" />
        <Row label="Geo Reference Model" value="" />
        <Row label="Data Update Frequency" value="Every 5 minutes" />
        <Row label="Endpoint Documentation" value="" />
      </div>
      <div className="mt-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Reference Files:</p>
          <p className="text-sm text-[var(--muted-foreground)]">—</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Data samples:</p>
          <p className="text-sm text-[var(--muted-foreground)]">—</p>
        </div>
      </div>
    </div>
  )
}

function ProviderTab({ dataset }: { dataset: Dataset }) {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false)
  const endpoint = dataset.org.toLowerCase().includes('bmw')
    ? 'https://connector-mds-prod.edc.aws.bmw.cloud/api/dsp'
    : `https://connector.${dataset.org.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}.mds.eu/api/dsp`

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint)
    setCopiedEndpoint(true)
    setTimeout(() => setCopiedEndpoint(false), 2000)
  }

  return (
    <div className="p-6">
      <div className="divide-y divide-[var(--border)]">
        <div className="flex gap-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm text-[var(--muted-foreground)] w-40 flex-shrink-0">Publisher:</span>
          <span className="text-sm text-[var(--foreground)] font-medium">Mobility Data Space member directory</span>
        </div>
        <Row label="Organisation" value={dataset.org} />
        <Row label="Standard License" value="" />
        <Row label="Conditions For Use" value="" />
        <div className="flex gap-4 py-3">
          <span className="text-sm text-[var(--muted-foreground)] w-40 flex-shrink-0">Connector Endpoint:</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="mono text-sm text-[var(--foreground)] truncate">{endpoint}</span>
            <button onClick={copyEndpoint} title="Copy endpoint URL"
              className="flex-shrink-0 p-1.5 rounded hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              {copiedEndpoint ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataOffersTab({ dataset }: { dataset: Dataset }) {
  const navigate = useNavigate()
  return (
    <div className="p-6">
      <div className="bg-white border border-[var(--border)] rounded-xl p-5 mb-4">
        <h3 className="font-bold text-sm text-[var(--foreground)] mb-3">Data Offer</h3>
        <div className="flex items-center gap-4 py-2">
          <span className="text-sm text-[var(--muted-foreground)] w-24">Policy:</span>
          <span className="text-sm font-medium text-[var(--foreground)]">Unrestricted</span>
          <span className="ml-auto text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
          </span>
        </div>
      </div>
      <button
        onClick={() => navigate(`/catalogue/request?dataset=${encodeURIComponent(dataset.title)}&provider=${encodeURIComponent(dataset.org)}`)}
        className="w-full bg-[var(--primary)] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[var(--navy-900)] transition-colors flex items-center justify-center gap-2"
      >
        Request access <ArrowRight size={14} />
      </button>
    </div>
  )
}
