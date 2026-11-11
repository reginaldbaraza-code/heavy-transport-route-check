import { Link } from 'lucide-react'

interface MDSPlaceholderProps {
  feature: string
  description?: string
}

export default function MDSPlaceholder({ feature, description }: MDSPlaceholderProps) {
  return (
    <div className="mds-placeholder">
      <div className="mds-placeholder-icon">
        <Link size={32} />
      </div>
      <div className="mds-placeholder-content">
        <span className="mds-placeholder-badge">Not connected – planned</span>
        <h2>{feature}</h2>
        {description && <p>{description}</p>}
        <p className="mds-placeholder-note">
          Mobility Data Space (MDS) integration is out of scope for this free MVP.
          This feature will be available when MDS connectors are enabled.
        </p>
      </div>
    </div>
  )
}
