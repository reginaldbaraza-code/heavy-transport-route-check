import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, Briefcase, Clock3, Pencil, Play, Trash2,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Toast } from '../components/Feedback'
import { useJobs } from '../context/JobsContext'
import { formatBerlinDateTime, relativeFromNow } from '../lib/formatTime'
import {
  DEFAULT_MONITOR_PREFS,
  MONITOR_INTERVAL_OPTIONS,
  formatVehicleDims,
  fromLocalInput,
  isFutureDeparture,
  nextCheckIso,
  shouldMonitorJob,
  toLocalInput,
  type SavedJob,
} from '../lib/jobs'
import { DEPARTURE_ESCALATION_MINUTES } from '../lib/monitoring'

const emptyDraft = {
  name: '',
  permitNumber: '',
  plannedDeparture: '',
  monitorIntervalMinutes: DEFAULT_MONITOR_PREFS.intervalMinutes,
}

export default function SavedJobs() {
  const {
    jobs, prefs, setPrefs, saveJob, deleteJob, requestNotifications, notificationPermission,
    monitoringActive, monitoredCount, checkingJobId, lastTickAt,
  } = useJobs()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<SavedJob | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [toast, setToast] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
  }, [jobs, lastTickAt, checkingJobId])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10000)
    return () => window.clearInterval(id)
  }, [])

  const openEdit = (job: SavedJob) => {
    setEditing(job)
    setDraft({
      name: job.name,
      permitNumber: job.permitNumber,
      plannedDeparture: toLocalInput(job.plannedDeparture),
      monitorIntervalMinutes: job.monitorIntervalMinutes || prefs.intervalMinutes,
    })
  }

  const saveEdit = () => {
    if (!editing) return
    if (!draft.name.trim()) {
      setToast('Enter a job name.')
      return
    }
    const plannedDeparture = fromLocalInput(draft.plannedDeparture)
    saveJob({
      ...editing,
      name: draft.name.trim(),
      permitNumber: draft.permitNumber.trim(),
      plannedDeparture,
      monitorIntervalMinutes: Number(draft.monitorIntervalMinutes) || prefs.intervalMinutes,
    }, editing.id)
    setEditing(null)
    setToast('Job updated. Saved to your account.')
  }

  const monitored = useMemo(() => jobs.filter(job => shouldMonitorJob(job)), [jobs])

  return (
    <div className="market-page jobs-page">
      <PageHeader
        eyebrow="Dispatch jobs"
        title="Saved jobs"
        description="Save a permit, vehicle, and planned departure to your account, then re-run the check until departure."
        actions={
          <Link to="/route-checks" className="market-button primary">New route check</Link>
        }
      />
      <p className="storage-note activity-storage-note">Jobs are saved to your account and stay with you when you switch devices (same login).</p>

      <section className="jobs-monitor-banner" role="note">
        <Clock3 size={18} />
        <div>
          <strong>{monitoringActive ? `${monitoredCount} job${monitoredCount === 1 ? '' : 's'} monitored in this tab` : 'No jobs currently monitored'}</strong>
          <p>
            Monitoring runs while this tab is open. Keep it open until departure to get alerts. Closing the tab stops monitoring. Email and SMS stay disabled.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void requestNotifications()}>
          <Bell size={16} />
          {notificationPermission === 'granted' ? 'Browser notifications on' : 'Allow browser notifications'}
        </button>
      </section>

      <section className="jobs-prefs-card">
        <h2>Monitoring while this tab is open</h2>
        <div className="jobs-prefs-grid">
          <label>
            <span>Default re-check interval</span>
            <select value={prefs.intervalMinutes} onChange={event => setPrefs({ intervalMinutes: Number(event.target.value) })}>
              {MONITOR_INTERVAL_OPTIONS.map(minutes => (
                <option key={minutes} value={minutes}>{minutes} minutes</option>
              ))}
            </select>
          </label>
          <label>
            <span>Escalate unacknowledged HOLD/VERIFY after</span>
            <select value={prefs.escalateAfterMinutes} onChange={event => setPrefs({ escalateAfterMinutes: Number(event.target.value) })}>
              {MONITOR_INTERVAL_OPTIONS.map(minutes => (
                <option key={minutes} value={minutes}>{minutes} minutes</option>
              ))}
            </select>
          </label>
        </div>
        <p className="storage-note">Alerts also escalate when departure is under {DEPARTURE_ESCALATION_MINUTES / 60} hours away. Monitoring stops after the planned departure time.</p>
      </section>

      <section className="route-alert-log jobs-list">
        <header>
          <div><Briefcase size={20} /><h2>Jobs in this browser</h2></div>
          <span>{jobs.length} saved</span>
        </header>
        {jobs.map(job => {
          const monitoring = shouldMonitorJob(job)
          const departed = Boolean(job.plannedDeparture) && !isFutureDeparture(job)
          return (
            <article className={`job-row ${job.lastVerdict ? `severity-${job.lastVerdict.toLowerCase()}` : ''}`} key={job.id} data-job-id={job.id}>
              <div className="job-row-main">
                <div>
                  <span className="route-alert-meta">
                    <b>{job.name}</b>
                    <small>{job.permitNumber || 'No permit number'} · {job.routeFileName}</small>
                  </span>
                  <p>{job.origin} → {job.destination} · {formatVehicleDims(job.vehicle)}</p>
                  <p data-testid="job-last-check">
                    Departure {formatBerlinDateTime(job.plannedDeparture) || 'not set'}
                    {job.lastVerdict ? ` · Last check ${job.lastVerdict} ${relativeFromNow(job.lastCheckedAt, now)}` : ' · Not checked since save'}
                    {checkingJobId === job.id ? ' · Checking now…' : ''}
                  </p>
                  {monitoring && (
                    <p className="job-next-check" data-testid="job-next-check">
                      Last checked {formatBerlinDateTime(job.lastCheckedAt) || 'not yet'}
                      {' · '}
                      Next check {checkingJobId === job.id ? 'now' : (formatBerlinDateTime(nextCheckIso(job)) || relativeFromNow(nextCheckIso(job), now) || 'when this tab is visible')}
                    </p>
                  )}
                  <span className={`job-monitor-pill ${monitoring ? 'live' : departed ? 'stopped' : 'idle'}`}>
                    {monitoring ? `Monitoring every ${job.monitorIntervalMinutes} min (tab open)` : departed ? 'Stopped after departure' : 'Not monitored'}
                  </span>
                </div>
                <div className="job-row-actions">
                  <button type="button" className="btn-primary" onClick={() => navigate(`/route-checks?job=${job.id}&run=1`)}>
                    <Play size={15} /> Re-run check
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => openEdit(job)}>
                    <Pencil size={15} /> Edit
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmId(job.id)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
              {confirmId === job.id && (
                <div className="job-confirm">
                  <AlertTriangle size={16} />
                  <span>Delete this job from this browser?</span>
                  <button type="button" className="btn-secondary" onClick={() => setConfirmId(null)}>Cancel</button>
                  <button type="button" className="btn-primary" onClick={() => { deleteJob(job.id); setConfirmId(null); setToast('Job deleted.') }}>Delete</button>
                </div>
              )}
            </article>
          )
        })}
        {!jobs.length && (
          <div className="market-empty">
            <Briefcase size={30} />
            <h2>No saved jobs yet</h2>
            <p>Run a route check, then choose Save as job. The permit file, vehicle dimensions, and planned departure stay in this browser.</p>
            <Link to="/route-checks" className="market-button primary">Check a route</Link>
          </div>
        )}
      </section>

      {editing && (
        <div className="job-edit-overlay" role="dialog" aria-labelledby="edit-job-title">
          <div className="job-edit-card">
            <h2 id="edit-job-title">Edit job</h2>
            <label>
              <span>Job name</span>
              <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Permit number</span>
              <input value={draft.permitNumber} onChange={event => setDraft(current => ({ ...current, permitNumber: event.target.value }))} />
            </label>
            <label>
              <span>Planned departure</span>
              <input type="datetime-local" value={draft.plannedDeparture} onChange={event => setDraft(current => ({ ...current, plannedDeparture: event.target.value }))} />
            </label>
            <label>
              <span>Re-check interval</span>
              <select value={draft.monitorIntervalMinutes} onChange={event => setDraft(current => ({ ...current, monitorIntervalMinutes: Number(event.target.value) }))}>
                {MONITOR_INTERVAL_OPTIONS.map(minutes => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>
            <p className="storage-note">Stored in this browser only. Monitoring runs only while the tab is open and stops after departure.</p>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={saveEdit}>Save job</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
