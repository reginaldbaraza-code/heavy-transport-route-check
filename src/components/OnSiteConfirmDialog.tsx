import { Camera, CheckCircle2, CircleSlash, CircleX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface OnSiteConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (outcome: 'open' | 'closed' | 'partly', note: string, photo?: File) => void
  location?: string
}

export default function OnSiteConfirmDialog({
  open,
  onClose,
  onConfirm,
  location,
}: OnSiteConfirmDialogProps) {
  const [outcome, setOutcome] = useState<'open' | 'closed' | 'partly'>('open')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | undefined>()
  const [photoPreview, setPhotoPreview] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('')
      return
    }

    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [photo])

  const handleConfirm = () => {
    onConfirm(outcome, note.trim(), photo)
    setOutcome('open')
    setNote('')
    setPhoto(undefined)
    setPhotoPreview('')
    onClose()
  }

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setPhoto(file)
    }
  }

  if (!open) return null

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="onsite-confirm-title">
      <div ref={dialogRef} className="dialog-content dialog-large">
        <header>
          <h2 id="onsite-confirm-title">On-site confirmation</h2>
          <p>Record the actual road status{location ? ` at ${location}` : ''} verified on site.</p>
        </header>
        <div className="dialog-form">
          <fieldset className="onsite-outcome-group">
            <legend>Road status</legend>
            <label className={`onsite-outcome-option ${outcome === 'open' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="outcome"
                value="open"
                checked={outcome === 'open'}
                onChange={() => setOutcome('open')}
              />
              <CheckCircle2 size={24} />
              <span>Open</span>
            </label>
            <label className={`onsite-outcome-option ${outcome === 'partly' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="outcome"
                value="partly"
                checked={outcome === 'partly'}
                onChange={() => setOutcome('partly')}
              />
              <CircleSlash size={24} />
              <span>Partly open</span>
            </label>
            <label className={`onsite-outcome-option ${outcome === 'closed' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="outcome"
                value="closed"
                checked={outcome === 'closed'}
                onChange={() => setOutcome('closed')}
              />
              <CircleX size={24} />
              <span>Closed</span>
            </label>
          </fieldset>

          <label>
            <span>Photo (optional)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn-secondary photo-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={16} />
              {photo ? 'Change photo' : 'Add photo'}
            </button>
            {photoPreview && (
              <div className="photo-preview">
                <img src={photoPreview} alt="Road condition preview" />
              </div>
            )}
          </label>

          <label>
            <span>Notes</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="Describe what you observed on site"
              rows={3}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            Confirm status
          </button>
        </div>
      </div>
    </div>
  )
}
