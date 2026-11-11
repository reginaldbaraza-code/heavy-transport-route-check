import { CheckCircle2, Database } from 'lucide-react'
import { formatBerlinDateTime } from '../lib/formatTime'
import type { RouteCheckResult } from '../lib/routeCheck'

interface InformationCheckedPanelProps {
  result: RouteCheckResult
  expanded?: boolean
  onToggle?: () => void
}

export default function InformationCheckedPanel({
  result,
  expanded = false,
  onToggle,
}: InformationCheckedPanelProps) {
  const sources = Array.from(
    new Set(result.evidence.map(item => item.source).filter(Boolean))
  ).map(source => {
    const items = result.evidence.filter(item => item.source === source)
    const latest = items.reduce((newest, item) => {
      const itemTime = new Date(item.retrievedAt || result.retrievedAt || 0).getTime()
      const newestTime = new Date(newest.retrievedAt || result.retrievedAt || 0).getTime()
      return itemTime > newestTime ? item : newest
    })
    return {
      name: source,
      retrievedAt: latest.retrievedAt || result.retrievedAt,
      count: items.length,
    }
  })

  // Always include the main source even if no evidence
  if (!sources.some(s => s.name === result.source) && result.source) {
    sources.unshift({
      name: result.source,
      retrievedAt: result.retrievedAt,
      count: 0,
    })
  }

  return (
    <div className="information-checked-panel">
      <button
        type="button"
        className="information-checked-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <Database size={18} />
        <strong>Information checked</strong>
        <span className="information-checked-badge">{sources.length} source{sources.length === 1 ? '' : 's'}</span>
      </button>
      {expanded && (
        <div className="information-checked-list">
          {sources.map((source, index) => (
            <div key={index} className="information-checked-item">
              <CheckCircle2 size={16} className="source-check-icon" />
              <div>
                <strong>{source.name}</strong>
                <p>
                  {source.count > 0 && `${source.count} item${source.count === 1 ? '' : 's'} · `}
                  Updated {formatBerlinDateTime(source.retrievedAt) || 'just now'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
