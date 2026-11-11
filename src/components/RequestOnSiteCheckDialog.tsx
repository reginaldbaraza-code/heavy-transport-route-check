import { useEffect, useRef, useState } from 'react'

interface RequestOnSiteCheckDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (note: string) => void
  location?: string
}

export default function RequestOnSiteCheckDialog({
  open,
  onClose,
  onConfirm,
  location,
}: RequestOnSiteCheckDialogProps) {
  const [note, setNote] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    textareaRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  const handleConfirm = () => {
    onConfirm(note.trim())
    setNote('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="onsite-request-title">
      <div ref={dialogRef} className="dialog-content">
        <header>
          <h2 id="onsite-request-title">Request on-site check</h2>
          <p>
            Request a field verification{location ? ` at ${location}` : ''} to confirm the current road status before
            departure.
          </p>
        </header>
        <div className="dialog-form">
          <label>
            <span>Additional notes (optional)</span>
            <textarea
              ref={textareaRef}
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="e.g. Check if northbound lane is passable for 3.8m width"
              rows={3}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            Request check
          </button>
        </div>
      </div>
    </div>
  )
}
