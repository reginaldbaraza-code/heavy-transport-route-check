import { useState } from 'react'
import { Bell, Building2, CheckCircle2, Save, User } from 'lucide-react'
import { Toast } from '../components/Feedback'

const tabs = [
  { id: 'profile', label: 'Organisation profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const

const initialProfile = {
  orgName: '',
  website: 'https://',
  description: '',
  orgType: 'Heavy-haul logistics operator',
  country: 'Germany',
}

const deliveryChannels = [
  { id: 'inApp', label: 'In-app', description: 'Show route alerts in the application and the alert history.' },
  { id: 'email', label: 'E-mail', description: 'Send route-status changes to the dispatch inbox. (Configuration required)' },
  { id: 'sms', label: 'SMS', description: 'Send urgent HOLD and VERIFY alerts to the duty dispatcher. (Configuration required)' },
]

const alertTypes = [
  { id: 'verdict', label: 'Verdict change', description: 'READY, VERIFY, or HOLD status changes.' },
  { id: 'closure', label: 'New closure', description: 'A closure appears on a monitored permit corridor.' },
  { id: 'stale', label: 'Data stale', description: 'A required source is too old for a dispatch decision.' },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('profile')
  const [profile, setProfile] = useState(initialProfile)
  const [savedProfile, setSavedProfile] = useState(initialProfile)
  const [channels, setChannels] = useState({ inApp: true, email: true, sms: false })
  const [alerts, setAlerts] = useState({ verdict: true, closure: true, stale: true })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile)

  const save = () => {
    if (!profile.orgName.trim()) {
      setError('Enter an organisation name.')
      return
    }
    try {
      new URL(profile.website)
    } catch {
      setError('Enter a complete website address, including https://.')
      return
    }
    setError('')
    setSavedProfile(profile)
    setSaved(true)
  }

  return (
    <div className="app-page settings-page">
      <header className="settings-heading">
        <span>Settings</span>
        <h1>{activeTab === 'profile' ? 'Organisation profile' : 'Route alert notifications'}</h1>
        <p>Manage the operator identity shown in route checks and choose how dispatchers receive monitoring alerts.</p>
      </header>

      <div className="settings-workspace">
        <aside className="settings-sidebar">
          <div className="settings-org-mark">
            <span><Building2 size={18} /></span>
            <div><strong>{profile.orgName || 'Your Organization'}</strong><small>Profile setup</small></div>
          </div>
          <nav aria-label="Settings">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} onClick={() => setActiveTab(id)} className={activeTab === id ? 'active' : ''}>
                <span><Icon size={16} /></span><strong>{label}</strong>
              </button>
            ))}
          </nav>
        </aside>

        <main className="settings-content">
          {activeTab === 'profile' && (
            <section className="settings-card profile-settings-card">
              <header className="settings-card-header">
                <div>
                  <span className="settings-card-icon"><Building2 size={18} /></span>
                  <div><h2>Organisation profile</h2><p>This identity appears in route-check exports and operator settings.</p></div>
                </div>
                <span className="setup-pill">Setup Required</span>
              </header>
              <div className="settings-form">
                <label className="settings-field">
                  <span>Organisation name</span>
                  <small>Your registered operator or legal entity name.</small>
                  <input required value={profile.orgName} onChange={event => { setProfile(current => ({ ...current, orgName: event.target.value })); setSaved(false) }} aria-invalid={Boolean(error && !profile.orgName.trim())} />
                </label>
                <label className="settings-field">
                  <span>Website</span>
                  <small>Use the complete public URL, including https://.</small>
                  <input type="url" value={profile.website} onChange={event => { setProfile(current => ({ ...current, website: event.target.value })); setSaved(false) }} />
                </label>
                <label className="settings-field">
                  <span>Description</span>
                  <small>Describe the operator role in heavy-transport dispatch.</small>
                  <textarea maxLength={500} rows={3} value={profile.description} onChange={event => { setProfile(current => ({ ...current, description: event.target.value })); setSaved(false) }} />
                  <i>{profile.description.length} / 500</i>
                </label>
                <div className="settings-field-row">
                  <label className="settings-field"><span>Organisation type</span><input value={profile.orgType} onChange={event => { setProfile(current => ({ ...current, orgType: event.target.value })); setSaved(false) }} /></label>
                  <label className="settings-field"><span>Country</span><select value={profile.country} onChange={event => { setProfile(current => ({ ...current, country: event.target.value })); setSaved(false) }}><option>Germany</option><option>Austria</option><option>Switzerland</option></select></label>
                </div>
                {error && <p role="alert" className="settings-error">{error}</p>}
              </div>
              <footer className="settings-card-footer">
                <p>{dirty ? 'You have unsaved changes.' : 'Your organisation profile is up to date.'}</p>
                <button type="button" onClick={save} disabled={!dirty}><Save size={16} /> Save changes</button>
              </footer>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="settings-card notification-settings-card">
              <header className="settings-card-header">
                <div>
                  <span className="settings-card-icon"><Bell size={18} /></span>
                  <div><h2>Route alert preferences</h2><p>Choose delivery channels and the monitoring events that should trigger an alert.</p></div>
                </div>
              </header>
              <div className="settings-preference-section">
                <h3>Delivery channels</h3>
                {deliveryChannels.map(item => (
                  <label className="settings-toggle-row" key={item.id}>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <input type="checkbox" checked={channels[item.id as keyof typeof channels]} onChange={event => setChannels(current => ({ ...current, [item.id]: event.target.checked }))} />
                  </label>
                ))}
              </div>
              <div className="settings-preference-section">
                <h3>Alert me when</h3>
                {alertTypes.map(item => (
                  <label className="settings-toggle-row" key={item.id}>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <input type="checkbox" checked={alerts[item.id as keyof typeof alerts]} onChange={event => setAlerts(current => ({ ...current, [item.id]: event.target.checked }))} />
                  </label>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
      {saved && <Toast message="Profile saved to browser storage. Server persistence not yet configured." onClose={() => setSaved(false)} />}
    </div>
  )
}
