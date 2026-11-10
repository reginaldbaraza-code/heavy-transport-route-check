import { CheckCircle2, Eye, FileText, Radio, Upload } from 'lucide-react'
import { formatBerlinDateTime } from '../lib/formatTime'

type TimelineStep = {
  id: string
  icon: typeof Upload
  label: string
  detail: string
  status: 'completed' | 'active' | 'pending'
}

type Props = {
  permitNumber?: string
  sources: string[]
  monitoringActive: boolean
  monitoringUntil?: string
  sourcesConnected: number
  issuesDetected: number
  dispatchDecision?: string
  retrievedAt?: string
}

export function StatusTimeline({
  permitNumber,
  sources,
  monitoringActive,
  monitoringUntil,
  sourcesConnected,
  issuesDetected,
  dispatchDecision,
  retrievedAt,
}: Props) {
  const steps: TimelineStep[] = [
    {
      id: 'import',
      icon: Upload,
      label: 'Route imported',
      detail: permitNumber ? `Permit ${permitNumber}` : 'Route file loaded',
      status: 'completed',
    },
    {
      id: 'check',
      icon: Eye,
      label: 'Route checked',
      detail: `${issuesDetected} issue${issuesDetected === 1 ? '' : 's'} detected`,
      status: 'completed',
    },
    {
      id: 'monitoring',
      icon: Radio,
      label: 'Monitoring live',
      detail: monitoringActive
        ? `${sourcesConnected} source${sourcesConnected === 1 ? '' : 's'} connected`
        : 'Not monitoring',
      status: monitoringActive ? 'active' : 'completed',
    },
    {
      id: 'dispatch',
      icon: CheckCircle2,
      label: 'Dispatch decision',
      detail: dispatchDecision || 'Pending dispatch decision',
      status: dispatchDecision ? 'completed' : 'pending',
    },
  ]

  return (
    <div className="status-timeline-card">
      <div className="status-timeline-header">
        <div className="status-sources">
          <span className="status-sources-label">SOURCES</span>
          <div className="status-sources-chips">
            {sources.map((source, i) => (
              <span key={i} className="source-chip">
                {source}
              </span>
            ))}
          </div>
        </div>
        {monitoringActive && monitoringUntil && (
          <div className="status-monitoring-active">
            <Radio size={14} className="status-monitoring-icon" />
            <span>Continuous monitoring active until {formatBerlinDateTime(monitoringUntil)}</span>
          </div>
        )}
      </div>

      <div className="status-timeline-steps">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          return (
            <div key={step.id} className="status-timeline-step-wrapper">
              <div className={`status-timeline-step status-${step.status}`}>
                <div className="status-step-icon">
                  <StepIcon size={18} />
                </div>
                <div className="status-step-content">
                  <div className="status-step-label">{step.label}</div>
                  <div className="status-step-detail">{step.detail}</div>
                </div>
              </div>
              {index < steps.length - 1 && <div className="status-timeline-connector" />}
            </div>
          )
        })}
      </div>

      {retrievedAt && (
        <div className="status-timeline-footer">
          <FileText size={14} />
          <span>Data retrieved {formatBerlinDateTime(retrievedAt)}</span>
        </div>
      )}
    </div>
  )
}
