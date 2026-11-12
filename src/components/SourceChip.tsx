import { formatBerlinDateTime } from '../lib/formatTime'

interface SourceChipProps {
  source: string
  retrievedAt?: string
  confidence?: string
  className?: string
}

export default function SourceChip({ source, retrievedAt, confidence, className = '' }: SourceChipProps) {
  const age = retrievedAt ? formatBerlinDateTime(retrievedAt) : 'Just now'
  const confidenceLabel = confidence?.toLowerCase() === 'high' ? 'High confidence' : confidence ? 'Medium confidence' : undefined

  return (
    <span className={`source-chip ${className}`} title={`${source} · ${age}${confidenceLabel ? ` · ${confidenceLabel}` : ''}`}>
      <span className="source-chip-name">{source}</span>
      {retrievedAt && <span className="source-chip-age">{age}</span>}
      {confidenceLabel && (
        <span className={`source-chip-confidence confidence-${confidence?.toLowerCase()}`}>
          {confidenceLabel}
        </span>
      )}
    </span>
  )
}
