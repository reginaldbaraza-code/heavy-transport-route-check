import { AlertTriangle } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function EscalateDialog({ isOpen, onClose, onConfirm }: Props) {
  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content escalate-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="escalate-title"
        aria-describedby="escalate-description"
      >
        <div className="dialog-icon warning">
          <AlertTriangle size={24} />
        </div>
        <h2 id="escalate-title">Escalate to the transport manager?</h2>
        <p id="escalate-description">
          The manager will be told that the route is still unconfirmed and needs a departure
          decision.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Confirm escalation
          </button>
        </div>
      </div>
    </div>
  )
}
