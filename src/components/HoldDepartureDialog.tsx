import { useEffect, useRef } from 'react'

interface HoldDepartureDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  routeName?: string
}

export default function HoldDepartureDialog({ open, onClose, onConfirm, routeName }: HoldDepartureDialogProps) {
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
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="hold-dialog-title">
      <div ref={dialogRef} className="dialog-content">
        <header>
          <h2 id="hold-dialog-title">Log a departure hold (demo)?</h2>
          <p>
            This demo only marks{' '}
            {routeName ? `the ${routeName} route` : 'the route'} as held in your account. The dispatch team is not
            notified — nothing is sent.
          </p>
        </header>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn-primary" onClick={onConfirm}>
            Confirm hold
          </button>
        </div>
      </div>
    </div>
  )
}
