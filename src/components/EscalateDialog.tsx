import { useEffect, useRef } from 'react'

interface EscalateDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  routeName?: string
}

export default function EscalateDialog({ open, onClose, onConfirm, routeName }: EscalateDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    confirmRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="escalate-dialog-title">
      <div ref={dialogRef} className="dialog-content">
        <header>
          <h2 id="escalate-dialog-title">Log an escalation (demo)?</h2>
          <p>
            This demo only records that{' '}
            {routeName ? `the ${routeName} route` : 'the route'} still needs a departure decision. Nobody is
            notified — nothing is sent.
          </p>
        </header>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn-primary" onClick={onConfirm}>
            Confirm escalation
          </button>
        </div>
      </div>
    </div>
  )
}
