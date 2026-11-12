import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, FileCheck, Database, Clock, Activity, TrendingUp, CheckCircle, Car, Train, Plug, ParkingSquare, AlertTriangle, Route } from 'lucide-react'
import MobilityHeatmap from '../components/MobilityHeatmap'

const kpis = [
  { label: 'Active Contracts', value: '12', delta: '+2 this month', positive: true, icon: FileCheck, accent: 'var(--accent)', bg: 'var(--accent-soft)', link: '/contracts' },
  { label: 'Available Datasets', value: '134', delta: '6 new this week', positive: true, icon: Database, accent: 'var(--green-text)', bg: 'var(--green-bg)', link: '/catalogue' },
  { label: 'Pending Requests', value: '3', delta: '1 awaiting review', positive: false, icon: Clock, accent: 'var(--amber-text)', bg: 'var(--amber-bg)', link: '/contracts' },
  { label: 'Data Subscriptions', value: '8', delta: 'Across 5 providers', positive: true, icon: Activity, accent: 'var(--navy-light)', bg: 'var(--blue-bg)', link: '/my-data' },
]

const recommended = [
  { id: 14, title: 'Real-Time Traffic Flow', subtitle: 'Munich Metropolitan Area', provider: 'City of Munich', category: 'Traffic', frequency: '30 sec', format: 'JSON / API', available: true, icon: Car, verified: true },
  { id: 11, title: 'Public Transport Disruptions', subtitle: 'North Rhine-Westphalia', provider: 'VRR GmbH', category: 'Transit', frequency: 'Real-time', format: 'GTFS-RT', available: true, icon: Train, verified: true },
  { id: 12, title: 'EV Charging Availability', subtitle: 'Berlin & Brandenburg', provider: 'Bundesnetzagentur', category: 'EV', frequency: '5 min', format: 'JSON / API', available: true, icon: Plug, verified: true },
  { id: 13, title: 'Parking Availability', subtitle: 'Hamburg City Centre', provider: 'Hamburg Parkhaus GmbH', category: 'Parking', frequency: '2 min', format: 'JSON', available: false, icon: ParkingSquare, verified: false },
]

const activity = [
  { event: 'Contract approved', meta: 'BMW Slippery Road', time: '2h ago', type: 'success' },
  { event: 'Dataset schema updated', meta: 'Public Transport Disruptions NRW', time: '5h ago', type: 'info' },
  { event: 'Access request submitted', meta: 'Real-Time Traffic Flow — Munich', time: '1d ago', type: 'pending' },
  { event: 'New organization joined', meta: 'Fraunhofer IML', time: '2d ago', type: 'info' },
  { event: 'Contract expiring soon', meta: 'Road Events & Conditions — BMW AG', time: '2d ago', type: 'warning' },
]

const members = [
  'DHL AG', 'Your organisation', 'Centre for Research and Technology Hellas',
]

const dot: Record<string, string> = {
  success: 'var(--green)', info: 'var(--accent)', pending: 'var(--amber)', warning: 'var(--red)',
}
const badge: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: 'var(--green-bg)', color: 'var(--green-text)', label: 'Approved' },
  info: { bg: 'var(--blue-bg)', color: 'var(--blue-text)', label: 'Info' },
  pending: { bg: 'var(--amber-bg)', color: 'var(--amber-text)', label: 'Pending' },
  warning: { bg: 'var(--red-bg)', color: 'var(--red-text)', label: 'Action required' },
}

