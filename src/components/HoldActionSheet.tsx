import { CircleX } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onReviewIssue: () => void
  onEscalate: () => void
  onHoldDeparture: () => void
}

export function HoldActionSheet({ isOpen, onClose, onReviewIssue, onEscalate, onHoldDeparture }: Props) {
  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="action-sheet hold-action-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="hold-action-title"
        aria-describedby="hold-action-description"
      >
        <div className="action-sheet-header">
          <CircleX size={24} className="action-sheet-icon hold" />
          <div>
            <h2 id="hold-action-title">Take action on this Hold verdict</h2>
            <p id="hold-action-description">
              Review the issue, notify the transport manager, or place the departure on hold.
            </p>
          </div>
        </div>
        <div className="action-sheet-actions">
          <button
            type="button"
            className="action-sheet-button"
            onClick={() => {
              onReviewIssue()
              onClose()
            }}
          >
            Review issue
          </button>
          <button
            type="button"
            className="action-sheet-button escalate"
            onClick={() => {
              onEscalate()
              onClose()
            }}
          >
            Escalate
          </button>
          <button
            type="button"
            className="action-sheet-button destructive"
            onClick={() => {
              onHoldDeparture()
              onClose()
            }}
          >
            Hold departure
          </button>
          <button type="button" className="action-sheet-button cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
