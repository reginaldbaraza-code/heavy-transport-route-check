import { useEffect, useId, useMemo, useRef } from 'react'
import RouteCheckLogo from '../components/RouteCheckLogo'
import { useAuth } from '../context/AuthContext'
import { userInitials, type AppUser } from '../lib/users'

function UserTile({
  user,
  lastUsed,
  loading,
  autoFocus,
  onSelect,
}: {
  user: AppUser
  lastUsed: boolean
  loading: boolean
  autoFocus: boolean
  onSelect: () => void
}) {
  const label = `Continue as ${user.name}`
  return (
    <button
      type="button"
      className={`login-user-tile${lastUsed ? ' is-last-used' : ''}${loading ? ' is-loading' : ''}${user.id === 'demo' ? ' is-demo' : ''}`}
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
        {user.id === 'demo' && <span className="login-user-caption">Shared sandbox account</span>}
        {loading && <span className="login-user-loading">Loading your workspace…</span>}
      </span>
      {lastUsed && !loading && <span className="login-last-used">Last used</span>}
    </button>
  )
}

export default function Login() {
  const { users, lastUsedId, selectingId, selectUser } = useAuth()
  const headingId = useId()
  const gridRef = useRef<HTMLDivElement>(null)

  const namedUsers = useMemo(() => users.filter(user => user.id !== 'demo'), [users])
  const demoUser = useMemo(() => users.find(user => user.id === 'demo')!, [users])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onKeyDown = (event: KeyboardEvent) => {
      const buttons = [...grid.querySelectorAll<HTMLButtonElement>('button.login-user-tile:not(:disabled)')]
      if (buttons.length === 0) return
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (currentIndex < 0) return
      const cols = window.matchMedia('(min-width: 768px)').matches ? 4 : 2
      let next = currentIndex
      if (event.key === 'ArrowRight') next = Math.min(buttons.length - 1, currentIndex + 1)
      else if (event.key === 'ArrowLeft') next = Math.max(0, currentIndex - 1)
      else if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, currentIndex + cols)
      else if (event.key === 'ArrowUp') next = Math.max(0, currentIndex - cols)
      else return
      event.preventDefault()
      buttons[next]?.focus()
    }
    grid.addEventListener('keydown', onKeyDown)
    return () => grid.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="login-screen" role="main" aria-labelledby={headingId}>
      <div className="login-shell">
        <header className="login-brand">
          <RouteCheckLogo size={48} tone="auto" />
          <h1 id={headingId}>Who&apos;s checking routes?</h1>
          <p>Pick your name. Your jobs, checks and alerts are saved to your account.</p>
        </header>

        <div className="login-grid" ref={gridRef} role="group" aria-label="Choose an account">
          {namedUsers.map((user, index) => (
            <UserTile
              key={user.id}
              user={user}
              lastUsed={lastUsedId === user.id}
              loading={selectingId === user.id}
              autoFocus={lastUsedId ? lastUsedId === user.id : index === 0}
              onSelect={() => { void selectUser(user.id) }}
            />
          ))}
        </div>

        <div className="login-demo-divider" role="separator">
          <span>Or explore</span>
        </div>

        <div className="login-demo-row">
          <UserTile
            user={demoUser}
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
  )
}
