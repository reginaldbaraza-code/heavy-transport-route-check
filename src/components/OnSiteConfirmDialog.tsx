import { Camera, CheckCircle2, CircleAlert, CircleDot, X } from 'lucide-react'
import { useState } from 'react'
import type { OnSiteOutcome } from '../context/RouteMonitoringContext'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (outcome: OnSiteOutcome, note: string, photoName?: string) => void
  evidenceTitle: string
}

export function OnSiteConfirmDialog({ isOpen, onClose, onConfirm, evidenceTitle }: Props) {
  const [outcome, setOutcome] = useState<OnSiteOutcome>('Open')
  const [note, setNote] = useState('')
  const [photoName, setPhotoName] = useState('')

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm(outcome, note, photoName || undefined)
    setNote('')
    setPhotoName('')
    setOutcome('Open')
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content onsite-confirm-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="onsite-title"
      >
        <div className="dialog-header-with-close">
          <h2 id="onsite-title">Confirm on site</h2>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        
        <div className="onsite-evidence-ref">
          <span className="onsite-evidence-label">Evidence item</span>
          <strong>{evidenceTitle}</strong>
        </div>

        <div className="onsite-outcome-select">
          <label>
            <span>On-site outcome</span>
            <div className="onsite-outcome-options">
              <button
                type="button"
                className={`onsite-outcome-btn ${outcome === 'Open' ? 'selected' : ''}`}
                onClick={() => setOutcome('Open')}
              >
                <CheckCircle2 size={18} />
                Open
              </button>
              <button
                type="button"
                className={`onsite-outcome-btn ${outcome === 'Closed' ? 'selected' : ''}`}
                onClick={() => setOutcome('Closed')}
              >
                <CircleAlert size={18} />
                Closed
              </button>
              <button
                type="button"
                className={`onsite-outcome-btn ${outcome === 'Partly' ? 'selected' : ''}`}
                onClick={() => setOutcome('Partly')}
              >
                <CircleDot size={18} />
                Partly
              </button>
            </div>
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="onsite-note">
            <span>Note (optional)</span>
            <textarea
              id="onsite-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Driver or escort observation..."
              rows={3}
            />
          </label>
        </div>

        <div className="form-group">
          <label htmlFor="onsite-photo">
            <span>Photo reference (optional)</span>
            <div className="onsite-photo-input">
              <Camera size={18} />
              <input
                id="onsite-photo"
                type="text"
                value={photoName}
                onChange={e => setPhotoName(e.target.value)}
                placeholder="e.g., IMG_1234.jpg"
              />
            </div>
          </label>
          <p className="form-note">
            This is a client-side app, so photos aren't uploaded. Reference the filename for your
            records.
          </p>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            Confirm observation
          </button>
        </div>
      </div>
    </div>
  )
}