export default function Home() {
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const navigate = useNavigate()

  return (
    <div className="app-page home-page" style={{ padding: '28px 28px 40px', maxWidth: 1280, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}>
          {greeting}, Your organisation
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
          Here's what's happening across your data activity today.
        </p>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="home-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Link key={k.label} to={k.link} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                padding: '20px 20px 18px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'box-shadow 150ms, transform 150ms',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: k.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} style={{ color: k.accent }} />
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 500,
                    color: k.positive ? 'var(--green-text)' : 'var(--amber-text)',
                    background: k.positive ? 'var(--green-bg)' : 'var(--amber-bg)',
                    padding: '2px 7px', borderRadius: 99,
                  }}>
                    {k.delta}
                  </span>
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  marginBottom: 6,
                }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {k.label}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <Link to="/live-map" className="home-intelligence-card">
        <div className="home-intelligence-copy">
          <span className="eyebrow">Operational intelligence · Prototype scenario</span>
          <h2>Weather risk is affecting 2 active corridors</h2>
          <p>Black ice is forecast along the A5 after 16:00. Review heavy transport routes before departure.</p>
          <div className="home-intelligence-alert"><AlertTriangle size={13} /> 1 high-priority route alert</div>
          <b>Open Live Mobility Map <ArrowRight size={13} /></b>
        </div>
        <div className="home-intelligence-map">
          <MobilityHeatmap mode="weather" compact />
        </div>
        <div className="home-intelligence-icon"><Route size={18} /></div>
      </Link>

      {/* ── Middle row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>

        {/* Recommended */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Recommended for you
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>Based on your organization and past activity</p>
            </div>
            <Link to="/catalogue" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>
              View all <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {recommended.map(ds => {
              const Icon = ds.icon
              return (
                <Link key={ds.id} to="/catalogue" style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 14,
                      padding: '16px',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-xs)',
                      cursor: 'pointer',
                      transition: 'box-shadow 150ms, border-color 150ms, transform 150ms',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)'
                      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg-base)',
                        borderRadius: 7,
                        padding: '4px 8px',
                      }}>
                        <Icon size={13} style={{ color: 'var(--navy-mid)' }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{ds.category}</span>
                        {ds.verified && <CheckCircle size={11} style={{ color: 'var(--green-text)' }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ds.available ? 'var(--green)' : 'var(--amber)' }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: ds.available ? 'var(--green-text)' : 'var(--amber-text)' }}>
                          {ds.available ? 'Available' : 'Limited'}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', lineHeight: 1.3 }}>
                        {ds.title}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{ds.subtitle}</div>
                    </div>

                    {/* Meta */}
                    <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        ['Provider', ds.provider],
                        ['Frequency', ds.frequency],
                        ['Format', ds.format],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{l}</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Stats card */}
          <div style={{
            background: 'var(--navy)',
            borderRadius: 16,
            padding: '20px',
            flex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.01em' }}>Platform</span>
              <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 18 }}>
              {[['134', 'Data Offers'], ['157', 'Members']].map(([num, lbl]) => (
                <button key={lbl} onClick={() => navigate('/catalogue')}
                  style={{ textAlign: 'left', background: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{
                    fontSize: 34, fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.04em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    marginBottom: 3,
                  }}>
                    {num}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', fontWeight: 400 }}>{lbl}</div>
                </button>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)', marginBottom: 8 }}>
                Top categories
              </div>
              {[['Road Events', 29], ['Traffic', 18], ['Parking', 9]].map(([name, n]) => (
                <button key={name} onClick={() => navigate('/catalogue')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 7, background: 'none', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{name}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </button>
              ))}
            </div>
          </div>

          {/* New Members */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xs)',
            padding: '16px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 4 }}>New Members</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Recently joined MDS</div>
            {members.map((name, i) => (
              <Link key={name} to="/catalogue" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: i < members.length - 1 ? '1px solid var(--divider)' : 'none',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{name}</span>
                  <ArrowRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 6 }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Activity ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>Recent Activity</h2>
          <Link to="/contracts" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>
            View audit trail <ArrowRight size={12} />
          </Link>
        </div>
        {activity.map((item, i) => {
          const b = badge[item.type]
          return (
            <Link key={i} to="/contracts" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 20px',
                borderBottom: i < activity.length - 1 ? '1px solid var(--divider)' : 'none',
                cursor: 'pointer',
                transition: 'background 100ms',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-base)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot[item.type], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{item.event}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 600, letterSpacing: '0.01em',
                      background: b.bg, color: b.color,
                      padding: '2px 7px', borderRadius: 99,
                    }}>
                      {b.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.meta}
                  </div>
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>{item.time}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Bottom row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {/* How To */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 12 }}>How To</div>
          {[
            { label: 'Get a Connector as a Service', link: '/connectors' },
            { label: 'Set up and register a connector', link: '/connector/dashboard' },
            { label: 'Offer data as a provider', link: '/my-data' },
            { label: 'MDS Members Newsletter', link: '/catalogue' },
          ].map(item => (
            <Link key={item.label} to={item.link} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--divider)',
              }}
                className="group"
              >
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item.label}</span>
                <ArrowRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </div>

        {/* Technical News */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 12 }}>Technical News</div>
          <div style={{ background: 'var(--bg-base)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
              Quick Tip: Connect with MDS Members
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Visit an organization's profile under Community and click the contact button to initiate a collaboration.
            </p>
            <Link to="/catalogue" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 14, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none' }}>
              Learn more <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Contact */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 6 }}>Contact</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            Questions about MDS? Reach out to the Community Team.
          </p>
          <a href="mailto:community@mobility-dataspace.eu" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--navy)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>CT</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Community Team</div>
              <div style={{ fontSize: 14, color: 'var(--accent)', marginTop: 1 }}>community@mobility-dataspace.eu</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
