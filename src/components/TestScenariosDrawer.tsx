import { AlertTriangle, Clock, Server, Wifi, WifiOff, X } from 'lucide-react'

type Scenario = {
  id: string
  icon: typeof Clock
  label: string
  description: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onScenario: (scenarioId: string) => void
}

const scenarios: Scenario[] = [
  {
    id: 'stale-data',
    icon: Clock,
    label: 'Stale data',
    description: 'Simulate data source returning old/cached information',
  },
  {
    id: 'source-outage',
    icon: WifiOff,
    label: 'Source outage',
    description: 'Simulate primary data source unavailable',
  },
  {
    id: 'no-response',
    icon: Server,
    label: 'No response',
    description: 'Simulate API timeout or network failure',
  },
  {
    id: 'new-disruption',
    icon: AlertTriangle,
    label: 'New disruption',
    description: 'Simulate a new A7 closure appearing during monitoring',
  },
]

export function TestScenariosDrawer({ isOpen, onClose, onScenario }: Props) {
  if (!isOpen) return null

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="drawer-content test-scenarios-drawer"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="scenarios-title"
      >
        <div className="drawer-header">
          <div>
            <h2 id="scenarios-title">Test scenarios</h2>
            <p>Simulate different monitoring conditions for testing</p>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="scenario-list">
            {scenarios.map(scenario => {
              const Icon = scenario.icon
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className="scenario-item"
                  onClick={() => {
                    onScenario(scenario.id)
                    onClose()
                  }}
                >
                  <div className="scenario-icon">
                    <Icon size={20} />
                  </div>
                  <div className="scenario-content">
                    <div className="scenario-label">{scenario.label}</div>
                    <div className="scenario-description">{scenario.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="scenario-note">
            <Wifi size={16} />
            <p>
              Test scenarios don't affect real data sources. They only change the displayed verdict
              and status for demonstration purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
