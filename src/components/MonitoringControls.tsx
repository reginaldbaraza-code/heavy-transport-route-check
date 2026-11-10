import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

type Props = {
  isMonitoring: boolean
  onToggle: () => void
  nextCheckAt?: string
  intervalMinutes?: number
}

export function MonitoringControls({ isMonitoring, onToggle, nextCheckAt, intervalMinutes }: Props) {
  const [timeUntilNext, setTimeUntilNext] = useState<string>('')

  useEffect(() => {
    if (!isMonitoring || !nextCheckAt) {
      setTimeUntilNext('')
      return
    }

    const update = () => {
      const next = new Date(nextCheckAt).getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((next - now) / 1000))
      
      if (diff === 0) {
        setTimeUntilNext('Checking now...')
        return
      }

      const minutes = Math.floor(diff / 60)
      const seconds = diff % 60
      setTimeUntilNext(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [isMonitoring, nextCheckAt])

  return (
    <div className="monitoring-controls">
      <div className="monitoring-status-bar">
        {isMonitoring ? (
          <div className="monitoring-active-bar">
            <div className="monitoring-indicator live">
              <span className="monitoring-dot"></span>
              <span>Monitoring active</span>
            </div>
            {timeUntilNext && (
              <span className="monitoring-countdown">Next refresh in {timeUntilNext}</span>
            )}
          </div>
        ) : (
          <div className="monitoring-inactive-bar">
            <span className="monitoring-status-text">Monitoring paused</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className={`btn-monitoring ${isMonitoring ? 'monitoring-active' : 'monitoring-paused'}`}
        onClick={onToggle}
      >
        {isMonitoring ? (
          <>
            <Pause size={16} />
            Stop monitoring
          </>
        ) : (
          <>
            <Play size={16} />
            Resume monitoring
          </>
        )}
      </button>
    </div>
  )
}
