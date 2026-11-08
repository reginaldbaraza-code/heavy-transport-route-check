import { Link } from 'react-router-dom'
import ConnectorSidebar from '../components/ConnectorSidebar'
import { Database, BookOpen, FileCheck, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react'
import MobilityHeatmap from '../components/MobilityHeatmap'

const stats = [
  { label: 'Data Offers', value: 4, link: '/connector/data-offers', accent: 'var(--accent)', bg: 'var(--accent-soft)' },
  { label: 'Assets', value: 3, link: '/connector/assets', accent: 'var(--green-text)', bg: 'var(--green-bg)' },
  { label: 'Policies', value: 1, link: '/connector/policies', accent: 'var(--navy-light)', bg: 'var(--blue-bg)' },
  { label: 'Contracts', value: 0, link: '/contracts', accent: 'var(--text-tertiary)', bg: 'var(--muted)' },
  { label: 'Negotiations', value: 0, link: '/connector/negotiations', accent: 'var(--text-tertiary)', bg: 'var(--muted)' },
  { label: 'Pending Approvals', value: 2, link: '/connector/approvals', accent: 'var(--amber-text)', bg: 'var(--amber-bg)' },
]

export default function ConnectorDashboard() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ConnectorSidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Header */}
        <div className="connector-workspace-header" style={{
          background: 'var(--navy)',
          padding: '24px 28px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                fontSize: 22, fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
                marginBottom: 4,
              }}>
                Connector Dashboard
              </h1>
              <div className="connector-subtitle" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 14, color: 'rgba(255,255,255,0.72)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34c759', boxShadow: '0 0 6px #34c759' }} />
                MDSLCN3QM1.CDK69LF — Code team on-prem
              </div>
            </div>
            <Link to="/connector/approvals" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,159,10,0.15)',
              border: '1px solid rgba(255,159,10,0.3)',
              borderRadius: 10,
              padding: '8px 12px',
              textDecoration: 'none',
              transition: 'background 120ms',
            }}>
              <AlertCircle size={14} style={{ color: '#ff9f0a' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#ff9f0a' }}>2 pending approvals</span>
              <ArrowRight size={12} style={{ color: '#ff9f0a' }} />
            </Link>
          </div>
        </div>

        <div className="connector-workspace-body" style={{ padding: '24px 28px 40px' }}>

          {/* Stats grid */}
          <div className="connector-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {stats.map(s => (
              <Link key={s.label} to={s.link} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--bg-card)',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-xs)',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  transition: 'box-shadow 150ms, transform 150ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)'
                    ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: 40, fontWeight: 700,
                      color: s.value > 0 ? s.accent : 'var(--text-tertiary)',
                      letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1, marginBottom: 4,
                    }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
                      {s.label}
                    </div>
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: s.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowRight size={14} style={{ color: s.accent }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="connector-coverage-card">
            <div className="connector-coverage-copy">
              <span className="eyebrow">Network observability</span>
              <h2>Data coverage & quality</h2>
              <p>Monitor regional freshness, coverage gaps, and connector health across your published assets.</p>
              <div className="coverage-metrics">
                <div><strong>94.6%</strong><span>Average coverage</span></div>
                <div><strong>2 min</strong><span>Latest update</span></div>
                <div><strong>1</strong><span>Coverage gap</span></div>
              </div>
              <Link to="/connector/assets">Review affected assets <ArrowRight size={12} /></Link>
            </div>
            <div className="connector-coverage-map">
              <MobilityHeatmap mode="quality" compact />
            </div>
          </div>

          {/* Transfer panels */}
          <div className="connector-transfer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            {[
              { title: 'Incoming Data', subtitle: 'Consuming Transfer Processes', link: '/connector/transfers' },
              { title: 'Outgoing Data', subtitle: 'Providing Transfer Processes', link: '/connector/transfers' },
            ].map(panel => (
              <div key={panel.title} style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 2 }}>
                      {panel.title}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{panel.subtitle}</div>
                  </div>
                  <Link to={panel.link} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 14, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none',
                  }}>
                    View all <ArrowRight size={11} />
                  </Link>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '24px',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 12,
                  gap: 8,
                }}>
                  <RefreshCw size={24} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    No active transfers
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            padding: '20px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 14 }}>
              Quick actions
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link to="/offers/new" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--navy)', color: '#ffffff',
                fontSize: 14, fontWeight: 600,
                padding: '9px 16px', borderRadius: 10,
                textDecoration: 'none',
                transition: 'opacity 120ms',
              }}>
                <Database size={14} /> Publish Marketplace Offer
              </Link>
              <Link to="/discover" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--bg-base)', color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: 14, fontWeight: 500,
                padding: '9px 16px', borderRadius: 10,
                textDecoration: 'none',
              }}>
                <BookOpen size={14} /> Discover Data
              </Link>
              <Link to="/deals" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--bg-base)', color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontSize: 14, fontWeight: 500,
                padding: '9px 16px', borderRadius: 10,
                textDecoration: 'none',
              }}>
                <FileCheck size={14} /> View Agreements
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
