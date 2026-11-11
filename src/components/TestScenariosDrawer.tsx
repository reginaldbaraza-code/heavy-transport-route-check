import { AlertTriangle, Construction, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface TestScenariosDrawerProps {
  open: boolean
  onClose: () => void
  onSimulateClosure: () => void
  onSimulateRoadwork: () => void
  onClearSimulations: () => void
}

export default function TestScenariosDrawer({
  open,
  onClose,
  onSimulateClosure,
  onSimulateRoadwork,
  onClearSimulations,
}: TestScenariosDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside ref={drawerRef} className="test-scenarios-drawer" role="complementary" aria-label="Test scenarios">
        <header className="drawer-header">
          <div>
            <strong>Test scenarios</strong>
            <p>Demo controls</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="drawer-content">
          <p className="drawer-note">
            Simulate different road conditions to test the verdict logic. These controls only work in demo mode and do
            not affect live data.
          </p>
          <div className="scenario-buttons">
            <button type="button" className="btn-secondary scenario-btn" onClick={onSimulateClosure}>
              <AlertTriangle size={16} />
              Simulate closure
            </button>
            <button type="button" className="btn-secondary scenario-btn" onClick={onSimulateRoadwork}>
              <Construction size={16} />
              Add roadworks
            </button>
            <button type="button" className="btn-text" onClick={onClearSimulations}>
              Clear simulations
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
