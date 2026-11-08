import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  Plus, Database, Users, RefreshCw, CheckCircle,
  AlertCircle, Eye, Settings, ArrowRight, TrendingUp, Route, Snowflake, Truck
} from 'lucide-react'
import { Toast } from '../components/Feedback'

const datasets = [
  {
    id: 1,
    name: 'EV Charging Availability — Munich',
    status: 'published',
    subscribers: 12,
    lastUpdated: '30 min ago',
    quality: 98,
    visibility: 'Public',
  },
  {
    id: 2,
    name: 'Parking Sensor Data — CODE Campus',
    status: 'published',
    subscribers: 3,
    lastUpdated: '2 hours ago',
    quality: 87,
    visibility: 'Restricted',
  },
  {
    id: 3,
    name: 'Campus Traffic Flow — Spree District',
    status: 'draft',
    subscribers: 0,
    lastUpdated: '3 days ago',
    quality: 72,
    visibility: 'Private',
  },
  {
    id: 4,
    name: 'Bike Sharing Demand Forecast — Berlin',
    status: 'under-review',
    subscribers: 0,
    lastUpdated: '1 week ago',
    quality: 91,
    visibility: 'Public',
  },
]

const accessRequests = [
  { dataset: 'EV Charging Availability — Munich', org: 'Fraunhofer IML', purpose: 'Research', time: '2 hours ago' },
  { dataset: 'Parking Sensor Data — CODE Campus', org: 'Berlin City Planning', purpose: 'Urban planning', time: '1 day ago' },
  { dataset: 'EV Charging Availability — Munich', org: 'Volkswagen AG', purpose: 'Product development', time: '3 days ago' },
]

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  published: { label: 'Published', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  'under-review': { label: 'Under review', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
}

export default function MyData() {
  const [requests, setRequests] = useState(accessRequests)
  const [selectedDataset, setSelectedDataset] = useState<typeof datasets[number] | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<typeof accessRequests[number] | null>(null)
  const [toast, setToast] = useState('')

  return (
    <div className="app-page my-data-page p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="page-heading flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">My Data</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Manage your published datasets and monitor data usage</p>
        </div>
        <Link
          to="/connector/create-offer"
          className="flex items-center gap-2 bg-[var(--primary)] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[var(--navy-900)] transition-colors"
        >
          <Plus size={15} />
          Publish dataset
        </Link>
      </div>

      {/* Stats overview */}
      <div className="metric-grid grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Published Datasets', value: '2', icon: Database, color: 'text-[var(--accent)]', bg: 'bg-blue-50' },
          { label: 'Active Subscriptions', value: '15', icon: Users, color: 'text-[var(--success)]', bg: 'bg-green-50' },
          { label: 'Pending Requests', value: '3', icon: AlertCircle, color: 'text-[var(--warning)]', bg: 'bg-amber-50' },
          { label: 'Avg. Data Quality', value: '93%', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="metric-card bg-white rounded-xl border border-[var(--border)] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--muted-foreground)] mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <Icon size={20} className={stat.color} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Data sovereignty notice */}
      <div className="sovereignty-banner bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
          <CheckCircle size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">Your data remains with your organization</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            MDS manages discovery, permissions and contractual access without storing the underlying raw dataset. You retain full sovereignty over your data at all times.
          </p>
        </div>
      </div>

      <Link to="/my-data/route-intelligence" className="intelligence-banner">
        <div className="intelligence-icon"><Route size={20} /></div>
        <div className="intelligence-copy">
          <span>Operational intelligence</span>
          <strong>Turn licensed data into safer routes</strong>
          <p>Plan heavy transport and snow-removal operations using live weather, restrictions, and road conditions.</p>
        </div>
        <div className="intelligence-modes">
          <span><Truck size={13} /> Heavy transport</span>
          <span><Snowflake size={13} /> Snow removal</span>
        </div>
        <div className="intelligence-action">Open workspace <ArrowRight size={14} /></div>
      </Link>

      {selectedDataset && (
        <div className="bg-[var(--navy-50)] border border-blue-200 rounded-xl p-4 mb-6 flex items-start justify-between gap-4">
          <div><div className="text-sm font-bold text-[var(--primary)] uppercase tracking-wide">Dataset summary</div><div className="font-semibold mt-1">{selectedDataset.name}</div><div className="text-sm text-[var(--muted-foreground)] mt-1">{selectedDataset.visibility} · {selectedDataset.quality}% quality · updated {selectedDataset.lastUpdated}</div></div>
          <button type="button" onClick={() => setSelectedDataset(null)} className="text-sm font-semibold text-[var(--accent)]">Close</button>
        </div>
      )}

      {/* Dataset management table */}
      <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-[var(--foreground)]">Published Datasets</h2>
          <span className="text-sm text-[var(--muted-foreground)]">{datasets.length} total</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              {['Dataset', 'Status', 'Subscribers', 'Last updated', 'Data quality', 'Visibility', 'Actions'].map((col) => (
                <th key={col} className="px-5 py-3 text-left text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {datasets.map((ds) => {
              const sc = statusConfig[ds.status]
              const qualityColor =
                ds.quality >= 90 ? 'bg-green-500' : ds.quality >= 75 ? 'bg-amber-500' : 'bg-red-500'
              return (
                <tr key={ds.id} className="hover:bg-[var(--muted)] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--navy-50)] flex items-center justify-center">
                        <Database size={15} className="text-[var(--primary)]" />
                      </div>
                      <span className="font-semibold text-[var(--foreground)]">{ds.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2 py-0.5 rounded-full ${sc.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} className="text-[var(--muted-foreground)]" />
                      <span className="font-semibold text-[var(--foreground)]">{ds.subscribers}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-[var(--muted-foreground)] text-sm">
                      <RefreshCw size={12} />
                      {ds.lastUpdated}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[var(--muted)] rounded-full h-1.5 w-16">
                        <div
                          className={`h-1.5 rounded-full ${qualityColor}`}
                          style={{ width: `${ds.quality}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-[var(--foreground)]">{ds.quality}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      ds.visibility === 'Public' ? 'text-green-700' : ds.visibility === 'Restricted' ? 'text-amber-700' : 'text-[var(--muted-foreground)]'
                    }`}>
                      {ds.visibility}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedDataset(ds)} aria-label={`View ${ds.name}`} className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                        <Eye size={14} />
                      </button>
                      <Link to="/connector/data-offers" aria-label={`Manage ${ds.name}`} className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"><Settings size={14} /></Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pending access requests */}
      <div className="data-table-shell bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-bold text-[var(--foreground)]">Pending Access Requests</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Organizations requesting access to your datasets</p>
          </div>
          <span className="text-sm bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">{requests.length} pending</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {requests.map((req, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{req.org.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-[var(--foreground)]">{req.org}</div>
                <div className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Requested: <span className="font-medium">{req.dataset}</span> · Purpose: {req.purpose}
                </div>
              </div>
              <span className="text-sm text-[var(--muted-foreground)] flex-shrink-0">{req.time}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => {
                  setRequests(current => current.filter(item => item !== req))
                  setToast(`Access approved for ${req.org}.`)
                }} className="text-sm font-semibold text-white bg-[var(--success)] px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                  Approve
                </button>
                <button type="button" onClick={() => setSelectedRequest(req)} className="text-sm font-semibold text-[var(--muted-foreground)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors">
                  Review
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && <div className="px-5 py-10 text-center text-sm text-[var(--muted-foreground)]">You have reviewed all access requests.</div>}
        </div>
      </div>
      {selectedRequest && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setSelectedRequest(null)}>
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="request-review-title">
            <div className="confirm-dialog-icon"><AlertCircle size={19} /></div>
            <div><h2 id="request-review-title">Review access request</h2><p><strong>{selectedRequest.org}</strong> requests <strong>{selectedRequest.dataset}</strong> for {selectedRequest.purpose.toLowerCase()}.</p></div>
            <div className="confirm-dialog-actions">
              <button type="button" onClick={() => setSelectedRequest(null)}>Close</button>
              <button type="button" className="primary" onClick={() => {
                setRequests(current => current.filter(item => item !== selectedRequest))
                setToast(`Access approved for ${selectedRequest.org}.`)
                setSelectedRequest(null)
              }}>Approve request</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
