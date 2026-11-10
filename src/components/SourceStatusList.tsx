import { CheckCircle2, Clock } from 'lucide-react'

type Source = {
  id: string
  abbrev: string
  name: string
  description: string
  age: string
  status: 'live' | 'confirmed' | 'example'
}

type Props = {
  sources: Source[]
}

export function SourceStatusList({ sources }: Props) {
  return (
    <div className="source-status-list">
      {sources.map(source => (
        <div key={source.id} className="source-status-row">
          <div className="source-abbrev">{source.abbrev}</div>
          <div className="source-info">
            <div className="source-name">
              <strong>{source.name}</strong>
              {source.status === 'live' && <CheckCircle2 size={14} className="source-live-icon" />}
            </div>
            <div className="source-description">
              <span>{source.description}</span>
              {source.age && (
                <>
                  {' · '}
                  <Clock size={12} className="source-age-icon" />
                  {source.age}
                </>
              )}
            </div>
          </div>
          <div className={`source-status-badge ${source.status}`}>
            {source.status === 'live' ? 'Live' : source.status === 'confirmed' ? 'Confirmed' : 'Example'}
          </div>
        </div>
      ))}
    </div>
  )
}
