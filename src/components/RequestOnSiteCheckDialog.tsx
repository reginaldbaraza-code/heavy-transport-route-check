import { MapPin } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  evidenceTitle: string
  location: string
}

export function RequestOnSiteCheckDialog({
  isOpen,
  onClose,
  onConfirm,
  evidenceTitle,
  location,
}: Props) {
  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content request-onsite-dialog"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="request-title"
      >
        <div className="dialog-icon info">
          <MapPin size={24} />
        </div>
        <h2 id="request-title">Request on-site check</h2>
        <div className="request-onsite-detail">
          <div className="request-detail-row">
            <span>Evidence</span>
            <strong>{evidenceTitle}</strong>
          </div>
          <div className="request-detail-row">
            <span>Location</span>
            <strong>{location}</strong>
          </div>
        </div>
        <p>
          This will record an on-site verification request for the driver or escort. Since this is a
          free client-side app, no real notification is sent.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Send request
          </button>
        </div>
      </div>
    </div>
  )
}
