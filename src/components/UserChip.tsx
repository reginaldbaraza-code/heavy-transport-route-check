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
  const tooltip = titleBits.join(' · ')
  const switchLabel = `Switch user (${user.name})`
  const onSwitch = () => { void switchUser() }

  const avatar = (
    <span
      className="user-chip-avatar"
      aria-hidden="true"
      style={{ background: user.avatarBg, color: user.avatarFg }}
    >
      {userInitials(user.name)}
    </span>
  )

  const meta = (
    <div className="user-chip-meta">
      <div className="user-chip-name-row">
        <span className="user-chip-name">{user.name}</span>
        {notSaved && <span className="user-chip-badge is-error">Not saved</span>}
        {memoryBadge && !notSaved && (
          <span className="user-chip-badge is-dev">Not saved online (dev)</span>
        )}
      </div>
      {/* Compact chip is itself the switch control; keep the label visual-only. */}
      {compact ? (
        <span className="user-chip-switch" aria-hidden="true">Switch user</span>
      ) : (
        <button
          type="button"
          className="user-chip-switch"
          onClick={onSwitch}
        >
          Switch user
        </button>
      )}
    </div>
  )

  if (collapsed) {
    return (
      <button
        type="button"
        className="user-chip is-collapsed has-tooltip"
        data-tooltip={tooltip}
        aria-label={switchLabel}
        onClick={onSwitch}
      >
        {avatar}
      </button>
    )
  }

  // Mobile header: one focusable control so ≤420px (meta hidden) still switches.
  if (compact) {
    return (
      <button
        type="button"
        className="user-chip is-compact"
        aria-label={switchLabel}
        title={tooltip}
        onClick={onSwitch}
      >
        {avatar}
        {meta}
      </button>
    )
  }

  return (
    <div className="user-chip">
      {avatar}
      {meta}
    </div>
  )
}
