import { useState } from 'react'
import { Bell, Building2, Save, User } from 'lucide-react'
import { Toast } from '../components/Feedback'
import { useOrgSettings } from '../context/OrgSettingsContext'

const tabs = [
  { id: 'profile', label: 'Organisation profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const

const deliveryChannels = [
  { id: 'inApp', label: 'In-app', description: 'Show route alerts in this browser. Stored only on this device.' },
  { id: 'email', label: 'E-mail', description: 'Not enabled — this app does not send email.' },
  { id: 'sms', label: 'SMS', description: 'Not enabled — this app does not send SMS.' },
] as const

const alertTypes = [
  { id: 'verdict', label: 'Verdict change', description: 'READY, VERIFY, or HOLD status changes from checks you run.' },
  { id: 'closure', label: 'New closure', description: 'A closure appears in a check you ran in this browser.' },
  { id: 'stale', label: 'Data stale', description: 'A required source is too old for a dispatch decision.' },
] as const

export default function Settings() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('profile')
  const {
    profile, dirty, complete, setProfile, saveProfile, notifications, setNotifications,
  } = useOrgSettings()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const save = () => {
    const result = saveProfile()
    if (!result.ok) {
      setError(result.error)
      setSaved(false)
      return
    }
    setError('')
    setSaved(true)
  }

  const statusLabel = !complete ? 'Setup required' : dirty ? 'Unsaved changes' : 'Profile complete'
  const footerStatus = dirty
    ? 'You have unsaved changes.'
    : complete
      ? 'Required organisation fields are complete.'
      : 'Organisation profile is incomplete until required fields are filled.'

  return (
    <div className="app-page settings-page">
      <header className="settings-heading">
        <span>Settings</span>
        <h1>{activeTab === 'profile' ? 'Organisation profile' : 'Route alert notifications'}</h1>
        <p>Manage the operator identity shown in this browser and choose how dispatchers see in-app monitoring alerts. Settings are saved in this browser only.</p>
      </header>

      <div className="settings-workspace">
        <aside className="settings-sidebar">
          <div className="settings-org-mark">
            <span><Building2 size={18} /></span>
            <div>
              <strong>{profile.orgName || 'Your organisation'}</strong>
              <small className={complete ? 'status-complete' : 'status-incomplete'}>{complete ? 'Profile complete' : 'Profile setup'}</small>
            </div>
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
                  <div><h2>Organisation profile</h2><p>This identity appears in the header. It is stored only in this browser.</p></div>
                </div>
                <span className={`setup-pill ${complete && !dirty ? 'complete' : ''}`}>{statusLabel}</span>
              </header>
              <div className="settings-form">
                <label className="settings-field">
                  <span>Organisation name</span>
                  <small>Required. Your registered operator or legal entity name.</small>
                  <input required value={profile.orgName} onChange={event => { setProfile(current => ({ ...current, orgName: event.target.value })); setSaved(false) }} aria-invalid={Boolean(error && !profile.orgName.trim())} />
                </label>
                <label className="settings-field">
                  <span>Website</span>
                  <small>Required. Use the complete public URL, including https:// and a hostname.</small>
                  <input type="url" value={profile.website} onChange={event => { setProfile(current => ({ ...current, website: event.target.value })); setSaved(false) }} />
                </label>
                <label className="settings-field">
                  <span>Description</span>
                  <small>Optional. Describe the operator role in heavy-transport dispatch.</small>
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
                <p>{footerStatus} Settings are saved in this browser only.</p>
                <button type="button" onClick={save} disabled={!dirty}><Save size={16} /> Save changes</button>
              </footer>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="settings-card notification-settings-card">
              <header className="settings-card-header">
                <div>
                  <span className="settings-card-icon"><Bell size={18} /></span>
                  <div>
                    <h2>Route alert preferences</h2>
                    <p>In-app alerts come from route checks you run in this browser. Email and SMS are not sent.</p>
                  </div>
                </div>
              </header>
              <div className="settings-preference-section">
                <h3>Delivery channels</h3>
                {deliveryChannels.map(item => (
                  <label className="settings-toggle-row" key={item.id}>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <input
                      type="checkbox"
                      checked={notifications.channels[item.id]}
                      disabled={item.id !== 'inApp'}
                      onChange={event => setNotifications(current => ({
                        ...current,
                        channels: { ...current.channels, [item.id]: event.target.checked },
                      }))}
                    />
                  </label>
                ))}
              </div>
              <div className="settings-preference-section">
                <h3>Alert me when</h3>
                {alertTypes.map(item => (
                  <label className="settings-toggle-row" key={item.id}>
                    <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    <input
                      type="checkbox"
                      checked={notifications.alerts[item.id]}
                      onChange={event => setNotifications(current => ({
                        ...current,
                        alerts: { ...current.alerts, [item.id]: event.target.checked },
                      }))}
                    />
                  </label>
                ))}
              </div>
              <p className="storage-note settings-storage-note">Notification preferences are saved in this browser only. This app does not send email, SMS, or push messages.</p>
            </section>
          )}
        </main>
      </div>
      {saved && <Toast message="Profile saved in this browser only. It is not stored on a server." onClose={() => setSaved(false)} />}
    </div>
  )
}
