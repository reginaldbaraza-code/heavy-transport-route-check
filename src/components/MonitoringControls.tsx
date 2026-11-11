import { Pause, Play, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MonitoringControlsProps {
  monitoring: boolean
  onStop: () => void
  onResume: () => void
  departureTime?: string
  nextCheckIn?: number // minutes
}

export default function MonitoringControls({
  monitoring,
  onStop,
  onResume,
  departureTime,
  nextCheckIn,
}: MonitoringControlsProps) {
  const [countdown, setCountdown] = useState<string>('')

  useEffect(() => {
    if (!departureTime || !monitoring) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const departure = new Date(departureTime).getTime()
      const diff = departure - now

      if (diff <= 0) {
        setCountdown('Departure time reached')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m until departure`)
      } else {
        setCountdown(`${minutes}m until departure`)
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 30000) // Update every 30 seconds

    return () => clearInterval(timer)
  }, [departureTime, monitoring])

  return (
    <div className="monitoring-controls">
      <div className="monitoring-status">
        <Clock size={18} />
        <div>
          <strong>{monitoring ? 'Monitoring until departure' : 'Monitoring paused'}</strong>
          <p>
            {monitoring && nextCheckIn && `Next refresh in ${nextCheckIn} min`}
            {monitoring && countdown && ` · ${countdown}`}
            {!monitoring && 'Click Resume to restart checks'}
          </p>
        </div>
      </div>
      {monitoring ? (
        <button type="button" className="btn-secondary monitoring-btn" onClick={onStop}>
          <Pause size={16} />
          Stop monitoring
        </button>
      ) : (
        <button type="button" className="btn-primary monitoring-btn" onClick={onResume}>
          <Play size={16} />
          Resume monitoring
        </button>
      )}
    </div>
  )
}
