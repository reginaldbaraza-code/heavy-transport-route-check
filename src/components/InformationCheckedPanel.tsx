import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { formatBerlinDateTime } from '../lib/formatTime'

type EvidenceSource = {
  name: string
  age: string
  retrievedAt?: string
  status: 'confirmed' | 'unconfirmed'
}

type Props = {
  sources: EvidenceSource[]
  nextStep: string
}

export function InformationCheckedPanel({ sources, nextStep }: Props) {
  return (
    <div className="information-checked-panel">
      <h3>Information checked</h3>
      <div className="info-checked-sources">
        {sources.map((source, i) => {
          const StatusIcon = source.status === 'confirmed' ? CheckCircle2 : AlertTriangle
          return (
            <div key={i} className="info-checked-source">
              <div className="info-source-header">
                <div className="info-source-name">
                  <StatusIcon
                    size={16}
                    className={source.status === 'confirmed' ? 'status-confirmed' : 'status-unconfirmed'}
                  />
                  <strong>{source.name}</strong>
                </div>
                <span className={`info-source-badge ${source.status}`}>
                  {source.status === 'confirmed' ? 'Confirmed' : 'Unconfirmed'}
                </span>
              </div>
              <div className="info-source-meta">
                <Clock size={14} />
                <span>
                  {source.age}
                  {source.retrievedAt && ` · Retrieved ${formatBerlinDateTime(source.retrievedAt)}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="info-checked-next-step">
        <strong>Next step</strong>
        <p>{nextStep}</p>
      </div>
    </div>
  )
}
