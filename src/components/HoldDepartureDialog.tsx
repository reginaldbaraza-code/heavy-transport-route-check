import { CircleX } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export function HoldDepartureDialog({ isOpen, onClose, onConfirm }: Props) {
  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content hold-departure-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="hold-departure-title"
        aria-describedby="hold-departure-description"
      >
        <div className="dialog-icon danger">
          <CircleX size={24} />
        </div>
        <h2 id="hold-departure-title">Place this departure on hold?</h2>
        <p id="hold-departure-description">
          This will mark the departure as on hold. The dispatcher and crew will see "Departure is on
          hold. Do not depart."
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            Confirm hold
          </button>
        </div>
      </div>
    </div>
  )
}
