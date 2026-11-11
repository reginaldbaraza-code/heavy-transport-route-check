import { FileText, Pause, PhoneCall, ClipboardCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface TakeActionSheetProps {
  open: boolean
  onClose: () => void
  onReviewIssue?: () => void
  onEscalate: () => void
  onHoldDeparture: () => void
  onRequestOnSiteCheck?: () => void
}

export default function TakeActionSheet({
  open,
  onClose,
  onReviewIssue,
  onEscalate,
  onHoldDeparture,
  onRequestOnSiteCheck,
}: TakeActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    cancelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="action-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="action-sheet-title">
      <div ref={sheetRef} className="action-sheet">
        <header>
          <h2 id="action-sheet-title">Take action on this Hold verdict</h2>
          <p>Review the issue, notify the transport manager, or place the departure on hold.</p>
        </header>
        <div className="action-sheet-buttons">
          {onReviewIssue && (
            <button type="button" className="action-sheet-option" onClick={onReviewIssue}>
              <FileText size={20} />
              <span>Review issue</span>
            </button>
          )}
          <button type="button" className="action-sheet-option" onClick={onEscalate}>
            <PhoneCall size={20} />
            <span>Escalate</span>
          </button>
          <button type="button" className="action-sheet-option" onClick={onHoldDeparture}>
            <Pause size={20} />
            <span>Hold departure</span>
          </button>
          {onRequestOnSiteCheck && (
            <button type="button" className="action-sheet-option" onClick={onRequestOnSiteCheck}>
              <ClipboardCheck size={20} />
              <span>Request on-site check</span>
            </button>
          )}
        </div>
        <button ref={cancelRef} type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
