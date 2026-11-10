import { useState } from 'react'
import { Bell, Building2, Database, Save, Timer, User } from 'lucide-react'
import { Toast } from '../components/Feedback'
import { useOrgSettings } from '../context/OrgSettingsContext'
import { useJobs } from '../context/JobsContext'
import { dataSources } from '../data/dataSources'
import { MONITOR_INTERVAL_OPTIONS } from '../lib/jobs'
import { DEPARTURE_ESCALATION_MINUTES } from '../lib/monitoring'

const tabs = [
  { id: 'profile', label: 'Organisation profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'monitoring', label: 'Monitoring', icon: Timer },
  { id: 'sources', label: 'Data sources', icon: Database },
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
  const { prefs, setPrefs, requestNotifications, notificationPermission, monitoringActive, monitoredCount } = useJobs()
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

  const statusLabel = dirty ? 'Unsaved changes' : complete ? 'Saved in this browser' : 'Optional profile'
  const footerStatus = dirty
    ? 'You have unsaved changes.'
    : complete
      ? 'Organisation name is saved in this browser only.'
      : 'Add an organisation name when you want it in the header. Nothing is required to run a check.'

  return (
    <div className="app-page settings-page">
      <header className="settings-heading">
        <span>Settings</span>
        <h1>
          {activeTab === 'profile' ? 'Organisation profile'
            : activeTab === 'notifications' ? 'Route alert notifications'
              : activeTab === 'monitoring' ? 'Tab monitoring'
                : 'Data sources and limits'}
        </h1>
        <p>Manage the operator identity shown in this browser, in-tab monitoring, and which free data sources this check uses. Settings are saved in this browser only.</p>
      </header>

      <div className="settings-workspace">
        <aside className="settings-sidebar">
          <div className="settings-org-mark">
            <span><Building2 size={18} /></span>
            <div>
              <strong>{profile.orgName || 'Dispatcher'}</strong>
              <small className={complete ? 'status-complete' : ''}>{complete ? 'Saved locally' : 'No profile yet'}</small>
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
                <span className={`setup-pill ${complete && !dirty ? 'complete' : 'quiet'}`}>{statusLabel}</span>
              </header>
              <div className="settings-form">
                <label className="settings-field">
                  <span>Organisation name</span>
                  <small>Shown in the header. Stored only in this browser.</small>
                  <input value={profile.orgName} onChange={event => { setProfile(current => ({ ...current, orgName: event.target.value })); setSaved(false) }} placeholder="e.g. Nordhauler GmbH" aria-invalid={Boolean(error && !profile.orgName.trim())} />
                </label>
                <label className="settings-field">
                  <span>Dispatcher name</span>
                  <small>Used as the default name on on-site confirmations.</small>
                  <input value={profile.dispatcherName} onChange={event => { setProfile(current => ({ ...current, dispatcherName: event.target.value })); setSaved(false) }} placeholder="e.g. Ada Dispatcher" />
                </label>
                <label className="settings-field">
                  <span>Website</span>
                  <small>Optional organisation website URL.</small>
                  <input value={profile.website || ''} onChange={event => { setProfile(current => ({ ...current, website: event.target.value })); setSaved(false) }} placeholder="https://example.com" />
                </label>
                <label className="settings-field">
                  <span>Description</span>
                  <small>Optional description of your organisation's operations.</small>
                  <textarea rows={3} value={profile.description || ''} onChange={event => { setProfile(current => ({ ...current, description: event.target.value })); setSaved(false) }} placeholder="Heavy transport operator serving industrial clients across Germany..." />
                </label>
                <label className="settings-field">
                  <span>Organisation type</span>
                  <small>Type of heavy transport operation.</small>
                  <select value={profile.orgType || 'freight'} onChange={event => { setProfile(current => ({ ...current, orgType: event.target.value })); setSaved(false) }}>
                    <option value="freight">Freight operator</option>
                    <option value="construction">Construction logistics</option>
                    <option value="industrial">Industrial transport</option>
                    <option value="specialized">Specialized heavy haulage</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Country</span>
                  <small>Primary operating country. Currently supports Germany (DE), Austria (AT), Switzerland (CH).</small>
                  <select value={profile.country || 'DE'} onChange={event => { setProfile(current => ({ ...current, country: event.target.value })); setSaved(false) }}>
                    <option value="DE">Germany (DE)</option>
                    <option value="AT">Austria (AT)</option>
                    <option value="CH">Switzerland (CH)</option>
                  </select>
                </label>
                <label className="settings-toggle-row">
                  <span>
                    <strong>Verified operator</strong>
                    <small>Mark as a verified heavy transport operator (stored locally only).</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={profile.verified || false}
                    onChange={event => { setProfile(current => ({ ...current, verified: event.target.checked })); setSaved(false) }}
                  />
                </label>
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
              <p className="storage-note settings-storage-note">Notification preferences are saved in this browser only. This app does not send email, SMS, or push messages. Browser notifications only appear after you click Allow.</p>
            </section>
          )}

          {activeTab === 'monitoring' && (
            <section className="settings-card notification-settings-card">
              <header className="settings-card-header">
                <div>
                  <span className="settings-card-icon"><Timer size={18} /></span>
                  <div>
                    <h2>Monitor until departure</h2>
                    <p>Saved jobs with a future departure are re-checked while this tab stays open. Closing the tab stops monitoring.</p>
                  </div>
                </div>
              </header>
              <p className="storage-note settings-storage-note">
                {monitoringActive
                  ? `${monitoredCount} job${monitoredCount === 1 ? '' : 's'} currently monitored in this tab.`
                  : 'No jobs are in the monitoring window.'}
                {' '}Monitoring runs while this tab is open. Keep it open until departure to get alerts. Email and SMS stay disabled.
              </p>
              <div className="settings-preference-section">
                <h3>Re-check and escalation</h3>
                <label className="settings-field">
                  <span>Default interval</span>
                  <select value={prefs.intervalMinutes} onChange={event => setPrefs({ intervalMinutes: Number(event.target.value) })}>
                    {MONITOR_INTERVAL_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Escalate unacknowledged HOLD/VERIFY after</span>
                  <select value={prefs.escalateAfterMinutes} onChange={event => setPrefs({ escalateAfterMinutes: Number(event.target.value) })}>
                    {MONITOR_INTERVAL_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                  </select>
                </label>
                <p className="storage-note">Alerts also escalate when departure is under {DEPARTURE_ESCALATION_MINUTES / 60} hours away. Monitoring stops after departure.</p>
                <button type="button" className="market-button secondary" onClick={() => void requestNotifications()}>
                  {notificationPermission === 'granted' ? 'Browser notifications allowed' : 'Allow browser notifications'}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'sources' && (
            <section className="settings-card notification-settings-card">
              <header className="settings-card-header">
                <div>
                  <span className="settings-card-icon"><Database size={18} /></span>
                  <div>
                    <h2>Free data sources</h2>
                    <p>Only keyless, unpaid feeds are used. Anything that needs a contract, key, or paid Vercel feature is listed as a limitation.</p>
                  </div>
                </div>
              </header>
              <div className="data-source-list">
                {dataSources.map(source => (
                  <article key={source.id} className={`data-source-item status-${source.status}`}>
                    <div>
                      <strong>{source.name}</strong>
                      <small>{source.used ? 'In use' : 'Not integrated'} · {source.status}{source.license ? ` · ${source.license}` : ''}</small>
                      <p>{source.summary}</p>
                      {source.attribution && <p>Attribution: {source.attribution}</p>}
                      {source.limitation && <p className="source-limitation">{source.limitation}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
      {saved && <Toast message="Profile saved in this browser only. It is not stored on a server." onClose={() => setSaved(false)} />}
    </div>
  )
}
