import { Database } from 'lucide-react'
import { formatBerlinDateTime } from '../lib/formatTime'

interface SourceStatusPanelProps {
  sources: Array<{
    id: string
    name: string
    status: 'active' | 'degraded' | 'unavailable'
    lastUpdate?: string
    detail?: string
  }>
}

export default function SourceStatusPanel({ sources }: SourceStatusPanelProps) {
  return (
    <div className="source-status-panel">
      <header>
        <Database size={20} />
        <div>
          <h2>Information covering your next route</h2>
          <p>Data sources currently connected and their freshness</p>
        </div>
      </header>
      <div className="source-status-list">
        {sources.map(source => (
          <div key={source.id} className={`source-status-item status-${source.status}`}>
            <div className="source-icon-mark">
              {source.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="source-status-content">
              <strong>{source.name}</strong>
              <p>
                {source.detail}
                {source.lastUpdate && ` · Updated ${formatBerlinDateTime(source.lastUpdate)}`}
              </p>
            </div>
            <span className={`source-status-badge status-${source.status}`}>
              {source.status === 'active' ? 'Confirmed' : source.status === 'degraded' ? 'Degraded' : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
