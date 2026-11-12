import { CheckCircle2, FileUp, MapPin, Play, ShieldCheck } from 'lucide-react'
import type { RouteCheckResult } from '../lib/routeCheck'

interface StatusTimelineProps {
  result: RouteCheckResult
  permitNumber?: string
  monitoring?: boolean
}

export default function StatusTimeline({ result, permitNumber, monitoring = false }: StatusTimelineProps) {
  const steps = [
    {
      icon: FileUp,
      label: 'Route imported',
      detail: permitNumber || 'GPX file loaded',
      completed: true,
    },
    {
      icon: MapPin,
      label: 'Route checked',
      detail: `${result.evidence.length} item${result.evidence.length === 1 ? '' : 's'} found`,
      completed: true,
    },
    {
      icon: Play,
      label: monitoring ? 'Monitoring live' : 'Check complete',
      detail: monitoring ? `${result.evidence.length} source${result.evidence.length === 1 ? '' : 's'} connected` : 'Static check',
      completed: true,
    },
    {
      icon: ShieldCheck,
      label: 'Dispatch decision',
      detail: result.title,
      completed: true,
    },
  ]

  return (
    <div className="status-timeline" role="region" aria-label="Route monitoring progress">
      {steps.map((step, index) => (
        <div key={index} className={`status-timeline-step ${step.completed ? 'completed' : ''}`}>
          <div className="status-timeline-icon">
            <step.icon size={18} />
          </div>
          <div className="status-timeline-content">
            <strong>{step.label}</strong>
            <p>{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
