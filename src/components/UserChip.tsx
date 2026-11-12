import { useAuth } from '../context/AuthContext'
import { userInitials } from '../lib/users'

export default function UserChip({
  collapsed = false,
  compact = false,
}: {
  collapsed?: boolean
  compact?: boolean
}) {
  const { user, switchUser, syncBackend, saveStatus } = useAuth()
  if (!user) return null

  const notSaved = saveStatus === 'error'
  const memoryBadge = syncBackend === 'memory'
  const titleBits = [
    user.name,
    notSaved ? 'Not saved' : null,
    memoryBadge ? 'Not saved online (dev)' : null,
    'Switch user',
  ].filter(Boolean)
  const title = titleBits.join(' · ')

  if (collapsed) {
    return (
      <button
        type="button"
        className="user-chip is-collapsed"
        title={title}
        aria-label={`Switch user (${user.name})`}
        onClick={() => { void switchUser() }}
      >
        <span
          className="user-chip-avatar"
          aria-hidden="true"
          style={{ background: user.avatarBg, color: user.avatarFg }}
        >
          {userInitials(user.name)}
        </span>
      </button>
    )
  }

  return (
    <div className={`user-chip${compact ? ' is-compact' : ''}`}>
      <span
        className="user-chip-avatar"
        aria-hidden="true"
        style={{ background: user.avatarBg, color: user.avatarFg }}
      >
        {userInitials(user.name)}
      </span>
      <div className="user-chip-meta">
        <div className="user-chip-name-row">
          <span className="user-chip-name">{user.name}</span>
          {notSaved && <span className="user-chip-badge is-error">Not saved</span>}
          {memoryBadge && !notSaved && (
            <span className="user-chip-badge is-dev">Not saved online (dev)</span>
          )}
        </div>
        <button
          type="button"
          className="user-chip-switch"
          onClick={() => { void switchUser() }}
        >
          Switch user
        </button>
      </div>
    </div>
  )
}
