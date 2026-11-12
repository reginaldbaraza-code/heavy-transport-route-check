import { useEffect, useId, useMemo, useRef, useState } from 'react'
import RouteCheckLogo from '../components/RouteCheckLogo'
import { useAuth } from '../context/AuthContext'
import { userInitials, type AppUser } from '../lib/users'

const BERLIN_TZ = 'Europe/Berlin'

function berlinParts(date: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BERLIN_TZ, ...opts })
}

function berlinHour(date: Date): number {
  return Number(berlinParts(date, { hour: '2-digit', hour12: false }).format(date))
}

function berlinGreeting(date: Date): string {
  const hour = berlinHour(date)
  if (hour < 12) return 'Good morning.'
  if (hour < 18) return 'Good afternoon.'
  return 'Good evening.'
}

function berlinDateLabel(date: Date): string {
  const weekday = berlinParts(date, { weekday: 'long' }).format(date)
  const day = berlinParts(date, { day: 'numeric' }).format(date)
  const month = berlinParts(date, { month: 'long' }).format(date)
  return `${weekday}, ${day} ${month} · Berlin`
}

function UserRow({
  user,
  lastUsed,
  loading,
  autoFocus,
  compact,
  onSelect,
}: {
  user: AppUser
  lastUsed: boolean
  loading: boolean
  autoFocus: boolean
  compact?: boolean
  onSelect: () => void
}) {
  const label = `Continue as ${user.name}`
  return (
    <button
      type="button"
      className={`login-user-tile${compact ? ' is-demo' : ''}${lastUsed ? ' is-last-used' : ''}${loading ? ' is-loading' : ''}`}
      onClick={onSelect}
      disabled={loading}
      autoFocus={autoFocus}
      aria-label={label}
      aria-busy={loading || undefined}
    >
      <span
        className="login-user-avatar"
        aria-hidden="true"
        style={{ background: user.avatarBg, color: user.avatarFg }}
      >
        {userInitials(user.name)}
      </span>
      <span className="login-user-copy">
        <span className="login-user-name">{user.name}</span>
        {compact && <span className="login-user-caption">Shared sandbox account</span>}
        {loading && <span className="login-user-loading">Loading your workspace…</span>}
      </span>
      {lastUsed && !loading && <span className="login-last-used">Last used</span>}
    </button>
  )
}

export default function Login() {
  const { users, lastUsedId, selectingId, selectUser } = useAuth()
  const headingId = useId()
  const pickerRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  const namedUsers = useMemo(() => users.filter(user => user.id !== 'demo'), [users])
  const demoUser = useMemo(() => users.find(user => user.id === 'demo')!, [users])

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const root = pickerRef.current
    if (!root) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Named rows + Demo — linear roving for the list layout.
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('button.login-user-tile:not(:disabled)')]
      if (buttons.length === 0) return
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (currentIndex < 0) return
      let next = currentIndex
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (currentIndex + 1) % buttons.length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (currentIndex - 1 + buttons.length) % buttons.length
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = buttons.length - 1
      } else {
        return
      }
      event.preventDefault()
      buttons[next]?.focus()
    }
    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="login-screen" role="main" aria-labelledby={headingId}>
      <header className="login-top">
        <div className="login-brand-mark">
          <RouteCheckLogo size={32} tone="auto" decorative className="login-logo" />
          <span className="login-wordmark">HTR</span>
        </div>
        <p className="login-when" aria-live="polite">
          {berlinDateLabel(now)}
        </p>
      </header>

      <div className="login-layout">
        <p className="login-greet">{berlinGreeting(now)}</p>
        <h1 id={headingId} className="login-headline">
          Who&apos;s checking<br />routes?
        </h1>
        <p className="login-lede">
          Your jobs, checks and alerts are saved to your account.
        </p>

        {/* display:contents so names/tail participate in the parent grid with the hero. */}
        <div className="login-picker" ref={pickerRef}>
          <div className="login-names" role="group" aria-label="Choose an account">
            {namedUsers.map((user, index) => (
              <UserRow
                key={user.id}
                user={user}
                lastUsed={lastUsedId === user.id}
                loading={selectingId === user.id}
                autoFocus={lastUsedId ? lastUsedId === user.id : index === 0}
                onSelect={() => { void selectUser(user.id) }}
              />
            ))}
          </div>

          <div className="login-tail">
            <div className="login-demo-divider" role="separator">
              <span>Or explore</span>
            </div>

            <div className="login-demo-row">
              <UserRow
                user={demoUser}
                compact
                lastUsed={lastUsedId === demoUser.id}
                loading={selectingId === demoUser.id}
                autoFocus={lastUsedId === demoUser.id}
                onSelect={() => { void selectUser(demoUser.id) }}
              />
            </div>

            <p className="login-footnote">
              Demo login — no password. Anyone with the link can open any account.
            </p>
          </div>
        </div>

        <aside className="login-hero" aria-hidden="true">
          <img className="login-convoy login-convoy--tone" src="/assets/convoy.svg" alt="" width={640} height={140} />
          <span className="login-convoy login-convoy--stroke" />
          <span className="login-hero-caption">Escort · low-loader · oversize</span>
        </aside>
      </div>
    </div>
  )
}
