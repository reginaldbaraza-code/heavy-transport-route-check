import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectorSidebar from '../components/ConnectorSidebar'
import { Plus, X, CheckCircle } from 'lucide-react'
import { ConfirmDialog } from '../components/Feedback'
import { initialOffers } from './connector/DataOffers'

export default function CreateDataOffer() {
  const [type, setType] = useState('REST-API Endpoint')
  const [method, setMethod] = useState('GET')
  const [baseUrl, setBaseUrl] = useState('')
  const [path, setPath] = useState('')
  const [proxyMethod, setProxyMethod] = useState(false)
  const [proxyPath, setProxyPath] = useState(false)
  const [proxyQuery, setProxyQuery] = useState(false)
  const [queryParams, setQueryParams] = useState<{ key: string; value: string }[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseUrl.trim()) {
      setError('Enter a base URL.')
      return
    }
    try {
      const url = new URL(baseUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      setError('Enter a valid HTTP or HTTPS URL, for example https://api.example.com.')
      return
    }
    if (path && !path.startsWith('/')) {
      setError('The path must start with “/”.')
      return
    }
    if (queryParams.some(param => !param.key.trim())) {
      setError('Every query parameter needs a key.')
      return
    }
    setError('')
    let offers = initialOffers
    try {
      const saved = sessionStorage.getItem('mds-data-offers')
      if (saved) offers = JSON.parse(saved)
    } catch {
      offers = initialOffers
    }
    const nextOffer = {
      id: `offer-${String(offers.length + 1).padStart(3, '0')}`,
      name: `${type} · ${new URL(baseUrl).hostname}`,
      asset: `asset-${String(offers.length + 1).padStart(3, '0')}`,
      policy: 'Unrestricted Access',
      status: 'draft',
      subscriptions: 0,
    }
    sessionStorage.setItem('mds-data-offers', JSON.stringify([...offers, nextOffer]))
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex h-full">
        <ConnectorSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Data offer created!</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">Your offer is available in this prototype for the current session.</p>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => navigate('/connector/data-offers')} className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-semibold rounded-lg">View data offers</button>
              <button type="button" onClick={() => { setSubmitted(false); setBaseUrl(''); setPath(''); setQueryParams([]) }} className="px-4 py-2 border border-[var(--border)] text-sm font-semibold rounded-lg">Create another</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ConnectorSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="connector-workspace-header" style={{ background: 'var(--navy)', padding: '24px 32px 22px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 4 }}>
            Create Data Offer
          </h1>
          <p className="connector-subtitle" style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)' }}>Define how your data will be exposed to consumers</p>
        </div>

        <form onSubmit={handleSubmit} className="connector-form p-8 max-w-3xl">
          <div className="flex gap-10">
            <div className="w-48 flex-shrink-0">
              <h2 className="font-bold text-lg text-[var(--foreground)]">Data offer type</h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Define how your data will be accessed</p>
            </div>

            <div className="flex-1 space-y-5">
              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Type</label>
                <div className="relative">
                  <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full appearance-none bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all">
                    <option>REST-API Endpoint</option>
                    <option>S3 Bucket</option>
                    <option>SFTP</option>
                    <option>Custom HTTP</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)]">▾</div>
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Method</label>
                <div className="relative">
                  <select value={method} onChange={e => setMethod(e.target.value)}
                    className="w-full appearance-none bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all">
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                    <option>DELETE</option>
                    <option>PATCH</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted-foreground)]">▾</div>
                </div>
              </div>

              {/* Proxy method */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={proxyMethod} onChange={e => setProxyMethod(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                <span className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Enable Proxy Method</span>
              </label>

              {/* Base URL — required */}
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={baseUrl}
                  onChange={e => { setBaseUrl(e.target.value); setError('') }}
                  type="url"
                  aria-invalid={Boolean(error)}
                  placeholder="https://your-api.example.com"
                  className="w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Path */}
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Path</label>
                <input
                  value={path}
                  onChange={e => setPath(e.target.value)}
                  placeholder="/api/v1/data"
                  className="w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Proxy path */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={proxyPath} onChange={e => setProxyPath(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                <span className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Enable Proxy Path</span>
              </label>

              {/* Query Params */}
              <div>
                <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">Query Params</label>
                {queryParams.map((param, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      placeholder="Key"
                      value={param.key}
                      onChange={e => {
                        const u = [...queryParams]; u[i] = { ...u[i], key: e.target.value }; setQueryParams(u)
                      }}
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-all"
                    />
                    <input
                      placeholder="Value"
                      value={param.value}
                      onChange={e => {
                        const u = [...queryParams]; u[i] = { ...u[i], value: e.target.value }; setQueryParams(u)
                      }}
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] transition-all"
                    />
                    <button type="button" onClick={() => setQueryParams(prev => prev.filter((_, j) => j !== i))}
                      className="p-2 text-[var(--muted-foreground)] hover:text-red-600 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setQueryParams(prev => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-1.5 text-sm font-bold text-[var(--foreground)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                  <Plus size={13} /> Add Query Param
                </button>
              </div>

              {/* Proxy query */}
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={proxyQuery} onChange={e => setProxyQuery(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                <span className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Enable Proxy Query Params</span>
              </label>

              {/* Submit */}
              {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="pt-4 flex gap-3">
                <button type="submit"
                  className="flex-1 bg-[var(--primary)] text-white text-sm font-semibold py-3 rounded-lg hover:bg-[var(--navy-900)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!baseUrl.trim()}
                >
                  Create Data Offer
                </button>
                <button type="button" onClick={() => baseUrl || path || queryParams.length ? setShowCancelConfirm(true) : navigate('/connector/dashboard')}
                  className="px-6 py-3 border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] rounded-lg hover:border-[var(--accent)] transition-colors flex items-center">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
      {showCancelConfirm && (
        <ConfirmDialog
          title="Discard this data offer?"
          description="Your unsaved endpoint and query parameter changes will be lost."
          confirmLabel="Discard changes"
          destructive
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={() => navigate('/connector/dashboard')}
        />
      )}
    </div>
  )
}
